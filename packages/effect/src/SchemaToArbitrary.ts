/**
 * @since 4.0.0
 */
import * as Array from "./Array.js"
import * as FastCheck from "./FastCheck.js"
import { formatPath, memoizeThunk } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import type * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"

/**
 * @since 4.0.0
 */
export function make<T>(schema: Schema.Schema<T>): FastCheck.Arbitrary<T> {
  return go(schema.ast, [])
}

const arbitraryMemoMap = new WeakMap<SchemaAST.AST, FastCheck.Arbitrary<any>>()

function isAnnotation(
  u: unknown
): u is (
  typeParameters: ReadonlyArray<FastCheck.Arbitrary<any>>
) => (fc: typeof FastCheck) => FastCheck.Arbitrary<any> {
  return Predicate.isFunction(u)
}

function go(ast: SchemaAST.AST, path: ReadonlyArray<PropertyKey>): FastCheck.Arbitrary<any> {
  switch (ast._tag) {
    case "Declaration": {
      const annotation = ast.annotations?.arbitrary
      if (isAnnotation(annotation)) {
        return annotation(ast.typeParameters.map((tp) => go(tp, path)))(FastCheck)
      }
      throw new Error(`cannot generate Arbitrary for ${ast._tag} at ${formatPath(path) || "root"}`)
    }
    case "NullKeyword":
      return FastCheck.constant(null)
    case "UndefinedKeyword":
      return FastCheck.constant(undefined)
    case "NeverKeyword":
      throw new Error(`cannot generate Arbitrary for ${ast._tag} at ${formatPath(path) || "root"}`)
    case "UnknownKeyword":
    case "AnyKeyword":
    case "VoidKeyword":
      return FastCheck.anything()
    case "StringKeyword":
      return FastCheck.string()
    case "NumberKeyword":
      return FastCheck.float()
    case "BooleanKeyword":
      return FastCheck.boolean()
    case "BigIntKeyword":
      return FastCheck.bigInt()
    case "SymbolKeyword":
      return FastCheck.string().map(Symbol.for)
    case "LiteralType":
      return FastCheck.constant(ast.literal)
    case "UniqueSymbol":
      return FastCheck.constant(ast.symbol)
    case "ObjectKeyword":
      return FastCheck.oneof(FastCheck.object(), FastCheck.array(FastCheck.anything()))
    case "Enums":
      return go(SchemaAST.enumsToLiterals(ast), path)
    case "TemplateLiteral":
      return FastCheck.stringMatching(SchemaAST.getTemplateLiteralCapturingRegExp(ast))
    case "TupleType": {
      // ---------------------------------------------
      // handle elements
      // ---------------------------------------------
      const elements: Array<FastCheck.Arbitrary<Option.Option<any>>> = ast.elements.map((ast, i) => {
        const out = go(ast, [...path, i])
        if (ast.context?.isOptional === true) {
          return out.chain((a) => FastCheck.boolean().map((b) => b ? Option.some(a) : Option.none()))
        }
        return out.map(Option.some)
      })
      let out = FastCheck.tuple(...elements).map(Array.getSomes)
      // ---------------------------------------------
      // handle rest element
      // ---------------------------------------------
      if (Array.isNonEmptyReadonlyArray(ast.rest)) {
        const rest = ast.rest.map((ast, i) => go(ast, [...path, elements.length + i]))
        const [head, ...tail] = rest
        const h = FastCheck.array(head)
        out = out.chain((as) => h.map((rest) => [...as, ...rest]))
        // ---------------------------------------------
        // handle post rest elements
        // ---------------------------------------------
        if (tail.length > 0) {
          const t = FastCheck.tuple(...tail)
          out = out.chain((as) => t.map((rest) => [...as, ...rest]))
        }
      }
      return out
    }
    case "TypeLiteral": {
      // ---------------------------------------------
      // handle property signatures
      // ---------------------------------------------
      const pss: any = {}
      const requiredKeys: Array<PropertyKey> = []
      for (const ps of ast.propertySignatures) {
        if (ps.type.context?.isOptional !== true) {
          requiredKeys.push(ps.name)
        }
        pss[ps.name] = go(ps.type, [...path, ps.name])
      }
      let out = FastCheck.record<any>(pss, { requiredKeys })
      // ---------------------------------------------
      // handle index signatures
      // ---------------------------------------------
      for (const is of ast.indexSignatures) {
        const pair = FastCheck.tuple(go(is.parameter, path), go(is.type, path))
        const tuples = FastCheck.array(pair)
        out = out.chain((o) => tuples.map((tuples) => ({ ...Object.fromEntries(tuples), ...o })))
      }
      return out
    }
    case "UnionType":
      return FastCheck.oneof(...ast.types.map((ast) => go(ast, path)))
    case "Suspend": {
      const memo = arbitraryMemoMap.get(ast)
      if (memo) {
        return memo
      }
      const get = memoizeThunk(() => go(ast.thunk(), path))
      const out: FastCheck.Arbitrary<any> = FastCheck.constant(null).chain(() => get())
      arbitraryMemoMap.set(ast, out)
      return out
    }
  }
}
