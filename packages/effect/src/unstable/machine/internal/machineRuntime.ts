/**
 * Internal machine runtime planning helpers.
 *
 * @since 4.0.0
 */

import * as Cause from "../../../Cause.ts"
import * as Channel from "../../../Channel.ts"
import * as Context from "../../../Context.ts"
import * as Deferred from "../../../Deferred.ts"
import * as Effect from "../../../Effect.ts"
import * as Exit from "../../../Exit.ts"
import * as Fiber from "../../../Fiber.ts"
import * as HashMap from "../../../HashMap.ts"
import * as Option from "../../../Option.ts"
import * as PubSub from "../../../PubSub.ts"
import * as Queue from "../../../Queue.ts"
import * as Ref from "../../../Ref.ts"
import type * as Schema from "../../../Schema.ts"
import * as Scope from "../../../Scope.ts"
import * as Stream from "../../../Stream.ts"
import * as SynchronizedRef from "../../../SynchronizedRef.ts"
import type * as Take from "../../../Take.ts"
import type { InitialEvent as MachineInitialEvent, Machine, Runtime } from "../Machine.ts"
import {
  ChildAlreadyExistsError,
  InfiniteTransitionError,
  StartupError,
  StoppedError,
  UnhandledEventError
} from "./machineErrors.ts"
import {
  type ActiveConfiguration,
  compareDocumentOrder,
  completeConfiguration,
  getActiveLeafPathFrom,
  getActiveLeafPaths,
  getActiveValue,
  getInitialEntryPaths,
  getLeafPath,
  getNode,
  getPathToRoot,
  isActiveFinalConfiguration,
  isDescendantOf,
  isSnapshot,
  isTarget,
  normalizeConfiguration,
  normalizeTargetConfiguration,
  pathDepth,
  snapshotFromConfiguration,
  validateInitialConfiguration
} from "./machineModel.ts"

export type DeferredAction<E = any, R = any> = Effect.Effect<void, E, R>

type IsAny<A> = 0 extends (1 & A) ? true : false

type ExcludeCompatibleRuntime<Requirements, Events, Emits> = Requirements extends Runtime.Requirement<
  infer RequiredEvents,
  infer RequiredEmits
> ? IsAny<Requirements> extends true ? Requirements
  : [RequiredEvents] extends [Events] ? [RequiredEmits] extends [Emits] ? never : Requirements
  : Requirements
  : Requirements

export interface DeferredQueue<A> {
  readonly add: (value: A) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<A>>
}

export class DeferredActions extends Context.Service<DeferredActions, {
  readonly add: <E, R>(effect: DeferredAction<E, R>) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<DeferredAction>>
}>()("effect/Machine/DeferredActions") {}

export class DeferredRaisedEvents extends Context.Service<DeferredRaisedEvents, {
  readonly add: <Event>(event: Event) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<any>>
}>()("effect/Machine/DeferredRaisedEvents") {}

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

export type RuntimeSnapshot<State, Error = never, Output = never> =
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

export type RuntimeOutcome<State, Error = never, Output = never> =
  | {
    readonly _tag: "Done"
    readonly output: Output
    readonly snapshot: Extract<RuntimeSnapshot<State, Error, Output>, { readonly status: "done" }>
  }
  | {
    readonly _tag: "Failure"
    readonly error: Error
    readonly cause: Cause.Cause<Error>
    readonly snapshot: Extract<RuntimeSnapshot<State, Error, Output>, { readonly status: "error" }>
  }
  | {
    readonly _tag: "Defect"
    readonly defect: unknown
    readonly cause: Cause.Cause<Error>
    readonly snapshot: Extract<RuntimeSnapshot<State, Error, Output>, { readonly status: "error" }>
  }
  | {
    readonly _tag: "Interrupted"
    readonly cause: Cause.Cause<Error>
    readonly snapshot: Extract<RuntimeSnapshot<State, Error, Output>, { readonly status: "error" }>
  }
  | {
    readonly _tag: "Cause"
    readonly cause: Cause.Cause<Error>
    readonly snapshot: Extract<RuntimeSnapshot<State, Error, Output>, { readonly status: "error" }>
  }
  | {
    readonly _tag: "Stopped"
    readonly snapshot: Extract<RuntimeSnapshot<State, Error, Output>, { readonly status: "stopped" }>
  }

export interface MachineRef<out State, in Event, out Error = never, out Output = never> {
  readonly id: string
  readonly sessionId: string
  readonly state: Effect.Effect<State>
  readonly snapshot: Effect.Effect<RuntimeSnapshot<State, Error, Output>>
  readonly changes: Stream.Stream<RuntimeSnapshot<State, Error, Output>>
  readonly join: Effect.Effect<Output, Error | StoppedError>
  readonly stop: Effect.Effect<void>
  readonly send: (event: Event) => Effect.Effect<void>
}

export interface ProcessScope<Event> {
  readonly self: MachineRef<unknown, Event, unknown, unknown>
  readonly parent: MachineRef<unknown, unknown, unknown, unknown> | undefined
  readonly spawn: ProcessSpawn
  readonly sendParent: (event: unknown) => Effect.Effect<void>
  readonly sendTo: <Address extends string>(id: Address, event: unknown) => Effect.Effect<void>
  readonly stopChild: (id: string) => Effect.Effect<void>
}

export interface ProcessContext<State, Event> extends ProcessScope<Event> {
  readonly receive: Effect.Effect<Event>
  readonly state: Effect.Effect<State>
  readonly setState: (state: State) => Effect.Effect<void>
  readonly updateState: <E, R>(
    f: (state: State) => Effect.Effect<State, E, R>
  ) => Effect.Effect<void, E, R>
}

export interface ProcessLogic<
  State,
  Event,
  out Error = never,
  out Requirements = never,
  out Output = never,
  out InitialError = never
> {
  readonly initial: (scope: ProcessScope<Event>) => Effect.Effect<State, InitialError, Requirements>
  readonly run: (context: ProcessContext<State, Event>) => Effect.Effect<Output, Error, Requirements>
}

export interface ProcessSpawn {
  <ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
    logic: ProcessLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>
  ): Effect.Effect<
    MachineRef<ChildState, ChildEvent, ChildError | ChildInitialError, ChildOutput>,
    ChildInitialError,
    Exclude<ChildRequirements, Scope.Scope>
  >
  <ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
    logic: ProcessLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>,
    options: {
      readonly id: string
    }
  ): Effect.Effect<
    MachineRef<ChildState, ChildEvent, ChildError | ChildInitialError, ChildOutput>,
    ChildAlreadyExistsError | ChildInitialError,
    Exclude<ChildRequirements, Scope.Scope>
  >
}

export class MachineRuntime extends Context.Service<MachineRuntime, ProcessScope<any>>()(
  "effect/Machine/MachineRuntime"
) {}

export class RuntimeContext extends Context.Service<RuntimeContext, Runtime<any, any>>()(
  "effect/Machine/Runtime"
) {}

