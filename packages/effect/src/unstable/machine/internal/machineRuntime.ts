/**
 * Internal machine process runtime helpers.
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
import * as Scope from "../../../Scope.ts"
import * as Stream from "../../../Stream.ts"
import * as SynchronizedRef from "../../../SynchronizedRef.ts"
import type * as Take from "../../../Take.ts"
import { ChildAlreadyExistsError, StoppedError } from "./machineErrors.ts"

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

export const provideMachineRuntime = <A, E, R, Event>(
  effect: Effect.Effect<A, E, R>,
  scope: ProcessScope<Event>
): Effect.Effect<A, E, Exclude<R, MachineRuntime>> =>
  Effect.provideService(effect, MachineRuntime, scope as ProcessScope<any>)

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
