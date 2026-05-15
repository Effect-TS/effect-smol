/**
 * @since 4.0.0
 */
import * as Predicate from "../../Predicate.ts"
import * as PrimaryKey from "../../PrimaryKey.ts"
import type { ReadonlyRecord } from "../../Record.ts"
import * as Schema from "../../Schema.ts"
import * as Transformation from "../../SchemaTransformation.ts"
import * as Headers from "../http/Headers.ts"
import type * as Rpc from "../rpc/Rpc.ts"
import { EntityAddress } from "./EntityAddress.ts"
import { type Snowflake, SnowflakeFromBigInt } from "./Snowflake.ts"

/**
 * @category Type IDs
 * @since 4.0.0
 */
export const TypeId = "~effect/cluster/Envelope"

/**
 * @category models
 * @since 4.0.0
 */
export type Envelope<R extends Rpc.Any> = Request<R> | AckChunk | Interrupt

/**
 * @category models
 * @since 4.0.0
 */
export type Encoded = PartialRequestEncoded | AckChunkEncoded | InterruptEncoded

/**
 * @since 4.0.0
 */
export declare namespace Envelope {
  /**
   * @category models
   * @since 4.0.0
   */
  export type Any = Envelope<any>
}

/**
 * @category models
 * @since 4.0.0
 */
export interface Request<in out Rpc extends Rpc.Any> {
  readonly [TypeId]: typeof TypeId
  readonly _tag: "Request"
  readonly requestId: Snowflake
  readonly address: EntityAddress
  readonly tag: Rpc.Tag<Rpc>
  readonly payload: Rpc.Payload<Rpc>
  readonly headers: Headers.Headers
  readonly traceId?: string
  readonly spanId?: string
  readonly sampled?: boolean
}

/**
 * @category models
 * @since 4.0.0
 */
export class PartialRequest extends Schema.Opaque<PartialRequest>()(Schema.Struct({
  _tag: Schema.tag("Request"),
  requestId: SnowflakeFromBigInt,
  address: EntityAddress,
  tag: Schema.String,
  payload: Schema.Any,
  headers: Headers.HeadersSchema,
  traceId: Schema.optional(Schema.String),
  spanId: Schema.optional(Schema.String),
  sampled: Schema.optional(Schema.Boolean)
})) {}

/**
 * @category models
 * @since 4.0.0
 */
export interface PartialRequestEncoded {
  readonly _tag: "Request"
  readonly requestId: string
  readonly address: {
    readonly shardId: {
      readonly group: string
      readonly id: number
    }
    readonly entityType: string
    readonly entityId: string
  }
  readonly tag: string
  readonly payload: unknown
  readonly headers: ReadonlyRecord<string, string>
  readonly traceId?: string
  readonly spanId?: string
  readonly sampled?: boolean
}

/**
 * @category models
 * @since 4.0.0
 */
