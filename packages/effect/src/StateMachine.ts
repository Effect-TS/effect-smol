/**
 * Schema-first state machine definitions.
 *
 * @since 4.0.0
 */

import type * as Cause from "./Cause.ts"
import * as Context from "./Context.ts"
import * as Data from "./Data.ts"
import * as Effect from "./Effect.ts"
import { PipeInspectableProto } from "./internal/core.ts"
import type { Pipeable } from "./Pipeable.ts"
import { hasProperty } from "./Predicate.ts"
import * as Ref from "./Ref.ts"
import type * as Schema from "./Schema.ts"
import * as SynchronizedRef from "./SynchronizedRef.ts"

/**
 * String literal type used as the runtime type identifier for `StateMachine`
 * values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export type TypeId = "~effect/StateMachine"

/**
 * Runtime type identifier attached to `StateMachine` values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export const TypeId: TypeId = "~effect/StateMachine"

/**
 * A schema-first state machine definition.
 *
 * @category models
 * @since 4.0.0
 */
export interface Machine<
  States extends ReadonlyArray<Machine.TaggedSchema>,
  Events extends ReadonlyArray<Machine.TaggedSchema>,
  Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly states: States
  readonly events: Events
  readonly input: Input | undefined
  readonly id: string | undefined

  readonly handlers: Machine.StateConfigs<States, Events, UnhandledStates, Machine.TagOf<Events[number]>, E, R>
  readonly handle: Machine.Handler<
    States,
    Events,
    Input,
    UnhandledStates,
    E,
    R,
    InitialE,
    InitialR,
    FinalStates,
    Output
  >

  /** @internal */
  readonly initial: (...args: [...Machine.InputArgs<Input>]) => Machine.InitialResult<States, InitialE, InitialR>
}

/**
 * A running state machine.
 *
 * @category models
 * @since 4.0.0
 */
export interface Actor<State, Event, out E = never, out R = never, out Output = never> {
  readonly state: Effect.Effect<State>
  readonly output: Effect.Effect<Output | undefined>
  readonly send: (event: Event) => Effect.Effect<void, E | UnhandledEventError | InfiniteTransitionError, R>
  readonly stop: Effect.Effect<void>
}

/**
 * Error returned when an event has no handler for the current state.
 *
 * @category errors
 * @since 4.0.0
 */
export class UnhandledEventError extends Data.TaggedError("UnhandledEventError")<{
  readonly machineId: string | undefined
  readonly state: string
  readonly event: string
}> {}

/**
 * Error returned when a state machine does not stabilize within the maximum
 * number of macrostep iterations.
 *
 * @category errors
 * @since 4.0.0
 */
export class InfiniteTransitionError extends Data.TaggedError("InfiniteTransitionError")<{
  readonly machineId: string | undefined
  readonly state: string
  readonly maxIterations: number
}> {}

/**
 * Error returned when a state machine fails while running startup lifecycle
 * logic after the initial state has been computed.
 *
 * @category errors
 * @since 4.0.0
 */
export class StartupError extends Data.TaggedError("StartupError")<{
  readonly cause: Cause.Cause<unknown>
}> {}

type DeferredAction<E = any, R = any> = Effect.Effect<void, E, R>

interface DeferredQueue<A> {
  readonly add: (value: A) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<A>>
}

class DeferredActions extends Context.Service<DeferredActions, {
  readonly add: <E, R>(effect: DeferredAction<E, R>) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<DeferredAction>>
}>()("effect/StateMachine/DeferredActions") {}

class DeferredRaisedEvents extends Context.Service<DeferredRaisedEvents, {
  readonly add: <Event>(event: Event) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<any>>
}>()("effect/StateMachine/DeferredRaisedEvents") {}

/**
 * Namespace containing type-level members associated with `Machine`.
 *
 * @since 4.0.0
 */
export declare namespace Machine {
  /**
   * Any schema-first state machine.
   *
   * @category models
   * @since 4.0.0
   */
  export type Any = Machine<any, any, any, any, any, any, any, any, any, any>

  /**
   * A schema whose decoded value contains a `_tag` discriminator.
   *
   * This mirrors the tagged-schema constraint used by `Schema.toTaggedUnion`.
   *
   * @category models
   * @since 4.0.0
   */
  export type TaggedSchema = Schema.Top & { readonly Type: { readonly _tag: PropertyKey } }

