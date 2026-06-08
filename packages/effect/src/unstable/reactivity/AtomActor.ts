/**
 * Atom bridge for running actors and state machines.
 *
 * @since 4.0.0
 */

import * as Effect from "../../Effect.ts"
import type * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as Stream from "../../Stream.ts"
import * as Actor from "../actors/Actor.ts"
import * as StateMachine from "../actors/StateMachine.ts"
import * as AsyncResult from "./AsyncResult.ts"
import * as Atom from "./Atom.ts"
import type * as AtomRegistry from "./AtomRegistry.ts"

type AtomSupportedRequirements = Scope.Scope | AtomRegistry.AtomRegistry

type ExternalRequirements<Requirements> = Exclude<Requirements, AtomSupportedRequirements>

const ExternalRequirementsTypeId = "~effect/reactivity/AtomActor/ExternalRequirements"

type EnsureNoExternalRequirements<Requirements> = [ExternalRequirements<Requirements>] extends [never] ? unknown : {
  readonly [ExternalRequirementsTypeId]: ExternalRequirements<Requirements>
}

type IsAny<A> = 0 extends (1 & A) ? true : false

type ExcludeCompatibleMachineRuntime<Requirements, Events, Emits> = Requirements extends
  StateMachine.Runtime.Requirement<infer RequiredEvents, infer RequiredEmits> ?
  IsAny<Requirements> extends true ? Requirements
  : [RequiredEvents] extends [Events] ? [RequiredEmits] extends [Emits] ? never : Requirements
  : Requirements
  : Requirements

type MachineActorRequirements<InitialR, R, Events, Emits> = ExcludeCompatibleMachineRuntime<
  Exclude<InitialR | R, StateMachine.ActorRuntime>,
  Events,
  Emits
>

type AnyActorLogic = Actor.ActorLogic<any, any, any, any, any, any>

const isActorLogic = (u: unknown): u is AnyActorLogic => {
  if (typeof u !== "object" || u === null) {
    return false
  }
  const record = u as Record<PropertyKey, unknown>
  return typeof record.initial === "function" && typeof record.run === "function"
}

const startActorAtomEffect = <State, Event, Error, Requirements, Output, InitialError>(
  get: Atom.AtomContext,
  logic: Actor.ActorLogic<State, Event, Error, Requirements, Output, InitialError>,
  options?: Actor.StartOptions
): Effect.Effect<Actor.Actor<State, Event, Error | InitialError, Output>, InitialError, Requirements> =>
  Effect.scoped(
    Effect.acquireRelease(
      Actor.start(logic, options),
      (actor) => actor.stop
    ).pipe(
      Effect.tap((actor) => Effect.sync(() => get.setSelf(AsyncResult.success(actor)))),
      Effect.flatMap(() => Effect.never)
    )
  )

const makeActorAtom = (
  logic: AnyActorLogic,
  options?: Actor.StartOptions
): ActorAtom<any, any, any, any, any> => {
  const actor = Atom.make((get) =>
    startActorAtomEffect(get, logic, options) as Effect.Effect<
      Actor.Actor<any, any, any, any>,
      any,
      Scope.Scope | AtomRegistry.AtomRegistry
    >
  )
  return makeFromActorAtom(actor)
}

const makeRuntimeActorAtom = (
  runtime: Atom.AtomRuntime<any, any>,
  logic: AnyActorLogic,
  options?: Actor.StartOptions
): ActorAtom<any, any, any, any, any> => {
  const actor = runtime.atom((get) => startActorAtomEffect(get, logic, options))
  return makeFromActorAtom(actor)
}

/**
 * Atoms backed by one running actor instance in an `AtomRegistry`.
 *
 * **Details**
 *
 * The actor starts when one of the returned atoms is mounted or read in a
 * registry, and it is stopped when the registry disposes the actor atom. The
 * same atom values share one actor per registry.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorAtom<State, Event, Error = never, Output = never, StartError = never> {
  /**
   * Atom containing the running actor handle once startup succeeds.
   *
   * @since 4.0.0
   */
  readonly actor: Atom.Atom<AsyncResult.AsyncResult<Actor.Actor<State, Event, Error, Output>, StartError>>

  /**
   * Atom containing the latest actor lifecycle snapshot.
   *
   * @since 4.0.0
   */
  readonly snapshot: Atom.Atom<AsyncResult.AsyncResult<Actor.Snapshot<State, Error, Output>, StartError>>

  /**
   * Atom containing the state value from the latest actor snapshot.
   *
   * @since 4.0.0
   */
  readonly state: Atom.Atom<AsyncResult.AsyncResult<State, StartError>>

  /**
   * Writable atom that sends events to the actor.
   *
   * @since 4.0.0
   */
  readonly send: Atom.Writable<AsyncResult.AsyncResult<void, StartError>, Event>

  /**
   * Writable atom that stops the actor.
   *
   * @since 4.0.0
   */
  readonly stop: Atom.Writable<AsyncResult.AsyncResult<void, StartError>, void>
}

