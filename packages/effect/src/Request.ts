/**
 * The `Request` module provides a way to model requests to external data sources
 * in a functional and composable manner. Requests represent descriptions of
 * operations that can be batched, cached, and executed efficiently.
 *
 * A `Request<A, E, R>` represents a request that:
 * - Yields a value of type `A` on success
 * - Can fail with an error of type `E`
 * - Requires services of type `R`
 *
 * Requests are primarily used with RequestResolver to implement efficient
 * data fetching patterns, including automatic batching and caching.
 *
 * @since 2.0.0
 */
import type * as Cause from "./Cause.js"
import type * as Effect from "./Effect.js"
import type * as Exit from "./Exit.js"
import { dual } from "./Function.js"
import * as core from "./internal/core.js"
import { StructuralPrototype } from "./internal/core.js"
import * as internalEffect from "./internal/effect.js"
import type * as Option from "./Option.js"
import { hasProperty } from "./Predicate.js"
import type * as ServiceMap from "./ServiceMap.js"
import type * as Types from "./Types.js"

/**
 * @example
 * ```ts
 * import { Request } from "effect"
 *
 * // The TypeId is used internally to identify Request instances
 * declare const GetUser: Request.Request<string, Error>
 *
 * console.log(Request.TypeId) // "~effect/Request"
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/Request"

/**
 * @example
 * ```ts
 * import { Request } from "effect"
 *
 * // TypeId is the unique identifier type for Request
 * const checkType = (value: unknown): value is { [Request.TypeId]: any } => {
 *   return typeof value === "object" && value !== null && Request.TypeId in value
 * }
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export type TypeId = "~effect/Request"

/**
 * A `Request<A, E, R>` is a request from a data source for a value of type `A`
 * that may fail with an `E` and have requirements of type `R`.
 *
 * @example
 * ```ts
 * import { Request } from "effect"
 *
 * // Define a request that fetches a user by ID
 * interface GetUser extends Request.Request<string, Error> {
 *   readonly _tag: "GetUser"
 *   readonly id: number
 * }
 *
 * // Define a request that fetches all users
 * interface GetAllUsers extends Request.Request<ReadonlyArray<string>, Error> {
 *   readonly _tag: "GetAllUsers"
 * }
 *
 * // Requests can have requirements (dependencies)
 * interface GetUserProfile extends Request.Request<string, Error, { database: any }> {
 *   readonly _tag: "GetUserProfile"
 *   readonly userId: string
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Request<out A, out E = never, out R = never> extends Request.Variance<A, E, R> {}

/**
 * @example
 * ```ts
 * import { Request } from "effect"
 *
 * // Define a request interface
 * interface GetUser extends Request.Request<string, Error> {
 *   readonly _tag: "GetUser"
 *   readonly id: number
 * }
 *
 * // Extract types from Request using conditional types
 * type UserSuccess = GetUser extends Request.Request<infer A, any, any> ? A : never // string
 * type UserError = GetUser extends Request.Request<any, infer E, any> ? E : never // Error
 * type UserServices = GetUser extends Request.Request<any, any, infer R> ? R : never // never
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export declare namespace Request {
  /**
   * @example
   * ```ts
   * import { Request } from "effect"
   *
   * // Variance is used internally to ensure proper type variance
   * // It's typically not used directly in application code
   * interface MyRequest extends Request.Request<string, Error, never> {
   *   readonly _tag: "MyRequest"
   * }
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export interface Variance<out A, out E, out R> {
    readonly [TypeId]: {
      readonly _A: Types.Covariant<A>
      readonly _E: Types.Covariant<E>
      readonly _R: Types.Covariant<R>
    }
  }

  /**
   * @example
   * ```ts
   * import { Request } from "effect"
   *
   * interface GetUser extends Request.Request<string, Error> {
   *   readonly _tag: "GetUser"
   *   readonly id: number
   * }
   *
   * // Constructor type is used internally by Request.of() and Request.tagged()
   * const GetUser = Request.tagged<GetUser>("GetUser")
   * const userRequest = GetUser({ id: 123 })
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export interface Constructor<R extends Request<any, any, any>, T extends keyof R = never> {
    (args: Omit<R, T | keyof (Request.Variance<any, any, any>)>): R
  }

  /**
   * A utility type to extract the error type from a `Request`.
   *
   * @example
   * ```ts
   * import { Request } from "effect"
   *
   * interface GetUser extends Request.Request<string, Error> {
   *   readonly id: number
   * }
   *
   * // Extract the error type from a Request using the utility
   * type UserError = Request.Request.Error<GetUser> // Error
   * ```
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Error<T extends Request<any, any, any>> = [T] extends [Request<infer _A, infer _E, infer _R>] ? _E : never

  /**
   * A utility type to extract the value type from a `Request`.
   *
   * @example
   * ```ts
   * import { Request } from "effect"
   *
   * interface GetUser extends Request.Request<string, Error> {
   *   readonly _tag: "GetUser"
   *   readonly id: number
   * }
   *
   * // Extract the success type from a Request using the utility
   * type UserSuccess = Request.Request.Success<GetUser> // string
   * ```
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Success<T extends Request<any, any, any>> = [T] extends [Request<infer _A, infer _E, infer _R>] ? _A
    : never

  /**
   * A utility type to extract the requirements type from a `Request`.
   *
   * @example
   * ```ts
   * import { Request } from "effect"
   *
   * interface GetUserProfile extends Request.Request<string, Error, { database: DatabaseService }> {
   *   readonly userId: string
   * }
   *
   * // Extract the services type from a Request using the utility
   * type UserServices = Request.Request.Services<GetUserProfile> // { database: DatabaseService }
   *
   * declare const DatabaseService: unique symbol
   * interface DatabaseService {
   *   readonly [DatabaseService]: DatabaseService
   * }
   * ```
   *
   * @since 4.0.0
   * @category type-level
   */
  export type Services<T extends Request<any, any, any>> = [T] extends [Request<infer _A, infer _E, infer _R>] ? _R
    : never

  /**
   * A utility type to extract the result type from a `Request`.
   *
   * @example
   * ```ts
   * import { Request, Exit } from "effect"
   *
   * interface GetUser extends Request.Request<string, Error> {
   *   readonly _tag: "GetUser"
   *   readonly id: number
   * }
   *
   * // Extract the result type from a Request using the utility
   * type UserResult = Request.Request.Result<GetUser> // Exit.Exit<string, Error>
   * ```
   *
   * @since 2.0.0
   * @category type-level
   */
  export type Result<T extends Request<any, any, any>> = T extends Request<infer A, infer E, infer _R> ? Exit.Exit<A, E>
    : never

  /**
   * A utility type to extract the optional result type from a `Request`.
   *
   * @example
   * ```ts
   * import { Request, Exit, Option } from "effect"
   *
   * interface GetUser extends Request.Request<string, Error> {
   *   readonly _tag: "GetUser"
   *   readonly id: number
   * }
   *
   * // Extract the optional result type from a Request using the utility
   * type OptionalUserResult = Request.Request.OptionalResult<GetUser> // Exit.Exit<Option.Option<string>, Error>
   * ```
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
  [TypeId]: requestVariance
}

/**
 * Tests if a value is a `Request`.
 *
 * @example
 * ```ts
 * import { Request } from "effect"
 *
 * declare const User: unique symbol
 * declare const UserNotFound: unique symbol
 * type User = typeof User
 * type UserNotFound = typeof UserNotFound
 *
 * interface GetUser extends Request.Request<User, UserNotFound> {
 *   readonly _tag: "GetUser"
 *   readonly id: string
 * }
 * const GetUser = Request.tagged<GetUser>("GetUser")
 *
 * const request = GetUser({ id: "123" })
 * console.log(Request.isRequest(request)) // true
 * console.log(Request.isRequest("not a request")) // false
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isRequest = (u: unknown): u is Request<unknown, unknown, unknown> => hasProperty(u, TypeId)

/**
 * Creates a constructor function for a specific Request type.
 *
 * @example
 * ```ts
 * import { Request } from "effect"
 *
 * declare const UserProfile: unique symbol
 * declare const ProfileError: unique symbol
 * type UserProfile = typeof UserProfile
 * type ProfileError = typeof ProfileError
 *
 * interface GetUserProfile extends Request.Request<UserProfile, ProfileError> {
 *   readonly id: string
 *   readonly includeSettings: boolean
 * }
 *
 * const GetUserProfile = Request.of<GetUserProfile>()
 *
 * const request = GetUserProfile({
 *   id: "user-123",
 *   includeSettings: true
 * })
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const of = <R extends Request<any, any, any>>(): Request.Constructor<R> => (args) =>
  Object.assign(Object.create(RequestPrototype), args)

/**
 * Creates a constructor function for a tagged Request type. The tag is automatically
 * added to the request, making it useful for discriminated unions.
 *
 * @example
 * ```ts
 * import { Request } from "effect"
 *
 * declare const User: unique symbol
 * declare const UserNotFound: unique symbol
 * declare const Post: unique symbol
 * declare const PostNotFound: unique symbol
 * type User = typeof User
 * type UserNotFound = typeof UserNotFound
 * type Post = typeof Post
 * type PostNotFound = typeof PostNotFound
 *
 * interface GetUser extends Request.Request<User, UserNotFound> {
 *   readonly _tag: "GetUser"
 *   readonly id: string
 * }
 *
 * interface GetPost extends Request.Request<Post, PostNotFound> {
 *   readonly _tag: "GetPost"
 *   readonly id: string
 * }
 *
 * const GetUser = Request.tagged<GetUser>("GetUser")
 * const GetPost = Request.tagged<GetPost>("GetPost")
 *
 * const userRequest = GetUser({ id: "user-123" })
 * const postRequest = GetPost({ id: "post-456" })
 *
 * // _tag is automatically set
 * console.log(userRequest._tag) // "GetUser"
 * console.log(postRequest._tag) // "GetPost"
 * ```
 *
 * @category constructors
 * @since 2.0.0
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
 * @example
 * ```ts
 * import { Request } from "effect"
 *
 * class GetUser extends Request.Class<{ id: number }, string, Error> {
 *   constructor(readonly id: number) {
 *     super({ id })
 *   }
 * }
 *
 * const getUserRequest = new GetUser(123)
 * console.log(getUserRequest.id) // 123
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const Class: new<A extends Record<string, any>, Success, Error = never, ServiceMap = never>(
  args: Types.Equals<Omit<A, keyof Request<unknown, unknown>>, {}> extends true ? void
    : { readonly [P in keyof A as P extends keyof Request<any, any, any> ? never : P]: A[P] }
) => Request<Success, Error, ServiceMap> & Readonly<A> = (function() {
  function Class(this: any, args: any) {
    if (args) {
      Object.assign(this, args)
    }
  }
  Class.prototype = RequestPrototype
  return Class as any
})()

/**
 * @example
 * ```ts
 * import { Request } from "effect"
 *
 * const GetUserByIdClass = Request.TaggedClass("GetUserById")
 *
 * class GetUserById extends GetUserByIdClass<{ id: number }, string, Error> {
 *   constructor(readonly id: number) {
 *     super({ id })
 *   }
 * }
 *
 * const request = new GetUserById(123)
 * console.log(request._tag) // "GetUserById"
 * console.log(request.id) // 123
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const TaggedClass = <Tag extends string>(
  tag: Tag
): new<A extends Record<string, any>, Success, Error = never, ServiceMap = never>(
  args: Types.Equals<Omit<A, keyof Request<unknown, unknown>>, {}> extends true ? void
    : { readonly [P in keyof A as P extends "_tag" | keyof Request<any, any, any> ? never : P]: A[P] }
) => Request<Success, Error, ServiceMap> & Readonly<A> & { readonly _tag: Tag } => {
  return class TaggedClass extends Class<any, any, any> {
    readonly _tag = tag
  } as any
}

/**
 * Completes a request entry with the provided result. This is typically used
 * within RequestResolver implementations to fulfill pending requests.
 *
 * @example
 * ```ts
 * import { Request, Effect, Exit } from "effect"
 *
 * declare const userRequest: Request.Request<string, Error>
 * declare const userData: string
 * declare const entry: Request.Entry<Request.Request<string, Error>>
 *
 * const completeRequest = Effect.gen(function* () {
 *   // Complete with success
 *   yield* Request.complete(entry, Exit.succeed(userData))
 *
 *   // Or complete with failure
 *   // yield* Request.complete(entry, Exit.fail(new Error("User not found")))
 * })
 * ```
 *
 * @category completion
 * @since 2.0.0
 */
