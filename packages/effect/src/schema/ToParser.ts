/**
 * @since 4.0.0
 */

import * as Arr from "../Array.js"
import * as Effect from "../Effect.js"
import { defaultParseOptions } from "../internal/schema/util.js"
import * as Option from "../Option.js"
import * as Result from "../Result.js"
import * as AST from "./AST.js"
import type * as Check from "./Check.js"
import * as Issue from "./Issue.js"
import type * as Schema from "./Schema.js"

/**
 * @category Constructing
 * @since 4.0.0
 */
export function makeEffect<S extends Schema.Top>(schema: S) {
  const parser = run<S["Type"], never>(AST.typeAST(schema.ast))
  return (input: S["~type.make.in"], options?: Schema.MakeOptions): Effect.Effect<S["Type"], Issue.Issue> => {
    const parseOptions: AST.ParseOptions = { "~variant": "make", ...options?.parseOptions }
    return parser(input, parseOptions)
  }
}

/**
 * @category Constructing
 * @since 4.0.0
 */
export function makeSync<S extends Schema.Top>(schema: S) {
  const parser = makeEffect(schema)
  return (input: S["~type.make.in"], options?: Schema.MakeOptions): S["Type"] => {
    return Effect.runSync(
      parser(input, options).pipe(Effect.mapErrorEager((issue) => new Error("makeSync failure", { cause: issue })))
    )
  }
}

/**
 * @category Asserting
 * @since 4.0.0
 */
export function is<T, E, RE>(codec: Schema.Codec<T, E, never, RE>): <I>(input: I) => input is I & T {
  return refinement<T>(codec.ast)
}

/** @internal */
export function refinement<T>(ast: AST.AST) {
  const parser = asResult(run<T, never>(AST.typeAST(ast)))
  return <I>(input: I): input is I & T => {
    return Result.isSuccess(parser(input, defaultParseOptions))
  }
}

/**
 * @category Asserting
 * @since 4.0.0
 */
export function asserts<T, E, RE>(codec: Schema.Codec<T, E, never, RE>) {
  const parser = asResult(run<T, never>(AST.typeAST(codec.ast)))
  return <I>(input: I): asserts input is I & T => {
    const result = parser(input, defaultParseOptions)
    if (Result.isFailure(result)) {
      throw new Error("asserts failure", { cause: result.failure })
    }
  }
}

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
 * @category Decoding
 * @since 4.0.0
 */
