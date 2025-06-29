/**
 * @since 4.0.0
 */
import * as Effect from "../Effect.js"
import type * as Option from "../Option.js"
import * as Result from "../Result.js"
import type * as Issue from "./Issue.js"

/**
 * @category model
 * @since 4.0.0
 */
export type SchemaResult<A, R = never> = Result.Result<A, Issue.Issue> | Effect.Effect<A, Issue.Issue, R>

/**
 * @category constructors
 * @since 4.0.0
 */
export const succeed: <A>(a: A) => SchemaResult<A> = Result.succeed

/**
 * @category constructors
 * @since 4.0.0
 */
export const succeedNone: SchemaResult<Option.Option<never>> = Result.succeedNone

/**
 * @category constructors
 * @since 4.0.0
 */
export const succeedSome: <A>(a: A) => SchemaResult<Option.Option<A>> = Result.succeedSome

/**
 * @category constructors
 * @since 4.0.0
 */
export const fail: (issue: Issue.Issue) => SchemaResult<never> = Result.fail

/**
 * @since 4.0.0
 */
export function asPromise<A>(sr: SchemaResult<A, never>): Promise<A> {
  return Effect.isEffect(sr)
    ? Effect.runPromise(sr)
    : Result.isSuccess(sr)
    ? Promise.resolve(sr.success)
    : Promise.reject(sr.failure)
}

/**
 * @since 4.0.0
 */
export function asEffect<A, R>(sr: SchemaResult<A, R>): Effect.Effect<A, Issue.Issue, R> {
  return Effect.isEffect(sr) ? sr : Effect.fromResult(sr)
}

/**
 * @since 4.0.0
 */
export function map<A, B>(f: (a: A) => B) {
  return <R>(sr: SchemaResult<A, R>): SchemaResult<B, R> => {
    return Result.isResult(sr) ? Result.map(sr, f) : Effect.map(sr, f)
  }
}

/**
 * @since 4.0.0
 */
export function mapError(
  f: (issue: Issue.Issue) => Issue.Issue
) {
  return <A, R>(sr: SchemaResult<A, R>): SchemaResult<A, R> => {
    return Result.isResult(sr) ? Result.mapError(sr, f) : Effect.mapError(sr, f)
  }
}

/**
 * @since 4.0.0
 */
export function mapBoth<A, B>(
  options: {
    readonly onSuccess: (a: A) => B
    readonly onFailure: (issue: Issue.Issue) => Issue.Issue
  }
) {
  return <R>(sr: SchemaResult<A, R>): SchemaResult<B, R> => {
    return Result.isResult(sr)
      ? Result.mapBoth(sr, options)
      : Effect.mapBoth(sr, options)
  }
}

/**
 * @since 4.0.0
 */
export function flatMap<A, B, R2>(
  f: (a: A) => SchemaResult<B, R2>
) {
  return <R1>(sr: SchemaResult<A, R1>): SchemaResult<B, R1 | R2> => {
    if (Result.isResult(sr)) {
      if (Result.isSuccess(sr)) {
        const out = f(sr.success)
        if (Result.isResult(out)) {
          return Result.isSuccess(out) ? Effect.succeed(out.success) : Effect.fail(out.failure)
        }
        return out
      }
      return Result.fail(sr.failure)
    }
    return Effect.flatMap(sr, (a) => {
      const out = f(a)
      if (Result.isResult(out)) {
        return Result.isSuccess(out) ? Effect.succeed(out.success) : Effect.fail(out.failure)
      }
      return out
    })
  }
}

const catch_ = <B, E, R2>(
  f: (issue: Issue.Issue) => Result.Result<B, E> | Effect.Effect<B, E, R2>
) =>
<A, R>(sr: SchemaResult<A, R>): Result.Result<A | B, E> | Effect.Effect<A | B, E, R | R2> => {
  if (Result.isResult(sr)) {
    return Result.isFailure(sr) ? f(sr.failure) : Result.succeed(sr.success)
  }
  return Effect.catch(sr, (issue) => {
    const out = f(issue)
    if (Result.isResult(out)) {
      return Result.isSuccess(out) ? Effect.succeed(out.success) : Effect.fail(out.failure)
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
