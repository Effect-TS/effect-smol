/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import * as Predicate from "./Predicate.js"
import * as Result from "./Result.js"
import * as Scheduler from "./Scheduler.js"
import type * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"

/**
 * @category model
 * @since 4.0.0
 */
export type SchemaParserResult<A, R> = Result.Result<A, SchemaAST.Issue> | Effect.Effect<A, SchemaAST.Issue, R>

const defaultParseOptions: SchemaAST.ParseOptions = {}

const mergeParseOptions = (
  options: SchemaAST.ParseOptions | undefined,
  overrideOptions: SchemaAST.ParseOptions | undefined
): SchemaAST.ParseOptions => {
  if (!Predicate.isObject(overrideOptions)) {
    return options ?? defaultParseOptions
  }
  if (options === undefined) {
    return overrideOptions ?? defaultParseOptions
  }
  return { ...options, ...overrideOptions }
}

const astUnknownParserResult = <A, R>(
  ast: SchemaAST.AST,
  options?: SchemaAST.ParseOptions
) => {
  const parser = goMemo(ast, true)
  return (u: unknown, overrideOptions?: SchemaAST.ParseOptions): SchemaParserResult<A, R> =>
    parser(u, mergeParseOptions(options, overrideOptions))
}

const runSyncResult = <A, R>(
  ast: SchemaAST.AST,
  actual: unknown,
  self: Effect.Effect<A, SchemaAST.Issue, R>
): Result.Result<A, SchemaAST.Issue> => {
  const scheduler = new Scheduler.MixedScheduler()
  const fiber = Effect.runFork(self as Effect.Effect<A, SchemaAST.Issue>, { scheduler })
  scheduler.flush()
  const exit = fiber.unsafePoll()

  if (exit) {
    if (Exit.isSuccess(exit)) {
      // If the effect successfully resolves, wrap the value in a Right
      return Result.ok(exit.value)
    }
    const cause = exit.cause
    if (cause.failures.length === 1) {
      const failure = cause.failures[0]
      if (failure._tag === "Fail") {
        // The effect executed synchronously but failed due to a ParseIssue
        return Result.err(failure.error)
      }
    }
    // The effect executed synchronously but failed due to a defect (e.g., a missing dependency)
    return Result.err(new SchemaAST.ForbiddenIssue(ast, actual, cause.failures.map(String).join("\n")))
  }

  // The effect could not be resolved synchronously, meaning it performs async work
  return Result.err(
    new SchemaAST.ForbiddenIssue(
      ast,
      actual,
      "cannot be be resolved synchronously, this is caused by using runSync on an effect that performs async work"
    )
  )
}

const astUnknownSync = <A, R>(
  ast: SchemaAST.AST,
  options?: SchemaAST.ParseOptions
) => {
  const parser = astUnknownParserResult<A, R>(ast, options)
  return (u: unknown, overrideOptions?: SchemaAST.ParseOptions): A => {
    const out = parser(u, overrideOptions)
    const res = Result.isResult(out) ? out : runSyncResult(ast, u, out)
    return Result.getOrThrow(res)
  }
}

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownParserResult = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  options?: SchemaAST.ParseOptions
) => astUnknownParserResult<A, R>(schema.ast, options)

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownSync = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  options?: SchemaAST.ParseOptions
) => astUnknownSync<A, R>(schema.ast, options)

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownParserResult = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  options?: SchemaAST.ParseOptions
) => astUnknownParserResult<A, R>(SchemaAST.typeAST(schema.ast), options)

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownSync = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  options?: SchemaAST.ParseOptions
) => astUnknownSync<A, R>(SchemaAST.typeAST(schema.ast), options)

interface Parser {
  (i: unknown, options: SchemaAST.ParseOptions): SchemaParserResult<any, any>
}