export const decodeEffect: <T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
) => (input: E, options?: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, RD> = decodeUnknownEffect

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownPromise<T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
): (input: unknown, options?: AST.ParseOptions) => Promise<T> {
  return asPromise(decodeUnknownEffect(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodePromise<T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
): (input: E, options?: AST.ParseOptions) => Promise<T> {
  return asPromise(decodeEffect(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownResult<T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
): (input: unknown, options?: AST.ParseOptions) => Result.Result<T, Issue.Issue> {
  return asResult(decodeUnknownEffect(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeResult: <T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
) => (input: E, options?: AST.ParseOptions) => Result.Result<T, Issue.Issue> = decodeUnknownResult

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownOption<T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
): (input: unknown, options?: AST.ParseOptions) => Option.Option<T> {
  return asOption(decodeUnknownEffect(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeOption: <T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
) => (input: E, options?: AST.ParseOptions) => Option.Option<T> = decodeUnknownOption

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownSync<T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
): (input: unknown, options?: AST.ParseOptions) => T {
  return asSync(decodeUnknownEffect(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeSync: <T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
) => (input: E, options?: AST.ParseOptions) => T = decodeUnknownSync

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownEffect<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): (input: unknown, options?: AST.ParseOptions) => Effect.Effect<E, Issue.Issue, RE> {
  return run<E, RE>(AST.flip(codec.ast))
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeEffect: <T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
) => (input: T, options?: AST.ParseOptions) => Effect.Effect<E, Issue.Issue, RE> = encodeUnknownEffect

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownPromise = <T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
): (input: unknown, options?: AST.ParseOptions) => Promise<E> => asPromise(encodeUnknownEffect(codec))

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodePromise: <T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
) => (input: T, options?: AST.ParseOptions) => Promise<E> = encodeUnknownPromise

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownResult<T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
): (input: unknown, options?: AST.ParseOptions) => Result.Result<E, Issue.Issue> {
  return asResult(encodeUnknownEffect(codec))
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeResult: <T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
) => (input: T, options?: AST.ParseOptions) => Result.Result<E, Issue.Issue> = encodeUnknownResult

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownOption<T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
): (input: unknown, options?: AST.ParseOptions) => Option.Option<E> {
  return asOption(encodeUnknownEffect(codec))
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeOption: <T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
) => (input: T, options?: AST.ParseOptions) => Option.Option<E> = encodeUnknownOption

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownSync<T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
): (input: unknown, options?: AST.ParseOptions) => E {
  return asSync(encodeUnknownEffect(codec))
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeSync: <T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
) => (input: T, options?: AST.ParseOptions) => E = encodeUnknownSync

function run<T, R>(ast: AST.AST) {
  const parser = go(ast)
  return (input: unknown, options?: AST.ParseOptions): Effect.Effect<T, Issue.Issue, R> => {
    const oinput = Option.some(input)
    const oa = parser(oinput, options ?? defaultParseOptions)
    return oa.pipe(Effect.flatMapEager((oa) => {
      if (Option.isNone(oa)) {
        return Effect.fail(new Issue.InvalidValue(oa))
      }
      return Effect.succeed(oa.value as T)
    }))
  }
}

function asPromise<T, E>(
  parser: (input: E, options?: AST.ParseOptions) => Effect.Effect<T, Issue.Issue>
): (input: E, options?: AST.ParseOptions) => Promise<T> {
  return (input: E, options?: AST.ParseOptions) => Effect.runPromise(parser(input, options))
}

function asResult<T, E, R>(
  parser: (input: E, options?: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, R>
): (input: E, options?: AST.ParseOptions) => Result.Result<T, Issue.Issue> {
  return (input: E, options?: AST.ParseOptions) => Effect.runSync(Effect.result(parser(input, options)) as any)
}

function asOption<T, E, R>(
  parser: (input: E, options?: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, R>
): (input: E, options?: AST.ParseOptions) => Option.Option<T> {
  const parserResult = asResult(parser)
  return (input: E, options?: AST.ParseOptions) => Result.getSuccess(parserResult(input, options))
}

function asSync<T, E, R>(
  parser: (input: E, options?: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, R>
): (input: E, options?: AST.ParseOptions) => T {
  const parserResult = asResult(parser)
  return (input: E, options?: AST.ParseOptions) => Result.getOrThrow(parserResult(input, options))
}

/** @internal */
export interface Parser {
  (input: Option.Option<unknown>, options: AST.ParseOptions): Effect.Effect<Option.Option<unknown>, Issue.Issue, any>
}

const go = AST.memoize(
  (ast: AST.AST): Parser => {
    return Effect.fnUntraced(function*(ou, options) {
      let encoding = ast.encoding
      if (options["~variant"] === "make" && ast.context) {
        if (ast.context.defaultValue) {
          encoding = ast.context.defaultValue
        }
        if (ast.context.make) {
          encoding = encoding ? [...encoding, ...ast.context.make] : ast.context.make
        }
      }

      let srou: Effect.Effect<Option.Option<unknown>, Issue.Issue, unknown> = Effect.succeed(ou)
      if (encoding) {
        const links = encoding
        const len = links.length
        for (let i = len - 1; i >= 0; i--) {
          const link = links[i]
          const to = link.to
          const parser = go(to)
          srou = srou.pipe(Effect.flatMapEager((ou) => parser(ou, options)))
          if (link.transformation._tag === "Transformation") {
            const getter = link.transformation.decode
            srou = srou.pipe(Effect.flatMapEager((ou) => getter.run(ou, options)))
          } else {
            srou = link.transformation.decode(srou, options)
          }
        }
        srou = srou.pipe(Effect.mapErrorEager((issue) => new Issue.Encoding(ast, ou, issue)))
      }

      const parser = ast.parser(go)
      let sroa = srou.pipe(Effect.flatMapEager((ou) => parser(ou, options)))

      if (ast.checks) {
        const errorsAllOption = options?.errors === "all"

        function runChecks(
          checks: ReadonlyArray<Check.Check<unknown>>,
          value: unknown,
          issues: Array<Issue.Issue>
        ) {
          for (const check of checks) {
            switch (check._tag) {
              case "Filter": {
                const issue = check.run(value, ast, options)
                if (issue) {
                  issues.push(new Issue.Filter(value, check, issue))
                  if (check.abort || !errorsAllOption) {
                    return
                  }
                }
                break
              }
              case "FilterGroup":
                runChecks(check.checks, value, issues)
                break
            }
          }
        }

        const checks = ast.checks
        sroa = sroa.pipe(Effect.flatMapEager((oa) => {
          if (Option.isSome(oa)) {
            const value = oa.value
            const issues: Array<Issue.Issue> = []

            runChecks(checks, value, issues)

            if (Arr.isNonEmptyArray(issues)) {
              return Effect.fail(new Issue.Composite(ast, oa, issues))
            }
          }
          return Effect.succeed(oa)
        }))
        const isStructural = AST.isTupleType(ast) || AST.isTypeLiteral(ast) ||
          (AST.isDeclaration(ast) && ast.typeParameters.length > 0)
        if (errorsAllOption && isStructural && Option.isSome(ou)) {
          sroa = sroa.pipe(
            Effect.catchEager((issue) => {
              const issues: Array<Issue.Issue> = []
              runChecks(checks.filter((check) => check.annotations?.["~structural"]), ou.value, issues)
              const out: Issue.Issue = Arr.isNonEmptyArray(issues)
                ? issue._tag === "Composite" && issue.ast === ast
                  ? new Issue.Composite(ast, issue.actual, [...issue.issues, ...issues])
                  : new Issue.Composite(ast, ou, [issue, ...issues])
                : issue
              return Effect.fail(out)
            })
          )
        }
      }

      return yield* sroa
    })
  }
)
