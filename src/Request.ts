/**
 * @since 2.0.0
 */
import type * as Cause from "./Cause.js"
import type * as Effect from "./Effect.js"
import type * as Exit from "./Exit.js"
import { dual } from "./Function.js"
import { completedRequestMap } from "./internal/completedRequestMap.js"
import * as core from "./internal/core.js"
import { StructuralPrototype } from "./internal/effectable.js"
import type * as Option from "./Option.js"
import { hasProperty } from "./Predicate.js"
import type * as Types from "./Types.js"

/**
 * @since 2.0.0
 * @category symbols
 */
export const RequestTypeId: unique symbol = Symbol.for("effect/Request")

/**
 * @since 2.0.0
 * @category symbols
 */
export type RequestTypeId = typeof RequestTypeId

/**
 * A `Request<A, E>` is a request from a data source for a value of type `A`
 * that may fail with an `E`.
 *
 * @since 2.0.0
 * @category models
 */
export interface Request<out A, out E = never> extends Request.Variance<A, E> {}

/**
 * @since 2.0.0
 */
export declare namespace Request {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<out A, out E> {
    readonly [RequestTypeId]: {
      readonly _A: Types.Covariant<A>
      readonly _E: Types.Covariant<E>
    }
  }

  /**
   * @since 2.0.0
   * @category models
   */
  export interface Constructor<R extends Request<any, any>, T extends keyof R = never> {
    (args: Omit<R, T | keyof (Request.Variance<Request.Success<R>, Request.Error<R>>)>): R
  }

  /**
   * A utility type to extract the error type from a `Request`.
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Error<T extends Request<any, any>> = [T] extends [Request<infer _A, infer _E>] ? _E : never

  /**
   * A utility type to extract the value type from a `Request`.
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Success<T extends Request<any, any>> = [T] extends [Request<infer _A, infer _E>] ? _A : never

  /**
   * A utility type to extract the result type from a `Request`.
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Result<T extends Request<any, any>> = T extends Request<infer A, infer E> ? Exit.Exit<A, E> : never

  /**
   * A utility type to extract the optional result type from a `Request`.
   *
   * @since 2.0.0
   * @category type-level
   */
  export type OptionalResult<T extends Request<any, any>> = T extends Request<infer A, infer E>
    ? Exit.Exit<Option.Option<A>, E>
    : never
}

const requestVariance = {
  /* c8 ignore next */
  _E: (_: never) => _,
  /* c8 ignore next */
  _A: (_: never) => _
}

const RequestPrototype = {
  ...StructuralPrototype,
  [RequestTypeId]: requestVariance
}

/**
 * @since 2.0.0
 * @category guards
 */
export const isRequest = (u: unknown): u is Request<unknown, unknown> => hasProperty(u, RequestTypeId)

/**
 * @since 2.0.0
 * @category constructors
 */
export const of = <R extends Request<any, any>>(): Request.Constructor<R> => (args) =>
  Object.assign(Object.create(RequestPrototype), args)

/**
 * @since 2.0.0
 * @category constructors
 */
export const tagged = <R extends Request<any, any> & { _tag: string }>(
  tag: R["_tag"]
): Request.Constructor<R, "_tag"> =>
(args) => {
  const request = Object.assign(Object.create(RequestPrototype), args)
  request._tag = tag
  return request
}

/**
 * @since 2.0.0
 * @category constructors
 */
export const Class: new<Success, Error, A extends Record<string, any>>(
  args: Types.Equals<Omit<A, keyof Request<unknown, unknown>>, {}> extends true ? void
    : { readonly [P in keyof A as P extends keyof Request<unknown, unknown> ? never : P]: A[P] }
) => Request<Success, Error> & Readonly<A> = (function() {
  function Class(this: any, args: any) {
    if (args) {
      Object.assign(this, args)
    }
  }
  Class.prototype = RequestPrototype
  return Class as any
})()

