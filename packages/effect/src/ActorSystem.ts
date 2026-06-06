/**
 * Actor system runtime.
 *
 * @since 4.0.0
 */

import type * as Actor from "./Actor.ts"
import type * as Effect from "./Effect.ts"
import type * as Exit from "./Exit.ts"
import type * as HashMap from "./HashMap.ts"
import type { ActorSystemIdAlreadyExistsError } from "./internal/actorErrors.ts"
import * as internal from "./internal/actorSystem.ts"
import type * as Option from "./Option.ts"
import type * as Scope from "./Scope.ts"
import type * as Stream from "./Stream.ts"

export {
  /**
   * Error returned by `spawn` when an actor with the same system id already exists.
   *
   * @category errors
   * @since 4.0.0
   */
  ActorSystemIdAlreadyExistsError
} from "./internal/actorErrors.ts"

type SupervisionRequirements<Options> = Options extends {
  readonly supervision?: infer SupervisionOption
} ? SupervisionOption extends { readonly _tag: "Restart" } & Actor.Supervision<infer Requirements> ? Requirements
  : never
  : never

type SpawnRequirements<Requirements, Options = never> = Exclude<
  Requirements | SupervisionRequirements<Options>,
  Scope.Scope
>

type SpawnSystemIdError<Options extends Actor.SpawnOptions> = "systemId" extends keyof Options ? Options extends {
    readonly systemId?: infer SystemId
  } ? [SystemId] extends [undefined] ? never : ActorSystemIdAlreadyExistsError
  : ActorSystemIdAlreadyExistsError
  : never

type SpawnResult<State, Event, Error, Requirements, Output, SpawnError, Options = never, InitialError = never> =
  Effect.Effect<
    Actor.Actor<State, Event, Error | InitialError, Output>,
    SpawnError | InitialError,
    SpawnRequirements<Requirements, Options>
  >

/**
 * Lifecycle event emitted by an actor system.
 *
 * @category models
 * @since 4.0.0
 */
export type Event =
  | {
    readonly _tag: "ActorStarted"
    readonly ref: Actor.ActorRef<unknown>
    readonly parent?: Actor.ActorRef<unknown>
  }
  | {
    readonly _tag: "ActorStopped"
    readonly ref: Actor.ActorRef<unknown>
    readonly exit: Exit.Exit<unknown, unknown>
  }
  | {
    readonly _tag: "ActorRegistered"
    readonly systemId: string
    readonly ref: Actor.ActorRef<unknown>
  }
  | {
    readonly _tag: "ActorUnregistered"
    readonly systemId: string
  }

/**
 * Spawns an actor owned by an actor system.
 *
 * @category models
 * @since 4.0.0
 */
export interface SystemSpawn {
  <ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
    logic: Actor.ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>
  ): SpawnResult<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, never, never, ChildInitialError>
  <
    ChildState,
    ChildEvent,
    ChildError,
    ChildRequirements,
    ChildOutput,
    Options extends Actor.SpawnOptions,
    ChildInitialError = never
  >(
    logic: Actor.ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>,
    options: Options
  ): SpawnResult<
    ChildState,
    ChildEvent,
    ChildError,
    ChildRequirements,
    ChildOutput,
    SpawnSystemIdError<Options>,
    Options,
    ChildInitialError
  >
}

/**
 * Root-scoped actor registry shared by an actor tree.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorSystem {
  readonly spawn: SystemSpawn
  readonly get: <Event = unknown>(systemId: string) => Effect.Effect<Option.Option<Actor.ActorRef<Event>>>
  readonly getAll: Effect.Effect<HashMap.HashMap<string, Actor.ActorRef<unknown>>>
  readonly send: <Event>(systemId: string, event: Event) => Effect.Effect<void>
  readonly stop: (systemId: string) => Effect.Effect<void>
  readonly events: Stream.Stream<Event>
}

/**
 * Creates a scoped actor system.
 *
 * **When to use**
 *
 * Use when actor system lifecycle events should be observed before spawning the
 * first actor, or when multiple root actors should share the same system.
 *
 * **Gotchas**
 *
 * The `events` stream is live. Subscribe to it before spawning actors when the
 * initial `ActorStarted` events must be observed.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make: Effect.Effect<ActorSystem, never, Scope.Scope> = internal.make