export const complete = dual<
  <A extends Request<any, any, any>>(
    result: Request.Result<A>
  ) => (self: Entry<A>) => Effect.Effect<void>,
  <A extends Request<any, any, any>>(
    self: Entry<A>,
    result: Request.Result<A>
  ) => Effect.Effect<void>
>(2, (self, result) => internalEffect.sync(() => self.unsafeComplete(result)))

/**
 * @example
 * ```ts
 * import { Request, Effect } from "effect"
 *
 * declare const userRequest: Request.Request<string, Error>
 * declare const entry: Request.Entry<Request.Request<string, Error>>
 *
 * const fetchUserData = Effect.gen(function* () {
 *   // Simulate async operation that might fail
 *   const userData = yield* Effect.tryPromise({
 *     try: () => fetch("/api/user").then(res => res.json()),
 *     catch: () => new Error("Failed to fetch user")
 *   })
 *   return userData.name
 * })
 *
 * // Complete the request with an effect
 * const completeRequest = Request.completeEffect(entry, fetchUserData)
 * ```
 *
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
  internalEffect.matchEffect(effect, {
    onFailure: (error) => complete(self, core.exitFail(error) as any),
    onSuccess: (value) => complete(self, core.exitSucceed(value) as any)
  }))

/**
 * @example
 * ```ts
 * import { Request, Effect } from "effect"
 *
 * declare const userRequest: Request.Request<string, Error>
 * declare const entry: Request.Entry<Request.Request<string, Error>>
 *
 * const handleRequestFailure = Effect.gen(function* () {
 *   // Complete the request with a failure
 *   yield* Request.fail(entry, new Error("User not found"))
 * })
 * ```
 *
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
>(2, (self, error) => complete(self, core.exitFail(error) as any))

/**
 * @example
 * ```ts
 * import { Request, Effect, Cause } from "effect"
 *
 * declare const userRequest: Request.Request<string, Error>
 * declare const entry: Request.Entry<Request.Request<string, Error>>
 *
 * const handleRequestFailureWithCause = Effect.gen(function* () {
 *   // Create a failure cause with interruption
 *   const cause = Cause.fail(new Error("Network timeout"))
 *
 *   // Complete the request with a cause
 *   yield* Request.failCause(entry, cause)
 * })
 * ```
 *
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
>(2, (self, cause) => complete(self, core.exitFailCause(cause) as any))

/**
 * @example
 * ```ts
 * import { Request, Effect } from "effect"
 *
 * declare const userRequest: Request.Request<string, Error>
 * declare const entry: Request.Entry<Request.Request<string, Error>>
 *
 * const handleRequestSuccess = Effect.gen(function* () {
 *   // Complete the request with a successful value
 *   yield* Request.succeed(entry, "John Doe")
 * })
 * ```
 *
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
>(2, (self, value) => complete(self, core.exitSucceed(value) as any))

/**
 * @example
 * ```ts
 * import { Request, Effect, Exit } from "effect"
 *
 * interface GetUser extends Request.Request<string, Error> {
 *   readonly _tag: "GetUser"
 *   readonly id: number
 * }
 *
 * // Entry represents a request that needs to be resolved
 * declare const entry: Request.Entry<GetUser>
 *
 * // You can access the original request
 * console.log(entry.request.id)
 *
 * // Complete the entry with a result
 * entry.unsafeComplete(Effect.succeed("John Doe"))
 * ```
 *
 * @since 2.0.0
 * @category entry
 */
