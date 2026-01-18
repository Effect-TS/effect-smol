/**
 * @since 4.0.0
 */
import type * as Effect from "../../Effect.ts"
import type { Pipeable } from "../../Pipeable.ts"
import * as Predicate from "../../Predicate.ts"
import type * as Record from "../../Record.ts"
import * as Redacted from "../../Redacted.ts"
import * as Schema from "../../Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { Covariant } from "../../Types.ts"
import type { Event } from "./Event.ts"
import type { EventGroup } from "./EventGroup.ts"
import type { Entry } from "./EventJournal.ts"

/**
 * @since 4.0.0
 * @category schema
 */
export type SchemaTypeId = "~effect/eventlog/EventLogSchema"

/**
 * @since 4.0.0
 * @category schema
 */
export const SchemaTypeId: SchemaTypeId = "~effect/eventlog/EventLogSchema"

/**
 * @since 4.0.0
 * @category schema
 */
export const isEventLogSchema = (u: unknown): u is EventLogSchema<EventGroup.Any> =>
  Predicate.hasProperty(u, SchemaTypeId)

/**
 * @since 4.0.0
 * @category schema
 */
export interface EventLogSchema<Groups extends EventGroup.Any> {
  readonly [SchemaTypeId]: SchemaTypeId
  readonly groups: ReadonlyArray<Groups>
}

/**
 * @since 4.0.0
 * @category schema
 */
export const schema = <Groups extends ReadonlyArray<EventGroup.Any>>(
  ...groups: Groups
): EventLogSchema<Groups[number]> => {
  const EventLog = Object.assign(function EventLog() {}, {
    [SchemaTypeId]: SchemaTypeId,
    groups
  }) satisfies EventLogSchema<Groups[number]>
  return EventLog
}

/**
 * @since 4.0.0
 * @category handlers
 */
export type HandlersTypeId = "~effect/eventlog/EventLogHandlers"

/**
 * @since 4.0.0
 * @category handlers
 */
export const HandlersTypeId: HandlersTypeId = "~effect/eventlog/EventLogHandlers"

/**
 * Represents a handled `EventGroup`.
 *
 * @since 4.0.0
 * @category handlers
 */
export interface Handlers<
  R,
  Events extends Event.Any = never
> extends Pipeable {
  readonly [HandlersTypeId]: {
    _Events: Covariant<Events>
  }
  readonly group: EventGroup.AnyWithProps
  readonly handlers: Record.ReadonlyRecord<string, Handlers.Item<R>>
  readonly services: ServiceMap.ServiceMap<R>

  /**
   * Add the implementation for an `Event` to a `Handlers` group.
   */
  handle<Tag extends Event.Tag<Events>, R1>(
    name: Tag,
    handler: (
      options: {
        readonly payload: Event.PayloadWithTag<Events, Tag>
        readonly entry: Entry
        readonly conflicts: ReadonlyArray<{
          readonly entry: Entry
          readonly payload: Event.PayloadWithTag<Events, Tag>
        }>
      }
    ) => Effect.Effect<Event.SuccessWithTag<Events, Tag>, Event.ErrorWithTag<Events, Tag>, R1>
  ): Handlers<
    R | R1,
    Event.ExcludeTag<Events, Tag>
  >
}

/**
 * @since 4.0.0
 * @category handlers
 */
export declare namespace Handlers {
  /**
   * @since 4.0.0
   * @category handlers
   */
  export interface Any {
    readonly [HandlersTypeId]: unknown
  }

  /**
   * @since 4.0.0
   * @category handlers
   */
  export type Item<R> = {
    readonly event: Event.AnyWithProps
    readonly services: ServiceMap.ServiceMap<R>
    readonly handler: (options: {
      readonly payload: unknown
      readonly entry: Entry
      readonly conflicts: ReadonlyArray<{
        readonly entry: Entry
        readonly payload: unknown
      }>
    }) => Effect.Effect<unknown, unknown, R>
  }

  /**
   * @since 4.0.0
   * @category handlers
   */
  export type ValidateReturn<A> = A extends (
    | Handlers<
      infer _R,
      infer _Events
    >
    | Effect.Effect<
      Handlers<
        infer _R,
        infer _Events
      >,
      infer _EX,
      infer _RX
    >
  ) ? [_Events] extends [never] ? A
    : `Event not handled: ${Event.Tag<_Events>}` :
    `Must return the implemented handlers`

  /**
   * @since 4.0.0
   * @category handlers
   */
  export type Error<A> = A extends Effect.Effect<
    Handlers<
      infer _R,
      infer _Events
    >,
    infer _EX,
    infer _RX
  > ? _EX :
    never

  /**
   * @since 4.0.0
   * @category handlers
   */
  export type Context<A> = A extends Handlers<
    infer _R,
    infer _Events
  > ? _R | Event.Context<_Events> :
    A extends Effect.Effect<
      Handlers<
        infer _R,
        infer _Events
      >,
      infer _EX,
      infer _RX
    > ? _R | _RX | Event.Context<_Events> :
    never
}

const RegistryTypeId = "~effect/eventlog/EventLogRegistry"

/**
 * @since 4.0.0
 * @category tags
 */
export interface Registry {
  readonly add: (handlers: Handlers.Any) => Effect.Effect<void>
  readonly handlers: Effect.Effect<Record.ReadonlyRecord<string, Handlers.Item<unknown>>>
}

/**
 * @since 4.0.0
 * @category tags
 */
export const Registry: ServiceMap.Service<Registry, Registry> = ServiceMap.Service(RegistryTypeId)

const IdentityTypeId = "~effect/eventlog/EventLogIdentity"

/**
 * @since 4.0.0
 * @category models
 */
export interface Identity {
  readonly publicKey: string
  readonly privateKey: Redacted.Redacted<Uint8Array>
}

/**
 * @since 4.0.0
 * @category schema
 */
export const IdentitySchema = Schema.Struct({
  publicKey: Schema.String,
  privateKey: Schema.Redacted(Schema.Uint8ArrayFromBase64)
})

const IdentityEncodedSchema = Schema.Struct({
  publicKey: Schema.String,
  privateKey: Schema.Uint8ArrayFromBase64
})

const IdentityStringSchema = Schema.fromJsonString(IdentityEncodedSchema)

/**
 * @since 4.0.0
 * @category constructors
 */
export const decodeIdentityString = (value: string): Identity => {
  const decoded = Schema.decodeUnknownSync(IdentityStringSchema)(value)
  return {
    publicKey: decoded.publicKey,
    privateKey: Redacted.make(decoded.privateKey)
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const encodeIdentityString = (identity: Identity): string =>
  Schema.encodeSync(IdentityStringSchema)({
    publicKey: identity.publicKey,
    privateKey: Redacted.value(identity.privateKey)
  })

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeIdentity = (): Identity => ({
  publicKey: globalThis.crypto.randomUUID(),
  privateKey: Redacted.make(globalThis.crypto.getRandomValues(new Uint8Array(32)))
})

/**
 * @since 4.0.0
 * @category tags
 */
export const Identity: ServiceMap.Service<Identity, Identity> = ServiceMap.Service(IdentityTypeId)
