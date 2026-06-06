import type * as Actor from "../Actor.ts"
import type * as ActorSystem from "../ActorSystem.ts"
import type * as Cause from "../Cause.ts"
import * as Channel from "../Channel.ts"
import * as Deferred from "../Deferred.ts"
import * as Effect from "../Effect.ts"
import * as Exit from "../Exit.ts"
import * as Fiber from "../Fiber.ts"
import * as HashMap from "../HashMap.ts"
import * as Option from "../Option.ts"
import * as PubSub from "../PubSub.ts"
import * as Pull from "../Pull.ts"
import * as Queue from "../Queue.ts"
import * as Schedule from "../Schedule.ts"
import * as Scope from "../Scope.ts"
import * as Stream from "../Stream.ts"
import * as SynchronizedRef from "../SynchronizedRef.ts"
import type * as Take from "../Take.ts"
import { ActorChildAlreadyExistsError, ActorStoppedError, ActorSystemIdAlreadyExistsError } from "./actorErrors.ts"

type ChildEntry =
  | {
    readonly _tag: "Reserved"
  }
  | {
    readonly _tag: "Started"
    readonly token: symbol
    readonly send: (event: unknown) => Effect.Effect<void>
    readonly stop: Effect.Effect<void>
  }

type SystemEntry =
  | {
    readonly _tag: "Reserved"
  }
  | {
    readonly _tag: "Started"
    readonly token: symbol
    readonly ref: Actor.ActorRef<unknown>
    readonly stop: Effect.Effect<void>
  }

interface InternalStartOptions<out SupervisionRequirements = never> extends Actor.StartOptions {
  readonly fiberScope?: Scope.Scope
  readonly finalizer?: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<void>
  readonly onStop?: Effect.Effect<void>
  readonly parent?: Actor.ActorRef<unknown>
  readonly runtime: ActorRuntime
  readonly stopOwner?: Effect.Effect<void>
  readonly supervision?: Actor.Supervision<SupervisionRequirements>
}

/** @internal */
export interface ActorRuntime {
  readonly close: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<void>
  readonly nextSessionId: Effect.Effect<string>
  readonly publish: (event: ActorSystem.Event) => Effect.Effect<void>
  readonly system: ActorSystem.ActorSystem
  readonly systemRegistry: SynchronizedRef.SynchronizedRef<HashMap.HashMap<string, SystemEntry>>
  readonly systemScope: Scope.Closeable
}

type SupervisionRequirements<Options> = Options extends {
  readonly supervision?: infer SupervisionOption
} ? SupervisionOption extends { readonly _tag: "Restart" } & Actor.Supervision<infer Requirements> ? Requirements
  : never
  : never

type SpawnRequirements<Requirements, Options = never> = Exclude<
  Requirements | SupervisionRequirements<Options>,
  Scope.Scope
>

type SpawnIdError<Options extends Actor.SpawnOptions> = "id" extends keyof Options ? Options extends {
    readonly id?: infer Id
  } ? [Id] extends [undefined] ? never : ActorChildAlreadyExistsError
  : ActorChildAlreadyExistsError
  : never

type SpawnSystemIdError<Options extends Actor.SpawnOptions> = "systemId" extends keyof Options ? Options extends {
    readonly systemId?: infer SystemId
  } ? [SystemId] extends [undefined] ? never : ActorSystemIdAlreadyExistsError
  : ActorSystemIdAlreadyExistsError
  : never

type SpawnError<Options extends Actor.SpawnOptions> = SpawnIdError<Options> | SpawnSystemIdError<Options>

type SystemSpawnError<Options extends Actor.SpawnOptions> = SpawnSystemIdError<Options>

type SpawnResult<State, Event, Error, Requirements, Output, SpawnError, Options = never, InitialError = never> =
  Effect.Effect<
    Actor.Actor<State, Event, Error | InitialError, Output>,
    SpawnError | InitialError,
    SpawnRequirements<Requirements, Options>
  >

const reserveSystemId = (
  runtime: ActorRuntime,
  systemId: string
): Effect.Effect<void, ActorSystemIdAlreadyExistsError> =>
  SynchronizedRef.modifyEffect(runtime.systemRegistry, (registry) =>
    HashMap.has(registry, systemId)
      ? Effect.fail(new ActorSystemIdAlreadyExistsError({ systemId }))
      : Effect.succeed([undefined, HashMap.set(registry, systemId, { _tag: "Reserved" })] as const))

