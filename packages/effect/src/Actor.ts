/**
 * Generic actor runtime.
 *
 * @since 4.0.0
 */

import type * as ActorSystemModule from "./ActorSystem.ts"
import * as Cause from "./Cause.ts"
import * as Effect from "./Effect.ts"
import type * as Exit from "./Exit.ts"
import type {
  ActorChildAlreadyExistsError,
  ActorStoppedError,
  ActorSystemIdAlreadyExistsError
} from "./internal/actorErrors.ts"
import { start as internalStart } from "./internal/actorSystem.ts"
import * as Result from "./Result.ts"
import type * as Schedule from "./Schedule.ts"
import type * as Scope from "./Scope.ts"
import * as Stream from "./Stream.ts"

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
 * Terminal lifecycle event derived from an actor snapshot.
 *
 * @category models
 * @since 4.0.0
 */
export type WatchEvent<State, Error = never, Output = never> =
  | {
    readonly _tag: "Done"
    readonly output: Output
    readonly snapshot: Extract<Snapshot<State, Error, Output>, { readonly status: "done" }>
  }
  | {
    readonly _tag: "Failure"
    readonly error: Error
    readonly cause: Cause.Cause<Error>
    readonly snapshot: Extract<Snapshot<State, Error, Output>, { readonly status: "error" }>
  }
  | {
    readonly _tag: "Defect"
    readonly defect: unknown
    readonly cause: Cause.Cause<Error>
    readonly snapshot: Extract<Snapshot<State, Error, Output>, { readonly status: "error" }>
  }
  | {
    readonly _tag: "Interrupted"
    readonly cause: Cause.Cause<Error>
    readonly snapshot: Extract<Snapshot<State, Error, Output>, { readonly status: "error" }>
  }
  | {
    readonly _tag: "Cause"
    readonly cause: Cause.Cause<Error>
    readonly snapshot: Extract<Snapshot<State, Error, Output>, { readonly status: "error" }>
  }
  | {
    readonly _tag: "Stopped"
    readonly snapshot: Extract<Snapshot<State, Error, Output>, { readonly status: "stopped" }>
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

const classifyWatchEvent = <State, Error, Output>(
  snapshot: Snapshot<State, Error, Output>
): WatchEvent<State, Error, Output> | undefined => {
  switch (snapshot.status) {
    case "active": {
      return undefined
    }
    case "done": {
      return {
        _tag: "Done",
        output: snapshot.output,
        snapshot
      }
    }
    case "error": {
      const failure = snapshot.cause.reasons.find(Cause.isFailReason)
      if (failure !== undefined) {
        return {
          _tag: "Failure",
          error: failure.error,
          cause: snapshot.cause,
          snapshot
        }
      }
      const defect = snapshot.cause.reasons.find(Cause.isDieReason)
      if (defect !== undefined) {
        return {
          _tag: "Defect",
          defect: defect.defect,
          cause: snapshot.cause,
          snapshot
        }
      }
      const interrupted = snapshot.cause.reasons.find(Cause.isInterruptReason)
      if (interrupted !== undefined) {
        return {
          _tag: "Interrupted",
          cause: snapshot.cause,
          snapshot
        }
      }
      return {
        _tag: "Cause",
        cause: snapshot.cause,
        snapshot
      }
    }
    case "stopped": {
      return {
        _tag: "Stopped",
        snapshot
      }
    }
  }
}

/**
 * Returns a stream of terminal lifecycle events for an actor.
 *
 * **When to use**
 *
 * Use to observe actor completion, failure, interruption, defects, or explicit
 * stops without consuming every active state snapshot.
 *
 * **Details**
 *
 * The stream emits at most one event. It ignores active snapshots, emits the
 * first terminal event derived from the actor's `changes` stream, and then
 * completes. Error snapshots are classified in this order: typed failure,
 * defect, interruption, and finally the full cause fallback.
 *
 * **Example** (Forwarding child termination)
 *
 * ```ts
 * import { Actor, Effect, Stream } from "effect"
 *
 * const watchChild = (self: Actor.ActorRef<{ readonly _tag: "ChildStopped" }>, child: Actor.Actor<number, never>) =>
 *   Actor.watch(child).pipe(
 *     Stream.runForEach(() => self.send({ _tag: "ChildStopped" })),
 *     Effect.forkChild
 *   )
 * ```
 *
 * @see {@link Actor} for the raw `changes` stream of lifecycle snapshots
 * @category combinators
 * @since 4.0.0
 */
export const watch = <State, Event, Error = never, Output = never>(
  actor: Actor<State, Event, Error, Output>
): Stream.Stream<WatchEvent<State, Error, Output>> =>
  actor.changes.pipe(
    Stream.filterMap((snapshot) => {
      const event = classifyWatchEvent(snapshot)
      return event === undefined ? Result.failVoid : Result.succeed(event)
    }),
    Stream.take(1)
  )

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

type SpawnResult<State, Event, Error, Requirements, Output, SpawnError, Options = never, InitialError = never> =
  Effect.Effect<
    Actor<State, Event, Error | InitialError, Output>,
    SpawnError | InitialError,
    SpawnRequirements<Requirements, Options>
  >

interface Spawn {
  <ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
    logic: ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>
  ): SpawnResult<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, never, never, ChildInitialError>
  <
    ChildState,
    ChildEvent,
    ChildError,
    ChildRequirements,
    ChildOutput,
    Options extends SpawnOptions,
    ChildInitialError = never
  >(
    logic: ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>,
    options: Options
  ): SpawnResult<
    ChildState,
    ChildEvent,
    ChildError,
    ChildRequirements,
    ChildOutput,
    SpawnError<Options>,
    Options,
    ChildInitialError
  >
}

/**
 * Runtime scope available to actor initialization and execution logic.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorScope<Event> {
  readonly self: ActorRef<Event>
  readonly parent: ActorRef<unknown> | undefined
  readonly system: ActorSystemModule.ActorSystem
  readonly spawn: Spawn
  readonly sendTo: <ChildEvent>(id: string, event: ChildEvent) => Effect.Effect<void>
  readonly stopChild: (id: string) => Effect.Effect<void>
}

/**
 * Runtime context available to an effect-backed actor.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorContext<State, Event> extends ActorScope<Event> {
  readonly receive: Effect.Effect<Event>
  readonly state: Effect.Effect<State>
  readonly setState: (state: State) => Effect.Effect<void>
  readonly updateState: <E, R>(
    f: (state: State) => Effect.Effect<State, E, R>
  ) => Effect.Effect<void, E, R>
}

/**
 * Process logic used by an actor runtime.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorLogic<
  State,
  Event,
  out Error = never,
  out Requirements = never,
  out Output = never,
  out InitialError = never
> {
  readonly initial: (scope: ActorScope<Event>) => Effect.Effect<State, InitialError, Requirements>
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
  initial: () => Effect.succeed(initial),
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
export const start: <
  State,
  Event,
  Error = never,
  Requirements = never,
  Output = never,
  InitialError = never
>(
  logic: ActorLogic<State, Event, Error, Requirements, Output, InitialError>,
  options?: StartOptions
) => Effect.Effect<Actor<State, Event, Error | InitialError, Output>, InitialError, Requirements> = internalStart
