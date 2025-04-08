/**
 * @since 4.0.0
 */
import * as Effect from "./Effect.js"
import * as Result from "./Result.js"
import type * as SchemaAST from "./SchemaAST.js"

/**
 * @category model
 * @since 4.0.0
 */
export type SchemaParserResult<A, R> = Result.Result<A, SchemaAST.Issue> | Effect.Effect<A, SchemaAST.Issue, R>

/**
 * @since 4.0.0
 */
export function map<A, B, R>(spr: SchemaParserResult<A, R>, f: (a: A) => B): SchemaParserResult<B, R> {
  return Result.isResult(spr) ? Result.map(spr, f) : Effect.map(spr, f)
}

/**
 * @since 4.0.0
 */
export function mapError<A, R>(
  spr: SchemaParserResult<A, R>,
  f: (issue: SchemaAST.Issue) => SchemaAST.Issue
): SchemaParserResult<A, R> {
  return Result.isResult(spr) ? Result.mapErr(spr, f) : Effect.mapError(spr, f)
}

/**
 * @since 4.0.0
 */
export function mapBoth<A, B, R>(
  spr: SchemaParserResult<A, R>,
  options: {
    readonly onSuccess: (a: A) => B
    readonly onFailure: (issue: SchemaAST.Issue) => SchemaAST.Issue
  }
): SchemaParserResult<B, R> {
  return Result.isResult(spr)
    ? Result.mapBoth(spr, { onErr: options.onFailure, onOk: options.onSuccess })
    // TODO: replace with `Effect.mapBoth` when it lands
    : spr.pipe(Effect.map(options.onSuccess), Effect.mapError(options.onFailure))
}

/**
 * @since 4.0.0
 */
export function flatMap<A, B, R>(
  spr: SchemaParserResult<A, R>,
  f: (a: A) => SchemaParserResult<B, R>
): SchemaParserResult<B, R> {
  if (Result.isResult(spr)) {
    if (Result.isOk(spr)) {
      const out = f(spr.ok)
      if (Result.isResult(out)) {
        return Result.isOk(out) ? Effect.succeed(out.ok) : Effect.fail(out.err)
      }
      return out
    }
    return Result.err(spr.err)
  }
  return Effect.flatMap(spr, (a) => {
    const out = f(a)
    if (Result.isResult(out)) {
      return Result.isOk(out) ? Effect.succeed(out.ok) : Effect.fail(out.err)
    }
    return out
  })
}

const catch_ = <A, B, R, E, R2>(
  spr: SchemaParserResult<A, R>,
  f: (issue: SchemaAST.Issue) => Result.Result<B, E> | Effect.Effect<B, E, R2>
): Result.Result<A | B, E> | Effect.Effect<A | B, E, R | R2> => {
  if (Result.isResult(spr)) {
    return Result.isErr(spr) ? f(spr.err) : Result.ok(spr.ok)
  }
  return Effect.catch(spr, (issue) => {
    const out = f(issue)
    if (Result.isResult(out)) {
      return Result.isOk(out) ? Effect.succeed(out.ok) : Effect.fail(out.err)
    }
    return out
  })
}

export {
  /**
   * @since 4.0.0
   */
  catch_ as catch
}
