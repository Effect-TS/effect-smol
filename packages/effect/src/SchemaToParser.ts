/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import { defaultParseOptions } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as Result from "./Result.js"
import * as Scheduler from "./Scheduler.js"
import type * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"
import type * as SchemaCheck from "./SchemaCheck.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaResult from "./SchemaResult.js"

/**
 * @category Constructing
 * @since 4.0.0
 */
export function makeSchemaResult<S extends Schema.Top>(schema: S) {
  const parser = run<S["Type"], never>(SchemaAST.typeAST(schema.ast))
  return (input: S["~type.make.in"], options?: Schema.MakeOptions): SchemaResult.SchemaResult<S["Type"]> => {
    const parseOptions: SchemaAST.ParseOptions = { "~variant": "make", ...options?.parseOptions }
    return parser(input, parseOptions)
  }
}

/**
 * @category Constructing
 * @since 4.0.0
 */
export function makeSync<S extends Schema.Top>(schema: S) {
  const parser = makeSchemaResult(schema)
  return (input: S["~type.make.in"], options?: Schema.MakeOptions): S["Type"] => {
    return Result.getOrThrowWith(
      toResult(input, parser(input, options)),
      (issue) => new Error("makeSync failure", { cause: issue })
    )
  }
}

/**
 * @category Asserting
 * @since 4.0.0
 */
export function is<T, E, RE>(codec: Schema.Codec<T, E, never, RE>): (input: unknown) => input is T {
  return refinement(codec.ast)
}

/** @internal */
export function refinement<T>(ast: SchemaAST.AST): (input: unknown) => input is T {
  const parser = asResult(run<T, never>(SchemaAST.typeAST(ast)))
  return (input): input is T => {
    return Result.isOk(parser(input, defaultParseOptions))
  }
}

/**
 * @category Asserting
 * @since 4.0.0
 */
