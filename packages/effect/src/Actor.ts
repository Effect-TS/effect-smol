/**
 * Generic actor runtime.
 *
 * @since 4.0.0
 */

import type * as Cause from "./Cause.ts"
import * as Channel from "./Channel.ts"
import * as Data from "./Data.ts"
import * as Deferred from "./Deferred.ts"
import * as Effect from "./Effect.ts"
import * as Exit from "./Exit.ts"
import * as Fiber from "./Fiber.ts"
import * as PubSub from "./PubSub.ts"
import * as Queue from "./Queue.ts"
import * as Stream from "./Stream.ts"
import * as SynchronizedRef from "./SynchronizedRef.ts"
import type * as Take from "./Take.ts"

/**
 * Reference to an actor that can receive events.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorRef<in Event> {
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
 * Error returned by `join` when an actor is stopped before producing an output.
 *
 * @category errors
 * @since 4.0.0
 */
export class ActorStoppedError extends Data.TaggedError("ActorStoppedError") {}

/**
 * Running actor with current state, lifecycle snapshots, and a stop action.
 *
 * @category models
 * @since 4.0.0
 */
export interface Actor<out State, in Event, out Error = never, out Output = never> extends ActorRef<Event> {
  readonly state: Effect.Effect<State>
  readonly snapshot: Effect.Effect<Snapshot<State, Error, Output>>
  readonly changes: Stream.Stream<Snapshot<State, Error, Output>>
  readonly join: Effect.Effect<Output, Error | ActorStoppedError>
  readonly stop: Effect.Effect<void>
}

