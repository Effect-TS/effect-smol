/**
 * The `Scope` module provides functionality for managing resource lifecycles
 * and cleanup operations in a functional and composable manner.
 *
 * A `Scope` represents a context where resources can be acquired and automatically
 * cleaned up when the scope is closed. This is essential for managing resources
 * like file handles, database connections, or any other resources that need
 * proper cleanup.
 *
 * Scopes support both sequential and parallel finalization strategies:
 * - Sequential: Finalizers run one after another in reverse order of registration
 * - Parallel: Finalizers run concurrently for better performance
 *
 * @since 2.0.0
 */

import type { Effect } from "./Effect.js"
import type { Exit } from "./Exit.js"
import * as effect from "./internal/effect.js"
import type * as ServiceMap from "./ServiceMap.js"

/**
 * @since 2.0.0
 * @category type ids
 */
export const TypeId: TypeId = effect.ScopeTypeId

/**
 * @since 2.0.0
 * @category type ids
 */
export type TypeId = "~effect/Scope"

/**
 * @since 2.0.0
 * @category models
 */
export interface Scope {
  readonly [TypeId]: TypeId
  readonly strategy: "sequential" | "parallel"
  state: Scope.State.Open | Scope.State.Closed
}

/**
 * @since 2.0.0
 * @category models
 */
export declare namespace Scope {
  /**
   * @since 2.0.0
   * @category models
   */
  export namespace State {
    /**
     * @since 2.0.0
     * @category models
     */
    export type Open = {
      readonly _tag: "Open"
      readonly finalizers: Map<{}, (exit: Exit<any, any>) => Effect<void>>
    }
    /**
     * @since 2.0.0
     * @category models
     */
    export type Closed = {
      readonly _tag: "Closed"
      readonly exit: Exit<any, any>
    }
  }
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Closeable extends Scope {
    readonly close: (exit: Exit<any, any>) => Effect<void>
  }
}

/**
 * @since 2.0.0
 * @category tags
 */
export const Scope: ServiceMap.Key<Scope, Scope> = effect.scopeTag

/**
 * Creates a new `Scope` with the specified finalizer strategy.
 *
 * @example
 * ```ts
 * import { Scope, Effect, Console, Exit } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create a scope with sequential cleanup
 *   const scope = yield* Scope.make("sequential")
 *
 *   // Add finalizers
 *   yield* Scope.addFinalizer(scope, () => Console.log("Cleanup 1"))
 *   yield* Scope.addFinalizer(scope, () => Console.log("Cleanup 2"))
 *
 *   // Close the scope (finalizers run in reverse order)
 *   yield* Scope.close(scope, Exit.void)
 *   // Output: "Cleanup 2", then "Cleanup 1"
 * })
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const make: (finalizerStrategy?: "sequential" | "parallel") => Effect<Scope.Closeable> = effect.scopeMake

/**
 * @since 4.0.0
 * @category constructors
 */
export const unsafeMake: (finalizerStrategy?: "sequential" | "parallel") => Scope.Closeable = effect.scopeUnsafeMake

/**
 * @since 4.0.0
 * @category combinators
 */
export const provide: {
  (value: Scope): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, Scope>>
  <A, E, R>(self: Effect<A, E, R>, value: Scope): Effect<A, E, Exclude<R, Scope>>
} = effect.provideScope

/**
 * Adds a finalizer to a scope that will be executed when the scope is closed.
 * Finalizers are cleanup functions that receive the exit value of the scope.
 *
 * @example
 * ```ts
 * import { Scope, Effect, Console, Exit } from "effect"
 *
 * const withResource = Effect.gen(function* () {
 *   const scope = yield* Scope.make()
 *
 *   // Add a finalizer for cleanup
 *   yield* Scope.addFinalizer(scope, (exit) =>
 *     Console.log(`Cleaning up resource. Exit: ${Exit.isSuccess(exit) ? "Success" : "Failure"}`)
 *   )
 *
 *   // Use the resource
 *   yield* Console.log("Using resource")
 *
 *   // Close the scope
 *   yield* Scope.close(scope, Exit.void)
 * })
 * ```
 *
 * @category combinators
 * @since 4.0.0
 */
export const addFinalizerExit: (scope: Scope, finalizer: (exit: Exit<any, any>) => Effect<unknown>) => Effect<void> =
  effect.scopeAddFinalizerExit

/**
 * @since 4.0.0
 * @category combinators
 */
export const addFinalizer: (scope: Scope, finalizer: Effect<unknown>) => Effect<void> = effect.scopeAddFinalizer

/**
 * Creates a child scope from a parent scope. The child scope inherits the
 * parent's finalization strategy unless overridden.
 *
 * @example
 * ```ts
 * import { Scope, Effect, Console, Exit } from "effect"
 *
 * const nestedScopes = Effect.gen(function* () {
 *   const parentScope = yield* Scope.make("sequential")
 *
 *   // Add finalizer to parent
 *   yield* Scope.addFinalizer(parentScope, () => Console.log("Parent cleanup"))
 *
 *   // Create child scope
 *   const childScope = yield* Scope.fork(parentScope, "parallel")
 *
 *   // Add finalizer to child
 *   yield* Scope.addFinalizer(childScope, () => Console.log("Child cleanup"))
 *
 *   // Close child first, then parent
 *   yield* Scope.close(childScope, Exit.void)
 *   yield* Scope.close(parentScope, Exit.void)
 * })
 * ```
 *
 * @category combinators
 * @since 4.0.0
 */
export const fork: (
  scope: Scope,
  finalizerStrategy?: "sequential" | "parallel"
) => Effect<Scope.Closeable> = effect.scopeFork

/**
 * @since 4.0.0
 * @category combinators
 */
export const unsafeFork: (scope: Scope, finalizerStrategy?: "sequential" | "parallel") => Scope.Closeable =
  effect.scopeUnsafeFork

/**
 * Closes a scope, running all registered finalizers in the appropriate order.
 * The exit value is passed to each finalizer.
 *
 * @example
 * ```ts
 * import { Scope, Effect, Console, Exit } from "effect"
 *
 * const resourceManagement = Effect.gen(function* () {
 *   const scope = yield* Scope.make("sequential")
 *
 *   // Add multiple finalizers
 *   yield* Scope.addFinalizer(scope, () => Console.log("Close database connection"))
 *   yield* Scope.addFinalizer(scope, () => Console.log("Close file handle"))
 *   yield* Scope.addFinalizer(scope, () => Console.log("Release memory"))
 *
 *   // Do some work...
 *   yield* Console.log("Performing operations...")
 *
 *   // Close scope - finalizers run in reverse order of registration
 *   yield* Scope.close(scope, Exit.succeed("Success!"))
 *   // Output: "Release memory", "Close file handle", "Close database connection"
 * })
 * ```
 *
 * @category combinators
 * @since 4.0.0
 */
export const close = <A, E>(self: Scope.Closeable, exit: Exit<A, E>): Effect<void> => self.close(exit)