export function asserts<T, E, RE>(codec: Schema.Codec<T, E, never, RE>): (input: unknown) => asserts input is T {
  const parser = asResult(run<T, never>(SchemaAST.typeAST(codec.ast)))
  return (input): asserts input is T => {
    const result = parser(input, defaultParseOptions)
    if (Result.isErr(result)) {
      throw new Error("asserts failure", { cause: result.err })
    }
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownSchemaResult<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): (input: unknown, options?: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, RD> {
  return run<T, RD>(codec.ast)
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeSchemaResult: <T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
) => (input: E, options?: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, RD> = decodeUnknownSchemaResult

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownPromise<T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
): (input: unknown, options?: SchemaAST.ParseOptions) => Promise<T> {
  return asPromise(decodeUnknownSchemaResult(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodePromise<T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
): (input: E, options?: SchemaAST.ParseOptions) => Promise<T> {
  return asPromise(decodeResult(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownEffect<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): (input: unknown, options?: SchemaAST.ParseOptions) => Effect.Effect<T, SchemaIssue.Issue, RD> {
  return asEffect(decodeUnknownSchemaResult(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeEffect: <T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
) => (input: E, options?: SchemaAST.ParseOptions) => Effect.Effect<T, SchemaIssue.Issue, RD> = decodeUnknownEffect

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownResult<T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
): (input: unknown, options?: SchemaAST.ParseOptions) => Result.Result<T, SchemaIssue.Issue> {
  return asResult(decodeUnknownSchemaResult(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeResult: <T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
) => (input: E, options?: SchemaAST.ParseOptions) => Result.Result<T, SchemaIssue.Issue> = decodeUnknownResult

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownOption<T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
): (input: unknown, options?: SchemaAST.ParseOptions) => Option.Option<T> {
  return asOption(decodeUnknownSchemaResult(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeOption: <T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
) => (input: E, options?: SchemaAST.ParseOptions) => Option.Option<T> = decodeUnknownOption

/**
 * @category Decoding
 * @since 4.0.0
 */
export function decodeUnknownSync<T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
): (input: unknown, options?: SchemaAST.ParseOptions) => T {
  return asSync(decodeUnknownSchemaResult(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeSync: <T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
) => (input: E, options?: SchemaAST.ParseOptions) => T = decodeUnknownSync

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownSchemaResult<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): (input: unknown, options?: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<E, RE> {
  return run<E, RE>(SchemaAST.flip(codec.ast))
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeSchemaResult: <T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
) => (input: T, options?: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<E, RE> = encodeUnknownSchemaResult

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownPromise = <T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
): (input: unknown, options?: SchemaAST.ParseOptions) => Promise<E> => asPromise(encodeUnknownSchemaResult(codec))

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodePromise: <T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
) => (input: T, options?: SchemaAST.ParseOptions) => Promise<E> = encodeUnknownPromise

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownEffect<T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
): (input: unknown, options?: SchemaAST.ParseOptions) => Effect.Effect<E, SchemaIssue.Issue, RE> {
  return asEffect(encodeUnknownSchemaResult(codec))
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeEffect: <T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
) => (input: T, options?: SchemaAST.ParseOptions) => Effect.Effect<E, SchemaIssue.Issue, RE> = encodeUnknownEffect

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownResult<T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
): (input: unknown, options?: SchemaAST.ParseOptions) => Result.Result<E, SchemaIssue.Issue> {
  return asResult(encodeUnknownSchemaResult(codec))
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeResult: <T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
) => (input: T, options?: SchemaAST.ParseOptions) => Result.Result<E, SchemaIssue.Issue> = encodeUnknownResult

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownOption<T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
): (input: unknown, options?: SchemaAST.ParseOptions) => Option.Option<E> {
  return asOption(encodeUnknownSchemaResult(codec))
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeOption: <T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
) => (input: T, options?: SchemaAST.ParseOptions) => Option.Option<E> = encodeUnknownOption

/**
 * @category Encoding
 * @since 4.0.0
 */
export function encodeUnknownSync<T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
): (input: unknown, options?: SchemaAST.ParseOptions) => E {
  return asSync(encodeUnknownSchemaResult(codec))
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeSync: <T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
) => (input: T, options?: SchemaAST.ParseOptions) => E = encodeUnknownSync

function run<T, R>(ast: SchemaAST.AST) {
  const parser = go<T, R>(ast)
  return (input: unknown, options?: SchemaAST.ParseOptions): SchemaResult.SchemaResult<T, R> => {
    const oinput = Option.some(input)
    const oa = parser(oinput, options ?? defaultParseOptions)
    return oa.pipe(SchemaResult.flatMap((oa) => {
      if (Option.isNone(oa)) {
        return SchemaResult.fail(new SchemaIssue.InvalidValue(oa))
      }
      return SchemaResult.succeed(oa.value)
    }))
  }
}

function asPromise<T, E>(
  parser: (input: E, options?: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, never>
): (input: E, options?: SchemaAST.ParseOptions) => Promise<T> {
  return (input: E, options?: SchemaAST.ParseOptions) => SchemaResult.asPromise(parser(input, options))
}

function asEffect<T, E, R>(
  parser: (input: E, options?: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, R>
): (input: E, options?: SchemaAST.ParseOptions) => Effect.Effect<T, SchemaIssue.Issue, R> {
  return (input: E, options?: SchemaAST.ParseOptions) => SchemaResult.asEffect(parser(input, options))
}

function asResult<T, E, R>(
  parser: (input: E, options?: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, R>
): (input: E, options?: SchemaAST.ParseOptions) => Result.Result<T, SchemaIssue.Issue> {
  return (input: E, options?: SchemaAST.ParseOptions) => toResult(input, parser(input, options))
}

function asOption<T, E, R>(
  parser: (input: E, options?: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, R>
): (input: E, options?: SchemaAST.ParseOptions) => Option.Option<T> {
  const parserResult = asResult(parser)
  return (input: E, options?: SchemaAST.ParseOptions) => Result.getOk(parserResult(input, options))
}

function asSync<T, E, R>(
  parser: (input: E, options?: SchemaAST.ParseOptions) => SchemaResult.SchemaResult<T, R>
): (input: E, options?: SchemaAST.ParseOptions) => T {
  const parserResult = asResult(parser)
  return (input: E, options?: SchemaAST.ParseOptions) => Result.getOrThrow(parserResult(input, options))
}

function toResult<T, E, R>(input: E, sr: SchemaResult.SchemaResult<T, R>): Result.Result<T, SchemaIssue.Issue> {
  if (Result.isResult(sr)) {
    return sr
  }
  const scheduler = new Scheduler.MixedScheduler()
  const fiber = Effect.runFork(sr as Effect.Effect<T, SchemaIssue.Issue>, { scheduler })
  scheduler.flush()
  const exit = fiber.unsafePoll()

  if (exit) {
    if (Exit.isSuccess(exit)) {
      // If the effect successfully resolves, wrap the value in an Ok
      return Result.ok(exit.value)
    }
    const cause = exit.cause
    if (cause.failures.length === 1) {
      const failure = cause.failures[0]
      if (failure._tag === "Fail") {
        // The effect executed synchronously but failed due to an `Issue`
        return Result.err(failure.error)
      }
    }
    // The effect executed synchronously but failed due to a defect (e.g., a missing dependency)
    return Result.err(new SchemaIssue.Forbidden(Option.some(input), { cause }))
  }

  // The effect could not be resolved synchronously, meaning it performs async work
  return Result.err(
    new SchemaIssue.Forbidden(
      Option.some(input),
      {
        message:
          "cannot be be resolved synchronously, this is caused by using runSync on an effect that performs async work"
      }
    )
  )
}

/** @internal */
export interface Parser<T, R> {
  (input: Option.Option<unknown>, options: SchemaAST.ParseOptions): SchemaResult.SchemaResult<Option.Option<T>, R>
}

const go = SchemaAST.memoize(
  <T, R>(ast: SchemaAST.AST): Parser<T, R> => {
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

      let srou: SchemaResult.SchemaResult<Option.Option<unknown>, unknown> = SchemaResult.succeed(ou)
      if (encoding) {
        const links = encoding
        const len = links.length
        for (let i = len - 1; i >= 0; i--) {
          const link = links[i]
          const to = link.to
          const parser = go(to)
          srou = srou.pipe(SchemaResult.flatMap((ou) => parser(ou, options)))
          if (link.transformation._tag === "Transformation") {
            const getter = link.transformation.decode
            srou = srou.pipe(SchemaResult.flatMap((ou) => getter.run(ou, options)))
          } else {
            srou = link.transformation.decode(srou, options)
          }
        }
        srou = srou.pipe(SchemaResult.mapError((issue) => new SchemaIssue.Encoding(ast, ou, issue)))
      }

      const parser = ast.parser(go)
      let sroa = srou.pipe(SchemaResult.flatMap((ou) => parser(ou, options)))

      if (ast.checks) {
        const errorsAllOption = options?.errors === "all"

        function runChecks(
          checks: ReadonlyArray<SchemaCheck.SchemaCheck<unknown>>,
          value: unknown,
          issues: Array<SchemaIssue.Issue>
        ) {
          for (const check of checks) {
            switch (check._tag) {
              case "Filter": {
                const issue = check.run(value, ast, options)
                if (issue) {
                  issues.push(new SchemaIssue.Check(value, check, issue))
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
        sroa = sroa.pipe(SchemaResult.flatMap((oa) => {
          if (Option.isSome(oa)) {
            const value = oa.value
            const issues: Array<SchemaIssue.Issue> = []

            runChecks(checks, value, issues)

            if (Arr.isNonEmptyArray(issues)) {
              return Effect.fail(new SchemaIssue.Composite(ast, oa, issues))
            }
          }
          return Effect.succeed(oa)
        }))
        const isStructural = SchemaAST.isTupleType(ast) || SchemaAST.isTypeLiteral(ast) ||
          (SchemaAST.isDeclaration(ast) && ast.typeParameters.length > 0)
        if (errorsAllOption && isStructural && Option.isSome(ou)) {
          sroa = sroa.pipe(
            SchemaResult.catch((issue) => {
              const issues: Array<SchemaIssue.Issue> = []
              runChecks(checks.filter((check) => check.annotations?.["~structural"]), ou.value, issues)
              const out: SchemaIssue.Issue = Arr.isNonEmptyArray(issues)
                ? issue._tag === "Composite" && issue.ast === ast
                  ? new SchemaIssue.Composite(ast, issue.actual, [...issue.issues, ...issues])
                  : new SchemaIssue.Composite(ast, ou, [issue, ...issues])
                : issue
              return SchemaResult.fail(out)
            })
          )
        }
      }

      return yield* (Result.isResult(sroa) ? Effect.fromResult(sroa) : sroa)
    })
  }
)
