import type { Reference } from "./Context.js"
import type { Effect } from "./Effect.js"
import type { Exit } from "./Exit.js"
import * as core from "./internal/core.js"

export declare namespace Scope {
  export type Finalizer = (exit: Exit<unknown, unknown>) => Effect<unknown, never, never>
}

export const ScopeTypeId: unique symbol = core.ScopeTypeId
export type ScopeTypeId = typeof ScopeTypeId

export interface Scope {
  readonly [ScopeTypeId]: ScopeTypeId
  readonly finalizers: Map<{}, Scope.Finalizer>
}

export const Scope: Reference<Scope, Scope> = core.ScopeRef

export const close: (scope: Scope, exit: Exit<unknown, unknown>) => Effect<undefined, never, never> = core.newScopeClose

export const addFinalizer: (scope: Scope, finalizer: Scope.Finalizer) => Effect<undefined, never, never> =
  core.newScopeAddFinalizer

export const unsafeMake: () => Scope = core.newScopeUnsafeMake

export const make: Effect<Scope, never, never> = core.sync(unsafeMake)

export const fork: (scope: Scope) => Effect<Scope, never, never> = core.newScopeFork

export const provide: {
  (value: Scope): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(self: Effect<A, E, R>, value: Scope): Effect<A, E, R>
} = core.makeProvideService(Scope)
