/**
 * @since 4.0.0
 */
import * as Array from "./Array.js"
import * as FastCheck from "./FastCheck.js"
import type { SchemaCheck } from "./index.js"
import { defaultParseOptions, memoizeThunk } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import type * as Schema from "./Schema.js"
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import * as SchemaAST from "./SchemaAST.js"

/**
 * @since 4.0.0
 */
export declare namespace Annotation {
  /**
   * @since 4.0.0
   */
  export type Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly type: "declaration"
    readonly declaration: (
      typeParameters: { readonly [K in keyof TypeParameters]: LazyArbitrary<TypeParameters[K]["Type"]> }
    ) => (fc: typeof FastCheck) => FastCheck.Arbitrary<T>
  }
}

/**
 * @since 4.0.0
 */
export type LazyArbitrary<T> = (fc: typeof FastCheck) => FastCheck.Arbitrary<T>

/**
 * @since 4.0.0
 */
export function makeLazy<T>(schema: Schema.Schema<T>): LazyArbitrary<T> {
  return go(schema.ast)
}

/**
 * @since 4.0.0
 */
export function make<T>(schema: Schema.Schema<T>): FastCheck.Arbitrary<T> {
  return makeLazy(schema)(FastCheck)
}

const arbitraryMemoMap = new WeakMap<SchemaAST.AST, LazyArbitrary<any>>()

function isAnnotation(u: unknown): u is Annotation.Declaration<any, ReadonlyArray<any>> {
  return u !== undefined
}

/**
 * @since 4.0.0
 */
export function getAnnotation(
  annotated: SchemaAnnotations.Annotated
): Annotation.Declaration<any, ReadonlyArray<any>> | undefined {
  const out = annotated.annotations?.arbitrary
  if (isAnnotation(out)) {
    return out
  }
}

function filter(
  ast: SchemaAST.AST,
  checks: SchemaAST.Checks,
  arbitrary: FastCheck.Arbitrary<any>
): FastCheck.Arbitrary<any> {
  const filters: Array<(a: any) => boolean> = []
  function go(check: SchemaCheck.SchemaCheck<any>) {
    switch (check._tag) {
      case "Filter":
        return filters.push((a) => {
          const result = check.run(a, ast, defaultParseOptions)
          return result === undefined
        })
      case "FilterGroup":
        return check.checks.forEach(go)
    }
  }
  checks.forEach(go)
  return filters.reduce((acc, filter) => acc.filter(filter), arbitrary)
}

const go = SchemaAST.memoize((ast: SchemaAST.AST): LazyArbitrary<any> => {
  if (ast.checks) {
    const checks = ast.checks
    const out = go(SchemaAST.replaceChecks(ast, undefined))
    return (fc) => filter(ast, checks, out(fc))
  }
  switch (ast._tag) {
    case "Declaration": {
      const annotation = getAnnotation(ast)
      if (annotation) {
        return (fc) => annotation.declaration(ast.typeParameters.map((tp) => go(tp)))(fc)
      }
      throw new Error(`cannot generate Arbitrary, no annotation found for declaration`, { cause: ast })
    }
    case "NullKeyword":
      return (fc) => fc.constant(null)
    case "UndefinedKeyword":
      return (fc) => fc.constant(undefined)
    case "NeverKeyword":
      throw new Error(`cannot generate Arbitrary, no annotation found for never`, { cause: ast })
    case "UnknownKeyword":
    case "AnyKeyword":
    case "VoidKeyword":
      return (fc) => fc.anything()
    case "StringKeyword":
      return (fc) => fc.string()
    case "NumberKeyword":
      return (fc) => fc.float()
    case "BooleanKeyword":
      return (fc) => fc.boolean()
    case "BigIntKeyword":
      return (fc) => fc.bigInt()
    case "SymbolKeyword":
      return (fc) => fc.string().map(Symbol.for)
    case "LiteralType":
      return (fc) => fc.constant(ast.literal)
    case "UniqueSymbol":
      return (fc) => fc.constant(ast.symbol)
    case "ObjectKeyword":
      return (fc) => fc.oneof(fc.object(), fc.array(fc.anything()))
    case "Enums":
      return go(SchemaAST.enumsToLiterals(ast))
    case "TemplateLiteral":
      return (fc) => fc.stringMatching(SchemaAST.getTemplateLiteralCapturingRegExp(ast))
    case "TupleType":
      return (fc) => {
        // ---------------------------------------------
        // handle elements
        // ---------------------------------------------
        const elements: Array<FastCheck.Arbitrary<Option.Option<any>>> = ast.elements.map((ast) => {
          const out = go(ast)(fc)
          if (ast.context?.isOptional === true) {
            return out.chain((a) => fc.boolean().map((b) => b ? Option.some(a) : Option.none()))
          }
          return out.map(Option.some)
        })
        let out = fc.tuple(...elements).map(Array.getSomes)
        // ---------------------------------------------
        // handle rest element
        // ---------------------------------------------
        if (Array.isNonEmptyReadonlyArray(ast.rest)) {
          const rest = ast.rest.map((ast) => go(ast)(fc))
          const [head, ...tail] = rest
          const h = fc.array(head)
          out = out.chain((as) => h.map((rest) => [...as, ...rest]))
          // ---------------------------------------------
          // handle post rest elements
          // ---------------------------------------------
          if (tail.length > 0) {
            const t = fc.tuple(...tail)
            out = out.chain((as) => t.map((rest) => [...as, ...rest]))
          }
        }
        return out
      }
    case "TypeLiteral":
      return (fc) => {
        // ---------------------------------------------
        // handle property signatures
        // ---------------------------------------------
        const pss: any = {}
        const requiredKeys: Array<PropertyKey> = []
        for (const ps of ast.propertySignatures) {
          if (ps.type.context?.isOptional !== true) {
            requiredKeys.push(ps.name)
          }
          pss[ps.name] = go(ps.type)(fc)
        }
        let out = fc.record<any>(pss, { requiredKeys })
        // ---------------------------------------------
        // handle index signatures
        // ---------------------------------------------
        for (const is of ast.indexSignatures) {
          const entries = fc.array(fc.tuple(go(is.parameter)(fc), go(is.type)(fc)))
          out = out.chain((o) => entries.map((entries) => ({ ...Object.fromEntries(entries), ...o })))
        }
        return out
      }
    case "UnionType":
      return (fc) => fc.oneof(...ast.types.map((ast) => go(ast)(fc)))
    case "Suspend": {
      const memo = arbitraryMemoMap.get(ast)
      if (memo) {
        return memo
      }
      const get = memoizeThunk(() => go(ast.thunk()))
      const out: LazyArbitrary<any> = (fc) => fc.constant(null).chain(() => get()(fc))
      arbitraryMemoMap.set(ast, out)
      return out
    }
  }
})
