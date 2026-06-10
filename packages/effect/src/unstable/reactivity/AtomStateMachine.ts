/**
 * Atom bridge for running state machines.
 *
 * @since 4.0.0
 */

import * as Effect from "../../Effect.ts"
import type * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as Stream from "../../Stream.ts"
import type * as internalRuntime from "../machine/internal/stateMachineRuntime.ts"
import * as StateMachine from "../machine/StateMachine.ts"
import * as AsyncResult from "./AsyncResult.ts"
import * as Atom from "./Atom.ts"
import type * as AtomRegistry from "./AtomRegistry.ts"

type AtomSupportedRequirements = Scope.Scope | AtomRegistry.AtomRegistry

type ExternalRequirements<Requirements> = Exclude<Requirements, AtomSupportedRequirements>

const ExternalRequirementsTypeId = "~effect/reactivity/AtomStateMachine/ExternalRequirements"

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

type MachineRequirements<InitialR, R, Events, Emits> = ExcludeCompatibleMachineRuntime<
  Exclude<InitialR | R, internalRuntime.StateMachineRuntime>,
  Events,
  Emits
>

const startMachineAtomEffect = <
  const States extends StateMachine.Machine.StateSchemas,
  const Events extends ReadonlyArray<StateMachine.Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<StateMachine.Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends StateMachine.Machine.StateIdentifier<States> = StateMachine.Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends StateMachine.Machine.StateIdentifier<States> = never,
  Output = never
>(
  get: Atom.AtomContext,
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
  args: [...StateMachine.Machine.InputArgs<Input>]
): Effect.Effect<
  StateMachine.StateMachineRef<
    StateMachine.Machine.Snapshot<States>,
    StateMachine.Machine.EventOf<Events>,
    E | StateMachine.UnhandledEventError | StateMachine.InfiniteTransitionError | InitialE | StateMachine.StartupError,
    Output | undefined
  >,
  InitialE | StateMachine.StartupError,
  MachineRequirements<InitialR, R, StateMachine.Machine.EventOf<Events>, StateMachine.Machine.EmitOf<Emits>>
> =>
  Effect.scoped(
    Effect.acquireRelease(
      StateMachine.start(machine, ...args),
      (ref) => ref.stop
    ).pipe(
      Effect.tap((ref) => Effect.sync(() => get.setSelf(AsyncResult.success(ref)))),
      Effect.flatMap(() => Effect.never)
    )
  )

/**
 * Atoms backed by one running state machine instance in an `AtomRegistry`.
 *
 * **Details**
 *
 * The state machine starts when one of the returned atoms is mounted or read in
 * a registry, and it is stopped when the registry disposes the ref atom. The
 * same atom values share one running state machine per registry.
 *
 * @category models
 * @since 4.0.0
 */
export interface StateMachineAtom<State, Event, Error = never, Output = never, StartError = never> {
  /**
   * Atom containing the running state machine handle once startup succeeds.
   *
   * @since 4.0.0
   */
  readonly ref: Atom.Atom<
    AsyncResult.AsyncResult<StateMachine.StateMachineRef<State, Event, Error, Output>, StartError>
  >

  /**
   * Atom containing the latest state machine lifecycle snapshot.
   *
   * @since 4.0.0
   */
  readonly snapshot: Atom.Atom<
    AsyncResult.AsyncResult<StateMachine.RuntimeSnapshot<State, Error, Output>, StartError>
  >

  /**
   * Atom containing the state value from the latest runtime snapshot.
   *
   * @since 4.0.0
   */
  readonly state: Atom.Atom<AsyncResult.AsyncResult<State, StartError>>

  /**
   * Writable atom that sends events to the state machine.
   *
   * @since 4.0.0
   */
  readonly send: Atom.Writable<AsyncResult.AsyncResult<void, StartError>, Event>

  /**
   * Writable atom that stops the state machine.
   *
   * @since 4.0.0
   */
  readonly stop: Atom.Writable<AsyncResult.AsyncResult<void, StartError>, void>
}

