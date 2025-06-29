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
 * @category type ids
 */
export const CloseableScopeTypeId: unique symbol = effect.CloseableScopeTypeId

/**
 * @since 2.0.0
 * @category type ids
 */
export type CloseableScopeTypeId = typeof CloseableScopeTypeId

/**
 * @since 2.0.0
 * @category models
 */
export interface Scope {
  readonly [TypeId]: TypeId
  readonly strategy: "sequential" | "parallel"
  readonly close: (exit: Exit<any, any>) => Effect<void>
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
    readonly [CloseableScopeTypeId]: CloseableScopeTypeId
  }
}

/**
 * @since 2.0.0
 * @category tags
 */
export const Scope: Context.Tag<Scope, Scope> = effect.scopeTag

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
  (value: Scope): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, Scope>>
  <A, E, R>(self: Effect<A, E, R>, value: Scope): Effect<A, E, Exclude<R, Scope>>
} = effect.provideScope

/**
 * @since 4.0.0
 * @category combinators
 */
export const addFinalizer: (scope: Scope, finalizer: (exit: Exit<any, any>) => Effect<void>) => Effect<void> =
  effect.scopeAddFinalizer

/**
 * @since 4.0.0
 * @category combinators
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
 * @since 4.0.0
 * @category combinators
 */
export const close = <A, E>(self: Scope.Closeable, exit: Exit<A, E>): Effect<void> => self.close(exit)
