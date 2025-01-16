/**
 * @since 2.0.0
 */
import type * as Cause from "./Cause.js"
import type * as Context from "./Context.js"
import type * as Effect from "./Effect.js"
import type * as Exit from "./Exit.js"
import { dual } from "./Function.js"
import * as core from "./internal/core.js"
import * as primitive from "./internal/primitive.js"
import { StructuralPrototype } from "./internal/primitive.js"
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
 * A `Request<A, E, R>` is a request from a data source for a value of type `A`
 * that may fail with an `E` and have requirements of type `R`.
 *
 * @since 2.0.0
 * @category models
 */
export interface Request<out A, out E = never, out R = never> extends Request.Variance<A, E, R> {}

/**
 * @since 2.0.0
 */
export declare namespace Request {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<out A, out E, out R> {
    readonly [RequestTypeId]: {
      readonly _A: Types.Covariant<A>
      readonly _E: Types.Covariant<E>
      readonly _R: Types.Covariant<R>
    }
  }

  /**
   * @since 2.0.0
   * @category models
   */
  export interface Constructor<R extends Request<any, any, any>, T extends keyof R = never> {
    (args: Omit<R, T | keyof (Request.Variance<any, any, any>)>): R
  }

  /**
   * A utility type to extract the error type from a `Request`.
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Error<T extends Request<any, any, any>> = [T] extends [Request<infer _A, infer _E, infer _R>] ? _E : never

  /**
   * A utility type to extract the value type from a `Request`.
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Success<T extends Request<any, any, any>> = [T] extends [Request<infer _A, infer _E, infer _R>] ? _A
    : never

  /**
   * A utility type to extract the requirements type from a `Request`.
   *
   * @since 4.0.0
   * @category type-level
   */
  export type Context<T extends Request<any, any, any>> = [T] extends [Request<infer _A, infer _E, infer _R>] ? _R
    : never

  /**
   * A utility type to extract the result type from a `Request`.
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Result<T extends Request<any, any, any>> = T extends Request<infer A, infer E, infer _R> ? Exit.Exit<A, E>
    : never

  /**
   * A utility type to extract the optional result type from a `Request`.
   *
   * @since 2.0.0
   * @category type-level
   */
  export type OptionalResult<T extends Request<any, any, any>> = T extends Request<infer A, infer E, infer _R>
    ? Exit.Exit<Option.Option<A>, E>
    : never
}

const requestVariance = {
  /* c8 ignore next */
  _E: (_: never) => _,
  /* c8 ignore next */
  _A: (_: never) => _,
  /* c8 ignore next */
  _R: (_: never) => _
}

const RequestPrototype = {
  ...StructuralPrototype,
  [RequestTypeId]: requestVariance
}

/**
 * @since 2.0.0
 * @category guards
 */
export const isRequest = (u: unknown): u is Request<unknown, unknown, unknown> => hasProperty(u, RequestTypeId)

/**
 * @since 2.0.0
 * @category constructors
 */
export const of = <R extends Request<any, any, any>>(): Request.Constructor<R> => (args) =>
  Object.assign(Object.create(RequestPrototype), args)

/**
 * @since 2.0.0
 * @category constructors
 */
export const tagged = <R extends Request<any, any, any> & { _tag: string }>(
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
export const Class: new<A extends Record<string, any>, Success, Error = never, Context = never>(
  args: Types.Equals<Omit<A, keyof Request<unknown, unknown>>, {}> extends true ? void
    : { readonly [P in keyof A as P extends keyof Request<any, any, any> ? never : P]: A[P] }
) => Request<Success, Error, Context> & Readonly<A> = (function() {
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
): new<A extends Record<string, any>, Success, Error = never, Context = never>(
  args: Types.Equals<Omit<A, keyof Request<unknown, unknown>>, {}> extends true ? void
    : { readonly [P in keyof A as P extends "_tag" | keyof Request<any, any, any> ? never : P]: A[P] }
) => Request<Success, Error, Context> & Readonly<A> & { readonly _tag: Tag } => {
  return class TaggedClass extends Class<any, any, any> {
    readonly _tag = tag
  } as any
}

/**
 * @since 2.0.0
 * @category completion
 */
export const complete = dual<
  <A extends Request<any, any, any>>(
    result: Request.Result<A>
  ) => (self: Entry<A>) => Effect.Effect<void>,
  <A extends Request<any, any, any>>(
    self: Entry<A>,
    result: Request.Result<A>
  ) => Effect.Effect<void>
>(2, (self, result) => core.sync(() => self.unsafeComplete(result)))

/**
 * @since 2.0.0
 * @category completion
 */
export const completeEffect = dual<
  <A extends Request<any, any, any>, R>(
    effect: Effect.Effect<Request.Success<A>, Request.Error<A>, R>
  ) => (self: Entry<A>) => Effect.Effect<void, never, R>,
  <A extends Request<any, any, any>, R>(
    self: Entry<A>,
    effect: Effect.Effect<Request.Success<A>, Request.Error<A>, R>
  ) => Effect.Effect<void, never, R>
>(2, (self, effect) =>
  core.matchEffect(effect, {
    onFailure: (error) => complete(self, primitive.exitFail(error) as any),
    onSuccess: (value) => complete(self, primitive.exitSucceed(value) as any)
  }))

/**
 * @since 2.0.0
 * @category completion
 */
export const fail = dual<
  <A extends Request<any, any, any>>(
    error: Request.Error<A>
  ) => (self: Entry<A>) => Effect.Effect<void>,
  <A extends Request<any, any, any>>(
    self: Entry<A>,
    error: Request.Error<A>
  ) => Effect.Effect<void>
>(2, (self, error) => complete(self, primitive.exitFail(error) as any))

/**
 * @since 2.0.0
 * @category completion
 */
export const failCause = dual<
  <A extends Request<any, any, any>>(
    cause: Cause.Cause<Request.Error<A>>
  ) => (self: Entry<A>) => Effect.Effect<void>,
  <A extends Request<any, any, any>>(
    self: Entry<A>,
    cause: Cause.Cause<Request.Error<A>>
  ) => Effect.Effect<void>
>(2, (self, cause) => complete(self, primitive.exitFailCause(cause) as any))

/**
 * @since 2.0.0
 * @category completion
 */
export const succeed = dual<
  <A extends Request<any, any, any>>(
    value: Request.Success<A>
  ) => (self: Entry<A>) => Effect.Effect<void>,
  <A extends Request<any, any, any>>(
    self: Entry<A>,
    value: Request.Success<A>
  ) => Effect.Effect<void>
>(2, (self, value) => complete(self, primitive.exitSucceed(value) as any))

/**
 * @since 2.0.0
 * @category entry
 */
export interface Entry<out R> {
  readonly request: R
  readonly context: Context.Context<
    [R] extends [Request<infer _A, infer _E, infer _R>] ? _R : never
  >
  readonly unsafeComplete: (
    effect: Effect.Effect<
      [R] extends [Request<infer _A, infer _E, infer _R>] ? _A : never,
      [R] extends [Request<infer _A, infer _E, infer _R>] ? _E : never
    >
  ) => void
}

/**
 * @since 2.0.0
 * @category entry
 */
export const makeEntry = <R>(options: {
  readonly request: R
  readonly context: Context.Context<
    [R] extends [Request<infer _A, infer _E, infer _R>] ? _R : never
  >
  readonly unsafeComplete: (
    effect: Effect.Effect<
      [R] extends [Request<infer _A, infer _E, infer _R>] ? _A : never,
      [R] extends [Request<infer _A, infer _E, infer _R>] ? _E : never
    >
  ) => void
}): Entry<R> => options