const unregisterReservedSystemId = (runtime: ActorRuntime, systemId: string): Effect.Effect<void> =>
  SynchronizedRef.update(runtime.systemRegistry, (registry) => {
    const entry = HashMap.get(registry, systemId)
    return Option.isSome(entry) && entry.value._tag === "Reserved"
      ? HashMap.remove(registry, systemId)
      : registry
  })

const unregisterStartedSystemId = (
  runtime: ActorRuntime,
  systemId: string,
  token: symbol
): Effect.Effect<void> =>
  SynchronizedRef.modify(runtime.systemRegistry, (registry) => {
    const entry = HashMap.get(registry, systemId)
    return Option.isSome(entry) && entry.value._tag === "Started" && entry.value.token === token
      ? [true, HashMap.remove(registry, systemId)] as const
      : [false, registry] as const
  }).pipe(
    Effect.flatMap((unregistered) =>
      unregistered ? runtime.publish({ _tag: "ActorUnregistered", systemId }) : Effect.void
    )
  )

const registerStartedSystemId = (
  runtime: ActorRuntime,
  systemId: string,
  token: symbol,
  ref: Actor.ActorRef<unknown>,
  stop: Effect.Effect<void>
): Effect.Effect<void> =>
  SynchronizedRef.update(
    runtime.systemRegistry,
    (registry) => HashMap.set(registry, systemId, { _tag: "Started", token, ref, stop })
  ).pipe(
    Effect.andThen(runtime.publish({ _tag: "ActorRegistered", systemId, ref }))
  )

const makeActorRuntime: Effect.Effect<ActorRuntime> = Effect.gen(function*() {
  let sessionIdCounter = 0
  const systemScope = yield* Scope.make("parallel")
  const systemRegistry = yield* SynchronizedRef.make<HashMap.HashMap<string, SystemEntry>>(HashMap.empty())
  const eventsPubSub = yield* PubSub.unbounded<Take.Take<ActorSystem.Event>>()

  const publish = (event: ActorSystem.Event): Effect.Effect<void> =>
    PubSub.publish(eventsPubSub, [event] as const).pipe(Effect.asVoid)

  const completeEvents: Effect.Effect<void> = PubSub.publish(eventsPubSub, Exit.succeed<void>(undefined)).pipe(
    Effect.asVoid
  )

  const close = (exit: Exit.Exit<unknown, unknown>): Effect.Effect<void> =>
    Scope.close(systemScope, exit).pipe(Effect.andThen(completeEvents))

  const events: Stream.Stream<ActorSystem.Event> = Stream.unwrap(
    PubSub.subscribe(eventsPubSub).pipe(
      Effect.map((subscription) => Stream.fromChannel(Channel.fromEffectTake(PubSub.take(subscription))))
    )
  )

  function spawn<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
    logic: Actor.ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>
  ): SpawnResult<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, never, never, ChildInitialError>
  function spawn<
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
    SystemSpawnError<Options>,
    Options,
    ChildInitialError
  >
  function spawn<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
    logic: Actor.ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>,
    spawnOptions?: Actor.SpawnOptions<any>
  ): SpawnResult<
    ChildState,
    ChildEvent,
    ChildError,
    ChildRequirements,
    ChildOutput,
    ActorSystemIdAlreadyExistsError,
    Actor.SpawnOptions<any>,
    ChildInitialError
  > {
    return Effect.acquireRelease(
      startInternal(logic, {
        ...spawnOptions,
        fiberScope: systemScope,
        runtime,
        stopOwner: runtime.close(Exit.void)
      }),
      (actor) => actor.stop
    ).pipe(Scope.provide(systemScope))
  }

  const system: ActorSystem.ActorSystem = {
    spawn,
    get: <Event = unknown>(systemId: string) =>
      SynchronizedRef.get(systemRegistry).pipe(
        Effect.map((registry) => {
          const entry = HashMap.get(registry, systemId)
          return Option.isSome(entry) && entry.value._tag === "Started"
            ? Option.some(entry.value.ref as Actor.ActorRef<Event>)
            : Option.none()
        })
      ),
    getAll: SynchronizedRef.get(systemRegistry).pipe(
      Effect.map((registry) =>
        HashMap.reduce(
          registry,
          HashMap.empty<string, Actor.ActorRef<unknown>>(),
          (actors, entry, systemId) => entry._tag === "Started" ? HashMap.set(actors, systemId, entry.ref) : actors
        )
      )
    ),
    send: <Event>(systemId: string, event: Event) =>
      SynchronizedRef.get(systemRegistry).pipe(
        Effect.flatMap((registry) => {
          const entry = HashMap.get(registry, systemId)
          return Option.isSome(entry) && entry.value._tag === "Started"
            ? entry.value.ref.send(event)
            : Effect.void
        })
      ),
    stop: (systemId: string) =>
      SynchronizedRef.get(systemRegistry).pipe(
        Effect.flatMap((registry) => {
          const entry = HashMap.get(registry, systemId)
          return Option.isSome(entry) && entry.value._tag === "Started" ? entry.value.stop : Effect.void
        })
      ),
    events
  }

  const runtime: ActorRuntime = {
    close,
    nextSessionId: Effect.sync(() => `actor:${sessionIdCounter++}`),
    publish,
    system,
    systemRegistry,
    systemScope
  }
  return runtime
})

