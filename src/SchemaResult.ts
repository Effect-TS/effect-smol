/**
 * @since 4.0.0
 */
import * as Effect from "./Effect.js"
import type * as Option from "./Option.js"
import * as Result from "./Result.js"
import type * as SchemaAST from "./SchemaAST.js"

/**
 * @category model
 * @since 4.0.0
 */
export type SchemaResult<A, R = never> = Result.Result<A, SchemaAST.Issue> | Effect.Effect<A, SchemaAST.Issue, R>

/**
 * @category constructors
 * @since 4.0.0
 */
export function succeed<A>(a: A): SchemaResult<A> {
  return Result.ok(a)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const succeedNone: SchemaResult<Option.Option<never>> = Result.succeedNone

/**
 * @category constructors
 * @since 4.0.0
 */
export function succeedSome<A>(a: A): SchemaResult<Option.Option<A>> {
  return Result.succeedSome(a)
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function fail(issue: SchemaAST.Issue): SchemaResult<never> {
  return Result.err(issue)
}

/**
 * @since 4.0.0
 */
export function asEffect<A, R>(sr: SchemaResult<A, R>): Effect.Effect<A, SchemaAST.Issue, R> {
  return Result.isResult(sr) ? Effect.fromResult(sr) : sr
}

/**
 * @since 4.0.0
 */
export function map<A, B, R>(sr: SchemaResult<A, R>, f: (a: A) => B): SchemaResult<B, R> {
  return Result.isResult(sr) ? Result.map(sr, f) : Effect.map(sr, f)
}

/**
 * @since 4.0.0
 */
export function tap<A, R>(sr: SchemaResult<A, R>, f: (a: A) => void): SchemaResult<A, R> {
  return Result.isResult(sr) ? Result.tap(sr, f) : Effect.tap(sr, f)
}

/**
 * @since 4.0.0
 */
export function mapError<A, R>(
  sr: SchemaResult<A, R>,
  f: (issue: SchemaAST.Issue) => SchemaAST.Issue
): SchemaResult<A, R> {
  return Result.isResult(sr) ? Result.mapErr(sr, f) : Effect.mapError(sr, f)
}

/**
 * @since 4.0.0
 */
export function mapBoth<A, B, R>(
  sr: SchemaResult<A, R>,
  options: {
    readonly onSuccess: (a: A) => B
    readonly onFailure: (issue: SchemaAST.Issue) => SchemaAST.Issue
  }
): SchemaResult<B, R> {
  return Result.isResult(sr)
    ? Result.mapBoth(sr, { onErr: options.onFailure, onOk: options.onSuccess })
    // TODO: replace with `Effect.mapBoth` when it lands
    : sr.pipe(Effect.map(options.onSuccess), Effect.mapError(options.onFailure))
}

/**
 * @since 4.0.0
 */
export function flatMap<A, B, R1, R2>(
  sr: SchemaResult<A, R1>,
  f: (a: A) => SchemaResult<B, R2>
): SchemaResult<B, R1 | R2> {
  if (Result.isResult(sr)) {
    if (Result.isOk(sr)) {
      const out = f(sr.ok)
      if (Result.isResult(out)) {
        return Result.isOk(out) ? Effect.succeed(out.ok) : Effect.fail(out.err)
      }
      return out
    }
    return Result.err(sr.err)
  }
  return Effect.flatMap(sr, (a) => {
    const out = f(a)
    if (Result.isResult(out)) {
      return Result.isOk(out) ? Effect.succeed(out.ok) : Effect.fail(out.err)
    }
    return out
  })
}

const catch_ = <A, B, R, E, R2>(
  sr: SchemaResult<A, R>,
  f: (issue: SchemaAST.Issue) => Result.Result<B, E> | Effect.Effect<B, E, R2>
): Result.Result<A | B, E> | Effect.Effect<A | B, E, R | R2> => {
  if (Result.isResult(sr)) {
    return Result.isErr(sr) ? f(sr.err) : Result.ok(sr.ok)
  }
  return Effect.catch(sr, (issue) => {
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