/**
 * @since 2.0.0
 * @category constructors
 */
export const TaggedClass = <Tag extends string>(
  tag: Tag
): new<Success, Error, A extends Record<string, any>>(
  args: Types.Equals<Omit<A, keyof Request<unknown, unknown>>, {}> extends true ? void
    : { readonly [P in keyof A as P extends "_tag" | keyof Request<unknown, unknown> ? never : P]: A[P] }
) => Request<Success, Error> & Readonly<A> & { readonly _tag: Tag } => {
  return class TaggedClass extends Class<any, any, any> {
    readonly _tag = tag
  } as any
}

/**
 * @since 2.0.0
 * @category completion
 */
export const complete = dual<
  <A extends Request<any, any>>(
    result: Request.Result<A>
  ) => (self: A) => Effect.Effect<void>,
  <A extends Request<any, any>>(
    self: A,
    result: Request.Result<A>
  ) => Effect.Effect<void>
>(2, (self, result) =>
  core.sync(() => {
    const entry = completedRequestMap.get(self)
    if (!entry || entry.completed) return
    entry.completed = true
    entry.resume(result)
  }))

/**
 * @since 2.0.0
 * @category completion
 */
export const completeEffect = dual<
  <A extends Request<any, any>, R>(
    effect: Effect.Effect<Request.Success<A>, Request.Error<A>, R>
  ) => (self: A) => Effect.Effect<void, never, R>,
  <A extends Request<any, any>, R>(
    self: A,
    effect: Effect.Effect<Request.Success<A>, Request.Error<A>, R>
  ) => Effect.Effect<void, never, R>
>(2, (self, effect) =>
  core.matchEffect(effect, {
    onFailure: (error) => complete(self, core.exitFail(error) as any),
    onSuccess: (value) => complete(self, core.exitSucceed(value) as any)
  }))

/**
 * @since 2.0.0
 * @category completion
 */
export const fail = dual<
  <A extends Request<any, any>>(
    error: Request.Error<A>
  ) => (self: A) => Effect.Effect<void>,
  <A extends Request<any, any>>(
    self: A,
    error: Request.Error<A>
  ) => Effect.Effect<void>
>(2, (self, error) => complete(self, core.exitFail(error) as any))

/**
 * @since 2.0.0
 * @category completion
 */
export const failCause = dual<
  <A extends Request<any, any>>(
    cause: Cause.Cause<Request.Error<A>>
  ) => (self: A) => Effect.Effect<void>,
  <A extends Request<any, any>>(
    self: A,
    cause: Cause.Cause<Request.Error<A>>
  ) => Effect.Effect<void>
>(2, (self, cause) => complete(self, core.exitFailCause(cause) as any))

/**
 * @since 2.0.0
 * @category completion
 */
export const succeed = dual<
  <A extends Request<any, any>>(
    value: Request.Success<A>
  ) => (self: A) => Effect.Effect<void>,
  <A extends Request<any, any>>(
    self: A,
    value: Request.Success<A>
  ) => Effect.Effect<void>
>(2, (self, value) => complete(self, core.exitSucceed(value) as any))

/**
 * @since 2.0.0
 * @category entry
 */
export interface Entry<out R> {
  readonly request: R
  readonly resume: (
    effect: Effect.Effect<
      [R] extends [Request<infer _A, infer _E>] ? _A : never,
      [R] extends [Request<infer _A, infer _E>] ? _E : never
    >
  ) => void
  completed: boolean
}

/**
 * @since 2.0.0
 * @category entry
 */
export const makeEntry = <R>(options: {
  readonly request: R
  readonly resume: (
    effect: Effect.Effect<
      [R] extends [Request<infer _A, infer _E>] ? _A : never,
      [R] extends [Request<infer _A, infer _E>] ? _E : never
    >
  ) => void
}): Entry<R> => ({
  ...options,
  completed: false
})
