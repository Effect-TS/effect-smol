/**
 * Generic actor runtime.
 *
 * @since 4.0.0
 */

import type * as ActorSystemModule from "./ActorSystem.ts"
import type * as Cause from "./Cause.ts"
import * as Effect from "./Effect.ts"
import type * as Exit from "./Exit.ts"
import type {
  ActorChildAlreadyExistsError,
  ActorStoppedError,
  ActorSystemIdAlreadyExistsError
} from "./internal/actorErrors.ts"
import { start as internalStart } from "./internal/actorSystem.ts"
import type * as Schedule from "./Schedule.ts"
import type * as Scope from "./Scope.ts"
import type * as Stream from "./Stream.ts"

export {
  /**
   * Error returned by `spawn` when a child actor with the same id already exists.
   *
   * @category errors
   * @since 4.0.0
   */
  ActorChildAlreadyExistsError,
  /**
   * Error returned by `join` when an actor is stopped before producing an output.
   *
   * @category errors
   * @since 4.0.0
   */
  ActorStoppedError,
  /**
   * Error returned by `spawn` when an actor with the same system id already exists.
   *
   * @category errors
   * @since 4.0.0
   */
  ActorSystemIdAlreadyExistsError
} from "./internal/actorErrors.ts"

/**
 * Reference to an actor that can receive events.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorRef<in Event> {
  readonly id: string
  readonly sessionId: string
  readonly systemId: string | undefined
  readonly send: (event: Event) => Effect.Effect<void>
}

/**
 * Lifecycle-aware snapshot of an actor.
 *
 * @category models
 * @since 4.0.0
 */
export type Snapshot<State, Error = never, Output = never> =
  | {
    readonly status: "active"
    readonly state: State
  }
  | {
    readonly status: "done"
    readonly state: State
    readonly output: Output
  }
  | {
    readonly status: "error"
    readonly state: State
    readonly cause: Cause.Cause<Error>
  }
  | {
    readonly status: "stopped"
    readonly state: State
  }

/**
 * Running actor with current state, lifecycle snapshots, and a stop action.
 *
 * @category models
 * @since 4.0.0
 */
export interface Actor<out State, in Event, out Error = never, out Output = never> extends ActorRef<Event> {
  readonly system: ActorSystemModule.ActorSystem
  readonly state: Effect.Effect<State>
  readonly snapshot: Effect.Effect<Snapshot<State, Error, Output>>
  readonly changes: Stream.Stream<Snapshot<State, Error, Output>>
  readonly join: Effect.Effect<Output, Error | ActorStoppedError>
  readonly stop: Effect.Effect<void>
}

/**
 * Root-scoped actor registry shared by an actor tree.
 *
 * @category models
 * @since 4.0.0
 */
export type ActorSystem = ActorSystemModule.ActorSystem

/**
 * Spawns an actor owned by an actor system.
 *
 * @category models
 * @since 4.0.0
 */
export type SystemSpawn = ActorSystemModule.SystemSpawn

/**
 * Lifecycle event emitted by an actor system.
 *
 * @category models
 * @since 4.0.0
 */
export type ActorSystemEvent = ActorSystemModule.Event

/**
 * Supervision strategy used when a child actor fails.
 *
 * **Details**
 *
 * `None` leaves the failed child in an error state. `StopOwner` stops the actor
 * or actor system that spawned the child. `Restart` resets the failed actor to
 * its initial state and runs it again according to the provided schedule.
 *
 * @category models
 * @since 4.0.0
 */
export type Supervision<Requirements = never> =
  | {
    readonly _tag: "None"
  }
  | {
    readonly _tag: "StopOwner"
  }
  | {
    readonly _tag: "Restart"
    readonly schedule: Schedule.Schedule<unknown, Exit.Exit<unknown, unknown>, never, Requirements>
  }

/**
 * Constructors for actor supervision strategies.
 *
 * @category constructors
 * @since 4.0.0
 */
export const Supervision: {
  readonly none: Supervision
  readonly stopOwner: Supervision
  readonly restart: <Requirements>(
    schedule: Schedule.Schedule<unknown, Exit.Exit<unknown, unknown>, never, Requirements>
  ) => Supervision<Requirements>
} = {
  none: { _tag: "None" },
  stopOwner: { _tag: "StopOwner" },
  restart: (schedule) => ({ _tag: "Restart", schedule })
}

/**
 * Options for spawning child actors.
 *
 * @category models
 * @since 4.0.0
 */
