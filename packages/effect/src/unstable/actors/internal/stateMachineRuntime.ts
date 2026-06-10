/**
 * Internal state machine runtime planning helpers.
 *
 * @since 4.0.0
 */

import * as Context from "../../../Context.ts"
import * as Effect from "../../../Effect.ts"
import { InfiniteTransitionError, StartupError, UnhandledEventError } from "../../../internal/stateMachineErrors.ts"
import * as Option from "../../../Option.ts"
import type * as Schema from "../../../Schema.ts"
import type * as Scope from "../../../Scope.ts"
import type * as ActorModule from "../Actor.ts"
import type { Machine, Runtime } from "../StateMachine.ts"
import {
  type ActiveConfiguration,
  compareDocumentOrder,
  completeConfiguration,
  findStateNode,
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
} from "./stateMachineModel.ts"

export type DeferredAction<E = any, R = any> = Effect.Effect<void, E, R>

export interface DeferredQueue<A> {
  readonly add: (value: A) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<A>>
}

export class DeferredActions extends Context.Service<DeferredActions, {
  readonly add: <E, R>(effect: DeferredAction<E, R>) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<DeferredAction>>
}>()("effect/StateMachine/DeferredActions") {}

export class DeferredRaisedEvents extends Context.Service<DeferredRaisedEvents, {
  readonly add: <Event>(event: Event) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<any>>
}>()("effect/StateMachine/DeferredRaisedEvents") {}

/**
 * Actor runtime scope available to state machine actions when a machine runs
 * through `toActorLogic`.
 *
 * @category services
 * @since 4.0.0
 */
export class ActorRuntime extends Context.Service<ActorRuntime, ActorModule.ActorScope<any>>()(
  "effect/StateMachine/ActorRuntime"
) {}

export class RuntimeContext extends Context.Service<RuntimeContext, Runtime<any, any>>()(
  "effect/StateMachine/Runtime"
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

export const provideActorRuntime = <A, E, R, Event>(
  effect: Effect.Effect<A, E, R>,
  scope: ActorModule.ActorScope<Event>
): Effect.Effect<A, E, Exclude<R, ActorRuntime>> =>
  Effect.provideService(effect, ActorRuntime, scope as ActorModule.ActorScope<any>)

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
    const runtime = Context.getOption(context as Context.Context<ActorRuntime>, ActorRuntime)
    return Option.isSome(runtime) && runtime.value.parent !== undefined
      ? runtime.value.parent.send(event)
      : Effect.void
  })

export const makePlanningRuntime = <Events, Emits>(
  deferredRaisedEvents: DeferredRaisedEvents["Service"]
): Runtime<Events, Emits> =>
  RuntimeContext.of({
    raise: (event) => deferredRaisedEvents.add(event),
    sendParent: sendParentOptional
  })

export const makeActorRuntime = <Events, Emits>(
  scope: ActorModule.ActorScope<Events>
): Runtime<Events, Emits> =>
  RuntimeContext.of({
    raise: (event) => scope.self.send(event),
    sendParent: (event) => scope.parent === undefined ? Effect.void : scope.parent.send(event)
  })

