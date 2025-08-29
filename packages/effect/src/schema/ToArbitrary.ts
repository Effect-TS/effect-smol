/**
 * @since 4.0.0
 */
import * as Array from "../collections/Array.ts"
import * as Combiner from "../data/Combiner.ts"
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Struct from "../data/Struct.ts"
import * as UndefinedOr from "../data/UndefinedOr.ts"
import { defaultParseOptions, memoizeThunk } from "../internal/schema/util.ts"
import * as Boolean from "../primitives/Boolean.ts"
import * as Number from "../primitives/Number.ts"
import * as FastCheck from "../testing/FastCheck.ts"
import type * as Annotations from "./Annotations.ts"
import * as AST from "./AST.ts"
import type * as Check from "./Check.ts"
import type * as Schema from "./Schema.ts"

/**
 * @since 4.0.0
 */
export declare namespace Annotation {
  /**
   * @since 4.0.0
   */
  export type Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly _tag: "Declaration"
    readonly declaration: (
      typeParameters: { readonly [K in keyof TypeParameters]: FastCheck.Arbitrary<TypeParameters[K]["Type"]> }
    ) => (fc: typeof FastCheck, context?: Context) => FastCheck.Arbitrary<T>
  }

  /**
   * @since 4.0.0
   */
  export interface StringConstraints extends FastCheck.StringSharedConstraints {
    readonly _tag: "StringConstraints"
    readonly patterns?: readonly [string, ...Array<string>]
  }

  /**
   * @since 4.0.0
   */
  export interface NumberConstraints extends FastCheck.FloatConstraints {
    readonly _tag: "NumberConstraints"
    readonly isInteger?: boolean
  }

  /**
   * @since 4.0.0
   */
  export interface BigIntConstraints extends FastCheck.BigIntConstraints {
    readonly _tag: "BigIntConstraints"
  }

  /**
   * @since 4.0.0
   */
  export interface ArrayConstraints extends FastCheck.ArrayConstraints {
    readonly _tag: "ArrayConstraints"
    readonly comparator?: (a: any, b: any) => boolean
  }

  /**
   * @since 4.0.0
   */
  export interface DateConstraints extends FastCheck.DateConstraints {
    readonly _tag: "DateConstraints"
  }

  /**
   * @since 4.0.0
   */
  export type Any =
    | StringConstraints
    | NumberConstraints
    | BigIntConstraints
    | ArrayConstraints
    | DateConstraints

  /**
   * @since 4.0.0
   */
  export type Constraint = {
    readonly _tag: "Constraint"
    readonly constraint: Any
  }

  /**
   * @since 4.0.0
   */
  export type Constraints = {
    readonly _tag: "Constraints"
    readonly constraints: {
      readonly StringConstraints?: StringConstraints | undefined
      readonly NumberConstraints?: NumberConstraints | undefined
      readonly BigIntConstraints?: BigIntConstraints | undefined
      readonly ArrayConstraints?: ArrayConstraints | undefined
      readonly DateConstraints?: DateConstraints | undefined
    }
  }

  /**
   * @since 4.0.0
   */
  export type Override<T> = {
    readonly _tag: "Override"
    readonly override: (fc: typeof FastCheck, context?: Context) => FastCheck.Arbitrary<T>
  }
}

/**
 * @since 4.0.0
 */
export interface Context {
  /**
   * This flag is set to `true` when the current schema is a suspend. The goal
   * is to avoid infinite recursion when generating arbitrary values for
   * suspends, so implementations should try to avoid excessive recursion.
   */
  readonly isSuspend?: boolean | undefined
  readonly constraints?: Annotation.Constraints["constraints"] | undefined
}

/**
 * @since 4.0.0
 */
export type LazyArbitrary<T> = (fc: typeof FastCheck, context?: Context) => FastCheck.Arbitrary<T>

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
  return makeLazy(schema)(FastCheck, {})
}

const arbitraryMemoMap = new WeakMap<AST.AST, LazyArbitrary<any>>()

function getArbitraryAnnotation(
  annotations: Annotations.Annotations | undefined
):
  | Annotation.Declaration<any, ReadonlyArray<any>>
  | Annotation.Constraint
  | Annotation.Constraints
  | Annotation.Override<any>
  | undefined
{
  return annotations?.arbitrary as any
}

function getCheckAnnotation(
  check: Check.Check<any>
): Annotation.Constraint | Annotation.Constraints | undefined {
  return check.annotations?.arbitrary as any
}