  export type InputArgs<Input extends Schema.Top> = Input extends typeof Schema.Void ? []
    : [input: Input["Type"]]

  /**
   * Extracts the discriminator value represented by a tagged schema.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type TagOf<S extends TaggedSchema> = S["Type"]["_tag"]

  /**
   * Extracts the union of state values represented by a state schema list.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateOf<States extends ReadonlyArray<TaggedSchema>> = States[number]["Type"]

  /**
   * Extracts the union of event values represented by an event schema list.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type EventOf<Events extends ReadonlyArray<TaggedSchema>> = Events[number]["Type"]

  /**
   * Extracts a state value from a state schema list by tag.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateByTag<
    States extends ReadonlyArray<TaggedSchema>,
    Tag extends TagOf<States[number]>
  > = Extract<StateOf<States>, { readonly _tag: Tag }>

  /**
   * Extracts an event value from an event schema list by tag.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type EventByTag<
    Events extends ReadonlyArray<TaggedSchema>,
    Tag extends TagOf<Events[number]>
  > = Extract<EventOf<Events>, { readonly _tag: Tag }>

  /**
   * Context passed to a state/event handler.
   *
   * @category models
   * @since 4.0.0
   */
  export interface HandlerContext<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > {
    readonly state: StateByTag<States, StateTag>
    readonly event: EventByTag<Events, EventTag>
  }

  /**
   * Context passed to an entry or exit state handler.
   *
   * @category models
   * @since 4.0.0
   */
  export interface StateActionContext<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>
  > {
    readonly state: StateByTag<States, StateTag>
    readonly event: EventOf<Events>
  }

  /**
   * Context passed to an eventless transition handler.
   *
   * @category models
   * @since 4.0.0
   */
  export interface AlwaysContext<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>
  > {
    readonly state: StateByTag<States, StateTag>
    readonly event: EventOf<Events>
  }

  /**
   * Context passed to a final state output function.
   *
   * @category models
   * @since 4.0.0
   */
  export interface FinalOutputContext<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>
  > {
    readonly state: StateByTag<States, StateTag>
    readonly event: EventOf<Events>
  }

  export type StateActionResult<E, R> = void | Effect.Effect<void, E, R>

  export type InitialResult<States extends ReadonlyArray<TaggedSchema>, E, R> =
    | StateOf<States>
    | Effect.Effect<StateOf<States>, E, R>

  export type HandlerResult<States extends ReadonlyArray<TaggedSchema>, E, R> =
    | StateOf<States>
    | void
    | Effect.Effect<StateOf<States> | void, E, R>

  export type HandlerEffect<Handlers> = Handlers[keyof Handlers]
  export type HandlerError<Handlers> = Effect.Error<HandlerEffect<Handlers>>
  export type HandlerServices<Handlers> = Effect.Services<HandlerEffect<Handlers>>
  export type InitialReturn<Initial> = Initial extends (...args: any) => infer Ret ? Ret : never
  export type StateActionReturn<Config, Key extends "entry" | "exit"> = Key extends keyof Config
    ? NonNullable<Config[Key]> extends (...args: any) => infer Ret ? Ret : never
    : never
  export type EventTransitionReturn<Transition> = Transition extends (...args: any) => infer Ret ? Ret
    : Transition extends { readonly transition: (...args: any) => infer Ret } ? Ret
    : never
  export type EventHandlerReturn<Config> = Config extends { readonly on?: infer On }
    ? { readonly [EventTag in keyof On]: EventTransitionReturn<NonNullable<On[EventTag]>> }[
      keyof On
    ]
    : never
  export type AlwaysReturn<Config> = Config extends { readonly always?: infer Always }
    ? NonNullable<Always> extends (...args: any) => infer Ret ? Ret : never
    : never
  export type FinalOutputReturn<Config> = Config extends { readonly output?: infer Output }
    ? NonNullable<Output> extends (...args: any) => infer Ret ? Ret : never
    : never

  export type FinalStateFromConfig<Config, StateTag extends PropertyKey> = Config extends { readonly type: "final" }
    ? StateTag
    : never

