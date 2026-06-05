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
import * as HashMap from "./HashMap.ts"
import * as Option from "./Option.ts"
import * as PubSub from "./PubSub.ts"
import * as Queue from "./Queue.ts"
import * as Scope from "./Scope.ts"
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
 * Error returned by `spawn` when a child actor with the same id already exists.
 *
 * @category errors
 * @since 4.0.0
 */
export class ActorChildAlreadyExistsError extends Data.TaggedError("ActorChildAlreadyExistsError")<{
  readonly id: string
}> {}

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

type ChildEntry =
  | {
    readonly _tag: "Reserved"
  }
  | {
    readonly _tag: "Started"
    readonly token: symbol
  }

/**
 * Options for spawning child actors.
 *
 * @category models
 * @since 4.0.0
 */
export interface SpawnOptions {
  readonly id?: string
}

/**
 * Options for spawning child actors with a parent-local id.
 *
 * @category models
 * @since 4.0.0
 */
export interface SpawnIdOptions extends SpawnOptions {
  readonly id: string
}

type SpawnRequirements<Requirements> = Exclude<Requirements, Scope.Scope>

type SpawnError<Options extends SpawnOptions> = Options extends SpawnIdOptions ? ActorChildAlreadyExistsError
  : Options extends { readonly id?: undefined } ? never
  : ActorChildAlreadyExistsError

type SpawnResult<State, Event, Error, Requirements, Output, SpawnError> = Effect.Effect<
  Actor<State, Event, Error, Output>,
  SpawnError,
  SpawnRequirements<Requirements>
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
  ): SpawnResult<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, SpawnError<Options>>
}

/**
 * Runtime context available to an effect-backed actor.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorContext<State, Event> {
  readonly self: ActorRef<Event>
  readonly receive: Effect.Effect<Event>
  readonly state: Effect.Effect<State>
  readonly setState: (state: State) => Effect.Effect<void>
  readonly updateState: <E, R>(
    f: (state: State) => Effect.Effect<State, E, R>
  ) => Effect.Effect<void, E, R>
  readonly spawn: Spawn
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
    const childrenScope = yield* Scope.make("parallel")
    const childRegistry = yield* SynchronizedRef.make<HashMap.HashMap<string, ChildEntry>>(HashMap.empty())

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

    const modifySnapshot = <E2, R2>(
      f: (snapshot: Snapshot<State, Error, Output>) => Effect.Effect<Snapshot<State, Error, Output> | undefined, E2, R2>
    ): Effect.Effect<Snapshot<State, Error, Output> | undefined, E2, R2> =>
      SynchronizedRef.modifyEffect(
        current,
        (snapshot) =>
          Effect.map(f(snapshot), (next) => next === undefined ? [undefined, snapshot] as const : [next, next] as const)
      )

    const updateSnapshot = <E2, R2>(
      f: (snapshot: Snapshot<State, Error, Output>) => Effect.Effect<Snapshot<State, Error, Output> | undefined, E2, R2>
    ): Effect.Effect<Snapshot<State, Error, Output> | undefined, E2, R2> =>
      modifySnapshot(f).pipe(
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

    const self: ActorRef<Event> = {
      send: (event: Event) => Queue.offer(queue, event).pipe(Effect.asVoid)
    }

    const closeChildren = <A, E>(exit: Exit.Exit<A, E>): Effect.Effect<void> => Scope.close(childrenScope, exit)

    const reserveChildId = (id: string): Effect.Effect<void, ActorChildAlreadyExistsError> =>
      SynchronizedRef.modifyEffect(childRegistry, (children) =>
        HashMap.has(children, id)
          ? Effect.fail(new ActorChildAlreadyExistsError({ id }))
          : Effect.succeed([undefined, HashMap.set(children, id, { _tag: "Reserved" })] as const))

    const unregisterReservedChild = (id: string): Effect.Effect<void> =>
      SynchronizedRef.update(childRegistry, (children) => {
        const entry = HashMap.get(children, id)
        return Option.isSome(entry) && entry.value._tag === "Reserved"
          ? HashMap.remove(children, id)
          : children
      })

    const unregisterStartedChild = (id: string, token: symbol): Effect.Effect<void> =>
      SynchronizedRef.update(childRegistry, (children) => {
        const entry = HashMap.get(children, id)
        return Option.isSome(entry) && entry.value._tag === "Started" && entry.value.token === token
          ? HashMap.remove(children, id)
          : children
      })

    const registerStartedChild = (id: string, token: symbol): Effect.Effect<void> =>
      SynchronizedRef.update(childRegistry, (children) => HashMap.set(children, id, { _tag: "Started", token }))

    const namedChild = <ChildState, ChildEvent, ChildError, ChildOutput>(
      id: string,
      token: symbol,
      child: Actor<ChildState, ChildEvent, ChildError, ChildOutput>
    ): Actor<ChildState, ChildEvent, ChildError, ChildOutput> => ({
      state: child.state,
      snapshot: child.snapshot,
      changes: child.changes,
      join: child.join,
      stop: child.stop.pipe(Effect.andThen(unregisterStartedChild(id, token))),
      send: child.send
    })

    function spawn<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput>(
      logic: ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput>
    ): SpawnResult<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, never>
    function spawn<
      ChildState,
      ChildEvent,
      ChildError,
      ChildRequirements,
      ChildOutput,
      Options extends SpawnOptions
    >(
      logic: ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput>,
      options: Options
    ): SpawnResult<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, SpawnError<Options>>
    function spawn<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput>(
      logic: ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput>,
      options?: SpawnOptions
    ): SpawnResult<
      ChildState,
      ChildEvent,
      ChildError,
      ChildRequirements,
      ChildOutput,
      ActorChildAlreadyExistsError
    > {
      if (options?.id === undefined) {
        return Effect.acquireRelease(
          start(logic),
          (child) => child.stop
        ).pipe(Scope.provide(childrenScope))
      }
      const id = options.id
      return Effect.acquireRelease(
        Effect.gen(function*() {
          yield* reserveChildId(id)
          const token = Symbol()
          const child = yield* start(logic).pipe(
            Effect.onExit((exit) => Exit.isFailure(exit) ? unregisterReservedChild(id) : Effect.void)
          )
          yield* registerStartedChild(id, token)
          return namedChild(id, token, child)
        }),
        (child) => child.stop
      ).pipe(Scope.provide(childrenScope))
    }

    const context: ActorContext<State, Event> = {
      self,
      spawn,
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
          modifySnapshot((snapshot) =>
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
                : Queue.shutdown(queue).pipe(
                  Effect.andThen(closeChildren(Exit.failCause(cause))),
                  Effect.andThen(publishIfCurrent(snapshot)),
                  Effect.andThen(Deferred.failCause(done, cause))
                )
            )
          ),
        onSuccess: (output) =>
          modifySnapshot((snapshot) =>
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
                : Queue.shutdown(queue).pipe(
                  Effect.andThen(closeChildren(Exit.succeed(output))),
                  Effect.andThen(publishIfCurrent(snapshot)),
                  Effect.andThen(Deferred.succeed(done, output))
                )
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
      stop: modifySnapshot((snapshot) =>
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
            : Queue.shutdown(queue).pipe(
              Effect.andThen(closeChildren(Exit.void)),
              Effect.andThen(publishIfCurrent(snapshot)),
              Effect.andThen(Deferred.fail(done, new ActorStoppedError())),
              Effect.andThen(Fiber.interrupt(fiber))
            )
        )
      ),
      send: self.send
    } satisfies Actor<State, Event, Error, Output>
  }
)
