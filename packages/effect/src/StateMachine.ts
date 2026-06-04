/**
 * Schema-first state machine definitions.
 *
 * @since 4.0.0
 */

import * as Data from "./Data.ts"
import * as Effect from "./Effect.ts"
import { Context } from "./index.ts"
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
  InitialR = never
> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly states: States
  readonly events: Events
  readonly input: Input | undefined
  readonly id: string | undefined

  readonly handlers: Machine.StateConfigs<States, Events, UnhandledStates, Machine.TagOf<Events[number]>, E, R>
  readonly handle: Machine.Handler<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR>

  /** @internal */
  readonly initial: (...args: [...Machine.InputArgs<Input>]) => Machine.InitialResult<States, InitialE, InitialR>
}

/**
 * A running state machine.
 *
 * @category models
 * @since 4.0.0
 */
export interface Actor<State, Event, out E = never, out R = never> {
  readonly state: Effect.Effect<State>
  readonly send: (event: Event) => Effect.Effect<void, E | UnhandledEventError, R>
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

class DeferredActions extends Context.Service<DeferredActions, {
  readonly add: <E, R>(effect: Effect.Effect<void, E, R>) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<Effect.Effect<void, any, any>>>
}>()("effect/StateMachine/DeferredActions") {}

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
  export type Any = Machine<any, any, any, any, any, any>

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
  export type EventHandlerReturn<Config> = Config extends { readonly on?: infer On }
    ? { readonly [EventTag in keyof On]: NonNullable<On[EventTag]> extends (...args: any) => infer Ret ? Ret : never }[
      keyof On
    ]
    : never

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
    InitialR
  > {
    <
      const StateTag extends UnhandledStates,
      const Config extends {
        readonly entry?: (context: StateActionContext<States, Events, StateTag>) => StateActionResult<any, any>
        readonly exit?: (context: StateActionContext<States, Events, StateTag>) => StateActionResult<any, any>
        readonly on?: {
          readonly [EventTag in TagOf<Events[number]>]?: (
            context: HandlerContext<States, Events, StateTag, EventTag, E, R>
          ) => HandlerResult<States, any, any>
        }
      }
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
      | Effect.Error<StateActionReturn<Config, "entry">>
      | Effect.Error<StateActionReturn<Config, "exit">>,
      | R
      | Effect.Services<EventHandlerReturn<Config>>
      | Effect.Services<StateActionReturn<Config, "entry">>
      | Effect.Services<StateActionReturn<Config, "exit">>,
      InitialE,
      InitialR
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
      (context: HandlerContext<States, Events, StateTag, EventTag, E, R>) => HandlerResult<States, E, R>
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
    readonly entry?: (context: StateActionContext<States, Events, StateTag>) => StateActionResult<E, R>
    readonly exit?: (context: StateActionContext<States, Events, StateTag>) => StateActionResult<E, R>
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

const makeDeferredActions = Effect.gen(function*() {
  const actions: Array<Effect.Effect<void, any, any>> = []
  return DeferredActions.of({
    read: Effect.sync(() => actions),
    add: (effect) =>
      Effect.sync(() => {
        actions.push(effect)
      })
  })
})

const runStateAction = <Context, E, R>(
  handler: ((context: Context) => Machine.StateActionResult<E, R>) | undefined,
  context: Context,
  deferredActions: {
    readonly add: <E, R>(effect: Effect.Effect<void, E, R>) => Effect.Effect<void>
    readonly read: Effect.Effect<ReadonlyArray<Effect.Effect<void, any, any>>>
  }
): Effect.Effect<void, E, R> => {
  if (handler === undefined) {
    return Effect.void
  }

  const result = handler(context)
  return Effect.isEffect(result)
    ? result.pipe(Effect.provideService(DeferredActions, deferredActions))
    : Effect.void
}

/**
 * Returns `true` if a value is a `StateMachine`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isMachine = (
  u: unknown
): u is Machine.Any => hasProperty(u, TypeId)

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
  InitialR = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR>,
  ...args: [...Machine.InputArgs<Input>]
) => Effect.Effect<
  {
    readonly state: Machine.StateOf<States>
    readonly actions: ReadonlyArray<Effect.Effect<void, InitialE, InitialR>>
  },
  never,
  never
> = Effect.fnUntraced(function*<
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
) {
  const deferredActions = yield* makeDeferredActions
  const result = initial(machine, ...args)
  const state = Effect.isEffect(result)
    ? yield* (result.pipe(Effect.provideService(DeferredActions, deferredActions)) as Effect.Effect<
      Machine.StateOf<States>
    >)
    : result
  const actions = yield* deferredActions.read

  return {
    state,
    actions: actions as ReadonlyArray<Effect.Effect<void, InitialE, InitialR>>
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
  Reflect.ownKeys(machine.handlers[state._tag]?.on ?? {}) as Array<Machine.TagOf<Events[number]>>

/**
 * Plans the next state for a state machine without running deferred actions.
 *
 * @category combinators
 * @since 4.0.0
 */
export const plan: <
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
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>
) => Effect.Effect<
  {
    readonly next: Machine.StateOf<States>
    readonly actions: ReadonlyArray<Effect.Effect<void, E, R>>
  },
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
  InitialR = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>
) {
  const deferredActions = yield* makeDeferredActions
  const stateConfig = machine.handlers[state._tag]
  const handler = stateConfig?.on?.[event._tag]

  if (handler === undefined) {
    return yield* new UnhandledEventError({
      machineId: machine.id,
      state: String(state._tag),
      event: String(event._tag)
    })
  }

  const result = handler({
    state: state as Machine.StateByTag<States, UnhandledStates>,
    event: event as Machine.EventByTag<Events, Machine.TagOf<Events[number]>>
  })

  const nextState = Effect.isEffect(result)
    ? yield* result.pipe(Effect.provideService(DeferredActions, deferredActions))
    : result

  const stateAfterTransition = nextState === undefined ? state : nextState
  const actions = yield* deferredActions.read
  if (stateAfterTransition._tag === state._tag) {
    return {
      next: stateAfterTransition,
      actions: actions as ReadonlyArray<Effect.Effect<void, E, R>>
    }
  }

  const exitDeferredActions = yield* makeDeferredActions
  yield* runStateAction(
    stateConfig?.exit,
    {
      state: state as Machine.StateByTag<States, UnhandledStates>,
      event
    },
    exitDeferredActions
  )
  const exitActions = yield* exitDeferredActions.read

  const entryDeferredActions = yield* makeDeferredActions
  yield* runStateAction(
    machine.handlers[stateAfterTransition._tag]?.entry,
    {
      state: stateAfterTransition as Machine.StateByTag<States, UnhandledStates>,
      event
    },
    entryDeferredActions
  )
  const entryActions = yield* entryDeferredActions.read

  return {
    next: stateAfterTransition,
    actions: [...exitActions, ...actions, ...entryActions] as ReadonlyArray<Effect.Effect<void, E, R>>
  }
})

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
  InitialR = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>
) => Effect.Effect<Machine.StateOf<States>, E | UnhandledEventError, R> = Effect.fnUntraced(function*<
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
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>
) {
  const planned = yield* plan(machine, state, event)
  yield* Effect.all(planned.actions, { discard: true })
  return planned.next
})

