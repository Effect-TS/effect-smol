/**
 * @since 4.0.0
 */
import * as Array from "./Array.js"
import * as FastCheck from "./FastCheck.js"
import { defaultParseOptions, memoizeThunk } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import type * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"
import type * as SchemaCheck from "./SchemaCheck.js"

/**
 * @since 4.0.0
 */
export declare namespace Annotation {
  /**
   * @since 4.0.0
   */
  export interface StringFragment extends FastCheck.StringSharedConstraints {
    readonly type: "string"
    readonly patterns?: readonly [string, ...Array<string>]
  }

  /**
   * @since 4.0.0
   */
  export interface NumberFragment extends FastCheck.FloatConstraints {
    readonly type: "number"
    readonly isInteger?: boolean
  }

  /**
   * @since 4.0.0
   */
  export interface BigIntFragment extends FastCheck.BigIntConstraints {
    readonly type: "bigint"
  }

  /**
   * @since 4.0.0
   */
  export interface ArrayFragment extends FastCheck.ArrayConstraints {
    readonly type: "array"
  }

  /**
   * @since 4.0.0
   */
  export interface DateFragment extends FastCheck.DateConstraints {
    readonly type: "date"
  }

  /**
   * @since 4.0.0
   */
  export type FragmentKey = "string" | "number" | "bigint" | "array" | "date"

  /**
   * @since 4.0.0
   */
  export type Constraint = StringFragment | NumberFragment | BigIntFragment | ArrayFragment | DateFragment

  /**
   * @since 4.0.0
   */
  export type Fragment = {
    readonly type: "fragment"
    readonly fragment: Constraint
  }

  /**
   * @since 4.0.0
   */
  export type Fragments = {
    readonly type: "fragments"
    readonly fragments: {
      readonly string?: StringFragment | undefined
      readonly number?: NumberFragment | undefined
      readonly bigint?: BigIntFragment | undefined
      readonly array?: ArrayFragment | undefined
      readonly date?: DateFragment | undefined
    }
  }

  /**
   * @since 4.0.0
   */
  export type Override<T> = {
    readonly type: "override"
    readonly override: (fc: typeof FastCheck, context?: Context) => FastCheck.Arbitrary<T>
  }

  /**
   * @since 4.0.0
   */
  export type Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly type: "declaration"
    readonly declaration: (
      typeParameters: { readonly [K in keyof TypeParameters]: FastCheck.Arbitrary<TypeParameters[K]["Type"]> }
    ) => (fc: typeof FastCheck, context?: Context) => FastCheck.Arbitrary<T>
  }
}

/**
 * @since 4.0.0
 */