export const makeDeferredQueue = <A>(): Effect.Effect<DeferredQueue<A>> =>
  Effect.sync(() => {
    const values: Array<A> = []
    return {
      read: Effect.sync(() => values),
      add: (value) =>
        Effect.sync(() => {
          values.push(value)
        })
    }
  })

export const makeDeferredActions = Effect.map(
  makeDeferredQueue<DeferredAction>(),
  (queue) =>
    DeferredActions.of({
      read: queue.read,
      add: (effect) => queue.add(effect)
    })
)

export const makeDeferredRaisedEvents = Effect.map(
  makeDeferredQueue<any>(),
  (queue) =>
    DeferredRaisedEvents.of({
      read: queue.read,
      add: (event) => queue.add(event)
    })
)

export const provideDeferredServices = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  deferredActions: DeferredActions["Service"],
  deferredRaisedEvents: DeferredRaisedEvents["Service"]
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.provideService(DeferredActions, deferredActions),
    Effect.provideService(DeferredRaisedEvents, deferredRaisedEvents),
    Effect.provideService(RuntimeContext, makePlanningRuntime(deferredRaisedEvents))
  )

export const provideMachineRuntime = <A, E, R, Event>(
  effect: Effect.Effect<A, E, R>,
  scope: ProcessScope<Event>
): Effect.Effect<A, E, Exclude<R, MachineRuntime>> =>
  Effect.provideService(effect, MachineRuntime, scope as ProcessScope<any>)

export const provideRuntimeContext = <A, E, R, Events, Emits>(
  effect: Effect.Effect<A, E, R>,
  runtime: Runtime<Events, Emits>
): Effect.Effect<A, E, R> =>
  Effect.provideService(
    effect as Effect.Effect<A, E, R | RuntimeContext>,
    RuntimeContext,
    runtime as Runtime<any, any>
  ) as Effect.Effect<A, E, R>

export const sendParentOptional = <Event>(event: Event): Effect.Effect<void> =>
  Effect.contextWith((context: Context.Context<never>) => {
    const runtime = Context.getOption(context as Context.Context<MachineRuntime>, MachineRuntime)
    return Option.isSome(runtime)
      ? runtime.value.sendParent(event)
      : Effect.void
  })

export const makePlanningRuntime = <Events, Emits>(
  deferredRaisedEvents: DeferredRaisedEvents["Service"]
): Runtime<Events, Emits> =>
  RuntimeContext.of({
    raise: (event) => deferredRaisedEvents.add(event),
    sendParent: sendParentOptional
  })

export const makeLiveRuntime = <Events, Emits>(
  scope: ProcessScope<Events>
): Runtime<Events, Emits> =>
  RuntimeContext.of({
    raise: (event) => scope.self.send(event),
    sendParent: (event) => scope.sendParent(event)
  })

export const runActions = <E, R, Events, Emits>(
  actions: Iterable<Effect.Effect<void, E, R>>,
  runtime: Runtime<Events, Emits>
): Effect.Effect<void, E, R> =>
  Effect.all(
    Array.from(actions, (action) => provideRuntimeContext(action, runtime)),
    { discard: true }
  )