function applyChecks(
  ast: AST.AST,
  filters: Array<Check.Filter<any>>,
  arbitrary: FastCheck.Arbitrary<any>
) {
  return filters.map((filter) => (a: any) => filter.run(a, ast, defaultParseOptions) === undefined).reduce(
    (acc, filter) => acc.filter(filter),
    arbitrary
  )
}

function isUniqueArrayConstraintsCustomCompare(
  constraint: Annotation.ArrayConstraints | undefined
): constraint is Annotation.ArrayConstraints & FastCheck.UniqueArrayConstraintsCustomCompare<any> {
  return constraint?.comparator !== undefined
}

function array(
  fc: typeof FastCheck,
  ctx: Context | undefined,
  item: FastCheck.Arbitrary<any>
) {
  const constraint = ctx?.constraints?.ArrayConstraints
  const array = isUniqueArrayConstraintsCustomCompare(constraint)
    ? fc.uniqueArray(item, constraint)
    : fc.array(item, constraint)
  if (ctx?.isSuspend) {
    return fc.oneof(
      { maxDepth: 2, depthIdentifier: "" },
      fc.constant([]),
      array
    )
  }
  return array
}

const last = UndefinedOr.getReducer(Combiner.last())
const max = UndefinedOr.getReducer(Number.ReducerMax)
const min = UndefinedOr.getReducer(Number.ReducerMin)
const or = UndefinedOr.getReducer(Boolean.ReducerOr)
const concat = UndefinedOr.getReducer(Array.getReducerConcat())

const combiner: Combiner.Combiner<any> = Struct.getCombiner({
  _tag: last,
  isInteger: or,
  max: min,
  maxExcluded: or,
  maxLength: min,
  min: max,
  minExcluded: or,
  minLength: max,
  noDefaultInfinity: or,
  noInteger: or,
  noInvalidDate: or,
  noNaN: or,
  patterns: concat,
  comparator: or
}, {
  omitKeyWhen: Predicate.isUndefined
})

function merge(
  constraints: Annotation.Constraints["constraints"],
  constraint: Annotation.Any
): Annotation.Constraints["constraints"] {
  const _tag = constraint._tag
  const c = constraints[_tag]
  if (c) {
    return { ...constraints, [constraint._tag]: combiner.combine(c, constraint) }
  } else {
    return { ...constraints, [constraint._tag]: constraint }
  }
}

/** @internal */
export function mergeFiltersConstraints(
  filters: Array<Check.Filter<any>>
): (ctx: Context | undefined) => Context | undefined {
  const annotations = filters.map(getCheckAnnotation).filter(Predicate.isNotUndefined)
  return (ctx) => {
    const constraints = annotations.reduce((acc: Annotation.Constraints["constraints"], c) => {
      switch (c._tag) {
        case "Constraint":
          return merge(acc, c.constraint)
        case "Constraints":
          return Object.values(c.constraints).reduce((acc, v) => {
            if (v) {
              return merge(acc, v)
            }
            return acc
          }, acc)
      }
    }, ctx?.constraints || {})
    return { ...ctx, constraints }
  }
}

function resetContext(ctx: Context | undefined): Context | undefined {
  if (ctx) {
    return { ...ctx, constraints: undefined }
  }
}