export interface SpawnOptions<out Requirements = never> {
  readonly id?: string
  readonly systemId?: string
  readonly supervision?: Supervision<Requirements>
}

/**
 * Options for spawning child actors with a parent-local id.
 *
 * @category models
 * @since 4.0.0
 */
export interface SpawnIdOptions<out Requirements = never> extends SpawnOptions<Requirements> {
  readonly id: string
}

/**
 * Options for starting a root actor.
 *
 * @category models
 * @since 4.0.0
 */
export interface StartOptions {
  readonly id?: string
  readonly systemId?: string
}

type SupervisionRequirements<Options> = Options extends {
  readonly supervision?: infer SupervisionOption
} ? SupervisionOption extends { readonly _tag: "Restart" } & Supervision<infer Requirements> ? Requirements : never
  : never

type SpawnRequirements<Requirements, Options = never> = Exclude<
  Requirements | SupervisionRequirements<Options>,
  Scope.Scope
>

type SpawnIdError<Options extends SpawnOptions> = "id" extends keyof Options ? Options extends {
    readonly id?: infer Id
  } ? [Id] extends [undefined] ? never : ActorChildAlreadyExistsError
  : ActorChildAlreadyExistsError
  : never

type SpawnSystemIdError<Options extends SpawnOptions> = "systemId" extends keyof Options ? Options extends {
    readonly systemId?: infer SystemId
  } ? [SystemId] extends [undefined] ? never : ActorSystemIdAlreadyExistsError
  : ActorSystemIdAlreadyExistsError
  : never

type SpawnError<Options extends SpawnOptions> = SpawnIdError<Options> | SpawnSystemIdError<Options>

type SpawnResult<State, Event, Error, Requirements, Output, SpawnError, Options = never> = Effect.Effect<
  Actor<State, Event, Error, Output>,
  SpawnError,
  SpawnRequirements<Requirements, Options>
>

interface Spawn {
  <ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput>(
    logic: ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput>
  ): SpawnResult<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, never>
  <
    ChildState,
    ChildEvent,
    ChildError,
    ChildRequirements,
    ChildOutput,
    Options extends SpawnOptions
  >(
    logic: ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput>,
    options: Options
  ): SpawnResult<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, SpawnError<Options>, Options>
}

/**
 * Runtime context available to an effect-backed actor.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorContext<State, Event> {
  readonly self: ActorRef<Event>
  readonly parent: ActorRef<unknown> | undefined
  readonly receive: Effect.Effect<Event>
  readonly system: ActorSystemModule.ActorSystem
  readonly state: Effect.Effect<State>
  readonly setState: (state: State) => Effect.Effect<void>
  readonly updateState: <E, R>(
    f: (state: State) => Effect.Effect<State, E, R>
  ) => Effect.Effect<void, E, R>
  readonly spawn: Spawn
  readonly sendTo: <ChildEvent>(id: string, event: ChildEvent) => Effect.Effect<void>
  readonly stopChild: (id: string) => Effect.Effect<void>
}

/**
 * Process logic used by an actor runtime.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorLogic<State, Event, out Error = never, out Requirements = never, out Output = never> {
  readonly initial: Effect.Effect<State, never, Requirements>
  readonly run: (context: ActorContext<State, Event>) => Effect.Effect<Output, Error, Requirements>
}

/**
 * Creates actor logic from an initial state and an effectful actor process.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromEffect = <State, Event, Output = void, Error = never, Requirements = never>(
  initial: State,
  effect: (context: ActorContext<State, Event>) => Effect.Effect<Output, Error, Requirements>
): ActorLogic<State, Event, Error, Requirements, Output> => ({
  initial: Effect.succeed(initial),
  run: effect
})

/**
 * Creates actor logic from an initial state and a transition function.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromTransition = <State, Event, Error = never, Requirements = never>(
  initial: State,
  transition: (state: State, event: Event) => Effect.Effect<State, Error, Requirements>
): ActorLogic<State, Event, Error, Requirements, never> =>
  fromEffect<State, Event, never, Error, Requirements>(initial, ({ receive, updateState }) =>
    receive.pipe(
      Effect.flatMap((event) => updateState((state) => transition(state, event))),
      Effect.forever
    ))

/**
 * Starts an actor from actor logic.
 *
 * @category constructors
 * @since 4.0.0
 */
export const start: <State, Event, Error = never, Requirements = never, Output = never>(
  logic: ActorLogic<State, Event, Error, Requirements, Output>,
  options?: StartOptions
) => Effect.Effect<Actor<State, Event, Error, Output>, never, Requirements> = internalStart