const classifyOutcome = <State, Error, Output>(
  snapshot: RuntimeSnapshot<State, Error, Output>
): RuntimeOutcome<State, Error, Output> | undefined => {
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

export const watch = <State, Event, Error = never, Output = never>(
  ref: MachineRef<State, Event, Error, Output>
): Stream.Stream<RuntimeOutcome<State, Error, Output>> =>
  ref.changes.pipe(
    Stream.filter((snapshot) => snapshot.status !== "active"),
    Stream.map((snapshot) => classifyOutcome(snapshot)!),
    Stream.take(1)
  )

interface ProcessRuntime {
  readonly close: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<void>
  readonly nextSessionId: Effect.Effect<string>
  readonly rootScope: Scope.Closeable
}

const makeProcessRuntime: Effect.Effect<ProcessRuntime> = Effect.gen(function*() {
  let sessionIdCounter = 0
  const rootScope = yield* Scope.make("parallel")
  return {
    close: (exit) => Scope.close(rootScope, exit),
    nextSessionId: Effect.sync(() => `machine:${sessionIdCounter++}`),
    rootScope
  }
})

interface StartInternalOptions {
  readonly fiberScope?: Scope.Scope
  readonly finalizer?: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<void>
  readonly id?: string
  readonly onStop?: Effect.Effect<void>
  readonly parent?: MachineRef<unknown, unknown, unknown, unknown>
  readonly runtime: ProcessRuntime
}

const startInternal: <
  State,
  Event,
  Error = never,
  Requirements = never,
  Output = never,
  InitialError = never
>(
  logic: ProcessLogic<State, Event, Error, Requirements, Output, InitialError>,
  options: StartInternalOptions
) => Effect.Effect<
  MachineRef<State, Event, Error | InitialError, Output>,
  InitialError,
  Requirements
> = Effect.fnUntraced(function*<State, Event, Error, Requirements, Output, InitialError>(
  logic: ProcessLogic<State, Event, Error, Requirements, Output, InitialError>,
  options: StartInternalOptions
) {
  const sessionId = yield* options.runtime.nextSessionId
  const id = options.id ?? sessionId
  const queue = yield* Queue.unbounded<Event>()
  const stopSelfDeferred = yield* Deferred.make<Effect.Effect<void>>()
  const done = yield* Deferred.make<Output, Error | InitialError | StoppedError>()
  const fiberRef = yield* Deferred.make<Fiber.Fiber<void>>()
  const changes = yield* PubSub.unbounded<Take.Take<RuntimeSnapshot<State, Error | InitialError, Output>>>({
    replay: 1
  })
  const childrenScope = yield* Scope.make("parallel")
  const childRegistry = yield* SynchronizedRef.make<HashMap.HashMap<string, ChildEntry>>(HashMap.empty())
  const currentChildrenScope = yield* SynchronizedRef.make<Scope.Closeable>(childrenScope)

  const closeChildren = <A, E>(exit: Exit.Exit<A, E>): Effect.Effect<void> =>
    SynchronizedRef.get(currentChildrenScope).pipe(
      Effect.flatMap((scope) => Scope.close(scope, exit))
    )

  const cleanupStartupFailure = <A, E>(exit: Exit.Exit<A, E>): Effect.Effect<void> =>
    Exit.isFailure(exit)
      ? Deferred.succeed(stopSelfDeferred, Effect.void).pipe(
        Effect.andThen(closeChildren(exit))
      )
      : Effect.void

  const finalize = (exit: Exit.Exit<unknown, unknown>): Effect.Effect<void> =>
    options.finalizer === undefined ? Effect.void : options.finalizer(exit)

  const cleanup = options.onStop ?? Effect.void

  const reserveChildId = (id: string): Effect.Effect<void, ChildAlreadyExistsError> =>
    SynchronizedRef.modifyEffect(childRegistry, (children) =>
      HashMap.has(children, id)
        ? Effect.fail(new ChildAlreadyExistsError({ id }))
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

  const sendTo = (id: string, event: unknown): Effect.Effect<void> =>
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

  const sendParent = (event: unknown): Effect.Effect<void> =>
    options.parent === undefined ? Effect.void : options.parent.send(event)

  function spawn<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
    logic: ProcessLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>
  ): Effect.Effect<
    MachineRef<ChildState, ChildEvent, ChildError | ChildInitialError, ChildOutput>,
    ChildInitialError,
    Exclude<ChildRequirements, Scope.Scope>
  >
  function spawn<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
    logic: ProcessLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>,
    spawnOptions: {
      readonly id: string
    }
  ): Effect.Effect<
    MachineRef<ChildState, ChildEvent, ChildError | ChildInitialError, ChildOutput>,
    ChildAlreadyExistsError | ChildInitialError,
    Exclude<ChildRequirements, Scope.Scope>
  >
  function spawn<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
    logic: ProcessLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>,
    spawnOptions?: {
      readonly id: string
    }
  ): Effect.Effect<
    MachineRef<ChildState, ChildEvent, ChildError | ChildInitialError, ChildOutput>,
    ChildAlreadyExistsError | ChildInitialError,
    Exclude<ChildRequirements, Scope.Scope>
  > {
    if (spawnOptions?.id === undefined) {
      return SynchronizedRef.get(currentChildrenScope).pipe(
        Effect.flatMap((childrenScope) =>
          Effect.acquireRelease(
            startInternal(logic, {
              fiberScope: childrenScope,
              parent: self as MachineRef<unknown, unknown, unknown, unknown>,
              runtime: options.runtime
            }),
            (child) => child.stop
          ).pipe(Scope.provide(childrenScope))
        )
      ) as Effect.Effect<
        MachineRef<ChildState, ChildEvent, ChildError | ChildInitialError, ChildOutput>,
        ChildInitialError,
        Exclude<ChildRequirements, Scope.Scope>
      >
    }

    const childId = spawnOptions.id
    return SynchronizedRef.get(currentChildrenScope).pipe(
      Effect.flatMap((childrenScope) =>
        Effect.acquireRelease(
          Effect.gen(function*() {
            yield* reserveChildId(childId)
            const token = Symbol()
            const child = yield* startInternal(logic, {
              fiberScope: childrenScope,
              id: childId,
              onStop: unregisterStartedChild(childId, token),
              parent: self as MachineRef<unknown, unknown, unknown, unknown>,
              runtime: options.runtime
            }).pipe(Effect.onExit((exit) => Exit.isFailure(exit) ? unregisterReservedChild(childId) : Effect.void))
            yield* registerStartedChild(childId, token, (event) => child.send(event as ChildEvent), child.stop)
            return child
          }),
          (child) => child.stop
        ).pipe(Scope.provide(childrenScope))
      )
    ) as Effect.Effect<
      MachineRef<ChildState, ChildEvent, ChildError | ChildInitialError, ChildOutput>,
      ChildAlreadyExistsError | ChildInitialError,
      Exclude<ChildRequirements, Scope.Scope>
    >
  }

  const self: MachineRef<unknown, Event, unknown, unknown> = {
    id,
    sessionId,
    state: Effect.die("Machine self state is not available during initialization"),
    snapshot: Effect.die("Machine self snapshot is not available during initialization"),
    changes: Stream.empty,
    join: Effect.never,
    stop: Deferred.await(stopSelfDeferred).pipe(Effect.flatMap((stopSelf) => stopSelf)),
    send: (event: Event) => Queue.offer(queue, event).pipe(Effect.asVoid)
  }

  const scope: ProcessScope<Event> = {
    self,
    parent: options.parent,
    spawn: spawn as ProcessSpawn,
    sendParent,
    sendTo,
    stopChild
  }

  const initial = yield* logic.initial(scope).pipe(Effect.onExit(cleanupStartupFailure))
  const current = yield* SynchronizedRef.make<RuntimeSnapshot<State, Error | InitialError, Output>>({
    status: "active",
    state: initial
  })
  const terminalizing = yield* Ref.make(false)

  const publishSnapshot = (
    snapshot: RuntimeSnapshot<State, Error | InitialError, Output>
  ): Effect.Effect<RuntimeSnapshot<State, Error | InitialError, Output>> =>
    PubSub.publish(changes, [snapshot] as const).pipe(Effect.as(snapshot))

  const completeChanges: Effect.Effect<void> = PubSub.publish(changes, Exit.succeed<void>(undefined)).pipe(
    Effect.asVoid
  )

  const completeIfTerminal = (
    snapshot: RuntimeSnapshot<State, Error | InitialError, Output>
  ): Effect.Effect<RuntimeSnapshot<State, Error | InitialError, Output>> => {
    if (snapshot.status === "active") {
      return Effect.succeed(snapshot)
    }
    return completeChanges.pipe(Effect.as(snapshot))
  }

  const publishIfCurrent = (
    snapshot: RuntimeSnapshot<State, Error | InitialError, Output>
  ): Effect.Effect<RuntimeSnapshot<State, Error | InitialError, Output> | undefined> =>
    SynchronizedRef.get(current).pipe(
      Effect.flatMap((
        currentSnapshot
      ): Effect.Effect<RuntimeSnapshot<State, Error | InitialError, Output> | undefined> =>
        currentSnapshot === snapshot
          ? publishSnapshot(snapshot).pipe(Effect.flatMap(completeIfTerminal))
          : Effect.succeed(undefined)
      )
    )

  type SnapshotModification = readonly [
    RuntimeSnapshot<State, Error | InitialError, Output> | undefined,
    RuntimeSnapshot<State, Error | InitialError, Output>
  ]

  const updateSnapshot = <E2, R2>(
    f: (
      snapshot: RuntimeSnapshot<State, Error | InitialError, Output>
    ) => Effect.Effect<RuntimeSnapshot<State, Error | InitialError, Output> | undefined, E2, R2>
  ): Effect.Effect<RuntimeSnapshot<State, Error | InitialError, Output> | undefined, E2, R2> =>
    SynchronizedRef.modifyEffect(
      current,
      (snapshot) =>
        Ref.get(terminalizing).pipe(
          Effect.flatMap((isTerminalizing) =>
            isTerminalizing
              ? Effect.succeed([undefined, snapshot] as const)
              : Effect.map(
                f(snapshot),
                (next) => next === undefined ? [undefined, snapshot] as const : [next, next] as const
              )
          )
        )
    ).pipe(
      Effect.flatMap((snapshot) => snapshot === undefined ? Effect.succeed(undefined) : publishIfCurrent(snapshot))
    )

  const reserveTerminalSnapshot = (
    f: (
      snapshot: Extract<RuntimeSnapshot<State, Error | InitialError, Output>, { readonly status: "active" }>
    ) => RuntimeSnapshot<State, Error | InitialError, Output>
  ): Effect.Effect<RuntimeSnapshot<State, Error | InitialError, Output> | undefined> =>
    SynchronizedRef.modifyEffect(
      current,
      (snapshot) =>
        Ref.get(terminalizing).pipe(
          Effect.flatMap((isTerminalizing): Effect.Effect<SnapshotModification> => {
            if (isTerminalizing || snapshot.status !== "active") {
              return Effect.succeed([undefined, snapshot] as SnapshotModification)
            }
            return Ref.set(terminalizing, true).pipe(
              Effect.as([f(snapshot), snapshot] as SnapshotModification)
            )
          })
        )
    )

  const setAndPublishSnapshot = (
    snapshot: RuntimeSnapshot<State, Error | InitialError, Output>
  ): Effect.Effect<void> =>
    SynchronizedRef.set(current, snapshot).pipe(
      Effect.andThen(publishSnapshot(snapshot)),
      Effect.flatMap(completeIfTerminal),
      Effect.asVoid
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

  const terminalizeWith = (
    snapshot: RuntimeSnapshot<State, Error | InitialError, Output>,
    exit: Exit.Exit<unknown, unknown>,
    completeDone: Effect.Effect<void>
  ): Effect.Effect<void> =>
    Queue.shutdown(queue).pipe(
      Effect.andThen(closeChildren(exit)),
      Effect.andThen(cleanup),
      Effect.andThen(setAndPublishSnapshot(snapshot)),
      Effect.andThen(finalize(exit)),
      Effect.andThen(completeDone)
    )

  const stopSelf: Effect.Effect<void> = reserveTerminalSnapshot((snapshot) => ({
    status: "stopped",
    state: snapshot.state
  })).pipe(
    Effect.flatMap((snapshot) =>
      snapshot === undefined
        ? Effect.void
        : Effect.suspend(() => {
          const exit = Exit.void
          return terminalizeWith(
            snapshot,
            exit,
            Deferred.fail(done, new StoppedError())
          ).pipe(
            Effect.andThen(Deferred.await(fiberRef).pipe(Effect.flatMap(Fiber.interrupt)))
          )
        })
    )
  )

  const context: ProcessContext<State, Event> = {
    ...scope,
    receive: Queue.take(queue),
    state: SynchronizedRef.get(current).pipe(Effect.map((snapshot) => snapshot.state)),
    setState: setActiveState,
    updateState: (f) =>
      updateSnapshot((snapshot) =>
        snapshot.status === "active"
          ? f(snapshot.state).pipe(
            Effect.map((state) => ({
              status: "active" as const,
              state
            }))
          )
          : Effect.succeed(undefined)
      ).pipe(Effect.asVoid)
  }

  yield* publishSnapshot(yield* SynchronizedRef.get(current))
  yield* Deferred.succeed(stopSelfDeferred, stopSelf)

  const changesStream: Stream.Stream<RuntimeSnapshot<State, Error | InitialError, Output>> = Stream.unwrap(
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

  const terminalizeFailure = (cause: Cause.Cause<Error | InitialError>): Effect.Effect<void> =>
    reserveTerminalSnapshot((snapshot) => ({
      status: "error",
      state: snapshot.state,
      cause
    })).pipe(
      Effect.flatMap((snapshot) =>
        snapshot === undefined
          ? Effect.void
          : Effect.suspend(() => {
            const exit = Exit.failCause(cause)
            return terminalizeWith(snapshot, exit, Deferred.failCause(done, cause))
          })
      )
    )

  const terminalizeSuccess = (output: Output): Effect.Effect<void> =>
    reserveTerminalSnapshot((snapshot) => ({
      status: "done",
      state: snapshot.state,
      output
    })).pipe(
      Effect.flatMap((snapshot) =>
        snapshot === undefined
          ? Effect.void
          : Effect.suspend(() => {
            const exit = Exit.succeed(output)
            return terminalizeWith(snapshot, exit, Deferred.succeed(done, output))
          })
      )
    )

  const runFiber: Effect.Effect<void, never, Requirements> = logic.run(context).pipe(
    Effect.matchCauseEffect({
      onFailure: terminalizeFailure,
      onSuccess: terminalizeSuccess
    })
  )

  const fiber = yield* runFiber.pipe(
    (effect) => options.fiberScope === undefined ? Effect.forkChild(effect) : Effect.forkIn(effect, options.fiberScope)
  )
  yield* Deferred.succeed(fiberRef, fiber)

  const ref: MachineRef<State, Event, Error | InitialError, Output> = {
    id,
    sessionId,
    state: SynchronizedRef.get(current).pipe(Effect.map((snapshot) => snapshot.state)),
    snapshot: SynchronizedRef.get(current),
    changes: changesStream,
    join: Deferred.await(done),
    stop: stopSelf,
    send: self.send
  }

  return ref
})

export const startProcess: <
  State,
  Event,
  Error = never,
  Requirements = never,
  Output = never,
  InitialError = never
>(
  logic: ProcessLogic<State, Event, Error, Requirements, Output, InitialError>,
  options?: {
    readonly id?: string
  }
) => Effect.Effect<
  MachineRef<State, Event, Error | InitialError, Output>,
  InitialError,
  Requirements
> = Effect.fnUntraced(function*<State, Event, Error, Requirements, Output, InitialError>(
  logic: ProcessLogic<State, Event, Error, Requirements, Output, InitialError>,
  options?: {
    readonly id?: string
  }
) {
  const runtime = yield* makeProcessRuntime
  return yield* startInternal(
    logic,
    options === undefined
      ? { finalizer: runtime.close, runtime }
      : { ...options, finalizer: runtime.close, runtime }
  ).pipe(Effect.onExit((exit) => Exit.isFailure(exit) ? runtime.close(exit) : Effect.void))
})

export const runtimeFor = <Events, Emits>(): Effect.Effect<
  Runtime<Events, Emits>,
  never,
  Runtime.Requirement<Events, Emits>
> => runtime<{ readonly events: Events; readonly emits: Emits }>()

export const runStateAction = <Context, E, R>(
  handler: ((context: Context) => Machine.StateActionResult<E, R>) | undefined,
  context: Context,
  deferredActions: DeferredActions["Service"],
  deferredRaisedEvents: DeferredRaisedEvents["Service"]
): Effect.Effect<void, E, R> => {
  if (handler === undefined) {
    return Effect.void
  }

  const result = handler(context)
  return Effect.isEffect(result)
    ? provideDeferredServices(result, deferredActions, deferredRaisedEvents)
    : Effect.void
}

export type MicrostepPlan<State, Event, E, R> = {
  readonly next: State
  readonly actions: ReadonlyArray<Effect.Effect<void, E, R>>
  readonly raisedEvents: ReadonlyArray<Event>
  readonly exitPaths: ReadonlyArray<string>
  readonly entryPaths: ReadonlyArray<string>
  readonly changed: boolean
}

export type MacrostepPlan<State, Event, E, R, Output> = {
  readonly next: State
  readonly actions: ReadonlyArray<Effect.Effect<void, E, R>>
  readonly microsteps: ReadonlyArray<MicrostepPlan<State, Event, E, R>>
  readonly output: Output | undefined
}

export type TransitionHandler<States extends Machine.StateSchemas, E, R, Context> = (
  context: Context
) => Machine.HandlerResult<States, E, R>

export type EventTransition<States extends Machine.StateSchemas, E, R, Context> =
  | TransitionHandler<States, E, R, Context>
  | {
    readonly reenter?: boolean
    readonly transition: TransitionHandler<States, E, R, Context>
  }

export type MicrostepTransition<States extends Machine.StateSchemas, E, R, Context> = {
  readonly reenter: boolean
  readonly transition: TransitionHandler<States, E, R, Context>
}

export type AnyInvokeConfig = Machine.InvokeConfig<any, any, any, any, any, any, any, any, any, any, any>

export interface InvokeSession {
  readonly token: symbol
  readonly scope: Scope.Closeable
  readonly childId: string
}

export const normalizeEventTransition = <States extends Machine.StateSchemas, E, R, Context>(
  transition: EventTransition<States, E, R, Context> | undefined
): MicrostepTransition<States, E, R, Context> | undefined => {
  if (transition === undefined) {
    return undefined
  }
  return typeof transition === "function"
    ? { reenter: false, transition }
    : { reenter: transition.reenter === true, transition: transition.transition }
}

export const getInvokes = (config: Machine.AnyStateConfig | undefined): ReadonlyArray<AnyInvokeConfig> => {
  const invokes = config?.invoke
  if (invokes === undefined) {
    return []
  }
  return Array.isArray(invokes) ? invokes as ReadonlyArray<AnyInvokeConfig> : [invokes as AnyInvokeConfig]
}

export const collectStateAction = Effect.fnUntraced(function*<Context, Event, E, R>(
  handler: ((context: Context) => Machine.StateActionResult<E, R>) | undefined,
  context: Context
) {
  const deferredActions = yield* makeDeferredActions
  const deferredRaisedEvents = yield* makeDeferredRaisedEvents
  yield* runStateAction(handler, context, deferredActions, deferredRaisedEvents)
  const actions = yield* deferredActions.read
  const raisedEvents = yield* deferredRaisedEvents.read
  return {
    actions: actions as ReadonlyArray<DeferredAction<E, R>>,
    raisedEvents: raisedEvents as ReadonlyArray<Event>
  }
})

export const collectTransition = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  Event,
  E,
  R,
  Context
>(
  transition: TransitionHandler<States, E, R, Context>,
  context: Context
) {
  const deferredActions = yield* makeDeferredActions
  const deferredRaisedEvents = yield* makeDeferredRaisedEvents
  const result = transition(context)
  const state = Effect.isEffect(result)
    ? yield* provideDeferredServices(result, deferredActions, deferredRaisedEvents)
    : result
  const actions = yield* deferredActions.read
  const raisedEvents = yield* deferredRaisedEvents.read
  return {
    state,
    actions: actions as ReadonlyArray<DeferredAction<E, R>>,
    raisedEvents: raisedEvents as ReadonlyArray<Event>
  }
})