const makeFromActorAtom = <State, Event, Error, Output, StartError>(
  actor: Atom.Atom<AsyncResult.AsyncResult<Actor.Actor<State, Event, Error, Output>, StartError>>
): ActorAtom<State, Event, Error, Output, StartError> => {
  const snapshot = Atom.readable((get): AsyncResult.AsyncResult<Actor.Snapshot<State, Error, Output>, StartError> => {
    const result = get(actor)
    if (AsyncResult.isInitial(result)) {
      return AsyncResult.initial(result.waiting)
    } else if (AsyncResult.isFailure(result)) {
      return AsyncResult.failureWithPrevious(result.cause, {
        previous: get.self<AsyncResult.AsyncResult<Actor.Snapshot<State, Error, Output>, StartError>>(),
        waiting: result.waiting
      })
    }

    const actorHandle = result.value
    const cancel = Effect.runCallback(
      actorHandle.changes.pipe(
        Stream.runForEach((snapshot) =>
          Effect.sync(() =>
            get.setSelf(
              AsyncResult.success(snapshot, {
                waiting: snapshot.status === "active"
              })
            )
          )
        )
      )
    )
    get.addFinalizer(cancel)

    const current = Effect.runSync(actorHandle.snapshot)
    return AsyncResult.success(current, {
      waiting: current.status === "active"
    })
  })

  const send = Atom.writable<AsyncResult.AsyncResult<void, StartError>, Event>(
    (get) => AsyncResult.map(get(actor), () => undefined),
    (ctx, event: Event) => {
      const result = ctx.get(actor)
      if (AsyncResult.isSuccess(result)) {
        Effect.runCallback(result.value.send(event))
      }
    }
  )

  const stop = Atom.writable<AsyncResult.AsyncResult<void, StartError>, void>(
    (get) => AsyncResult.map(get(actor), () => undefined),
    (ctx) => {
      const result = ctx.get(actor)
      if (AsyncResult.isSuccess(result)) {
        Effect.runCallback(result.value.stop)
      }
    }
  )

  return {
    actor,
    snapshot,
    state: Atom.mapResult(snapshot, (snapshot) => snapshot.state),
    send,
    stop
  }
}

