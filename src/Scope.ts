/**
 * @since 2.0.0
 */

import type * as Context from "./Context.js"
import type { Effect } from "./Effect.js"
import type { Exit } from "./Exit.js"
import * as effect from "./internal/effect.js"

/**
 * @since 2.0.0
 * @category type ids
 */
export const TypeId: unique symbol = effect.ScopeTypeId

/**
 * @since 2.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 2.0.0
 * @category models
 */
export interface Scope {
  readonly [TypeId]: TypeId
  state: Scope.State.Open | Scope.State.Closed
  addFinalizer(finalizer: (exit: Exit<unknown, unknown>) => Effect<void>): Effect<void>
  unsafeAddFinalizer(finalizer: (exit: Exit<any, any>) => Effect<void>): void
  unsafeRemoveFinalizer(finalizer: (exit: Exit<any, any>) => Effect<void>): void
  get fork(): Effect<Scope.Closeable>
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
      readonly finalizerStrategy: "sequential" | "parallel"
      readonly finalizers: Set<(exit: Exit<any, any>) => Effect<void>>
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
    close(exit: Exit<any, any>): Effect<void>
  }
}

/**
 * @since 2.0.0
 * @category tags
 */
export const Scope: Context.Reference<Scope> = effect.scopeTag

/**
 * @since 2.0.0
 * @category constructors
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
  (value: Scope): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(self: Effect<A, E, R>, value: Scope): Effect<A, E, R>
} = effect.provideScope
