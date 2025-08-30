/**
 * @since 4.0.0
 */
import * as Cause from "../Cause.ts"
import * as Filter from "../data/Filter.ts"
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Effect from "../Effect.ts"
import { constant, constVoid } from "../Function.ts"
import * as internalEffect from "../internal/effect.ts"
import { defaultParseOptions } from "../internal/schema/util.ts"
import * as AST from "./AST.ts"
import * as Issue from "./Issue.ts"
import type * as Schema from "./Schema.ts"

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownEffect<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): (input: unknown, options?: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, RD> {
  return run<T, RD>(codec.ast)
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownEffect<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): (input: unknown, options?: AST.ParseOptions) => Effect.Effect<E, Issue.Issue, RE> {
  return run<E, RE>(AST.flip(codec.ast))
}

function run<T, R>(ast: AST.AST) {
  const parser = go(ast)
  return (input: unknown, options?: AST.ParseOptions): Effect.Effect<T, Issue.Issue, R> =>
    handleResult(parser(input as any, options ?? defaultParseOptions))
}

export const missing: unique symbol = Symbol.for("effect/schema/ToParser2/missing")
export type missing = typeof missing

const handleResult = Effect.flatMapEager((oa: any) => {
  if (oa === missing) {
    return Effect.fail(new Issue.InvalidValue(Option.none()))
  }
  return Effect.succeed(oa)
})

/** @internal */
export interface Parser {
  (input: unknown | missing, options: AST.ParseOptions): Effect.Effect<{} | missing, Issue.Issue, any>
}

const go = AST.memoize((ast: AST.AST): Parser => {
  switch (ast._tag) {
    case "AnyKeyword":
      return anyParser
    case "UnknownKeyword":
      return anyParser
    case "NeverKeyword":
      return neverParser
    case "StringKeyword":
      return stringParser
    case "NumberKeyword":
      return numberParser
    case "BooleanKeyword":
      return booleanParser
    case "BigIntKeyword":
      return bigintParser
    case "SymbolKeyword":
      return symbolParser
    case "ObjectKeyword":
      return objectParser
    case "UndefinedKeyword":
      return undefinedParser
    case "NullKeyword":
      return nullParser
    case "VoidKeyword":
      return voidParser
    case "Declaration": {
      const run = ast.run(ast.typeParameters)
      return (input, options) => input === missing ? succeedMissing : run(input, ast, options)
    }
    case "Suspend":
      return go(ast.thunk())
    case "LiteralType":
      return constParser(ast, ast.literal)
    case "UniqueSymbol":
      return constParser(ast, ast.symbol)
    case "Enums": {
      const values = new Set(ast.enums.map((_) => _[1]))
      return refinementParser(ast, (u): u is any => values.has(u as any))
    }
    case "TypeLiteral": {
      const properties = ast.propertySignatures.map((ps) => {
        return {
          ps,
          name: ps.name,
          keyAnnotations: ps.type.context?.annotations,
          parser: go(ps.type),
          isOptional: AST.isOptional(ps.type),
          issueMissing: new Issue.Pointer([ps.name], new Issue.MissingKey(ps.type.context?.annotations))
        } as const
      })
      const propertyLen = properties.length
      return (input, options) => {
        if (input === missing) {
          return succeedMissing
        } else if (!Predicate.isRecord(input)) {
          return Effect.fail(new Issue.InvalidType(ast, optionFromInput(input)))
        }

        const out: Record<PropertyKey, unknown> = {}
        let effects: Array<Effect.Effect<any, Issue.Issue, any>> | undefined
        for (let i = 0; i < propertyLen; i++) {
          const p = properties[i]
          const value = Object.hasOwn(input, p.name) ? input[p.name] as {} : missing
          const eff = p.parser(value, options)
          if (!internalEffect.effectIsExit(eff)) {
            effects ??= []
            effects.push(Effect.matchEffect(eff, {
              onFailure: (issue) => Effect.fail(new Issue.Composite(ast, optionFromInput(input), [issue])),
              onSuccess: (value) => {
                if (value !== missing) {
                  out[p.name] = value
                  return Effect.void
                } else if (!p.isOptional) {
                  return Effect.fail(new Issue.Composite(ast, optionFromInput(input), [p.issueMissing]))
                }
                return Effect.void
              }
            }))
          } else if (eff._tag === "Failure") {
            const issue = Cause.filterError(eff.cause)
            if (Filter.isFail(issue)) {
              return Effect.failCause(issue.fail)
            }
            // TODO: collect all issues
            return Effect.fail(new Issue.Composite(ast, optionFromInput(input), [issue]))
          } else if (eff.value !== missing) {
            out[p.name] = eff.value
          } else if (!p.isOptional) {
            return Effect.fail(new Issue.Composite(ast, optionFromInput(input), [p.issueMissing]))
          }
        }

        if (effects === undefined) {
          return Effect.succeed(out)
        }

        let i = 0
        const len = effects.length
        return Effect.as(
          Effect.whileLoop({
            while: () => i < len,
            body: () => effects[i++],
            step: constVoid
          }),
          out
        )
      }
    }
    case "UnionType":
      return (input, options) => {
        if (input === missing) {
          return succeedMissing
        }
        const candidates = AST.getCandidates(input, ast.types)
        const oneOf = ast.mode === "oneOf"
        let out: {} | missing = missing
        const successes: Array<AST.AST> = []
        let effects: Array<Effect.Effect<any, Issue.Issue, any>> | undefined
        const issues: Array<Issue.Issue> = []
        for (let i = 0; i < candidates.length; i++) {
          const candidate = candidates[i]
          const eff = go(candidate)(input, options)
          if (!internalEffect.effectIsExit(eff)) {
            effects ??= []
            effects.push(Effect.matchEffect(eff, {
              onFailure(issue) {
                issues.push(issue)
                return Effect.void
              },
              onSuccess(value) {
                successes.push(candidate)
                if (oneOf && out !== missing) {
                  return Effect.fail(new Issue.OneOf(ast, input, successes))
                }
                out = value
                return Effect.void
              }
            }))
            continue
          } else if (eff._tag === "Failure") {
            const issue = Cause.filterError(eff.cause)
            if (Filter.isFail(issue)) {
              return Effect.failCause(issue.fail)
            }
            issues.push(issue)
            continue
          }
          successes.push(candidate)
          if (oneOf && out !== missing) {
            return Effect.fail(new Issue.OneOf(ast, input, successes))
          }
          out = eff.value
          if (!oneOf && out !== missing) {
            return Effect.succeed(out)
          }
        }

        if (effects === undefined) {
          return Effect.fail(new Issue.AnyOf(ast, optionFromInput(input), issues))
        }

        let i = 0
        const len = effects.length
        return Effect.flatMap(
          Effect.whileLoop({
            while() {
              if (!oneOf && out !== missing) {
                return false
              }
              return i < len
            },
            body: () => effects[i++],
            step: constVoid
          }),
          () =>
            out !== missing ? Effect.succeed(out) : Effect.fail(new Issue.AnyOf(ast, optionFromInput(input), issues))
        )
      }
  }
  return constant(Effect.die(`Unimplemented: ${ast._tag}`))
})

const succeedMissing = Effect.succeed(missing)

const optionFromInput = (input: unknown): Option.Option<unknown> =>
  input === missing ? Option.none() : Option.some(input)

const neverParser: Parser = (input, _options) =>
  input === missing
    ? succeedMissing
    : Effect.fail(new Issue.InvalidType(AST.neverKeyword, optionFromInput(input)))

const anyParser: Parser = (input, _options) =>
  input === missing
    ? succeedMissing
    : Effect.succeed(input as {})

const constParser = <const A>(ast: AST.AST, value: A): Parser => {
  const succeed = Effect.succeed(value as {})
  return (input, _options) =>
    input === missing
      ? succeedMissing
      : input === value
      ? succeed
      : Effect.fail(new Issue.InvalidType(ast, optionFromInput(input)))
}

const refinementParser = <A>(ast: AST.AST, refinement: (u: unknown) => u is A): Parser => (input, _options) =>
  input === missing
    ? succeedMissing
    : refinement(input)
    ? Effect.succeed(input as {})
    : Effect.fail(new Issue.InvalidType(ast, optionFromInput(input)))

const voidParser = constParser(AST.voidKeyword, undefined)
const undefinedParser = constParser(AST.undefinedKeyword, undefined)
const nullParser = constParser(AST.nullKeyword, null)
const stringParser = refinementParser(AST.stringKeyword, Predicate.isString)
const numberParser = refinementParser(AST.numberKeyword, Predicate.isNumber)
const booleanParser = refinementParser(AST.booleanKeyword, Predicate.isBoolean)
const bigintParser = refinementParser(AST.bigIntKeyword, Predicate.isBigInt)
const symbolParser = refinementParser(AST.symbolKeyword, Predicate.isSymbol)
const objectParser = refinementParser(AST.objectKeyword, Predicate.isObject)