export interface Context {
  readonly isSuspend?: boolean | undefined
  readonly fragments?: Annotation.Fragments["fragments"] | undefined
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

const arbitraryMemoMap = new WeakMap<SchemaAST.AST, LazyArbitrary<any>>()

/**
 * @since 4.0.0
 */
export function getAnnotation(
  ast: SchemaAST.AST
): Annotation.Declaration<any, ReadonlyArray<any>> | Annotation.Override<any> | undefined {
  return ast.annotations?.arbitrary as any
}

/**
 * @since 4.0.0
 */
export function getCheckAnnotation(
  check: SchemaCheck.SchemaCheck<any>
): Annotation.Fragment | Annotation.Fragments | undefined {
  return check.annotations?.arbitrary as any
}

function applyChecks(
  ast: SchemaAST.AST,
  filters: Array<SchemaCheck.Filter<any>>,
  arbitrary: FastCheck.Arbitrary<any>
) {
  return filters.map((filter) => (a: any) => filter.run(a, ast, defaultParseOptions) === undefined).reduce(
    (acc, filter) => acc.filter(filter),
    arbitrary
  )
}

function array(
  fc: typeof FastCheck,
  ctx: Context | undefined,
  item: FastCheck.Arbitrary<any>
) {
  if (ctx?.isSuspend) {
    return fc.oneof(
      { maxDepth: 2, depthIdentifier: "" },
      fc.constant([]),
      fc.array(item, ctx?.fragments?.array)
    )
  }
  return fc.array(item, ctx?.fragments?.array)
}

type Semigroup<A> = (x: A, y: A) => A

function lift<A>(S: Semigroup<A>): Semigroup<A | undefined> {
  return (x, y) => x === undefined ? y : y === undefined ? x : S(x, y)
}

function struct<A>(semigroups: { readonly [K in keyof A]: Semigroup<A[K]> }): Semigroup<A> {
  return (x, y) => {
    const keys = Object.keys(semigroups) as Array<keyof A>
    const out = {} as A
    for (const key of keys) {
      const merge = semigroups[key](x[key], y[key])
      if (merge !== undefined) {
        out[key] = merge
      }
    }
    return out
  }
}

const last = lift((_, y) => y)
const max = lift(Math.max)
const min = lift(Math.min)
const or = lift((x, y) => x || y)
const concat = lift<ReadonlyArray<unknown>>((x, y) => x.concat(y))

const semigroup: Semigroup<Partial<Annotation.Constraint>> = struct({
  type: last,
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
  patterns: concat
}) as any

function merge(
  fragments: Annotation.Fragments["fragments"],
  constraint: Annotation.Constraint
): Annotation.Fragments["fragments"] {
  const type = constraint.type
  const fragment = fragments[type]
  if (fragment) {
    return { ...fragments, [constraint.type]: semigroup(fragment, constraint) }
  } else {
    return { ...fragments, [constraint.type]: constraint }
  }
}

/** @internal */
export function mergeChecksFragments(
  checks: Array<SchemaCheck.Filter<any>>
): (ctx: Context | undefined) => Context | undefined {
  const annotations = checks.map(getCheckAnnotation).filter(Predicate.isNotUndefined)
  return (ctx) => {
    const fragments = annotations.reduce((acc: Annotation.Fragments["fragments"], f) => {
      switch (f.type) {
        case "fragment":
          return merge(acc, f.fragment)
        case "fragments":
          return Object.values(f.fragments).reduce((acc, v) => {
            if (v) {
              return merge(acc, v)
            }
            return acc
          }, acc)
      }
    }, ctx?.fragments || {})
    return { ...ctx, fragments }
  }
}

function resetContext(ctx: Context | undefined): Context | undefined {
  if (ctx) {
    return { ...ctx, fragments: undefined }
  }
}

const go = SchemaAST.memoize((ast: SchemaAST.AST): LazyArbitrary<any> => {
  // ---------------------------------------------
  // handle refinements
  // ---------------------------------------------
  if (ast.checks) {
    const filters = SchemaAST.getFilters(ast.checks)
    const f = mergeChecksFragments(filters)
    const out = go(SchemaAST.replaceChecks(ast, undefined))
    return (fc, ctx) => applyChecks(ast, filters, out(fc, f(ctx)))
  }
  // ---------------------------------------------
  // handle annotations
  // ---------------------------------------------
  const annotation = getAnnotation(ast)
  if (annotation) {
    switch (annotation.type) {
      case "declaration": {
        const typeParameters = (SchemaAST.isDeclaration(ast) ? ast.typeParameters : []).map(go)
        return (fc, ctx) => annotation.declaration(typeParameters.map((tp) => tp(fc, resetContext(ctx))))(fc, ctx)
      }
      case "override":
        return annotation.override
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
        const fragment = ctx?.fragments?.string
        const patterns = fragment?.patterns
        if (patterns) {
          return fc.oneof(...patterns.map((pattern) => fc.stringMatching(new RegExp(pattern))))
        }
        return fc.string(fragment)
      }
    case "NumberKeyword":
      return (fc, ctx) => {
        const fragment = ctx?.fragments?.number
        if (fragment?.isInteger) {
          return fc.integer(fragment)
        }
        return fc.float(fragment)
      }
    case "BooleanKeyword":
      return (fc) => fc.boolean()
    case "BigIntKeyword":
      return (fc, ctx) => fc.bigInt(ctx?.fragments?.bigint ?? {})
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
      return (fc) => fc.stringMatching(SchemaAST.getTemplateLiteralRegExp(ast))
    case "TupleType":
      return (fc, ctx) => {
        const ctx_ = resetContext(ctx)
        // ---------------------------------------------
        // handle elements
        // ---------------------------------------------
        const elements: Array<FastCheck.Arbitrary<Option.Option<any>>> = ast.elements.map((ast) => {
          const out = go(ast)(fc, ctx_)
          if (!ast.context?.isOptional) {
            return out.map(Option.some)
          }
          return out.chain((a) => fc.boolean().map((b) => b ? Option.some(a) : Option.none()))
        })
        let out = fc.tuple(...elements).map(Array.getSomes)
        // ---------------------------------------------
        // handle rest element
        // ---------------------------------------------
        if (Array.isNonEmptyReadonlyArray(ast.rest)) {
          const len = ast.elements.length
          const rest = ast.rest.map((ast) => go(ast)(fc, ctx_))
          const [head, ...tail] = rest

          out = out.chain((as) => {
            if (as.length < len) {
              return fc.constant(as)
            }
            return array(fc, ctx, head).map((rest) => [...as, ...rest])
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
        const ctx_ = resetContext(ctx)
        // ---------------------------------------------
        // handle property signatures
        // ---------------------------------------------
        const pss: any = {}
        const requiredKeys: Array<PropertyKey> = []
        for (const ps of ast.propertySignatures) {
          if (!ps.type.context?.isOptional) {
            requiredKeys.push(ps.name)
          }
          pss[ps.name] = go(ps.type)(fc, ctx_)
        }
        let out = fc.record<any>(pss, { requiredKeys })
        // ---------------------------------------------
        // handle index signatures
        // ---------------------------------------------
        for (const is of ast.indexSignatures) {
          const entry = fc.tuple(go(is.parameter)(fc, ctx_), go(is.type)(fc, ctx_))
          out = out.chain((o) => {
            return array(fc, ctx, entry).map((entries) => {
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