  export type ActiveStateConfig<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    E,
    R
  > = {
    readonly type?: "active"
    readonly entry?: (context: StateActionContext<States, Events, StateTag>) => StateActionResult<any, any>
    readonly exit?: (context: StateActionContext<States, Events, StateTag>) => StateActionResult<any, any>
    readonly always?: (context: AlwaysContext<States, Events, StateTag>) => HandlerResult<States, any, any>
    readonly output?: never
    readonly on?: {
      readonly [EventTag in TagOf<Events[number]>]?:
        | ((
          context: HandlerContext<States, Events, StateTag, EventTag, E, R>
        ) => HandlerResult<States, any, any>)
        | {
          readonly reenter?: boolean
          readonly transition: (
            context: HandlerContext<States, Events, StateTag, EventTag, E, R>
          ) => HandlerResult<States, any, any>
        }
    }
  }

  export type FinalStateConfig<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>
  > = {
    readonly type: "final"
    readonly entry?: (context: StateActionContext<States, Events, StateTag>) => StateActionResult<any, any>
    readonly output?: (context: FinalOutputContext<States, Events, StateTag>) => any
    readonly exit?: never
    readonly always?: never
    readonly on?: never
  }

  export type HandlerConfig<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    E,
    R
  > =
    | ActiveStateConfig<States, Events, StateTag, E, R>
    | FinalStateConfig<States, Events, StateTag>

  /**
   * Adds handlers for an unhandled state tag.
   *
   * @category combinators
   * @since 4.0.0
   */
  export interface Handler<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Input extends Schema.Top,
    UnhandledStates extends TagOf<States[number]>,
    E,
    R,
    InitialE,
    InitialR,
    FinalStates extends TagOf<States[number]>,
    Output
  > {
    <
      const StateTag extends UnhandledStates,
      const Config extends HandlerConfig<States, Events, StateTag, E, R>
    >(
      stateTag: StateTag,
      config: Config
    ): Machine<
      States,
      Events,
      Input,
      Exclude<UnhandledStates, StateTag>,
      | E
      | Effect.Error<EventHandlerReturn<Config>>
      | Effect.Error<AlwaysReturn<Config>>
      | Effect.Error<StateActionReturn<Config, "entry">>
      | Effect.Error<StateActionReturn<Config, "exit">>,
      | R
      | Effect.Services<EventHandlerReturn<Config>>
      | Effect.Services<AlwaysReturn<Config>>
      | Effect.Services<StateActionReturn<Config, "entry">>
      | Effect.Services<StateActionReturn<Config, "exit">>,
      InitialE,
      InitialR,
      FinalStates | FinalStateFromConfig<Config, StateTag>,
      Output | FinalOutputReturn<Config>
    >
  }

  /**
   * Any state config.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type AnyStateConfig = StateConfig<any, any, any, any, any, any>

  /**
   * Runtime event-handler map stored for a single state tag.
   *
   * @category models
   * @since 4.0.0
   */
  export type EventHandlerMap<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > = Readonly<
    Record<
      PropertyKey,
      | ((context: HandlerContext<States, Events, StateTag, EventTag, E, R>) => HandlerResult<States, E, R>)
      | {
        readonly reenter?: boolean
        readonly transition: (
          context: HandlerContext<States, Events, StateTag, EventTag, E, R>
        ) => HandlerResult<States, E, R>
      }
    >
  >

  /**
   * Runtime state config stored for a single state tag.
   *
   * @category models
   * @since 4.0.0
   */
  export interface StateConfig<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > {
    readonly type?: "final" | "active"
    readonly entry?: (context: StateActionContext<States, Events, StateTag>) => StateActionResult<E, R>
    readonly exit?: (context: StateActionContext<States, Events, StateTag>) => StateActionResult<E, R>
    readonly always?: (context: AlwaysContext<States, Events, StateTag>) => HandlerResult<States, E, R>
    readonly output?: (context: FinalOutputContext<States, Events, StateTag>) => any
    readonly on?: EventHandlerMap<States, Events, StateTag, EventTag, E, R>
  }

  /**
   * Runtime handler table stored on a machine.
   *
   * @category models
   * @since 4.0.0
   */
  export type StateConfigs<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > = Readonly<Record<PropertyKey, StateConfig<States, Events, StateTag, EventTag, E, R>>>
}

