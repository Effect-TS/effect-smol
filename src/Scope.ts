/**
 * @since 2.0.0
 */

import * as Context from "./Context.js"
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
export const Default: Context.Reference<Scope> = effect.scopeTag

/**
 * @since 2.0.0
 * @category constructors
 */
export const make: (options?: { strategy?: "sequential" | "parallel" | undefined }) => Effect<Scope.Closeable> =
  effect.scopeMake

/**
 * @since 2.0.0
 * @category constructors
 */
export const makeScoped: {
  (options?: { strategy?: "sequential" | "parallel" }): Effect<Scope>
  <I>(tag: Context.Tag<I, Scope>): (options: { strategy?: "sequential" | "parallel" }) => Effect<Scope, never, I>
} = function() {
  if (arguments.length > 0 && Context.isTag(arguments[0])) {
    const tag = arguments[0]
    return (options: any) =>
      effect.flatMap(
        tag.asEffect(),
        (scope) => acquireRelease(scope, make({ strategy: options?.strategy }), close)
      )
  }
  return makeScoped(Default)(arguments[0])
} as any

/**
 * @since 4.0.0
 * @category constructors
 */
export const unsafeMake: (options?: { strategy?: "sequential" | "parallel" | undefined }) => Scope.Closeable =
  effect.scopeUnsafeMake

/**
 * @since 4.0.0
 * @category combinators
 */
export const provide: {
  <I>(tag: Context.Tag<I, Scope>): {
    (value: Scope): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, I>>
    <A, E, R>(self: Effect<A, E, R>, value: Scope): Effect<A, E, Exclude<R, I>>
  }
} = effect.provideScope

/**
 * @since 2.0.0
 * @category combinators
 */
export const scoped: <I>(
  tag: Context.Tag<I, Scope>
) => <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, I>> = effect.scoped

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
export const acquireRelease: <A, E, R>(
  scope: Scope,
  acquire: Effect<A, E, R>,
  release: (a: A, exit: Exit<unknown, unknown>) => Effect<unknown>
) => Effect<A, E, R> = effect.scopeAcquireRelease

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
  options?: { strategy?: "sequential" | "parallel" }
) => Effect<Scope.Closeable, never, never> = effect.scopeFork

/**
 * @since 4.0.0
 * @category combinators
 */
export const unsafeFork: (scope: Scope, options?: { strategy?: "sequential" | "parallel" }) => Scope.Closeable =
  effect.scopeUnsafeFork

/**
 * @since 4.0.0
 * @category combinators
 */
export const close: (scope: Scope.Closeable, microExit: Exit<any, any>) => Effect<void, never, never> =
  effect.scopeClose

/**
 * @since 4.0.0
 * @category constructors
 */
export const Named: <Self>() => <Name extends string>(name: Name) => Named<Name, Self> = () => (name) => {
  const tag = Context.Tag()(name)
  return tag as any
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Named<Name extends string, Self> extends Context.Tag<Self, Scope> {
  readonly key: Name
  new(_: never): {
    readonly _tag: Name
    readonly _id: unique symbol
  }
}
