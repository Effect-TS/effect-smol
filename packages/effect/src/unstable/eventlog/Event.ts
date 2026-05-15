/**
 * @since 4.0.0
 */
import { pipeArguments } from "../../Pipeable.ts"
import * as Predicate from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import * as Msgpack from "../encoding/Msgpack.ts"

/**
 * @category type ids
 * @since 4.0.0
 */
export type TypeId = "~effect/eventlog/Event"

/**
 * @category type ids
 * @since 4.0.0
 */
export const TypeId: TypeId = "~effect/eventlog/Event"

/**
 * @category guards
 * @since 4.0.0
 */
export const isEvent = (u: unknown): u is Event<any, any, any, any> => Predicate.hasProperty(u, TypeId)

/**
 * Represents an event in an EventLog.
 *
 * @category models
 * @since 4.0.0
 */
export interface Event<
  out Tag extends string,
  in out Payload extends Schema.Top = typeof Schema.Void,
  in out Success extends Schema.Top = typeof Schema.Void,
  in out Error extends Schema.Top = typeof Schema.Never
> {
  readonly [TypeId]: TypeId
  readonly tag: Tag
  readonly primaryKey: (payload: Schema.Schema.Type<Payload>) => string
  readonly payload: Payload
  readonly payloadMsgPack: Msgpack.schema<Payload>
  readonly success: Success
  readonly error: Error
}

/**
 * @category models
 * @since 4.0.0
 */
export interface EventHandler<in out Tag extends string> {
  readonly _: unique symbol
  readonly tag: Tag
}

/**
 * @category models
 * @since 4.0.0
 */
export interface Any {
  readonly [TypeId]: TypeId
  readonly tag: string
  readonly primaryKey: (payload: any) => string
  readonly payload: Schema.Top
  readonly payloadMsgPack: Msgpack.schema<Schema.Top>
  readonly success: Schema.Top
  readonly error: Schema.Top
}

/**
 * @category models
 * @since 4.0.0
 */
export interface AnyWithProps extends Any {}

/**
 * @category models
 * @since 4.0.0
 */
export type ToService<A> = A extends Event<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error
> ? EventHandler<_Tag> :
  never

/**
 * @category models
 * @since 4.0.0
 */
export type Tag<A> = A extends Event<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error
> ? _Tag :
  never

/**
 * @category models
 * @since 4.0.0
 */
export type ErrorSchema<A extends Any> = A extends Event<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error
> ? _Error
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type Error<A extends Any> = Schema.Schema.Type<ErrorSchema<A>>

/**
 * @category models
 * @since 4.0.0
 */
export type AddError<A extends Any, Error extends Schema.Top> = A extends Event<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error
> ? Event<_Tag, _Payload, _Success, _Error | Error>
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type PayloadSchema<A extends Any> = A extends Event<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error
> ? _Payload
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type PayloadSchemaWithTag<A extends Any, Tag extends string> = A extends Event<
  Tag,
  infer _Payload,
  infer _Success,
  infer _Error
> ? _Payload
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type Payload<A extends Any> = Schema.Schema.Type<PayloadSchema<A>>

/**
 * @category models
 * @since 4.0.0
 */
export type TaggedPayload<A extends Any> = A extends Event<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error
> ? {
    readonly _tag: _Tag
    readonly payload: Schema.Schema.Type<_Payload>
  }
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type SuccessSchema<A extends Any> = A extends Event<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error
> ? _Success
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type Success<A extends Any> = Schema.Schema.Type<SuccessSchema<A>>

/**
 * @category models
 * @since 4.0.0
 */
export type ServicesClient<A> = A extends Event<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error
> ?
    | _Payload["EncodingServices"]
    | _Success["DecodingServices"]
    | _Error["DecodingServices"]
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type ServicesServer<A> = A extends Event<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error
> ?
    | _Payload["DecodingServices"]
    | _Success["EncodingServices"]
    | _Error["EncodingServices"]
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type Services<A> = A extends Event<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error
> ?
    | _Payload["DecodingServices"]
    | _Success["EncodingServices"]
    | _Error["EncodingServices"]
    | _Payload["EncodingServices"]
    | _Success["DecodingServices"]
    | _Error["DecodingServices"]
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type WithTag<Events extends Any, Tag extends string> = Extract<Events, { readonly tag: Tag }>

/**
 * @category models
 * @since 4.0.0
 */
export type ExcludeTag<Events extends Any, Tag extends string> = Exclude<Events, { readonly tag: Tag }>

/**
 * @category models
 * @since 4.0.0
 */
export type PayloadWithTag<Events extends Any, Tag extends string> = Payload<WithTag<Events, Tag>>

/**
 * @category models
 * @since 4.0.0
 */
export type SuccessWithTag<Events extends Any, Tag extends string> = Success<WithTag<Events, Tag>>

/**
 * @category models
 * @since 4.0.0
 */
export type ErrorWithTag<Events extends Any, Tag extends string> = Error<WithTag<Events, Tag>>

/**
 * @category models
 * @since 4.0.0
 */
export type ServicesClientWithTag<Events extends Any, Tag extends string> = ServicesClient<WithTag<Events, Tag>>

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function make<
  Tag extends string,
  Payload extends Schema.Top = typeof Schema.Void,
  Success extends Schema.Top = typeof Schema.Void,
  Error extends Schema.Top = typeof Schema.Never
>(options: {
  readonly tag: Tag
  readonly primaryKey: (payload: Schema.Schema.Type<Payload>) => string
  readonly payload?: Payload | undefined
  readonly success?: Success | undefined
  readonly error?: Error | undefined
}): Event<Tag, Payload, Success, Error>
export function make(options: {
  readonly tag: string
  readonly primaryKey: (payload: Schema.Schema.Type<Schema.Top>) => string
  readonly payload?: Schema.Top | undefined
  readonly success?: Schema.Top | undefined
  readonly error?: Schema.Top | undefined
}): Event<string, Schema.Top, Schema.Top, typeof Schema.Never> {
  const payload = options.payload ?? Schema.Void
  const success = options.success ?? Schema.Void
  const error = options.error ?? Schema.Never
  return Object.assign(Object.create(Proto), {
    tag: options.tag,
    primaryKey: options.primaryKey,
    payload,
    payloadMsgPack: Msgpack.schema(payload),
    success,
    error
  })
}

/**
 * @category constructors
 * @since 4.0.0
 */
export function addError<A extends Any, Error2 extends Schema.Top>(
  event: A,
  error: Error2
): AddError<A, Error2>
export function addError(event: Any, error: Schema.Top): Any {
  return make({
    tag: event.tag,
    primaryKey: event.primaryKey,
    payload: event.payload,
    success: event.success,
    error: Schema.Union([event.error, error])
  })
}
