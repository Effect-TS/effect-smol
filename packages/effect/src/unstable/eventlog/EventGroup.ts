/**
 * @since 4.0.0
 */
import { type Pipeable, pipeArguments } from "../../Pipeable.ts"
import * as Predicate from "../../Predicate.ts"
import * as Record from "../../Record.ts"
import type * as Schema from "../../Schema.ts"
import * as Event from "./Event.ts"

/**
 * Unique type identifier used to mark event log event groups.
 *
 * @category type ids
 * @since 4.0.0
 */
export type TypeId = "~effect/eventlog/EventGroup"

/**
 * Runtime type identifier used to mark event log event groups.
 *
 * @category type ids
 * @since 4.0.0
 */
export const TypeId: TypeId = "~effect/eventlog/EventGroup"

/**
 * Returns `true` when a value is an event log event group.
 *
 * @category guards
 * @since 4.0.0
 */
export const isEventGroup = (u: unknown): u is Any => Predicate.hasProperty(u, TypeId)

/**
 * Typed collection of event definitions that represents a portion of an event log
 * domain.
 *
 * Build groups from `empty.add(...)`, then provide implementations for the events
 * with `EventLog.group`.
 *
 * @category models
 * @since 4.0.0
 */
export interface EventGroup<
  out Events extends Event.Any = Event.Any
> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly events: Record.ReadonlyRecord<string, Events>

  /**
   * Add an `Event` to the `EventGroup`.
   */
  add<
    Tag extends string,
    Payload extends Schema.Top = typeof Schema.Void,
    Success extends Schema.Top = typeof Schema.Void,
    Error extends Schema.Top = typeof Schema.Never
  >(options: {
    readonly tag: Tag
    readonly primaryKey: (payload: Schema.Schema.Type<Payload>) => string
    readonly payload?: Payload
    readonly success?: Success
    readonly error?: Error
  }): EventGroup<Events | Event.Event<Tag, Payload, Success, Error>>

  /**
   * Add an error schema to all the events in the `EventGroup`.
   */
  addError<Error extends Schema.Top>(error: Error): EventGroup<Event.AddError<Events, Error>>
}

/**
 * Type-erased marker for an event log event group.
 *
 * @category models
 * @since 4.0.0
 */
export interface Any {
  readonly [TypeId]: TypeId
}

/**
 * Type-erased event group with its events record available structurally.
 *
 * @category models
 * @since 4.0.0
 */
export type AnyWithProps = EventGroup<Event.Any>

/**
 * Derives the handler service markers required for all events in an event group.
 *
 * @category models
 * @since 4.0.0
 */
export type ToService<A> = A extends EventGroup<infer _Events> ? Event.ToService<_Events>
  : never

/**
 * Extracts the union of event definitions contained in an event group.
 *
 * @category models
 * @since 4.0.0
 */
export type Events<Group> = Group extends EventGroup<infer _Events> ? _Events
  : never

/**
 * Client-side schema services required by all events in an event group.
 *
 * @category models
 * @since 4.0.0
 */
export type ServicesClient<Group> = Event.ServicesClient<Events<Group>>

/**
 * Server-side schema services required by all events in an event group.
 *
 * @category models
 * @since 4.0.0
 */
export type ServicesServer<Group> = Event.ServicesServer<Events<Group>>

const makeProto = <
  Events extends Event.Any
>(options: {
  readonly events: Record.ReadonlyRecord<string, Events>
}): EventGroup<Events> => {
  const EventGroupClass = (_: never) => {}
  const group = Object.assign(EventGroupClass, {
    [TypeId]: TypeId,
    events: options.events,
    add<
      Tag extends string,
      Payload extends Schema.Top = typeof Schema.Void,
      Success extends Schema.Top = typeof Schema.Void,
      Error extends Schema.Top = typeof Schema.Never
    >(
      this: EventGroup<Events>,
      addOptions: {
        readonly tag: Tag
        readonly primaryKey: (payload: Schema.Schema.Type<Payload>) => string
        readonly payload?: Payload
        readonly success?: Success
        readonly error?: Error
      }
    ): EventGroup<Events | Event.Event<Tag, Payload, Success, Error>> {
      return makeProto({
        events: {
          ...this.events,
          [addOptions.tag]: Event.make(addOptions)
        }
      })
    },
    addError<Error extends Schema.Top>(
      this: EventGroup<Events>,
      error: Error
    ): EventGroup<Event.AddError<Events, Error>> {
      const events = Record.map<string, Events, Event.AddError<Events, Error>>(
        this.events,
        (event) => Event.addError(event, error)
      )
      return makeProto({ events })
    },
    pipe() {
      return pipeArguments(this, arguments)
    }
  })
  return group
}

/**
 * Empty event group used as the starting point for defining a group.
 *
 * Call `.add(...)` to add event definitions and build a typed `EventGroup`.
 *
 * @category constructors
 * @since 4.0.0
 */
export const empty: EventGroup<never> = makeProto({ events: Record.empty() })
