import * as Boolean from "../Boolean.ts"
import * as Array from "../collections/Array.ts"
import type * as Combiner from "../data/Combiner.ts"
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Struct from "../data/Struct.ts"
import * as UndefinedOr from "../data/UndefinedOr.ts"
import { memoize } from "../Function.ts"
import * as Number from "../Number.ts"
import type * as Annotations from "../schema/Annotations.ts"
import * as AST from "../schema/AST.ts"
import type * as Schema from "../schema/Schema.ts"
import type * as FastCheck from "../testing/FastCheck.ts"

const arbitraryMemoMap = new WeakMap<AST.AST, Schema.LazyArbitrary<any>>()

function getAnnotation(
  annotations: Annotations.Annotations | undefined
):
  | Annotations.Arbitrary.Constraint
  | Annotations.Arbitrary.Constraint
  | Annotations.Arbitrary.Override<any, ReadonlyArray<any>>
  | undefined
{
  return annotations?.arbitrary as any
}

function getCheckAnnotation(
  check: AST.Check<any>
): Annotations.Arbitrary.Constraint | Annotations.Arbitrary.Constraint | undefined {
  return check.annotations?.arbitrary as any
}

function applyChecks(
  ast: AST.AST,
  filters: Array<AST.Filter<any>>,
  arbitrary: FastCheck.Arbitrary<any>
) {
  return filters.map((filter) => (a: any) => filter.run(a, ast, AST.defaultParseOptions) === undefined).reduce(
    (acc, filter) => acc.filter(filter),
    arbitrary
  )
}

function isUniqueArrayConstraintsCustomCompare(
  constraint: Annotations.Arbitrary.ArrayConstraints | undefined
): constraint is Annotations.Arbitrary.ArrayConstraints & FastCheck.UniqueArrayConstraintsCustomCompare<any> {
  return constraint?.comparator !== undefined
}

function array(
  fc: typeof FastCheck,
  ctx: Annotations.Arbitrary.Context | undefined,
  item: FastCheck.Arbitrary<any>
) {
  const constraint = ctx?.constraints?.array
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

const max = UndefinedOr.getReducer(Number.ReducerMax)
const min = UndefinedOr.getReducer(Number.ReducerMin)
const or = UndefinedOr.getReducer(Boolean.ReducerOr)
const concat = UndefinedOr.getReducer(Array.getReducerConcat())

const combiner: Combiner.Combiner<any> = Struct.getCombiner({
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
  _tag: "string" | "number" | "bigint" | "array" | "date",
  constraints: Annotations.Arbitrary.Constraint["constraint"],
  constraint: Annotations.Arbitrary.FastCheckConstraint
): Annotations.Arbitrary.Constraint["constraint"] {
  const c = constraints[_tag]
  if (c) {
    return { ...constraints, [_tag]: combiner.combine(c, constraint) }
  } else {
    return { ...constraints, [_tag]: constraint }
  }
}

const constraintsKeys = {
  string: null,
  number: null,
  bigint: null,
  array: null,
  date: null
}

function isConstraintKey(key: string): key is keyof Annotations.Arbitrary.Constraint["constraint"] {
  return key in constraintsKeys
}

/** @internal */
export function mergeFiltersConstraints(
  filters: Array<AST.Filter<any>>
): (ctx: Annotations.Arbitrary.Context | undefined) => Annotations.Arbitrary.Context | undefined {
  const annotations = filters.map(getCheckAnnotation).filter(Predicate.isNotUndefined)
  return (ctx) => {
    const constraints = annotations.reduce((acc: Annotations.Arbitrary.Constraint["constraint"], c) => {
      switch (c._tag) {
        case "Constraint": {
          const keys = Object.keys(c.constraint)
          for (const key of keys) {
            if (isConstraintKey(key)) {
              acc = merge(key, acc, c.constraint[key]!)
            }
          }
          return acc
        }
      }
    }, ctx?.constraints || {})
    return { ...ctx, constraints }
  }
}

function resetContext(ctx: Annotations.Arbitrary.Context | undefined): Annotations.Arbitrary.Context | undefined {
  if (ctx) {
    return { ...ctx, constraints: undefined }
  }
}

/** @internal */
export const go = memoize((ast: AST.AST): Schema.LazyArbitrary<any> => {
  if (ast.checks) {
    const filters = AST.getFilters(ast.checks)
    const f = mergeFiltersConstraints(filters)
    const out = go(AST.replaceChecks(ast, undefined))
    return (fc, ctx) => applyChecks(ast, filters, out(fc, f(ctx)))
  }
  // ---------------------------------------------
  // handle annotations
  // ---------------------------------------------
  const annotation = getAnnotation(ast.annotations)
  if (annotation) {
    switch (annotation._tag) {
      case "Override": {
        if (AST.isDeclaration(ast)) {
          const typeParameters = ast.typeParameters.map(go)
          return (fc, ctx) => annotation.override(typeParameters.map((tp) => tp(fc, resetContext(ctx))))(fc, ctx)
        }
        return annotation.override([])
      }
      case "Constraint":
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
        const constraint = ctx?.constraints?.string
        const patterns = constraint?.patterns
        if (patterns) {
          return fc.oneof(...patterns.map((pattern) => fc.stringMatching(new RegExp(pattern))))
        }
        return fc.string(constraint)
      }
    case "NumberKeyword":
      return (fc, ctx) => {
        const constraint = ctx?.constraints?.number
        if (constraint?.isInteger) {
          return fc.integer(constraint)
        }
        return fc.float(constraint)
      }
    case "BooleanKeyword":
      return (fc) => fc.boolean()
    case "BigIntKeyword":
      return (fc, ctx) => fc.bigInt(ctx?.constraints?.bigint ?? {})
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
      const get = AST.memoizeThunk(() => go(ast.thunk()))
      const out: Schema.LazyArbitrary<any> = (fc, ctx) =>
        fc.constant(null).chain(() => get()(fc, { ...ctx, isSuspend: true }))
      arbitraryMemoMap.set(ast, out)
      return out
    }
  }
})