const go = AST.memoize((ast: AST.AST): LazyArbitrary<any> => {
  // ---------------------------------------------
  // handle annotations
  // ---------------------------------------------
  if (ast.checks) {
    const filters = AST.getFilters(ast.checks)
    const f = mergeFiltersConstraints(filters)
    const out = go(AST.replaceChecks(ast, undefined))
    return (fc, ctx) => applyChecks(ast, filters, out(fc, f(ctx)))
  }
  const annotation = getArbitraryAnnotation(ast.annotations)
  if (annotation) {
    switch (annotation._tag) {
      case "Declaration": {
        if (AST.isDeclaration(ast)) {
          const typeParameters = ast.typeParameters.map(go)
          return (fc, ctx) => annotation.declaration(typeParameters.map((tp) => tp(fc, resetContext(ctx))))(fc, ctx)
        }
        throw new Error("Declaration annotation found on non-declaration AST")
      }
      case "Override":
        return annotation.override
      case "Constraint":
      case "Constraints":
        throw new Error("Constraint annotation found on non-constrained AST")
    }
  }
  switch (ast._tag) {
    case "Declaration":
      throw new Error(`cannot generate Arbitrary, no annotation found for declaration`, { cause: ast })
    case "NullKeyword":
      return (fc) => fc.constant(null)
    case "VoidKeyword":
    case "UndefinedKeyword":
      return (fc) => fc.constant(undefined)
    case "NeverKeyword":
      throw new Error(`cannot generate Arbitrary, no annotation found for never`, { cause: ast })
    case "UnknownKeyword":
    case "AnyKeyword":
      return (fc) => fc.anything()
    case "StringKeyword":
      return (fc, ctx) => {
        const constraint = ctx?.constraints?.StringConstraints
        const patterns = constraint?.patterns
        if (patterns) {
          return fc.oneof(...patterns.map((pattern) => fc.stringMatching(new RegExp(pattern))))
        }
        return fc.string(constraint)
      }
    case "NumberKeyword":
      return (fc, ctx) => {
        const constraint = ctx?.constraints?.NumberConstraints
        if (constraint?.isInteger) {
          return fc.integer(constraint)
        }
        return fc.float(constraint)
      }
    case "BooleanKeyword":
      return (fc) => fc.boolean()
    case "BigIntKeyword":
      return (fc, ctx) => fc.bigInt(ctx?.constraints?.BigIntConstraints ?? {})
    case "SymbolKeyword":
      return (fc) => fc.string().map(Symbol.for)
    case "LiteralType":
      return (fc) => fc.constant(ast.literal)
    case "UniqueSymbol":
      return (fc) => fc.constant(ast.symbol)
    case "ObjectKeyword":
      return (fc) => fc.oneof(fc.object(), fc.array(fc.anything()))
    case "Enums":
      return go(AST.enumsToLiterals(ast))
    case "TemplateLiteral":
      return (fc) => fc.stringMatching(AST.getTemplateLiteralRegExp(ast))
    case "TupleType":
      return (fc, ctx) => {
        const reset = resetContext(ctx)
        // ---------------------------------------------
        // handle elements
        // ---------------------------------------------
        const elements: Array<FastCheck.Arbitrary<Option.Option<any>>> = ast.elements.map((ast) => {
          const out = go(ast)(fc, reset)
          if (!AST.isOptional(ast)) {
            return out.map(Option.some)
          }
          return out.chain((a) => fc.boolean().map((b) => b ? Option.some(a) : Option.none()))
        })
        let out = fc.tuple(...elements).map(Array.getSomes)
        // ---------------------------------------------
        // handle rest element
        // ---------------------------------------------
        if (Array.isReadonlyArrayNonEmpty(ast.rest)) {
          const len = ast.elements.length
          const [head, ...tail] = ast.rest.map((ast) => go(ast)(fc, reset))

          const rest = array(fc, ast.elements.length === 0 ? ctx : reset, head)
          out = out.chain((as) => {
            if (as.length < len) {
              return fc.constant(as)
            }
            return rest.map((rest) => [...as, ...rest])
          })
          // ---------------------------------------------
          // handle post rest elements
          // ---------------------------------------------
          if (tail.length > 0) {
            const t = fc.tuple(...tail)
            out = out.chain((as) => {
              if (as.length < len) {
                return fc.constant(as)
              }
              return t.map((rest) => [...as, ...rest])
            })
          }
        }
        return out
      }
    case "TypeLiteral":
      return (fc, ctx) => {
        const reset = resetContext(ctx)
        // ---------------------------------------------
        // handle property signatures
        // ---------------------------------------------
        const pss: any = {}
        const requiredKeys: Array<PropertyKey> = []
        for (const ps of ast.propertySignatures) {
          if (!AST.isOptional(ps.type)) {
            requiredKeys.push(ps.name)
          }
          pss[ps.name] = go(ps.type)(fc, reset)
        }
        let out = fc.record<any>(pss, { requiredKeys })
        // ---------------------------------------------
        // handle index signatures
        // ---------------------------------------------
        for (const is of ast.indexSignatures) {
          const entry = fc.tuple(go(is.parameter)(fc, reset), go(is.type)(fc, reset))
          const entries = array(fc, ast.propertySignatures.length === 0 ? ctx : reset, entry)
          out = out.chain((o) => {
            return entries.map((entries) => {
              return {
                ...Object.fromEntries(entries),
                ...o
              }
            })
          })
        }
        return out
      }
    case "UnionType":
      return (fc, ctx) => fc.oneof(...ast.types.map((ast) => go(ast)(fc, ctx)))
    case "Suspend": {
      const memo = arbitraryMemoMap.get(ast)
      if (memo) {
        return memo
      }
      const get = memoizeThunk(() => go(ast.thunk()))
      const out: LazyArbitrary<any> = (fc, ctx) => fc.constant(null).chain(() => get()(fc, { ...ctx, isSuspend: true }))
      arbitraryMemoMap.set(ast, out)
      return out
    }
  }
})