const Proto = {
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  handle(this: Machine.Any, stateTag: PropertyKey, config: Machine.AnyStateConfig) {
    return handleUnsafe(this, stateTag, config)
  },
  toJSON() {
    return {
      _id: "StateMachine"
    }
  }
}

const handleUnsafe = (
  self: Machine.Any,
  stateTag: PropertyKey,
  config: Machine.AnyStateConfig
): Machine.Any => {
  const machine = Object.create(Proto)
  machine.states = self.states
  machine.events = self.events
  machine.input = self.input
  machine.id = self.id
  machine.initial = self.initial
  machine.handlers = {
    ...self.handlers,
    [stateTag]: config
  }
  return machine
}

const makeDeferredQueue = <A>(): Effect.Effect<DeferredQueue<A>> =>
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

const makeDeferredActions = Effect.map(
  makeDeferredQueue<DeferredAction>(),
  (queue) =>
    DeferredActions.of({
      read: queue.read,
      add: (effect) => queue.add(effect)
    })
)

const makeDeferredRaisedEvents = Effect.map(
  makeDeferredQueue<any>(),
  (queue) =>
    DeferredRaisedEvents.of({
      read: queue.read,
      add: (event) => queue.add(event)
    })
)

const provideDeferredServices = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  deferredActions: DeferredActions["Service"],
  deferredRaisedEvents: DeferredRaisedEvents["Service"]
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.provideService(DeferredActions, deferredActions),
    Effect.provideService(DeferredRaisedEvents, deferredRaisedEvents)
  )

