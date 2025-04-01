/**
 * @since 2.0.0
 */

import type * as Context from "./Context.ts"
import type { Effect } from "./Effect.ts"
import type { Exit } from "./Exit.ts"
import * as effect from "./internal/effect.ts"

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
  state: Scope.State.Open | Scope.State.Closed | Scope.State.Empty
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
      readonly finalizers: Set<(exit: Exit<any, any>) => Effect<void>>
      readonly close: (exit: Exit<any, any>) => Effect<void>
    }
    /**
     * @since 2.0.0
     * @category models
     */
    export type Closed = {
      readonly _tag: "Closed"
      readonly exit: Exit<any, any>
    }
    /**
     * @since 2.0.0
     * @category models
     */
    export type Empty = {
      readonly _tag: "Empty"
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
export const unsafeAddFinalizer: (scope: Scope, finalizer: (exit: Exit<any, any>) => Effect<void>) => void =
  effect.scopeUnsafeAddFinalizer

/**
 * @since 4.0.0
 * @category combinators
 */
export const unsafeRemoveFinalizer: (scope: Scope, finalizer: (exit: Exit<any, any>) => Effect<void>) => void =
  effect.scopeUnsafeRemoveFinalizer

/**
 * @since 4.0.0
 * @category combinators
 */
export const fork: (
  scope: Scope,
  finalizerStrategy?: "sequential" | "parallel"
) => Effect<Scope.Closeable, never, never> = effect.scopeFork

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
export const close: (scope: Scope.Closeable, microExit: Exit<any, any>) => Effect<void, never, never> =
  effect.scopeClose
