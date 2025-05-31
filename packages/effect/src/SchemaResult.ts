/**
 * @since 4.0.0
 */
import * as Effect from "./Effect.js"
import type * as Option from "./Option.js"
import * as Result from "./Result.js"
import type * as SchemaIssue from "./SchemaIssue.js"

/**
 * @category model
 * @since 4.0.0
 */
export type SchemaResult<A, R = never> = Result.Result<A, SchemaIssue.Issue> | Effect.Effect<A, SchemaIssue.Issue, R>

/**
 * @category constructors
 * @since 4.0.0
 */
export const succeed: <A>(a: A) => SchemaResult<A> = Result.ok

/**
 * @category constructors
 * @since 4.0.0
 */
export const succeedNone: SchemaResult<Option.Option<never>> = Result.okNone

/**
 * @category constructors
 * @since 4.0.0
 */
export const succeedSome: <A>(a: A) => SchemaResult<Option.Option<A>> = Result.okSome

/**
 * @category constructors
 * @since 4.0.0
 */
export const fail: (issue: SchemaIssue.Issue) => SchemaResult<never> = Result.err

/**
 * @since 4.0.0
 */
export function asPromise<A>(sr: SchemaResult<A, never>): Promise<A> {
  return Effect.isEffect(sr) ? Effect.runPromise(sr) : Result.isOk(sr) ? Promise.resolve(sr.ok) : Promise.reject(sr.err)
}

/**
 * @since 4.0.0
 */
export function asEffect<A, R>(sr: SchemaResult<A, R>): Effect.Effect<A, SchemaIssue.Issue, R> {
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
  f: (issue: SchemaIssue.Issue) => SchemaIssue.Issue
) {
  return <A, R>(sr: SchemaResult<A, R>): SchemaResult<A, R> => {
    return Result.isResult(sr) ? Result.mapErr(sr, f) : Effect.mapError(sr, f)
  }
}

/**
 * @since 4.0.0
 */
export function mapBoth<A, B>(
  options: {
    readonly onSuccess: (a: A) => B
    readonly onFailure: (issue: SchemaIssue.Issue) => SchemaIssue.Issue
  }
) {
  return <R>(sr: SchemaResult<A, R>): SchemaResult<B, R> => {
    return Result.isResult(sr)
      ? Result.mapBoth(sr, { onErr: options.onFailure, onOk: options.onSuccess })
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
}

const catch_ = <B, E, R2>(
  f: (issue: SchemaIssue.Issue) => Result.Result<B, E> | Effect.Effect<B, E, R2>
) =>
<A, R>(sr: SchemaResult<A, R>): Result.Result<A | B, E> | Effect.Effect<A | B, E, R | R2> => {
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