/** @internal */
export const make: Effect.Effect<ActorSystem.ActorSystem, never, Scope.Scope> = Effect.acquireRelease(
  makeActorRuntime,
  (runtime) => runtime.close(Exit.void)
).pipe(Effect.map((runtime) => runtime.system))

const startInternal: <
  State,
  Event,
  Error = never,
  Requirements = never,
  Output = never,
  InitialError = never,
  SupervisionRequirements = never
>(
  logic: Actor.ActorLogic<State, Event, Error, Requirements, Output, InitialError>,
  options: InternalStartOptions<SupervisionRequirements>
) => Effect.Effect<
  Actor.Actor<State, Event, Error | InitialError, Output>,
  ActorSystemIdAlreadyExistsError | InitialError,
  Requirements | SupervisionRequirements
> = Effect.fnUntraced(
  function*<State, Event, Error, Requirements, Output, InitialError, SupervisionRequirements>(
    logic: Actor.ActorLogic<State, Event, Error, Requirements, Output, InitialError>,
    options: InternalStartOptions<SupervisionRequirements>
  ) {
    const sessionId = yield* options.runtime.nextSessionId
    const id = options.id ?? sessionId
    const initial = yield* logic.initial
    const queue = yield* Queue.unbounded<Event>()
    const current = yield* SynchronizedRef.make<Actor.Snapshot<State, Error | InitialError, Output>>({
      status: "active",
      state: initial
    })
    const changes = yield* PubSub.unbounded<Take.Take<Actor.Snapshot<State, Error | InitialError, Output>>>({
      replay: 1
    })
    const done = yield* Deferred.make<Output, Error | InitialError | ActorStoppedError>()
    const childrenScope = yield* Scope.make("parallel")
    const currentChildrenScope = yield* SynchronizedRef.make<Scope.Closeable>(childrenScope)
    const childRegistry = yield* SynchronizedRef.make<HashMap.HashMap<string, ChildEntry>>(HashMap.empty())
    const fiberRef = yield* Deferred.make<Fiber.Fiber<void>>()
    const systemToken = Symbol()

    const publishSnapshot = (
      snapshot: Actor.Snapshot<State, Error | InitialError, Output>
    ): Effect.Effect<Actor.Snapshot<State, Error | InitialError, Output>> =>
      PubSub.publish(changes, [snapshot] as const).pipe(Effect.as(snapshot))

    const completeChanges: Effect.Effect<void> = PubSub.publish(changes, Exit.succeed<void>(undefined)).pipe(
      Effect.asVoid
    )

    const completeIfTerminal = (
      snapshot: Actor.Snapshot<State, Error | InitialError, Output>
    ): Effect.Effect<Actor.Snapshot<State, Error | InitialError, Output>> => {
      if (snapshot.status === "active") {
        return Effect.succeed(snapshot)
      }
      return completeChanges.pipe(Effect.as(snapshot))
    }

    const publishIfCurrent = (
      snapshot: Actor.Snapshot<State, Error | InitialError, Output>
    ): Effect.Effect<Actor.Snapshot<State, Error | InitialError, Output> | undefined> =>
      SynchronizedRef.get(current).pipe(
        Effect.flatMap((
          currentSnapshot
        ): Effect.Effect<Actor.Snapshot<State, Error | InitialError, Output> | undefined> =>
          currentSnapshot === snapshot
            ? publishSnapshot(snapshot).pipe(Effect.flatMap(completeIfTerminal))
            : Effect.succeed(undefined)
        )
      )

    const modifySnapshot = <E2, R2>(
      f: (
        snapshot: Actor.Snapshot<State, Error | InitialError, Output>
      ) => Effect.Effect<Actor.Snapshot<State, Error | InitialError, Output> | undefined, E2, R2>
    ): Effect.Effect<Actor.Snapshot<State, Error | InitialError, Output> | undefined, E2, R2> =>
      SynchronizedRef.modifyEffect(
        current,
        (snapshot) =>
          Effect.map(
            f(snapshot),
            (next) => next === undefined ? [undefined, snapshot] as const : [next, next] as const
          )
      )

    const updateSnapshot = <E2, R2>(
      f: (
        snapshot: Actor.Snapshot<State, Error | InitialError, Output>
      ) => Effect.Effect<Actor.Snapshot<State, Error | InitialError, Output> | undefined, E2, R2>
    ): Effect.Effect<Actor.Snapshot<State, Error | InitialError, Output> | undefined, E2, R2> =>
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

    const self: Actor.ActorRef<Event> = {
      id,
      sessionId,
      systemId: options.systemId,
      send: (event: Event) => Queue.offer(queue, event).pipe(Effect.asVoid)
    }

    const publishStarted = options.parent === undefined
      ? options.runtime.publish({ _tag: "ActorStarted", ref: self as Actor.ActorRef<unknown> })
      : options.runtime.publish({
        _tag: "ActorStarted",
        ref: self as Actor.ActorRef<unknown>,
        parent: options.parent
      })
    const publishStopped = (exit: Exit.Exit<unknown, unknown>) =>
      options.runtime.publish({ _tag: "ActorStopped", ref: self as Actor.ActorRef<unknown>, exit })
    const closeChildren = <A, E>(exit: Exit.Exit<A, E>): Effect.Effect<void> =>
      SynchronizedRef.get(currentChildrenScope).pipe(
        Effect.flatMap((scope) => Scope.close(scope, exit))
      )
    const finalize = (exit: Exit.Exit<unknown, unknown>): Effect.Effect<void> =>
      options.finalizer === undefined ? Effect.void : options.finalizer(exit)
    const cleanup = options.systemId === undefined
      ? options.onStop ?? Effect.void
      : unregisterStartedSystemId(options.runtime, options.systemId, systemToken).pipe(
        Effect.andThen(options.onStop ?? Effect.void)
      )

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

    const registerStartedChild = (
      id: string,
      token: symbol,
      send: (event: unknown) => Effect.Effect<void>,
      stop: Effect.Effect<void>
    ): Effect.Effect<void> =>
      SynchronizedRef.update(
        childRegistry,
        (children) => HashMap.set(children, id, { _tag: "Started", token, send, stop })
      )

    const sendTo = <ChildEvent>(id: string, event: ChildEvent): Effect.Effect<void> =>
      SynchronizedRef.get(childRegistry).pipe(
        Effect.flatMap((children) => {
          const entry = HashMap.get(children, id)
          return Option.isSome(entry) && entry.value._tag === "Started" ? entry.value.send(event) : Effect.void
        })
      )

    const stopChild = (id: string): Effect.Effect<void> =>
      SynchronizedRef.get(childRegistry).pipe(
        Effect.flatMap((children) => {
          const entry = HashMap.get(children, id)
          return Option.isSome(entry) && entry.value._tag === "Started" ? entry.value.stop : Effect.void
        })
      )

    const stopSelf: Effect.Effect<void> = modifySnapshot((snapshot) =>
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
          : Effect.suspend(() => {
            const exit = Exit.void
            return Queue.shutdown(queue).pipe(
              Effect.andThen(closeChildren(exit)),
              Effect.andThen(publishStopped(exit)),
              Effect.andThen(cleanup),
              Effect.andThen(publishIfCurrent(snapshot)),
              Effect.andThen(finalize(exit)),
              Effect.andThen(Deferred.fail(done, new ActorStoppedError())),
              Effect.andThen(Deferred.await(fiberRef).pipe(Effect.flatMap(Fiber.interrupt)))
            )
          })
      )
    )

    if (options.systemId !== undefined) {
      yield* reserveSystemId(options.runtime, options.systemId)
    }

    yield* publishStarted

    if (options.systemId !== undefined) {
      const systemId = options.systemId
      yield* registerStartedSystemId(
        options.runtime,
        systemId,
        systemToken,
        self as Actor.ActorRef<unknown>,
        stopSelf
      ).pipe(
        Effect.onExit((exit) =>
          Exit.isFailure(exit) ? unregisterReservedSystemId(options.runtime, systemId) : Effect.void
        )
      )
    }

    const namedChild = <ChildState, ChildEvent, ChildError, ChildOutput>(
      child: Actor.Actor<ChildState, ChildEvent, ChildError, ChildOutput>
    ): Actor.Actor<ChildState, ChildEvent, ChildError, ChildOutput> => {
      return {
        id: child.id,
        sessionId: child.sessionId,
        systemId: child.systemId,
        system: child.system,
        state: child.state,
        snapshot: child.snapshot,
        changes: child.changes,
        join: child.join,
        stop: child.stop,
        send: child.send
      }
    }

    function spawn<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
      logic: Actor.ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>
    ): SpawnResult<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, never, never, ChildInitialError>
    function spawn<
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
      SpawnError<Options>,
      Options,
      ChildInitialError
    >
    function spawn<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
      logic: Actor.ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>,
      spawnOptions?: Actor.SpawnOptions<any>
    ): SpawnResult<
      ChildState,
      ChildEvent,
      ChildError,
      ChildRequirements,
      ChildOutput,
      ActorChildAlreadyExistsError | ActorSystemIdAlreadyExistsError,
      Actor.SpawnOptions<any>,
      ChildInitialError
    > {
      if (spawnOptions?.id === undefined) {
        return SynchronizedRef.get(currentChildrenScope).pipe(
          Effect.flatMap((childrenScope) =>
            Effect.acquireRelease(
              startInternal(logic, {
                ...spawnOptions,
                parent: self as Actor.ActorRef<unknown>,
                runtime: options.runtime,
                stopOwner: stopSelf
              }),
              (child) => child.stop
            ).pipe(Scope.provide(childrenScope))
          )
        )
      }
      const id = spawnOptions.id
      return SynchronizedRef.get(currentChildrenScope).pipe(
        Effect.flatMap((childrenScope) =>
          Effect.acquireRelease(
            Effect.gen(function*() {
              yield* reserveChildId(id)
              const token = Symbol()
              const child = yield* startInternal(logic, {
                ...spawnOptions,
                id,
                onStop: unregisterStartedChild(id, token),
                parent: self as Actor.ActorRef<unknown>,
                runtime: options.runtime,
                stopOwner: stopSelf
              }).pipe(Effect.onExit((exit) => Exit.isFailure(exit) ? unregisterReservedChild(id) : Effect.void))
              const named = namedChild(child)
              yield* registerStartedChild(id, token, (event) => named.send(event as ChildEvent), named.stop)
              return named
            }),
            (child) => child.stop
          ).pipe(Scope.provide(childrenScope))
        )
      )
    }

    const context: Actor.ActorContext<State, Event> = {
      self,
      parent: options.parent,
      spawn,
      sendTo,
      stopChild,
      receive: Queue.take(queue),
      system: options.runtime.system,
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

    const changesStream: Stream.Stream<Actor.Snapshot<State, Error | InitialError, Output>> = Stream.unwrap(
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

    const supervision: Actor.Supervision<SupervisionRequirements> = options.supervision ?? { _tag: "None" }
    const restartStep = supervision._tag === "Restart"
      ? yield* Schedule.toStepWithSleep(supervision.schedule)
      : undefined

    const terminalizeFailure = (cause: Cause.Cause<Error | InitialError>): Effect.Effect<void> =>
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
            : Effect.suspend(() => {
              const exit = Exit.failCause(cause)
              return Queue.shutdown(queue).pipe(
                Effect.andThen(closeChildren(exit)),
                Effect.andThen(publishStopped(exit)),
                Effect.andThen(cleanup),
                Effect.andThen(publishIfCurrent(snapshot)),
                Effect.andThen(finalize(exit)),
                Effect.andThen(Deferred.failCause(done, cause))
              )
            })
        )
      )

    const terminalizeSuccess = (output: Output): Effect.Effect<void> =>
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
            : Effect.suspend(() => {
              const exit = Exit.succeed(output)
              return Queue.shutdown(queue).pipe(
                Effect.andThen(closeChildren(exit)),
                Effect.andThen(publishStopped(exit)),
                Effect.andThen(cleanup),
                Effect.andThen(publishIfCurrent(snapshot)),
                Effect.andThen(finalize(exit)),
                Effect.andThen(Deferred.succeed(done, output))
              )
            })
        )
      )

    const resetForRestart: Effect.Effect<boolean, never, Requirements> = logic.initial.pipe(
      Effect.matchCauseEffect({
        onFailure: (cause) => terminalizeFailure(cause).pipe(Effect.as(false)),
        onSuccess: (state) =>
          Effect.gen(function*() {
            const nextChildrenScope = yield* Scope.make("parallel")
            yield* SynchronizedRef.set(currentChildrenScope, nextChildrenScope)
            const snapshot = yield* updateSnapshot((snapshot) =>
              Effect.succeed(
                snapshot.status === "active"
                  ? {
                    status: "active",
                    state
                  }
                  : undefined
              )
            )
            return snapshot !== undefined
          })
      })
    )

    const handleFailure = (
      cause: Cause.Cause<Error>
    ): Effect.Effect<boolean, never, Requirements | SupervisionRequirements> =>
      SynchronizedRef.get(current).pipe(
        Effect.flatMap((snapshot) => {
          if (snapshot.status !== "active") {
            return Effect.succeed(false)
          }
          if (supervision._tag === "Restart" && restartStep !== undefined) {
            const exit = Exit.failCause(cause)
            return closeChildren(exit).pipe(
              Effect.andThen(SynchronizedRef.set(childRegistry, HashMap.empty())),
              Effect.andThen(
                Pull.matchEffect(restartStep(exit), {
                  onSuccess: () => resetForRestart,
                  onFailure: () => terminalizeFailure(cause).pipe(Effect.as(false)),
                  onDone: () => terminalizeFailure(cause).pipe(Effect.as(false))
                })
              )
            )
          }
          const stopOwner = supervision._tag === "StopOwner" ? options.stopOwner ?? Effect.void : Effect.void
          return terminalizeFailure(cause).pipe(
            Effect.andThen(stopOwner),
            Effect.as(false)
          )
        })
      )

    const supervisedRun: Effect.Effect<void, never, Requirements | SupervisionRequirements> = Effect.gen(function*() {
      let restart = true
      while (restart) {
        restart = yield* logic.run(context).pipe(
          Effect.matchCauseEffect({
            onFailure: handleFailure,
            onSuccess: (output) => terminalizeSuccess(output).pipe(Effect.as(false))
          })
        )
      }
    })

    const fiber = yield* supervisedRun.pipe(
      (effect) =>
        options.fiberScope === undefined ? Effect.forkChild(effect) : Effect.forkIn(effect, options.fiberScope)
    )
    yield* Deferred.succeed(fiberRef, fiber)

    return {
      id,
      sessionId,
      systemId: options.systemId,
      system: options.runtime.system,
      state: SynchronizedRef.get(current).pipe(Effect.map((snapshot) => snapshot.state)),
      snapshot: SynchronizedRef.get(current),
      changes: changesStream,
      join: Deferred.await(done),
      stop: stopSelf,
      send: self.send
    } satisfies Actor.Actor<State, Event, Error | InitialError, Output>
  }
)

/** @internal */
export const start: <
  State,
  Event,
  Error = never,
  Requirements = never,
  Output = never,
  InitialError = never
>(
  logic: Actor.ActorLogic<State, Event, Error, Requirements, Output, InitialError>,
  options?: Actor.StartOptions
) => Effect.Effect<Actor.Actor<State, Event, Error | InitialError, Output>, InitialError, Requirements> = Effect
  .fnUntraced(
    function*<State, Event, Error, Requirements, Output, InitialError>(
      logic: Actor.ActorLogic<State, Event, Error, Requirements, Output, InitialError>,
      options?: Actor.StartOptions
    ) {
      const runtime = yield* makeActorRuntime
      return yield* startInternal(
        logic,
        options === undefined
          ? { finalizer: runtime.close, runtime }
          : { ...options, finalizer: runtime.close, runtime }
      ).pipe(
        Effect.onExit((exit) => Exit.isFailure(exit) ? runtime.close(exit) : Effect.void),
        Effect.catchTag("ActorSystemIdAlreadyExistsError", (error) => Effect.die(error))
      )
    }
  )