const runStateAction = <Context, E, R>(
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

type MicrostepPlan<State, Event, E, R> = {
  readonly next: State
  readonly actions: ReadonlyArray<Effect.Effect<void, E, R>>
  readonly raisedEvents: ReadonlyArray<Event>
  readonly changed: boolean
}

type MacrostepPlan<State, Event, E, R, Output> = {
  readonly next: State
  readonly actions: ReadonlyArray<Effect.Effect<void, E, R>>
  readonly microsteps: ReadonlyArray<MicrostepPlan<State, Event, E, R>>
  readonly output: Output | undefined
}

type TransitionHandler<States extends ReadonlyArray<Machine.TaggedSchema>, E, R, Context> = (
  context: Context
) => Machine.HandlerResult<States, E, R>

type EventTransition<States extends ReadonlyArray<Machine.TaggedSchema>, E, R, Context> =
  | TransitionHandler<States, E, R, Context>
  | {
    readonly reenter?: boolean
    readonly transition: TransitionHandler<States, E, R, Context>
  }

type MicrostepTransition<States extends ReadonlyArray<Machine.TaggedSchema>, E, R, Context> = {
  readonly reenter: boolean
  readonly transition: TransitionHandler<States, E, R, Context>
}

const normalizeEventTransition = <States extends ReadonlyArray<Machine.TaggedSchema>, E, R, Context>(
  transition: EventTransition<States, E, R, Context> | undefined
): MicrostepTransition<States, E, R, Context> | undefined => {
  if (transition === undefined) {
    return undefined
  }
  return typeof transition === "function"
    ? { reenter: false, transition }
    : { reenter: transition.reenter === true, transition: transition.transition }
}

const collectStateAction = Effect.fnUntraced(function*<Context, Event, E, R>(
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

const collectTransition = Effect.fnUntraced(function*<
  const States extends ReadonlyArray<Machine.TaggedSchema>,
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

const MaxMacrostepIterations = 1000
const InitialEventTypeId: unique symbol = Symbol("effect/StateMachine/InitialEvent")
const InitialEvent = { _tag: InitialEventTypeId }

const catchStartup = <A>(
  effect: Effect.Effect<A, unknown, unknown>
): Effect.Effect<A, StartupError> =>
  Effect.catchCause(effect as Effect.Effect<A, unknown, never>, (cause) => Effect.fail(new StartupError({ cause })))

/**
 * Returns `true` if a value is a `StateMachine`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isMachine = (
  u: unknown
): u is Machine.Any => hasProperty(u, TypeId)

const isFinalState = (
  machine: Machine.Any,
  state: { readonly _tag: PropertyKey }
): boolean => machine.handlers[state._tag]?.type === "final"

const getFinalOutput = <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  StateTag extends Machine.TagOf<States[number]>,
  Output
>(
  machine: Machine.Any,
  state: Machine.StateByTag<States, StateTag>,
  event: Machine.EventOf<Events>
): Output | undefined => machine.handlers[state._tag]?.output?.({ state, event }) as Output | undefined

/**
 * Returns `true` if a state is final for a state machine.
 *
 * @category guards
 * @since 4.0.0
 */
export const isFinal = <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates>,
  state: Machine.StateOf<States>
): state is Machine.StateByTag<States, FinalStates> => isFinalState(machine, state)

/**
 * Creates a schema-first state machine definition.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  InitialE = never,
  InitialR = never
>(
  config: {
    readonly id?: string
    readonly states: States
    readonly events: Events
    readonly input?: Input
    readonly initial: (...args: [...Machine.InputArgs<Input>]) => Machine.InitialResult<States, InitialE, InitialR>
  }
): Machine<
  States,
  Events,
  Input,
  Machine.TagOf<States[number]>,
  never,
  never,
  InitialE,
  InitialR
> => {
  const self = Object.create(Proto)
  self.states = config.states
  self.events = config.events
  self.input = config.input
  self.id = config.id
  self.initial = config.initial
  self.handlers = {}
  return self
}

/**
 * Returns the initial state for a state machine.
 *
 * @category constructors
 * @since 4.0.0
 */
export const initial = <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR>,
  ...args: [...Machine.InputArgs<Input>]
): Machine.InitialResult<States, InitialE, InitialR> => machine.initial(...args)

/**
 * Plans the initial state for a state machine without running deferred actions.
 *
 * @category constructors
 * @since 4.0.0
 */
export const planInitial: <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output>,
  ...args: [...Machine.InputArgs<Input>]
) => Effect.Effect<
  {
    readonly state: Machine.StateOf<States>
    readonly actions: ReadonlyArray<Effect.Effect<void, InitialE | StartupError, InitialR>>
    readonly output: Output | undefined
  },
  InitialE | StartupError,
  never
> = Effect.fnUntraced(function*<
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output>,
  ...args: [...Machine.InputArgs<Input>]
) {
  const deferredActions = yield* makeDeferredActions
  const result = initial(machine, ...args)
  const state = Effect.isEffect(result)
    ? yield* (result.pipe(Effect.provideService(DeferredActions, deferredActions)) as Effect.Effect<
      Machine.StateOf<States>
    >)
    : result
  const actions = yield* deferredActions.read
  const settled = yield* catchStartup(Effect.gen(function*() {
    const entry = yield* collectStateAction(
      machine.handlers[state._tag]?.entry,
      {
        state: state as Machine.StateByTag<States, UnhandledStates>,
        event: InitialEvent as Machine.EventOf<Events>
      }
    )
    return yield* (settle(
      machine,
      state,
      InitialEvent as Machine.EventOf<Events>,
      [...entry.actions] as Array<Effect.Effect<void, never, never>>,
      [...entry.raisedEvents] as Array<Machine.EventOf<Events>>,
      []
    ) as Effect.Effect<MacrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, never, never, Output>>)
  }))

  return {
    state: settled.next,
    actions: [
      ...actions,
      ...settled.actions.map((action) => catchStartup(action))
    ] as ReadonlyArray<Effect.Effect<void, InitialE | StartupError, InitialR>>,
    output: settled.output
  }
})

/**
 * Returns the event tags handled by the current state.
 *
 * @category getters
 * @since 4.0.0
 */
export const enabled = <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R>,
  state: Machine.StateOf<States>
): ReadonlyArray<Machine.TagOf<Events[number]>> =>
  isFinalState(machine, state)
    ? []
    : Reflect.ownKeys(machine.handlers[state._tag]?.on ?? {}) as Array<Machine.TagOf<Events[number]>>

const microstep: <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  Context = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>,
  transition: MicrostepTransition<States, E, R, Context> | undefined,
  context: Context
) => Effect.Effect<
  MicrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R>,
  E | UnhandledEventError,
  R