export class AckChunk extends Schema.Class<AckChunk>("effect/cluster/Envelope/AckChunk")({
  _tag: Schema.tag("AckChunk"),
  id: SnowflakeFromBigInt,
  address: EntityAddress,
  requestId: SnowflakeFromBigInt,
  replyId: SnowflakeFromBigInt
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  withRequestId(requestId: Snowflake): AckChunk {
    return new AckChunk({
      ...this,
      requestId
    })
  }
}

/**
 * @category models
 * @since 4.0.0
 */
export interface AckChunkEncoded {
  readonly _tag: "AckChunk"
  readonly id: string
  readonly address: {
    readonly shardId: {
      readonly group: string
      readonly id: number
    }
    readonly entityType: string
    readonly entityId: string
  }
  readonly requestId: string
  readonly replyId: string
}

/**
 * @category models
 * @since 4.0.0
 */
export class Interrupt extends Schema.Class<Interrupt>("effect/cluster/Envelope/Interrupt")({
  _tag: Schema.tag("Interrupt"),
  id: SnowflakeFromBigInt,
  address: EntityAddress,
  requestId: SnowflakeFromBigInt
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  withRequestId(requestId: Snowflake): Interrupt {
    return new Interrupt({
      ...this,
      requestId
    })
  }
}

/**
 * @category models
 * @since 4.0.0
 */
export interface InterruptEncoded {
  readonly _tag: "Interrupt"
  readonly id: string
  readonly address: {
    readonly shardId: {
      readonly group: string
      readonly id: number
    }
    readonly entityType: string
    readonly entityId: string
  }
  readonly requestId: string
}

/**
 * @category schemas
 * @since 4.0.0
 */
export const Partial: Schema.Union<
  readonly [
    typeof PartialRequest,
    typeof AckChunk,
    typeof Interrupt
  ]
> = Schema.Union([PartialRequest, AckChunk, Interrupt])

/**
 * @category schemas
 * @since 4.0.0
 */
export type Partial = typeof Partial.Type

/**
 * @category schemas
 * @since 4.0.0
 */
export const PartialJson: Schema.Codec<
  AckChunk | Interrupt | PartialRequest,
  Encoded
> = Schema.toCodecJson(Partial) as any

/**
 * @category schemas
 * @since 4.0.0
 */
export const PartialArray: Schema.mutable<
  Schema.$Array<Schema.Codec<AckChunk | Interrupt | PartialRequest, Encoded>>
> = Schema.mutable(Schema.Array(PartialJson))

/**
 * @since 4.0.0
 */
export declare namespace Request {
  /**
   * @category models
   * @since 4.0.0
   */
  export type Any = Request<any>
}

/**
 * @category refinements
 * @since 4.0.0
 */
export const isEnvelope = (u: unknown): u is Envelope<any> => Predicate.hasProperty(u, TypeId)

/**
 * @category constructors
 * @since 4.0.0
 */
export const makeRequest = <Rpc extends Rpc.Any>(
  options: {
    readonly requestId: Snowflake
    readonly address: EntityAddress
    readonly tag: Rpc.Tag<Rpc>
    readonly payload: Rpc.Payload<Rpc>
    readonly headers: Headers.Headers
    readonly traceId?: string | undefined
    readonly spanId?: string | undefined
    readonly sampled?: boolean | undefined
  }
): Request<Rpc> => ({
  [TypeId]: TypeId,
  _tag: "Request",
  requestId: options.requestId,
  tag: options.tag,
  address: options.address,
  payload: options.payload,
  headers: options.headers,
  ...(options.traceId !== undefined ?
    {
      traceId: options.traceId!,
      spanId: options.spanId!,
      sampled: options.sampled!
    } :
    {})
})

/**
 * @category serialization / deserialization
 * @since 4.0.0
 */
export const Envelope = Schema.declare(isEnvelope, {
  identifier: "Envelope"
})

/**
 * @category serialization / deserialization
 * @since 4.0.0
 */
export const Request = Schema.declare(
  (u): u is Request.Any => isEnvelope(u) && u._tag === "Request",
  { identifier: "Request" }
)

/**
 * @category serialization / deserialization
 * @since 4.0.0
 */
export const RequestTransform: Transformation.Transformation<
  Request.Any,
  any
> = Transformation.transform({
  decode: (u: any) => makeRequest(u),
  encode: (u) => u as any
})

/**
 * @category primary key
 * @since 4.0.0
 */
export const primaryKey = <R extends Rpc.Any>(envelope: Envelope<R>): string | null => {
  if (envelope._tag !== "Request" || !PrimaryKey.isPrimaryKey(envelope.payload)) {
    return null
  }
  return primaryKeyByAddress({
    address: envelope.address,
    tag: envelope.tag,
    id: PrimaryKey.value(envelope.payload)
  })
}

/**
 * @category primary key
 * @since 4.0.0
 */
export const primaryKeyByAddress = (options: {
  readonly address: EntityAddress
  readonly tag: string
  readonly id: string
}): string =>
  // hash the entity address to save space?
  `${options.address.entityType}/${options.address.entityId}/${options.tag}/${options.id}`