export type SelectedTransition<States extends Machine.StateSchemas, E, R, Context> = {
  readonly sourcePath: string
  readonly leafPath: string
  readonly transition: MicrostepTransition<States, E, R, Context>
  readonly context: Context
}

export type EvaluatedTransition<States extends Machine.StateSchemas, Event, E, R, Context> = {
  readonly selection: SelectedTransition<States, E, R, Context>
  readonly target:
    | Machine.Snapshot<States>
    | Machine.Target<States, Machine.StateIdentifier<States>>
    | undefined
  readonly actions: ReadonlyArray<Effect.Effect<void, E, R>>
  readonly raisedEvents: ReadonlyArray<Event>
  readonly changed: boolean
  readonly exitPaths: ReadonlyArray<string>
  readonly entryPaths: ReadonlyArray<string>
}

export const getCandidatePaths = (machine: Machine.Any, configuration: ActiveConfiguration): ReadonlyArray<string> =>
  Array.from(configuration.active)
    .sort((left, right) => {
      const depth = pathDepth(machine, right) - pathDepth(machine, left)
      return depth === 0 ? compareDocumentOrder(machine, left, right) : depth
    })

export const getLeafCandidatePaths = (machine: Machine.Any, leaf: string): ReadonlyArray<string> =>
  [...getPathToRoot(machine, leaf)].reverse()