export const runActions = <E, R, Events, Emits>(
  actions: Iterable<Effect.Effect<void, E, R>>,
  runtime: Runtime<Events, Emits>
): Effect.Effect<void, E, R> =>
  Effect.all(
    Array.from(actions, (action) => provideRuntimeContext(action, runtime)),
    { discard: true }
  )

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
    | Machine.StateOf<States>
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
  event: Machine.EventOf<Events>
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
  event: Machine.EventOf<Events>,
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
  event: Machine.EventOf<Events>
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
            transition: { reenter: false, transition: always },
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
  machine: Machine.Any,
  target: Machine.StateOf<States> | Machine.Snapshot<States> | Machine.Target<States, Machine.StateIdentifier<States>>
): string => {
  if (isTarget(target)) {
    return String(target.path)
  }
  if (isSnapshot(target)) {
    return String(target.path)
  }
  const node = findStateNode(machine, target as { readonly _tag: PropertyKey })
  if (node === undefined) {
    throw new Error(`StateMachine expected target state "${String((target as any)._tag)}" to match a state node`)
  }
  return node.path
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
      | Machine.StateOf<States>
      | Machine.Snapshot<States>
      | Machine.Target<States, Machine.StateIdentifier<States>>
  const targetPath = target === undefined ? undefined : getTargetNodePath(machine, target)
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
export const InitialEventTypeId: unique symbol = Symbol("effect/StateMachine/InitialEvent")
export const InitialEvent = { _tag: InitialEventTypeId }

export const catchStartup = <A>(
  effect: Effect.Effect<A, unknown, unknown>
): Effect.Effect<A, StartupError> =>
  Effect.catchCause(effect as Effect.Effect<A, unknown, never>, (cause) => Effect.fail(new StartupError({ cause })))

export const isFinalState = (
  machine: Machine.Any,
  state: Machine.StateLike<any>
): boolean => isActiveFinalConfiguration(machine, normalizeConfiguration(machine, state))

export const getFinalOutputFromConfiguration = <
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  Output
>(
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  event: Machine.EventOf<Events>
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
  state: Machine.StateLike<States>,
  event: Machine.EventOf<Events>
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
  state: Machine.StateLike<States>
): state is Extract<
  Machine.StateLike<States>,
  Machine.StateByIdentifier<States, FinalStates> | Machine.SnapshotContainingFinal<States, FinalStates>
> => isFinalState(machine, state)

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
    readonly actions: ReadonlyArray<Effect.Effect<void, InitialE | StartupError, InitialR>>
    readonly output: Output | undefined
  },
  InitialE | StartupError,
  never
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
  const result = machine.initial(...args)
  const state = Effect.isEffect(result)
    ? yield* (result.pipe(Effect.provideService(DeferredActions, deferredActions)) as Effect.Effect<
      Machine.Snapshot<States>
    >)
    : result
  const configuration = normalizeConfiguration<States>(machine, state)
  validateInitialConfiguration(machine, configuration)
  const actions = yield* deferredActions.read
  const settled = yield* catchStartup(Effect.gen(function*() {
    const entry = yield* collectStateActions<States, Events, Emits, never, never>(
      machine,
      configuration,
      getInitialEntryPaths(machine, configuration),
      InitialEvent as Machine.EventOf<Events>,
      "entry"
    )
    return yield* (settle(
      machine,
      configuration,
      InitialEvent as Machine.EventOf<Events>,
      [...entry.actions] as Array<Effect.Effect<void, never, never>>,
      [...entry.raisedEvents] as Array<Machine.EventOf<Events>>,
      []
    ) as Effect.Effect<MacrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, never, never, Output>>)
  }))

  return {
    state: snapshotFromConfiguration<States>(machine, settled.next),
    actions: [
      ...actions,
      ...settled.actions.map((action) => catchStartup(action))
    ] as ReadonlyArray<Effect.Effect<void, InitialE | StartupError, InitialR>>,
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
  state: Machine.StateLike<States>
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
  event: Machine.EventOf<Events>,
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
  event: Machine.EventOf<Events>,
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
  let stateAfterTransition = state
  for (const transition of sortEvaluatedTransitions(machine, transitions)) {
    if (transition.target !== undefined) {
      stateAfterTransition = normalizeTargetConfiguration<States>(machine, stateAfterTransition, transition.target)
    }
  }

  const changed = transitions.some((transition) => transition.changed)
  const transitionActions = sortEvaluatedTransitions(machine, transitions)
    .flatMap((transition) => transition.actions)
  const transitionRaisedEvents = sortEvaluatedTransitions(machine, transitions)
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

  const exitPaths = sortExitPaths(machine, transitions.flatMap((transition) => transition.exitPaths))
  const entryPaths = sortEntryPaths(machine, transitions.flatMap((transition) => transition.entryPaths))
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
  event: Machine.EventOf<Events>,
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
  event: Machine.EventOf<Events>,
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
  state: Machine.StateLike<States>,
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
  state: Machine.StateLike<States>,
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
 * Defers an effectful action until the current state machine step is planned.
 *
 * @category combinators
 * @since 4.0.0
 */
export const action = <E, R>(
  effect: Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> => actionUnsafe(effect) as unknown as Effect.Effect<void, E, R>

/**
 * Returns the typed runtime capability for the current state machine.
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

/**
 * Returns the current actor runtime scope when a state machine is running as
 * actor logic.
 *
 * @category actor runtime
 * @since 4.0.0
 */
export const actorRuntime = <Event = unknown>(): Effect.Effect<
  ActorModule.ActorScope<Event>,
  never,
  ActorRuntime
> => Effect.map(ActorRuntime, (runtime) => runtime as ActorModule.ActorScope<Event>)