/**
 * Runtime context available to an effect-backed actor.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorContext<State, Event> {
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
  logic: ActorLogic<State, Event, Error, Requirements, Output>
) => Effect.Effect<Actor<State, Event, Error, Output>, never, Requirements> = Effect.fnUntraced(
  function*<State, Event, Error, Requirements, Output>(
    logic: ActorLogic<State, Event, Error, Requirements, Output>
  ) {
    const initial = yield* logic.initial
    const queue = yield* Queue.unbounded<Event>()
    const current = yield* SynchronizedRef.make<Snapshot<State, Error, Output>>({
      status: "active",
      state: initial
    })
    const changes = yield* PubSub.unbounded<Take.Take<Snapshot<State, Error, Output>>>({ replay: 1 })
    const done = yield* Deferred.make<Output, Error | ActorStoppedError>()

    const publishSnapshot = (
      snapshot: Snapshot<State, Error, Output>
    ): Effect.Effect<Snapshot<State, Error, Output>> =>
      PubSub.publish(changes, [snapshot] as const).pipe(Effect.as(snapshot))

    const completeChanges: Effect.Effect<void> = PubSub.publish(changes, Exit.succeed<void>(undefined)).pipe(
      Effect.asVoid
    )

    const completeIfTerminal = (
      snapshot: Snapshot<State, Error, Output>
    ): Effect.Effect<Snapshot<State, Error, Output>> => {
      if (snapshot.status === "active") {
        return Effect.succeed(snapshot)
      }
      return completeChanges.pipe(Effect.as(snapshot))
    }

    const publishIfCurrent = (
      snapshot: Snapshot<State, Error, Output>
    ): Effect.Effect<Snapshot<State, Error, Output> | undefined> =>
      SynchronizedRef.get(current).pipe(
        Effect.flatMap((currentSnapshot): Effect.Effect<Snapshot<State, Error, Output> | undefined> =>
          currentSnapshot === snapshot
            ? publishSnapshot(snapshot).pipe(Effect.flatMap(completeIfTerminal))
            : Effect.succeed(undefined)
        )
      )

    const updateSnapshot = <E2, R2>(
      f: (snapshot: Snapshot<State, Error, Output>) => Effect.Effect<Snapshot<State, Error, Output> | undefined, E2, R2>
    ): Effect.Effect<Snapshot<State, Error, Output> | undefined, E2, R2> =>
      SynchronizedRef.modifyEffect(
        current,
        (snapshot) =>
          Effect.map(f(snapshot), (next) => next === undefined ? [undefined, snapshot] as const : [next, next] as const)
      ).pipe(
        Effect.flatMap((snapshot) => snapshot === undefined ? Effect.succeed(undefined) : publishIfCurrent(snapshot))
      )

    const setActiveState = (state: State) =>
      updateSnapshot((snapshot) =>
        Effect.succeed(
          snapshot.status === "active"
            ? {
              status: "active",
              state
            }
            : undefined
        )
      ).pipe(Effect.asVoid)

    const context: ActorContext<State, Event> = {
      receive: Queue.take(queue),
      state: SynchronizedRef.get(current).pipe(Effect.map((snapshot) => snapshot.state)),
      setState: setActiveState,
      updateState: (f) =>
        updateSnapshot((snapshot) =>
          snapshot.status === "active"
            ? f(snapshot.state).pipe(
              Effect.map((state) => ({
                status: "active",
                state
              }))
            )
            : Effect.succeed(undefined)
        ).pipe(Effect.asVoid)
    }

    yield* publishSnapshot(yield* SynchronizedRef.get(current))

    const changesStream: Stream.Stream<Snapshot<State, Error, Output>> = Stream.unwrap(
      Effect.gen(function*() {
        const subscription = yield* PubSub.subscribe(changes)
        const snapshot = yield* SynchronizedRef.get(current)
        if (snapshot.status !== "active") {
          return Stream.succeed(snapshot)
        }
        return Stream.succeed(snapshot).pipe(
          Stream.concat(
            Stream.fromChannel(Channel.fromEffectTake(PubSub.take(subscription))).pipe(
              Stream.dropUntil((next) => next === snapshot)
            )
          )
        )
      })
    )

    const fiber = yield* logic.run(context).pipe(
      Effect.matchCauseEffect({
        onFailure: (cause) =>
          updateSnapshot((snapshot) =>
            Effect.succeed(
              snapshot.status === "active"
                ? {
                  status: "error",
                  state: snapshot.state,
                  cause
                }
                : undefined
            )
          ).pipe(
            Effect.flatMap((snapshot) =>
              snapshot === undefined
                ? Effect.void
                : Deferred.failCause(done, cause).pipe(
                  Effect.andThen(Queue.shutdown(queue))
                )
            )
          ),
        onSuccess: (output) =>
          updateSnapshot((snapshot) =>
            Effect.succeed(
              snapshot.status === "active"
                ? {
                  status: "done",
                  state: snapshot.state,
                  output
                }
                : undefined
            )
          ).pipe(
            Effect.flatMap((snapshot) =>
              snapshot === undefined
                ? Effect.void
                : Deferred.succeed(done, output).pipe(Effect.andThen(Queue.shutdown(queue)))
            )
          )
      }),
      Effect.forkChild
    )

    return {
      state: SynchronizedRef.get(current).pipe(Effect.map((snapshot) => snapshot.state)),
      snapshot: SynchronizedRef.get(current),
      changes: changesStream,
      join: Deferred.await(done),
      stop: updateSnapshot((snapshot) =>
        Effect.succeed(
          snapshot.status === "active"
            ? {
              status: "stopped",
              state: snapshot.state
            }
            : undefined
        )
      ).pipe(
        Effect.flatMap((snapshot) =>
          snapshot === undefined
            ? Effect.void
            : Deferred.fail(done, new ActorStoppedError()).pipe(
              Effect.andThen(Queue.shutdown(queue)),
              Effect.andThen(Fiber.interrupt(fiber))
            )
        )
      ),
      send: (event: Event) => Queue.offer(queue, event).pipe(Effect.asVoid)
    } satisfies Actor<State, Event, Error, Output>
  }
)