export const action = <E, R>(
  effect: Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> =>
  Effect.gen(function*() {
    const actions = yield* DeferredActions
    yield* actions.add(effect)
  }) as any

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
  InitialR = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR>,
  ...args: [...Machine.InputArgs<Input>]
) => Effect.Effect<
  Actor<Machine.StateOf<States>, Machine.EventOf<Events>, E, R>,
  InitialE,
  InitialR
> = Effect.fnUntraced(function*<
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
) {
  const stopped = yield* Ref.make(false)
  const planned = yield* planInitial(machine, ...args)
  yield* Effect.all(planned.actions, { discard: true })
  const current = yield* SynchronizedRef.make(planned.state)

  return {
    state: SynchronizedRef.get(current),
    stop: Ref.set(stopped, true),

    send: (event: Machine.EventOf<Events>): Effect.Effect<void, E | UnhandledEventError, R> =>
      Effect.gen(function*() {
        if (yield* Ref.get(stopped)) {
          // TODO: Some error or warning?
          return
        }

        const actions = yield* SynchronizedRef.modifyEffect(current, (state) =>
          plan(machine, state, event).pipe(
            Effect.map((planned) => [planned.actions, planned.next] as const)
          ))

        return yield* Effect.all(actions, { discard: true })
      })
  }
})