export const getLeastCommonAncestor = (
  machine: Machine.Any,
  left: string,
  right: string
): string | undefined => {
  const leftPath = getPathToRoot(machine, left)
  const rightPath = getPathToRoot(machine, right)
  let ancestor: string | undefined = undefined
  const length = Math.min(leftPath.length, rightPath.length)
  for (let index = 0; index < length; index++) {
    if (leftPath[index] !== rightPath[index]) {
      break
    }
    ancestor = leftPath[index]
  }
  return ancestor
}

export const getExitPaths = (
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  boundary: string | undefined
): ReadonlyArray<string> =>
  sortExitPaths(
    machine,
    Array.from(configuration.active)
      .filter((path) => boundary === undefined || isDescendantOf(path, boundary))
  )

export const getEntryPaths = (
  machine: Machine.Any,
  targetLeaf: string,
  boundary: string | undefined
): ReadonlyArray<string> =>
  getPathToRoot(machine, targetLeaf).filter((path) => boundary === undefined || isDescendantOf(path, boundary))

export const sortExitPaths = (machine: Machine.Any, paths: Iterable<string>): ReadonlyArray<string> =>
  Array.from(new Set(paths))
    .sort((left, right) => {
      const depth = getPathToRoot(machine, right).length - getPathToRoot(machine, left).length
      return depth === 0 ? getNode(machine, right).order - getNode(machine, left).order : depth
    })

export const sortEntryPaths = (machine: Machine.Any, paths: Iterable<string>): ReadonlyArray<string> =>
  Array.from(new Set(paths))
    .sort((left, right) => {
      const depth = getPathToRoot(machine, left).length - getPathToRoot(machine, right).length
      return depth === 0 ? compareDocumentOrder(machine, left, right) : depth
    })

export const makeStateActionContext = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema>,
  StateId extends Machine.StateIdentifier<States>
>(
  configuration: ActiveConfiguration,
  path: string,
  event: Machine.LifecycleEvent<Events>
): Machine.StateActionContext<States, Events, Emits, StateId> => ({
  state: getActiveValue(configuration, path) as Machine.StateByIdentifier<States, StateId>,
  event,
  runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>()
})

export const makeTransitionContext = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema>,
  StateId extends Machine.StateIdentifier<States>,
  EventTag extends Machine.TagOf<Events[number]>
>(
  machine: Machine<States, Events, any, any, any, any, any, any, any, any, Emits>,
  configuration: ActiveConfiguration,
  path: string,
  event: Machine.EventByTag<Events, EventTag>
): Machine.HandlerContext<States, Events, Emits, StateId, EventTag, any, any> => ({
  state: getActiveValue(configuration, path) as Machine.StateByIdentifier<States, StateId>,
  event,
  runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>(),
  target: machine.makeTargetBuilder(path as StateId)
})

