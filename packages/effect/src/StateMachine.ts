/**
 * Schema-first state machine definitions.
 *
 * @since 4.0.0
 */

import type * as Effect from "./Effect.ts"
import { PipeInspectableProto } from "./internal/core.ts"
import type { Pipeable } from "./Pipeable.ts"
import { hasProperty } from "./Predicate.ts"
import type * as Schema from "./Schema.ts"

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
  Input extends Schema.Top,
  Unhandled extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  out E = never,
  out R = never
> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly states: States
  readonly events: Events
  readonly input: Input
  readonly initial: (input: Input["Type"]) => Machine.StateOf<States>
  readonly handlers: Machine.Handlers
  readonly handle: Machine.Handle<States, Events, Input, Unhandled, E, R>
}

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
    readonly enqueue: { readonly action: <A>(effect: Effect.Effect<A, E, R>) => void }
  }

  /**
   * Adds handlers for an unhandled state tag.
   *
   * @category combinators
   * @since 4.0.0
   */
  export interface Handle<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Input extends Schema.Top,
    Unhandled extends TagOf<States[number]>,
    E,
    R
  > {
    <
      const StateTag extends Unhandled,
      const Handlers extends Partial<Record<TagOf<Events[number]>, StateOf<States>>>
    >(
      stateTag: StateTag,
      handlers: {
        readonly [EventTag in keyof Handlers]: EventTag extends TagOf<Events[number]> ? (
            context: HandlerContext<States, Events, StateTag, EventTag, unknown, unknown>
          ) => Handlers[EventTag]
          : never
      }
    ): Machine<
      States,
      Events,
      Input,
      Exclude<Unhandled, StateTag>,
      E | unknown,
      R | unknown
    >
  }

  /**
   * Runtime event-handler map stored for a single state tag.
   *
   * @category models
   * @since 4.0.0
   */
  export type EventHandlerMap = Readonly<Record<PropertyKey, unknown>>

  /**
   * Runtime handler table stored on a machine.
   *
   * @category models
   * @since 4.0.0
   */
  export type Handlers = Readonly<Record<PropertyKey, EventHandlerMap>>
}

const Proto = {
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  handle(this: Machine.Any, stateTag: PropertyKey, handlers: Machine.EventHandlerMap) {
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
  handlers: Machine.EventHandlerMap
): Machine.Any => {
  const machine = Object.create(Proto)
  machine.states = self.states
  machine.events = self.events
  machine.input = self.input
  machine.initial = self.initial
  machine.handlers = {
    ...self.handlers,
    [stateTag]: handlers
  }
  return machine
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
  const Input extends Schema.Top
>(
  config: {
    readonly states: States
    readonly events: Events
    readonly input: Input
    readonly initial: (input: Input["Type"]) => Machine.StateOf<States>
  }
): Machine<States, Events, Input> => {
  const self = Object.create(Proto)
  self.states = config.states
  self.events = config.events
  self.input = config.input
  self.initial = config.initial
  self.handlers = {}
  return self
}