function all<A, R>(
  items: ReadonlyArray<readonly [PropertyKey, SchemaParserResult<A, R>]>,
  options: SchemaAST.ParseOptions
):
  | [Array<[PropertyKey, A]>, Array<[PropertyKey, SchemaAST.Issue]>]
  | Effect.Effect<[Array<[PropertyKey, A]>, Array<[PropertyKey, SchemaAST.Issue]>], never, R>
{
  const as: Array<[PropertyKey, A]> = []
  const issues: Array<[PropertyKey, SchemaAST.Issue]> = []

  // Helper function to process remaining items effectfully
  function processRemaining(
    startIndex: number
  ): Effect.Effect<[Array<[PropertyKey, A]>, Array<[PropertyKey, SchemaAST.Issue]>], never, R> {
    return Effect.gen(function*() {
      for (let i = startIndex; i < items.length; i++) {
        const [key, spr] = items[i]
        // If spr is synchronous, use it directly; otherwise, yield its effect result.
        const result = Result.isResult(spr) ? spr : yield* Effect.result(spr)
        if (Result.isOk(result)) {
          as.push([key, result.ok])
        } else {
          issues.push([key, result.err])
          if (options.errors !== "all") {
            break
          }
        }
      }
      return [as, issues]
    })
  }

  // Process items synchronously until we hit an effect
  let i = 0
  for (; i < items.length; i++) {
    const [key, spr] = items[i]
    if (!Result.isResult(spr)) {
      // Delegate further processing to the helper if an effect is encountered.
      return processRemaining(i)
    }
    if (Result.isOk(spr)) {
      as.push([key, spr.ok])
    } else {
      issues.push([key, spr.err])
      if (options.errors !== "all") {
        break
      }
    }
  }
  return [as, issues]
}

/** @internal */
export function map<A, B, R>(spr: SchemaParserResult<A, R>, f: (a: A) => B): SchemaParserResult<B, R> {
  return Result.isResult(spr) ? Result.map(spr, f) : Effect.map(spr, f)
}

function goMemo(ast: SchemaAST.AST, isDecoding: boolean): Parser {
  return go(ast, isDecoding)
}

function go(ast: SchemaAST.AST, isDecoding: boolean): Parser {
  switch (ast._tag) {
    case "Declaration":
      throw new Error(`go: unimplemented Declaration`)
    case "StringKeyword":
      return fromRefinement<any>(ast, Predicate.isString)
    case "TypeLiteral": {
      // Handle empty Struct({}) case
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        return fromRefinement(ast, Predicate.isNotNullable)
      }
      return (input, options) => {
        // If the input is not a record, return early with an error
        if (!Predicate.isRecord(input)) {
          return Result.err(new SchemaAST.ValidationIssue(ast, input))
        }
        const propertySignatures = ast.propertySignatures.map((ps) => {
          const parser = goMemo(ps.type, isDecoding)
          const spr = parser(input[ps.name], options)
          return [ps.name, spr] as const
        })

        const results = all(propertySignatures, options)

        if (Effect.isEffect(results)) {
          return Effect.flatMap(results, ([entries, issueEntries]) => {
            const issues = issueEntries.map(([key, issue]) => new SchemaAST.PointerIssue([key], input, issue))
            const output = Object.fromEntries(entries)
            return Arr.isNonEmptyArray(issues) ?
              Effect.fail(new SchemaAST.CompositeIssue(ast, input, issues, output)) :
              Effect.succeed(output)
          })
        }

        const [entries, issueEntries] = results
        const issues = issueEntries.map(([key, issue]) => new SchemaAST.PointerIssue([key], input, issue))
        const output = Object.fromEntries(entries)
        return Arr.isNonEmptyArray(issues) ?
          Result.err(new SchemaAST.CompositeIssue(ast, input, issues, output)) :
          Result.ok(output)
      }
    }
  }
}

const fromRefinement = <A>(ast: SchemaAST.AST, refinement: (u: unknown) => u is A): Parser => (u) =>
  refinement(u) ? Result.ok(u) : Result.err(new SchemaAST.ValidationIssue(ast, u))