> = Effect.fnUntraced(function*<
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  Context = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>,
  transition: MicrostepTransition<States, E, R, Context> | undefined,
  context: Context
) {
  const stateConfig = machine.handlers[state._tag]

  if (transition === undefined) {
    return yield* new UnhandledEventError({
      machineId: machine.id,
      state: String(state._tag),
      event: String(event._tag)
    })
  }

  const transitionResult = yield* collectTransition<States, Machine.EventOf<Events>, E, R, Context>(
    transition.transition,
    context
  )
  const stateAfterTransition = transitionResult.state === undefined ? state : transitionResult.state
  if (stateAfterTransition._tag === state._tag && !transition.reenter) {
    return {
      next: stateAfterTransition,
      actions: transitionResult.actions,
      raisedEvents: transitionResult.raisedEvents,
      changed: false
    }
  }

  const exit = yield* collectStateAction<
    Machine.StateActionContext<States, Events, UnhandledStates>,
    Machine.EventOf<
      Events
    >,
    E,
    R
  >(
    stateConfig?.exit,
    {
      state: state as Machine.StateByTag<States, UnhandledStates>,
      event
    }
  )

  const entry = yield* collectStateAction<
    Machine.StateActionContext<States, Events, UnhandledStates>,
    Machine.EventOf<
      Events
    >,
    E,
    R
  >(
    machine.handlers[stateAfterTransition._tag]?.entry,
    {
      state: stateAfterTransition as Machine.StateByTag<States, UnhandledStates>,
      event
    }
  )

  return {
    next: stateAfterTransition,
    actions: [...exit.actions, ...transitionResult.actions, ...entry.actions] as ReadonlyArray<
      Effect.Effect<void, E, R>
    >,
    raisedEvents: [...exit.raisedEvents, ...transitionResult.raisedEvents, ...entry.raisedEvents] as ReadonlyArray<
      Machine.EventOf<Events>
    >,
    changed: true
  }
})

const settle: <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>,
  actions: Array<Effect.Effect<void, E, R>>,
  raisedEvents: Array<Machine.EventOf<Events>>,
  microsteps: Array<MicrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R>>
) => Effect.Effect<
  MacrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R, Output>,
  E | UnhandledEventError | InfiniteTransitionError,
  R
