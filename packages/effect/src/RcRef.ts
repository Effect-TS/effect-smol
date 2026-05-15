/**
 * @since 3.5.0
 */
import type * as Duration from "./Duration.ts"
import type * as Effect from "./Effect.ts"
import * as internal from "./internal/rcRef.ts"
import type { Pipeable } from "./Pipeable.ts"
import type { Scope } from "./Scope.ts"
import type * as Types from "./Types.ts"

const TypeId = "~effect/RcRef"

/**
 * A reference counted reference that manages resource lifecycle.
 *
 * An RcRef wraps a resource that can be acquired and released multiple times.
 * The resource is lazily acquired on the first call to `get` and automatically
 * released when the last reference is released.
 *
 * **Example** (Sharing a lazily acquired resource)
 *
 * ```ts
 * import { Effect, RcRef } from "effect"
 *
 * // Create an RcRef for a database connection
 * const createConnectionRef = (connectionString: string) =>
 *   RcRef.make({
 *     acquire: Effect.acquireRelease(
 *       Effect.succeed(`Connected to ${connectionString}`),
 *       (connection) => Effect.log(`Closing connection: ${connection}`)
 *     )
 *   })
 *
 * // Use the RcRef in multiple operations
 * const program = Effect.gen(function*() {
 *   const connectionRef = yield* createConnectionRef("postgres://localhost")
 *
 *   // Multiple gets will share the same connection
 *   const connection1 = yield* RcRef.get(connectionRef)
 *   const connection2 = yield* RcRef.get(connectionRef)
 *
 *   return [connection1, connection2]
 * })
 * ```
 *
 * @category models
 * @since 3.5.0
 */
export interface RcRef<out A, out E = never> extends Pipeable {
  readonly [TypeId]: RcRef.Variance<A, E>
}

/**
 * **Example** (Referencing namespace types)
 *
 * ```ts
 * import type { RcRef } from "effect"
 *
 * // Use RcRef namespace types
 * type MyRcRef = RcRef.RcRef<string, Error>
 * type MyVariance = RcRef.RcRef.Variance<string, Error>
 * ```
 *
 * @category models
 * @since 3.5.0
 */
export declare namespace RcRef {
  /**
   * **Example** (Referencing variance types)
   *
   * ```ts
   * import type { RcRef } from "effect"
   *
   * // Variance interface defines covariance for type parameters
   * type StringRcRefVariance = RcRef.RcRef.Variance<string, Error>
   *
   * // Shows that both A and E are covariant
   * declare const variance: StringRcRefVariance
   * ```
   *
   * @category models
   * @since 3.5.0
   */
  export interface Variance<A, E> {
    readonly _A: Types.Covariant<A>
    readonly _E: Types.Covariant<E>
  }
}

/**
 * Create an `RcRef` from an acquire `Effect`.
 *
 * An RcRef wraps a reference counted resource that can be acquired and released
 * multiple times.
 *
 * The resource is lazily acquired on the first call to `get` and released when
 * the last reference is released.
 *
 * **Example** (Creating a reference-counted resource)
 *
 * ```ts
 * import { Effect, RcRef } from "effect"
 *
 * Effect.gen(function*() {
 *   const ref = yield* RcRef.make({
 *     acquire: Effect.acquireRelease(
 *       Effect.succeed("foo"),
 *       () => Effect.log("release foo")
 *     )
 *   })
 *
 *   // will only acquire the resource once, and release it
 *   // when the scope is closed
 *   yield* RcRef.get(ref).pipe(
 *     Effect.andThen(RcRef.get(ref)),
 *     Effect.scoped
 *   )
 * })
 * ```
 *
 * @category constructors
 * @since 3.5.0
 */
export const make: <A, E, R>(
  options: {
    readonly acquire: Effect.Effect<A, E, R>
    /**
     * When the reference count reaches zero, the resource will be released
     * after this duration.
     */
    readonly idleTimeToLive?: Duration.Input | undefined
  }
) => Effect.Effect<RcRef<A, E>, never, R | Scope> = internal.make

/**
 * Get the value from an RcRef.
 *
 * This will acquire the resource if it hasn't been acquired yet, or increment
 * the reference count if it has. The resource will be automatically released
 * when the returned scope is closed.
 *
 * **Example** (Sharing one acquired value)
 *
 * ```ts
 * import { Effect, RcRef } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create an RcRef with a resource
 *   const ref = yield* RcRef.make({
 *     acquire: Effect.acquireRelease(
 *       Effect.succeed("shared resource"),
 *       (resource) => Effect.log(`Releasing ${resource}`)
 *     )
 *   })
 *
 *   // Get the value from the RcRef
 *   const value1 = yield* RcRef.get(ref)
 *   const value2 = yield* RcRef.get(ref)
 *
 *   // Both values are the same instance
 *   console.log(value1 === value2) // true
 *
 *   return value1
 * })
 * ```
 *
 * @category combinators
 * @since 3.5.0
 */
export const get: <A, E>(self: RcRef<A, E>) => Effect.Effect<A, E, Scope> = internal.get

/**
 * @category combinators
 * @since 3.19.6
 */
export const invalidate: <A, E>(self: RcRef<A, E>) => Effect.Effect<void> = internal.invalidate
