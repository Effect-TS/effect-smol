/**
 * @since 4.0.0
 */

import * as Cause from "../Cause.ts"
import * as Arr from "../collections/Array.ts"
import * as Filter from "../data/Filter.ts"
import * as Option from "../data/Option.ts"
import * as Effect from "../Effect.ts"
import * as Exit from "../Exit.ts"
import { memoize } from "../Function.ts"
import * as AST from "./AST.ts"
import type * as Check from "./Check.ts"
import * as Formatter from "./Formatter.ts"
import * as Issue from "./Issue.ts"
import type * as Schema from "./Schema.ts"

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
      Effect.mapErrorEager(
        parser(input, options),
        (issue) => new Error(Formatter.makeDefault().format(issue), { cause: issue })
      )
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
  const parser = asExit(run<T, never>(AST.typeAST(ast)))
  return <I>(input: I): input is I & T => {
    return Exit.isSuccess(parser(input, AST.defaultParseOptions))
  }
}

/**
 * @category Asserting
 * @since 4.0.0
 */
export function asserts<T, E, RE>(codec: Schema.Codec<T, E, never, RE>) {
  const parser = asExit(run<T, never>(AST.typeAST(codec.ast)))
  return <I>(input: I): asserts input is I & T => {
    const exit = parser(input, AST.defaultParseOptions)
    if (Exit.isFailure(exit)) {
      const issue = Cause.filterError(exit.cause)
      if (Filter.isFail(issue)) {
        throw Cause.squash(issue.fail)
      }
      throw new Error(Formatter.makeDefault().format(issue), { cause: issue })
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
export function decodeUnknownExit<T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
): (input: unknown, options?: AST.ParseOptions) => Exit.Exit<T, Issue.Issue> {
  return asExit(decodeUnknownEffect(codec))
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeExit: <T, E, RE>(
  codec: Schema.Codec<T, E, never, RE>
) => (input: E, options?: AST.ParseOptions) => Exit.Exit<T, Issue.Issue> = decodeUnknownExit

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
export function encodeUnknownExit<T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
): (input: unknown, options?: AST.ParseOptions) => Exit.Exit<E, Issue.Issue> {
  return asExit(encodeUnknownEffect(codec))
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeExit: <T, E, RD>(
  codec: Schema.Codec<T, E, RD, never>
) => (input: T, options?: AST.ParseOptions) => Exit.Exit<E, Issue.Issue> = encodeUnknownExit

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
  return (input: unknown, options?: AST.ParseOptions): Effect.Effect<T, Issue.Issue, R> =>
    Effect.flatMapEager(parser(Option.some(input), options ?? AST.defaultParseOptions), (oa) => {
      if (oa._tag === "None") {
        return Effect.fail(new Issue.InvalidValue(oa))
      }
      return Effect.succeed(oa.value as T)
    })
}

function asPromise<T, E>(
  parser: (input: E, options?: AST.ParseOptions) => Effect.Effect<T, Issue.Issue>
): (input: E, options?: AST.ParseOptions) => Promise<T> {
  return (input: E, options?: AST.ParseOptions) => Effect.runPromise(parser(input, options))
}

function asExit<T, E, R>(
  parser: (input: E, options?: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, R>
): (input: E, options?: AST.ParseOptions) => Exit.Exit<T, Issue.Issue> {
  return (input: E, options?: AST.ParseOptions) => Effect.runSyncExit(parser(input, options) as any)
}

function asOption<T, E, R>(
  parser: (input: E, options?: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, R>
): (input: E, options?: AST.ParseOptions) => Option.Option<T> {
  const parserExit = asExit(parser)
  return (input: E, options?: AST.ParseOptions) => Exit.getSuccess(parserExit(input, options))
}

function asSync<T, E, R>(
  parser: (input: E, options?: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, R>
): (input: E, options?: AST.ParseOptions) => T {
  return (input: E, options?: AST.ParseOptions) =>
    Effect.runSync(
      Effect.mapErrorEager(
        parser(input, options),
        (issue) => new Error(Formatter.makeDefault().format(issue), { cause: issue })
      ) as any
    )
}

/** @internal */
export interface Parser {
  (input: Option.Option<unknown>, options: AST.ParseOptions): Effect.Effect<Option.Option<unknown>, Issue.Issue, any>
}

/** @internal */
export function runChecks<T>(
  checks: ReadonlyArray<Check.Check<T>>,
  value: T,
  issues: Array<Issue.Issue>,
  ast: AST.AST,
  options: AST.ParseOptions
) {
  for (let i = 0; i < checks.length; i++) {
    const check = checks[i]
    if (check._tag === "FilterGroup") {
      runChecks(check.checks, value, issues, ast, options)
    } else {
      const issue = check.run(value, ast, options)
      if (issue) {
        issues.push(new Issue.Filter(value, check, issue))
        if (check.abort || options?.errors !== "all") {
          return
        }
      }
    }
  }
}

const go = memoize(
  (ast: AST.AST): Parser => {
    if (!ast.context && !ast.encoding && !ast.checks) {
      if (ast._tag === "Suspend") {
        let parser: Parser
        return (ou, options) => {
          parser ??= ast.parser(go)
          return parser(ou, options)
        }
      }
      return ast.parser(go)
    }
    let parser: Parser
    const isStructural = AST.isTupleType(ast) || AST.isTypeLiteral(ast) ||
      (AST.isDeclaration(ast) && ast.typeParameters.length > 0)
    return (ou, options) => {
      let encoding = ast.encoding
      if (options["~variant"] === "make" && ast.context) {
        if (ast.context.defaultValue) {
          encoding = ast.context.defaultValue
        }
        if (ast.context.make) {
          encoding = encoding ? [...encoding, ...ast.context.make] : ast.context.make
        }
      }

      let srou: Effect.Effect<Option.Option<unknown>, Issue.Issue, unknown> | undefined
      if (encoding) {
        const links = encoding
        const len = links.length
        for (let i = len - 1; i >= 0; i--) {
          const link = links[i]
          const to = link.to
          const parser = go(to)
          srou = srou ? Effect.flatMapEager(srou, (ou) => parser(ou, options)) : parser(ou, options)
          if (link.transformation._tag === "Transformation") {
            const getter = link.transformation.decode
            srou = Effect.flatMapEager(srou, (ou) => getter.run(ou, options))
          } else {
            srou = link.transformation.decode(srou, options)
          }
        }
        srou = Effect.mapErrorEager(srou!, (issue) => new Issue.Encoding(ast, ou, issue))
      }

      parser ??= ast.parser(go)
      let sroa = srou ? Effect.flatMapEager(srou, (ou) => parser(ou, options)) : parser(ou, options)

      if (ast.checks) {
        const checks = ast.checks
        if (options?.errors === "all" && isStructural && Option.isSome(ou)) {
          sroa = Effect.catchEager(sroa, (issue) => {
            const issues: Array<Issue.Issue> = []
            runChecks(checks.filter((check) => check.annotations?.["~structural"]), ou.value, issues, ast, options)
            const out: Issue.Issue = Arr.isArrayNonEmpty(issues)
              ? issue._tag === "Composite" && issue.ast === ast
                ? new Issue.Composite(ast, issue.actual, [...issue.issues, ...issues])
                : new Issue.Composite(ast, ou, [issue, ...issues])
              : issue
            return Effect.fail(out)
          })
        }
        sroa = Effect.flatMapEager(sroa, (oa) => {
          if (Option.isSome(oa)) {
            const value = oa.value
            const issues: Array<Issue.Issue> = []

            runChecks(checks, value, issues, ast, options)

            if (Arr.isArrayNonEmpty(issues)) {
              return Effect.fail(new Issue.Composite(ast, oa, issues))
            }
          }
          return Effect.succeed(oa)
        })
      }

      return sroa
    }
  }
)