/**
 * Creates atoms backed by an actor logic value.
 *
 * **When to use**
 *
 * Use when you want an actor to be owned by an `AtomRegistry` and observed from
 * atom-based UI bindings.
 *
 * **Details**
 *
 * Without an `AtomRuntime`, the actor logic may only require services that Atom
 * already provides, such as `Scope` or `AtomRegistry`. Use the runtime overload
 * when the actor needs additional services.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make: {
  <State, Event, Error = never, Output = never, InitialError = never, Requirements = never>(
    logic:
      & Actor.ActorLogic<State, Event, Error, Requirements, Output, InitialError>
      & EnsureNoExternalRequirements<Requirements>,
    options?: Actor.StartOptions
  ): ActorAtom<State, Event, Error | InitialError, Output, InitialError>
  <
    RuntimeError,
    State,
    Event,
    Error = never,
    Output = never,
    InitialError = never,
    Requirements = never
  >(
    runtime: Atom.AtomRuntime<ExternalRequirements<Requirements>, RuntimeError>,
    logic: Actor.ActorLogic<State, Event, Error, Requirements, Output, InitialError>,
    options?: Actor.StartOptions
  ): ActorAtom<State, Event, Error | InitialError, Output, InitialError | RuntimeError>
} = ((
  runtimeOrLogic: Atom.AtomRuntime<any, any> | Actor.ActorLogic<any, any, any, any, any, any>,
  logicOrOptions?: Actor.ActorLogic<any, any, any, any, any, any> | Actor.StartOptions,
  maybeOptions?: Actor.StartOptions
) => {
  if (isActorLogic(runtimeOrLogic)) {
    const logic = runtimeOrLogic
    const options = logicOrOptions as Actor.StartOptions | undefined
    return makeActorAtom(logic, options)
  }

  const runtime = runtimeOrLogic
  const logic = logicOrOptions as Actor.ActorLogic<any, any, any, any, any, any>
  return makeRuntimeActorAtom(runtime, logic, maybeOptions)
}) as any

/**
 * Creates atoms backed by a state machine running on the actor runtime.
 *
 * **When to use**
 *
 * Use when you want a schema-first state machine to be observed and controlled
 * from atom-based UI bindings.
 *
 * **Details**
 *
 * The returned atoms use `StateMachine.toActorLogic`, so state machine actions
 * can use actor runtime helpers such as `StateMachine.spawn` and
 * `StateMachine.sendTo`. Use the runtime overload when the state machine needs
 * additional services.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromStateMachine: {
  <
    const States extends ReadonlyArray<StateMachine.Machine.TaggedSchema>,
    const Events extends ReadonlyArray<StateMachine.Machine.TaggedSchema>,
    const Emits extends ReadonlyArray<StateMachine.Machine.TaggedSchema> = any,
    const Input extends Schema.Top = typeof Schema.Void,
    UnhandledStates extends StateMachine.Machine.TagOf<States[number]> = StateMachine.Machine.TagOf<States[number]>,
    E = never,
    R = never,
    InitialE = never,
    InitialR = never,
    FinalStates extends StateMachine.Machine.TagOf<States[number]> = never,
    Output = never
  >(
    machine:
      & StateMachine.Machine<
        States,
        Events,
        Input,
        UnhandledStates,
        E,
        R,
        InitialE,
        InitialR,
        FinalStates,
        Output,
        Emits
      >
      & EnsureNoExternalRequirements<
        MachineActorRequirements<
          InitialR,
          R,
          StateMachine.Machine.EventOf<Events>,
          StateMachine.Machine.EmitOf<Emits>
        >
      >,
    ...args: [...StateMachine.Machine.InputArgs<Input>]
  ): ActorAtom<
    StateMachine.Machine.StateOf<States>,
    StateMachine.Machine.EventOf<Events>,
    E | StateMachine.UnhandledEventError | StateMachine.InfiniteTransitionError | InitialE | StateMachine.StartupError,
    Output | undefined,
    InitialE | StateMachine.StartupError
  >
  <
    RuntimeError,
    const States extends ReadonlyArray<StateMachine.Machine.TaggedSchema>,
    const Events extends ReadonlyArray<StateMachine.Machine.TaggedSchema>,
    const Emits extends ReadonlyArray<StateMachine.Machine.TaggedSchema> = any,
    const Input extends Schema.Top = typeof Schema.Void,
    UnhandledStates extends StateMachine.Machine.TagOf<States[number]> = StateMachine.Machine.TagOf<States[number]>,
    E = never,
    R = never,
    InitialE = never,
    InitialR = never,
    FinalStates extends StateMachine.Machine.TagOf<States[number]> = never,
    Output = never
  >(
    runtime: Atom.AtomRuntime<
      ExternalRequirements<
        MachineActorRequirements<
          InitialR,
          R,
          StateMachine.Machine.EventOf<Events>,
          StateMachine.Machine.EmitOf<Emits>
        >
      >,
      RuntimeError
    >,
    machine: StateMachine.Machine<
      States,
      Events,
      Input,
      UnhandledStates,
      E,
      R,
      InitialE,
      InitialR,
      FinalStates,
      Output,
      Emits
    >,
    ...args: [...StateMachine.Machine.InputArgs<Input>]
  ): ActorAtom<
    StateMachine.Machine.StateOf<States>,
    StateMachine.Machine.EventOf<Events>,
    | E
    | StateMachine.UnhandledEventError
    | StateMachine.InfiniteTransitionError
    | InitialE
    | StateMachine.StartupError,
    Output | undefined,
    InitialE | StateMachine.StartupError | RuntimeError
  >
} = ((...args: ReadonlyArray<any>) => {
  const runtimeOrMachine = args[0] as Atom.AtomRuntime<any, any> | StateMachine.Machine.Any
  if (StateMachine.isMachine(runtimeOrMachine)) {
    return makeActorAtom(StateMachine.toActorLogic(runtimeOrMachine, ...(args.slice(1) as [] | [any])))
  }
  return makeRuntimeActorAtom(
    runtimeOrMachine,
    StateMachine.toActorLogic(args[1] as StateMachine.Machine.Any, ...(args.slice(2) as [] | [any]))
  )
}) as any