export interface Entry<out R> {
  readonly request: R
  readonly services: ServiceMap.ServiceMap<
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
 * @example
 * ```ts
 * import { Request, Effect, ServiceMap } from "effect"
 *
 * interface GetUser extends Request.Request<string, Error> {
 *   readonly _tag: "GetUser"
 *   readonly id: number
 * }
 *
 * const GetUser = Request.tagged<GetUser>("GetUser")
 * const userRequest = GetUser({ id: 123 })
 *
 * // Create an entry for processing in a resolver
 * const entry = Request.makeEntry({
 *   request: userRequest,
 *   services: ServiceMap.empty(),
 *   unsafeComplete: (effect) => {
 *     // This would be called by the resolver to complete the request
 *     Effect.runPromise(effect).then(console.log).catch(console.error)
 *   }
 * })
 * ```
 *
 * @since 2.0.0
 * @category entry
 */
export const makeEntry = <R>(options: {
  readonly request: R
  readonly services: ServiceMap.ServiceMap<
    [R] extends [Request<infer _A, infer _E, infer _R>] ? _R : never
  >
  readonly unsafeComplete: (
    effect: Effect.Effect<
      [R] extends [Request<infer _A, infer _E, infer _R>] ? _A : never,
      [R] extends [Request<infer _A, infer _E, infer _R>] ? _E : never
    >
  ) => void
}): Entry<R> => options