const makeFromRefAtom = <State, Event, Error, Output, StartError>(
  ref: Atom.Atom<AsyncResult.AsyncResult<StateMachine.StateMachineRef<State, Event, Error, Output>, StartError>>
): StateMachineAtom<State, Event, Error, Output, StartError> => {
  const snapshot = Atom.readable((
    get
  ): AsyncResult.AsyncResult<StateMachine.RuntimeSnapshot<State, Error, Output>, StartError> => {
    const result = get(ref)
    if (AsyncResult.isInitial(result)) {
      return AsyncResult.initial(result.waiting)
    } else if (AsyncResult.isFailure(result)) {
      return AsyncResult.failureWithPrevious(result.cause, {
        previous: get.self<AsyncResult.AsyncResult<StateMachine.RuntimeSnapshot<State, Error, Output>, StartError>>(),
        waiting: result.waiting
      })
    }

    const handle = result.value
    const cancel = Effect.runCallback(
      handle.changes.pipe(
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

    const current = Effect.runSync(handle.snapshot)
    return AsyncResult.success(current, {
      waiting: current.status === "active"
    })
  })

  const send = Atom.writable<AsyncResult.AsyncResult<void, StartError>, Event>(
    (get) => AsyncResult.map(get(ref), () => undefined),
    (ctx, event: Event) => {
      const result = ctx.get(ref)
      if (AsyncResult.isSuccess(result)) {
        Effect.runCallback(result.value.send(event))
      }
    }
  )

  const stop = Atom.writable<AsyncResult.AsyncResult<void, StartError>, void>(
    (get) => AsyncResult.map(get(ref), () => undefined),
    (ctx) => {
      const result = ctx.get(ref)
      if (AsyncResult.isSuccess(result)) {
        Effect.runCallback(result.value.stop)
      }
    }
  )

  return {
    ref,
    snapshot,
    state: Atom.mapResult(snapshot, (snapshot) => snapshot.state),
    send,
    stop
  }
}

/**
 * Creates atoms backed by a running state machine.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make: {
  <
    const States extends StateMachine.Machine.StateSchemas,
    const Events extends ReadonlyArray<StateMachine.Machine.TaggedSchema>,
    const Emits extends ReadonlyArray<StateMachine.Machine.TaggedSchema> = any,
    const Input extends Schema.Top = typeof Schema.Void,
    UnhandledStates extends StateMachine.Machine.StateIdentifier<States> = StateMachine.Machine.StateIdentifier<States>,
    E = never,
    R = never,
    InitialE = never,
    InitialR = never,
    FinalStates extends StateMachine.Machine.StateIdentifier<States> = never,
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
        MachineRequirements<
          InitialR,
          R,
          StateMachine.Machine.EventOf<Events>,
          StateMachine.Machine.EmitOf<Emits>
        >
      >,
    ...args: [...StateMachine.Machine.InputArgs<Input>]
  ): StateMachineAtom<
    StateMachine.Machine.Snapshot<States>,
    StateMachine.Machine.EventOf<Events>,
    E | StateMachine.UnhandledEventError | StateMachine.InfiniteTransitionError | InitialE | StateMachine.StartupError,
    Output | undefined,
    InitialE | StateMachine.StartupError
  >
  <
    RuntimeError,
    const States extends StateMachine.Machine.StateSchemas,
    const Events extends ReadonlyArray<StateMachine.Machine.TaggedSchema>,
    const Emits extends ReadonlyArray<StateMachine.Machine.TaggedSchema> = any,
    const Input extends Schema.Top = typeof Schema.Void,
    UnhandledStates extends StateMachine.Machine.StateIdentifier<States> = StateMachine.Machine.StateIdentifier<States>,
    E = never,
    R = never,
    InitialE = never,
    InitialR = never,
    FinalStates extends StateMachine.Machine.StateIdentifier<States> = never,
    Output = never
  >(
    runtime: Atom.AtomRuntime<
      ExternalRequirements<
        MachineRequirements<
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
  ): StateMachineAtom<
    StateMachine.Machine.Snapshot<States>,
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
    const machine = runtimeOrMachine
    const input = args.slice(1) as []
    const ref = Atom.make((get) => startMachineAtomEffect(get, machine, input))
    return makeFromRefAtom(ref as any)
  }

  const runtime = runtimeOrMachine
  const machine = args[1] as StateMachine.Machine.Any
  const input = args.slice(2) as []
  const ref = runtime.atom((get) => startMachineAtomEffect(get, machine, input))
  return makeFromRefAtom(ref as any)
}) as any
