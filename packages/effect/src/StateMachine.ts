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
  R = never
> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly states: States
  readonly events: Events
  readonly input: Input | undefined
  readonly id: string | undefined

  readonly handlers: Machine.Handlers<States, Events, UnhandledStates, Machine.TagOf<Events[number]>, E, R>
  readonly handle: Machine.Handler<States, Events, Input, UnhandledStates, E, R>

  /** @internal */
  readonly initial: (...args: [...Machine.InputArgs<Input>]) => Machine.StateOf<States>
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

  export type HandlerResult<States extends ReadonlyArray<TaggedSchema>, E, R> =
    | StateOf<States>
    | Effect.Effect<StateOf<States>, E, R>

  export type HandlerEffect<Handlers> = Handlers[keyof Handlers]
  export type HandlerError<Handlers> = Effect.Error<HandlerEffect<Handlers>>
  export type HandlerServices<Handlers> = Effect.Services<HandlerEffect<Handlers>>

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
    R
  > {
    <
      const StateTag extends UnhandledStates,
      const Handlers extends Partial<
        Record<
          TagOf<Events[number]>,
          HandlerResult<States, any, any>
        >
      >
    >(
      stateTag: StateTag,
      handlers: {
        readonly [EventTag in keyof Handlers]: EventTag extends TagOf<Events[number]> ?
          (context: HandlerContext<States, Events, StateTag, EventTag, E, R>) => Handlers[EventTag]
          : never
      }
    ): Machine<
      States,
      Events,
      Input,
      Exclude<UnhandledStates, StateTag>,
      E | HandlerError<Handlers>,
      R | HandlerServices<Handlers>
    >
  }

  /**
   * Any event handler map.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type AnyEventHandlerMap = EventHandlerMap<any, any, any, any, any, any>

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
   * Runtime handler table stored on a machine.
   *
   * @category models
   * @since 4.0.0
   */
  export type Handlers<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > = Readonly<Record<PropertyKey, EventHandlerMap<States, Events, StateTag, EventTag, E, R>>>
}

const Proto = {
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  handle(this: Machine.Any, stateTag: PropertyKey, handlers: Machine.AnyEventHandlerMap) {
    return handleUnsafe(this, stateTag, handlers)
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
  handlers: Machine.AnyEventHandlerMap
): Machine.Any => {
  const machine = Object.create(Proto)
  machine.states = self.states
  machine.events = self.events
  machine.input = self.input
  machine.id = self.id
  machine.initial = self.initial
  machine.handlers = {
    ...self.handlers,
    [stateTag]: handlers
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
  const Input extends Schema.Top = typeof Schema.Void
>(
  config: {
    readonly id?: string
    readonly states: States
    readonly events: Events
    readonly input?: Input
    readonly initial: (...args: [...Machine.InputArgs<Input>]) => Machine.StateOf<States>
  }
): Machine<States, Events, Input> => {
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
  R = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R>,
  ...args: [...Machine.InputArgs<Input>]
): Machine.StateOf<States> => machine.initial(...args)

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
  R = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R>,
  ...args: [...Machine.InputArgs<Input>]
) => Effect.Effect<Actor<Machine.StateOf<States>, Machine.EventOf<Events>, E, R>> = Effect.fnUntraced(function*<
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R>,
  ...args: [...Machine.InputArgs<Input>]
) {
  const deferredActions = yield* makeDeferredActions
  const stopped = yield* Ref.make(false)
  const current = yield* SynchronizedRef.make(initial(machine, ...args))

  return {
    state: SynchronizedRef.get(current),
    stop: Ref.set(stopped, true),

    send: (event: Machine.EventOf<Events>): Effect.Effect<void, E | UnhandledEventError, R> =>
      Effect.gen(function*() {
        if (yield* Ref.get(stopped)) {
          // TODO: Some error or warning?
          return
        }

        yield* SynchronizedRef.updateEffect(current, (state) =>
          Effect.gen(function*() {
            const handler = machine.handlers[state._tag]?.[event._tag]

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

            return Effect.isEffect(result)
              ? yield* result.pipe(Effect.provideService(DeferredActions, deferredActions))
              : result
          }))

        const actions = yield* deferredActions.read
        return yield* Effect.all(actions, { discard: true })
      })
  }
})