export const collectStateActions = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema>,
  E,
  R
>(
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  paths: ReadonlyArray<string>,
  event: Machine.LifecycleEvent<Events>,
  key: "entry" | "exit"
) {
  const actions: Array<DeferredAction<E, R>> = []
  const raisedEvents: Array<Machine.EventOf<Events>> = []
  for (const path of paths) {
    const collected = yield* collectStateAction<
      Machine.StateActionContext<States, Events, Emits, Machine.StateIdentifier<States>>,
      Machine.EventOf<Events>,
      E,
      R
    >(
      machine.handlers[path]?.[key],
      makeStateActionContext<States, Events, Emits, Machine.StateIdentifier<States>>(configuration, path, event)
    )
    actions.push(...collected.actions)
    raisedEvents.push(...collected.raisedEvents)
  }
  return { actions, raisedEvents }
})

export const selectAlwaysTransitions = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema>,
  E,
  R
>(
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  event: Machine.LifecycleEvent<Events>
): ReadonlyArray<
  SelectedTransition<
    States,
    E,
    R,
    Machine.AlwaysContext<States, Events, Emits, Machine.StateIdentifier<States>>
  >
> => {
  const selected: Array<
    SelectedTransition<
      States,
      E,
      R,
      Machine.AlwaysContext<States, Events, Emits, Machine.StateIdentifier<States>>
    >
  > = []
  const selectedSources = new Set<string>()
  for (const leaf of getActiveLeafPaths(machine, configuration)) {
    for (const path of getLeafCandidatePaths(machine, leaf)) {
      const always = machine.handlers[path]?.always
      if (always !== undefined) {
        if (!selectedSources.has(path)) {
          selectedSources.add(path)
          selected.push({
            sourcePath: path,
            leafPath: leaf,
            transition: { reenter: false, transition: always } as MicrostepTransition<
              States,
              E,
              R,
              Machine.AlwaysContext<States, Events, Emits, Machine.StateIdentifier<States>>
            >,
            context: {
              state: getActiveValue(configuration, path) as Machine.StateByIdentifier<
                States,
                Machine.StateIdentifier<States>
              >,
              event,
              runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>(),
              target: machine.makeTargetBuilder(path as Machine.StateIdentifier<States>)
            }
          })
        }
        break
      }
    }
  }
  return selected
}

export const selectEventTransitions = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema>,
  E,
  R
>(
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  event: Machine.EventByTag<Events, Machine.TagOf<Events[number]>>
): ReadonlyArray<
  SelectedTransition<
    States,
    E,
    R,
    Machine.HandlerContext<States, Events, Emits, Machine.StateIdentifier<States>, Machine.TagOf<Events[number]>, E, R>
  >
> => {
  const selected: Array<
    SelectedTransition<
      States,
      E,
      R,
      Machine.HandlerContext<
        States,
        Events,
        Emits,
        Machine.StateIdentifier<States>,
        Machine.TagOf<Events[number]>,
        E,
        R
      >
    >
  > = []
  const selectedSources = new Set<string>()
  for (const leaf of getActiveLeafPaths(machine, configuration)) {
    for (const path of getLeafCandidatePaths(machine, leaf)) {
      const transition = normalizeEventTransition(machine.handlers[path]?.on?.[event._tag])
      if (transition !== undefined) {
        if (!selectedSources.has(path)) {
          selectedSources.add(path)
          selected.push({
            sourcePath: path,
            leafPath: leaf,
            transition: transition as unknown as MicrostepTransition<
              States,
              E,
              R,
              Machine.HandlerContext<
                States,
                Events,
                Emits,
                Machine.StateIdentifier<States>,
                Machine.TagOf<Events[number]>,
                E,
                R
              >
            >,
            context: makeTransitionContext<
              States,
              Events,
              Emits,
              Machine.StateIdentifier<States>,
              Machine.TagOf<Events[number]>
            >(machine, configuration, path, event)
          })
        }
        break
      }
    }
  }
  return selected
}

export const getTargetNodePath = <const States extends Machine.StateSchemas>(
  target: Machine.Snapshot<States> | Machine.Target<States, Machine.StateIdentifier<States>>
): string => {
  if (isTarget(target)) {
    return String(target.path)
  }
  if (isSnapshot(target)) {
    return String(target.path)
  }
  throw new Error("Machine expected transition target to be a snapshot or target builder result")
}

export const hasPathIntersection = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean => {
  for (const path of left) {
    if (right.includes(path)) {
      return true
    }
  }
  return false
}

export const sortEvaluatedTransitions = <
  const States extends Machine.StateSchemas,
  Event,
  E,
  R,
  Context
>(
  machine: Machine.Any,
  transitions: Iterable<EvaluatedTransition<States, Event, E, R, Context>>
): ReadonlyArray<EvaluatedTransition<States, Event, E, R, Context>> =>
  Array.from(transitions)
    .sort((left, right) => compareDocumentOrder(machine, left.selection.sourcePath, right.selection.sourcePath))

export const removeConflictingTransitions = <
  const States extends Machine.StateSchemas,
  Event,
  E,
  R,
  Context
>(
  machine: Machine.Any,
  transitions: ReadonlyArray<EvaluatedTransition<States, Event, E, R, Context>>
): ReadonlyArray<EvaluatedTransition<States, Event, E, R, Context>> => {
  const filtered: Array<EvaluatedTransition<States, Event, E, R, Context>> = []
  for (const transition of sortEvaluatedTransitions(machine, transitions)) {
    let preempted = false
    const transitionsToRemove = new Set<EvaluatedTransition<States, Event, E, R, Context>>()
    for (const selected of filtered) {
      if (hasPathIntersection(transition.exitPaths, selected.exitPaths)) {
        if (isDescendantOf(transition.selection.sourcePath, selected.selection.sourcePath)) {
          transitionsToRemove.add(selected)
        } else {
          preempted = true
          break
        }
      }
    }
    if (!preempted) {
      for (const removed of transitionsToRemove) {
        const index = filtered.indexOf(removed)
        if (index >= 0) {
          filtered.splice(index, 1)
        }
      }
      filtered.push(transition)
    }
  }
  return filtered
}

export const collectEvaluatedTransition = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  Event,
  E,
  R,
  Context