> = Effect.fnUntraced(function*<
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>,
  actions: Array<Effect.Effect<void, E, R>>,
  raisedEvents: Array<Machine.EventOf<Events>>,
  microsteps: Array<MicrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R>>
) {
  let currentState = state
  let currentEvent = event
  let shouldRunAlways = true
  let iterations = 0
  let raisedEventIndex = 0
  let finalOutput: Output | undefined = undefined

  while (true) {
    if (isFinalState(machine, currentState)) {
      finalOutput = getFinalOutput<States, Events, Machine.TagOf<States[number]>, Output>(
        machine,
        currentState as Machine.StateByTag<States, Machine.TagOf<States[number]>>,
        currentEvent
      )
      break
    }

    iterations += 1
    if (iterations > MaxMacrostepIterations) {
      return yield* new InfiniteTransitionError({
        machineId: machine.id,
        state: String(currentState._tag),
        maxIterations: MaxMacrostepIterations
      })
    }

    const always = shouldRunAlways
      ? machine.handlers[currentState._tag]?.always
      : undefined
    if (always !== undefined) {
      const alwaysStep: MicrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R> = yield* microstep(
        machine,
        currentState,
        currentEvent,
        { reenter: false, transition: always },
        {
          state: currentState as Machine.StateByTag<States, UnhandledStates>,
          event: currentEvent
        }
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
    const raisedStateConfig = machine.handlers[currentState._tag]
    const raisedStep = yield* microstep(
      machine,
      currentState,
      raisedEvent,
      normalizeEventTransition(raisedStateConfig?.on?.[raisedEvent._tag]),
      {
        state: currentState as Machine.StateByTag<States, UnhandledStates>,
        event: raisedEvent as Machine.EventByTag<Events, Machine.TagOf<Events[number]>>
      }
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

const macrostep: <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>
) => Effect.Effect<
  MacrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R, Output>,
  E | UnhandledEventError | InfiniteTransitionError,
  R
> = Effect.fnUntraced(function*<
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>
) {
  if (isFinalState(machine, state)) {
    return {
      next: state,
      actions: [],
      microsteps: [],
      output: undefined
    }
  }

  const stateConfig = machine.handlers[state._tag]
  const step = yield* microstep(
    machine,
    state,
    event,
    normalizeEventTransition(stateConfig?.on?.[event._tag]),
    {
      state: state as Machine.StateByTag<States, UnhandledStates>,
      event: event as Machine.EventByTag<Events, Machine.TagOf<Events[number]>>
    }
  )
  const actions = [...step.actions]
  const raisedEvents = [...step.raisedEvents]
  const microsteps = [step]
  return yield* settle(machine, step.next, event, actions, raisedEvents, microsteps)
})

/**
 * Plans the next state for a state machine without running deferred actions.
 *
 * @category combinators
 * @since 4.0.0
 */
export const plan = macrostep

/**
 * Computes the next state for a state machine without mutating a running actor.
 *
 * Deferred actions are executed after the next state is planned.
 *
 * @category combinators
 * @since 4.0.0
 */
export const next: <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>
) => Effect.Effect<Machine.StateOf<States>, E | UnhandledEventError | InfiniteTransitionError, R> = Effect.fnUntraced(
  function*<
    const States extends ReadonlyArray<Machine.TaggedSchema>,
    const Events extends ReadonlyArray<Machine.TaggedSchema>,
    const Input extends Schema.Top = typeof Schema.Void,
    UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
    E = never,
    R = never,
    InitialE = never,
    InitialR = never,
    FinalStates extends Machine.TagOf<States[number]> = never,
    Output = never
  >(
    machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output>,
    state: Machine.StateOf<States>,
    event: Machine.EventOf<Events>
  ) {
    const planned = yield* plan(machine, state, event)
    yield* Effect.all(planned.actions, { discard: true })
    return planned.next
  }
)

const actionUnsafe = Effect.fnUntraced(function*<E, R>(
  effect: Effect.Effect<void, E, R>
) {
  const actions = yield* DeferredActions
  yield* actions.add(effect)
})

export const action = <E, R>(
  effect: Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> => actionUnsafe(effect) as unknown as Effect.Effect<void, E, R>

const raiseUnsafe = Effect.fnUntraced(function*<Event>(
  event: Event
) {
  const events = yield* DeferredRaisedEvents
  yield* events.add(event)
})

export const raise = <Event>(
  event: Event
): Effect.Effect<void> => raiseUnsafe(event) as unknown as Effect.Effect<void>

/**
 * Starts a state machine runtime.
 *
 * @category constructors
 * @since 4.0.0
 */
export const start: <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output>,
  ...args: [...Machine.InputArgs<Input>]
) => Effect.Effect<
  Actor<Machine.StateOf<States>, Machine.EventOf<Events>, E, R, Output>,
  InitialE | StartupError,
  InitialR
> = Effect.fnUntraced(function*<
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output>,
  ...args: [...Machine.InputArgs<Input>]
) {
  const stopped = yield* Ref.make(false)
  const planned = yield* planInitial(machine, ...args)
  yield* Effect.all(planned.actions, { discard: true })
  const current = yield* SynchronizedRef.make(planned.state)
  const currentOutput = yield* Ref.make<Output | undefined>(planned.output)
  if (isFinalState(machine, planned.state)) {
    yield* Ref.set(stopped, true)
  }

  return {
    state: SynchronizedRef.get(current),
    output: Ref.get(currentOutput),
    stop: Ref.set(stopped, true),

    send: (
      event: Machine.EventOf<Events>
    ): Effect.Effect<void, E | UnhandledEventError | InfiniteTransitionError, R> =>
      Effect.gen(function*() {
        if (yield* Ref.get(stopped)) {
          // TODO: Some error or warning?
          return
        }

        const [actions, isFinal, output] = yield* SynchronizedRef.modifyEffect(current, (state) =>
          macrostep(machine, state, event).pipe(
            Effect.map((planned) =>
              [[planned.actions, isFinalState(machine, planned.next), planned.output] as const, planned.next] as const
            )
          ))
        if (isFinal) {
          yield* Ref.set(stopped, true)
          yield* Ref.set(currentOutput, output)
        }

        return yield* Effect.all(actions, { discard: true })
      })
  }
})