>(
  machine: Machine.Any,
  state: ActiveConfiguration,
  selection: SelectedTransition<States, E, R, Context>
) {
  const stateIdentifier = selection.leafPath
  const transitionResult = yield* collectTransition<States, Event, E, R, Context>(
    selection.transition.transition,
    selection.context
  )
  const target = transitionResult.state === undefined
    ? undefined
    : transitionResult.state as
      | Machine.Snapshot<States>
      | Machine.Target<States, Machine.StateIdentifier<States>>
  const targetPath = target === undefined ? undefined : getTargetNodePath(target)
  const stateAfterTransition = target === undefined
    ? state
    : normalizeTargetConfiguration<States>(machine, state, target)
  const targetIdentifier = targetPath === undefined
    ? stateIdentifier
    : getActiveLeafPathFrom(machine, stateAfterTransition, targetPath)
  const changed = targetIdentifier !== stateIdentifier || selection.transition.reenter

  if (!changed) {
    return {
      selection,
      target,
      actions: transitionResult.actions,
      raisedEvents: transitionResult.raisedEvents,
      changed,
      exitPaths: [],
      entryPaths: []
    } as EvaluatedTransition<States, Event, E, R, Context>
  }

  const boundary = selection.transition.reenter
    ? getNode(machine, selection.sourcePath).parent
    : getLeastCommonAncestor(machine, stateIdentifier, targetIdentifier)

  return {
    selection,
    target,
    actions: transitionResult.actions,
    raisedEvents: transitionResult.raisedEvents,
    changed,
    exitPaths: getExitPaths(machine, state, boundary),
    entryPaths: getEntryPaths(machine, targetIdentifier, boundary)
  } as EvaluatedTransition<States, Event, E, R, Context>
})

export const MaxMacrostepIterations = 1000
export const InitialEventTypeId: unique symbol = Symbol("effect/Machine/InitialEvent")
export const InitialEvent: MachineInitialEvent = { _tag: InitialEventTypeId }

export const catchStartup = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, StartupError, R> => Effect.catchCause(effect, (cause) => Effect.fail(new StartupError({ cause })))

export const isFinalState = (
  machine: Machine.Any,
  state: Machine.Snapshot<any>
): boolean => isActiveFinalConfiguration(machine, normalizeConfiguration(machine, state))

export const getFinalOutputFromConfiguration = <
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  Output
>(
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  event: Machine.LifecycleEvent<Events>
): Output | undefined => {
  const completed = completeConfiguration(machine, configuration, event)
  return completed.completion?.output as Output | undefined
}

export const getFinalOutput = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  Output
>(
  machine: Machine.Any,
  state: Machine.Snapshot<States>,
  event: Machine.LifecycleEvent<Events>
): Output | undefined =>
  getFinalOutputFromConfiguration<Events, Output>(
    machine,
    normalizeConfiguration(machine, state),
    event
  )

export const isFinal = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates>,
  state: Machine.Snapshot<States>
): state is Machine.SnapshotContainingFinal<States, FinalStates> => isFinalState(machine, state)

export const planInitial: <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  ...args: [...Machine.InputArgs<Input>]
) => Effect.Effect<
  {
    readonly state: Machine.Snapshot<States>
    readonly actions: ReadonlyArray<Effect.Effect<void, InitialE | StartupError, InitialR | R>>
    readonly output: Output | undefined
  },
  InitialE | StartupError,
  ExcludeCompatibleRuntime<InitialR | R, Machine.EventOf<Events>, Machine.EmitOf<Emits>>
> = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  ...args: [...Machine.InputArgs<Input>]
) {
  const deferredActions = yield* makeDeferredActions
  const deferredRaisedEvents = yield* makeDeferredRaisedEvents
  const result = machine.initial(...args)
  const state = Effect.isEffect(result)
    ? yield* (provideDeferredServices(
      result as Effect.Effect<Machine.Snapshot<States>, InitialE, InitialR>,
      deferredActions,
      deferredRaisedEvents
    ) as Effect.Effect<
      Machine.Snapshot<States>,
      InitialE,
      ExcludeCompatibleRuntime<InitialR, Machine.EventOf<Events>, Machine.EmitOf<Emits>>
    >)
    : result
  const configuration = normalizeConfiguration<States>(machine, state)
  validateInitialConfiguration(machine, configuration)
  const actions = yield* deferredActions.read
  const raisedEvents = yield* deferredRaisedEvents.read
  const settled = yield* (catchStartup(Effect.gen(function*() {
    const entry = yield* collectStateActions<States, Events, Emits, E, R>(
      machine,
      configuration,
      getInitialEntryPaths(machine, configuration),
      InitialEvent,
      "entry"
    )
    return yield* (settle(
      machine,
      configuration,
      InitialEvent,
      [...entry.actions] as Array<Effect.Effect<void, E, R>>,
      [...raisedEvents, ...entry.raisedEvents] as Array<Machine.EventOf<Events>>,
      []
    ) as Effect.Effect<MacrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R, Output>>)
  })) as Effect.Effect<
    MacrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R, Output>,
    StartupError,
    ExcludeCompatibleRuntime<R, Machine.EventOf<Events>, Machine.EmitOf<Emits>>
  >)

  return {
    state: snapshotFromConfiguration<States>(machine, settled.next),
    actions: [
      ...actions,
      ...settled.actions.map((action) => catchStartup(action))
    ] as ReadonlyArray<Effect.Effect<void, InitialE | StartupError, InitialR | R>>,
    output: settled.output
  }
})

export const enabled = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R>,
  state: Machine.Snapshot<States>
): ReadonlyArray<Machine.TagOf<Events[number]>> => {
  if (isFinalState(machine, state)) {
    return []
  }
  const configuration = normalizeConfiguration(machine, state)
  const tags: Array<Machine.TagOf<Events[number]>> = []
  const seen = new Set<PropertyKey>()
  for (const path of getCandidatePaths(machine, configuration)) {
    for (const tag of Reflect.ownKeys(machine.handlers[path]?.on ?? {})) {
      if (!seen.has(tag)) {
        seen.add(tag)
        tags.push(tag as Machine.TagOf<Events[number]>)
      }
    }
  }
  return tags
}

export const microstep: <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never,
  Context = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: ActiveConfiguration,
  event: Machine.LifecycleEvent<Events>,
  selections: ReadonlyArray<SelectedTransition<States, E, R, Context>>
) => Effect.Effect<
  MicrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R>,
  E | UnhandledEventError,
  R
> = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never,
  Context = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: ActiveConfiguration,
  event: Machine.LifecycleEvent<Events>,
  selections: ReadonlyArray<SelectedTransition<States, E, R, Context>>
) {
  if (selections.length === 0) {
    return yield* new UnhandledEventError({
      machineId: machine.id,
      state: String(getLeafPath(machine, state)),
      event: String(event._tag)
    })
  }

  const evaluatedTransitions: Array<EvaluatedTransition<States, Machine.EventOf<Events>, E, R, Context>> = []
  for (const selection of selections) {
    evaluatedTransitions.push(
      yield* collectEvaluatedTransition<States, Machine.EventOf<Events>, E, R, Context>(
        machine,
        state,
        selection
      )
    )
  }

  const transitions = removeConflictingTransitions(machine, evaluatedTransitions)
  const sortedTransitions = sortEvaluatedTransitions(machine, transitions)
  let stateAfterTransition = state
  for (const transition of sortedTransitions) {
    if (transition.target !== undefined) {
      stateAfterTransition = normalizeTargetConfiguration<States>(machine, stateAfterTransition, transition.target)
    }
  }

  const changed = transitions.some((transition) => transition.changed)
  const transitionActions = sortedTransitions
    .flatMap((transition) => transition.actions)
  const transitionRaisedEvents = sortedTransitions
    .flatMap((transition) => transition.raisedEvents)

  if (!changed) {
    return {
      next: stateAfterTransition,
      actions: transitionActions,
      raisedEvents: transitionRaisedEvents,
      exitPaths: [],
      entryPaths: [],
      changed: false
    }
  }

  const exitPaths = sortExitPaths(machine, sortedTransitions.flatMap((transition) => transition.exitPaths))
  const entryPaths = sortEntryPaths(machine, sortedTransitions.flatMap((transition) => transition.entryPaths))
  const exit = yield* collectStateActions<States, Events, Emits, E, R>(
    machine,
    state,
    exitPaths,
    event,
    "exit"
  )
  const entry = yield* collectStateActions<States, Events, Emits, E, R>(
    machine,
    stateAfterTransition,
    entryPaths,
    event,
    "entry"
  )

  return {
    next: stateAfterTransition,
    actions: [...exit.actions, ...transitionActions, ...entry.actions] as ReadonlyArray<
      Effect.Effect<void, E, R>
    >,
    raisedEvents: [...exit.raisedEvents, ...transitionRaisedEvents, ...entry.raisedEvents] as ReadonlyArray<
      Machine.EventOf<Events>
    >,
    exitPaths,
    entryPaths,
    changed: true
  }
})

export const settle: <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: ActiveConfiguration,
  event: Machine.LifecycleEvent<Events>,
  actions: Array<Effect.Effect<void, E, R>>,
  raisedEvents: Array<Machine.EventOf<Events>>,
  microsteps: Array<MicrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R>>
) => Effect.Effect<
  MacrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R, Output>,
  E | UnhandledEventError | InfiniteTransitionError,
  R
> = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: ActiveConfiguration,
  event: Machine.LifecycleEvent<Events>,
  actions: Array<Effect.Effect<void, E, R>>,
  raisedEvents: Array<Machine.EventOf<Events>>,
  microsteps: Array<MicrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R>>
) {
  let currentState = state
  let currentEvent = event
  let shouldRunAlways = true
  let iterations = 0
  let raisedEventIndex = 0
  let finalOutput: Output | undefined = undefined

  while (true) {
    const completed = completeConfiguration(machine, currentState, currentEvent)
    currentState = completed.configuration
    if (completed.completion !== undefined) {
      finalOutput = completed.completion.output as Output | undefined
      break
    }

    iterations += 1
    if (iterations > MaxMacrostepIterations) {
      return yield* new InfiniteTransitionError({
        machineId: machine.id,
        state: String(getLeafPath(machine, currentState)),
        maxIterations: MaxMacrostepIterations
      })
    }

    const always = shouldRunAlways
      ? selectAlwaysTransitions<States, Events, Emits, E, R>(machine, currentState, currentEvent)
      : []
    if (always.length > 0) {
      const alwaysStep: MicrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R> = yield* microstep(
        machine,
        currentState,
        currentEvent,
        always
      )
      actions.push(...alwaysStep.actions)
      raisedEvents.push(...alwaysStep.raisedEvents)
      microsteps.push(alwaysStep)
      currentState = alwaysStep.next
      shouldRunAlways = alwaysStep.changed
      continue
    }

    const raisedEvent = raisedEvents[raisedEventIndex]
    if (raisedEvent === undefined) {
      break
    }
    raisedEventIndex += 1

    currentEvent = raisedEvent
    const raisedStep = yield* microstep(
      machine,
      currentState,
      raisedEvent,
      selectEventTransitions<States, Events, Emits, E, R>(
        machine,
        currentState,
        raisedEvent as Machine.EventByTag<Events, Machine.TagOf<Events[number]>>
      )
    )
    actions.push(...raisedStep.actions)
    raisedEvents.push(...raisedStep.raisedEvents)
    microsteps.push(raisedStep)
    currentState = raisedStep.next
    shouldRunAlways = true
  }

  return {
    next: currentState,
    actions,
    microsteps,
    output: finalOutput
  }
})

export const macrostep: <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.Snapshot<States>,
  event: Machine.EventOf<Events>
) => Effect.Effect<
  MacrostepPlan<Machine.Snapshot<States>, Machine.EventOf<Events>, E, R, Output>,
  E | UnhandledEventError | InfiniteTransitionError,
  R
> = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.Snapshot<States>,
  event: Machine.EventOf<Events>
) {
  const configuration = normalizeConfiguration<States>(machine, state)
  const snapshot = snapshotFromConfiguration<States>(machine, configuration)
  if (isFinalState(machine, snapshot)) {
    return {
      next: snapshot,
      actions: [],
      microsteps: [],
      output: undefined
    }
  }

  const step = yield* microstep(
    machine,
    configuration,
    event,
    selectEventTransitions<States, Events, Emits, E, R>(
      machine,
      configuration,
      event as Machine.EventByTag<Events, Machine.TagOf<Events[number]>>
    )
  )
  const actions = [...step.actions]
  const raisedEvents = [...step.raisedEvents]
  const microsteps = [step]
  const settled = yield* settle(machine, step.next, event, actions, raisedEvents, microsteps)
  return {
    next: snapshotFromConfiguration<States>(machine, settled.next),
    actions: settled.actions,
    microsteps: settled.microsteps.map((step) => ({
      next: snapshotFromConfiguration<States>(machine, step.next),
      actions: step.actions,
      raisedEvents: step.raisedEvents,
      exitPaths: step.exitPaths,
      entryPaths: step.entryPaths,
      changed: step.changed
    })),
    output: settled.output
  }
})

export const plan = macrostep

export const actionUnsafe = Effect.fnUntraced(function*<E, R>(
  effect: Effect.Effect<void, E, R>
) {
  const actions = yield* DeferredActions
  yield* actions.add(effect)
})

/**
 * Defers an effectful action until the current machine step is planned.
 *
 * @category combinators
 * @since 4.0.0
 */
export const action = <E, R>(
  effect: Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> => actionUnsafe(effect) as unknown as Effect.Effect<void, E, R>

/**
 * Returns the typed runtime capability for the current machine.
 *
 * @category combinators
 * @since 4.0.0
 */
export const runtime = <const Protocol extends Runtime.Protocol = {}>(): Effect.Effect<
  Runtime<Runtime.Events<Protocol>, Runtime.Emits<Protocol>>,
  never,
  Runtime.Requirement<Runtime.Events<Protocol>, Runtime.Emits<Protocol>>
> =>
  RuntimeContext as unknown as Effect.Effect<
    Runtime<Runtime.Events<Protocol>, Runtime.Emits<Protocol>>,
    never,
    Runtime.Requirement<Runtime.Events<Protocol>, Runtime.Emits<Protocol>>
  >
