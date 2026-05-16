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
 * Type identifier used to mark runtime cluster envelope values.
 *
 * @category Type IDs
 * @since 4.0.0
 */
export const TypeId = "~effect/cluster/Envelope"

/**
 * Union of cluster envelopes exchanged for an RPC request.
 *
 * An envelope is either a request, an acknowledgement for a streamed reply chunk,
 * or an interrupt signal.
 *
 * @category models
 * @since 4.0.0
 */
export type Envelope<R extends Rpc.Any> = Request<R> | AckChunk | Interrupt

/**
 * JSON-serializable form of a cluster envelope.
 *
 * @category models
 * @since 4.0.0
 */
export type Encoded = PartialRequestEncoded | AckChunkEncoded | InterruptEncoded

/**
 * Helper types associated with cluster envelopes.
 *
 * @since 4.0.0
 */
export declare namespace Envelope {
  /**
   * Envelope type for any RPC protocol.
   *
   * @category models
   * @since 4.0.0
   */
  export type Any = Envelope<any>
}

/**
 * Runtime envelope for an RPC request addressed to a specific entity.
 *
 * It carries the request ID, entity address, RPC tag, decoded payload, request
 * headers, and optional tracing context.
 *
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
 * Schema for a request envelope before its RPC payload has been decoded.
 *
 * The envelope metadata is decoded, while the payload remains `unknown` until it
 * is decoded with the target RPC payload schema.
 *
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
 * Serialized JSON shape of a request envelope.
 *
 * Identifiers are encoded as strings and the RPC payload remains unknown until
 * decoded with the RPC schema.
 *
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
 * Envelope acknowledging receipt of a streamed reply chunk for a request.
 *
 * The `replyId` identifies the chunk reply that has been received.
 *
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
 * Serialized JSON shape of an `AckChunk` envelope.
 *
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
 * Envelope used to interrupt an in-flight entity request.
 *
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
 * Serialized JSON shape of an `Interrupt` envelope.
 *
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
 * Schema union for partially decoded cluster envelopes.
 *
 * It accepts `PartialRequest`, `AckChunk`, and `Interrupt` envelope values.
 *
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
 * Decoded value type produced by the `Partial` envelope schema.
 *
 * @category schemas
 * @since 4.0.0
 */
export type Partial = typeof Partial.Type

/**
 * JSON codec for partial cluster envelopes.
 *
 * @category schemas
 * @since 4.0.0
 */
export const PartialJson: Schema.Codec<
  AckChunk | Interrupt | PartialRequest,
  Encoded
> = Schema.toCodecJson(Partial) as any

/**
 * Mutable array schema for JSON-encoded partial cluster envelopes.
 *
 * @category schemas
 * @since 4.0.0
 */
export const PartialArray: Schema.mutable<
  Schema.$Array<Schema.Codec<AckChunk | Interrupt | PartialRequest, Encoded>>
> = Schema.mutable(Schema.Array(PartialJson))

/**
 * Helper types associated with request envelopes.
 *
 * @since 4.0.0
 */
export declare namespace Request {
  /**
   * Request envelope type for any RPC protocol.
   *
   * @category models
   * @since 4.0.0
   */
  export type Any = Request<any>
}

/**
 * Returns `true` when the supplied value is a runtime cluster envelope.
 *
 * The check is based on the envelope type identifier.
 *
 * @category refinements
 * @since 4.0.0
 */
export const isEnvelope = (u: unknown): u is Envelope<any> => Predicate.hasProperty(u, TypeId)

/**
 * Constructs a runtime request envelope and attaches the envelope type identifier.
 *
 * Tracing fields are included only when a `traceId` is provided.
 *
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
 * Schema declaration that recognizes runtime `Envelope` values by their type
 * identifier.
 *
 * @category serialization / deserialization
 * @since 4.0.0
 */
export const Envelope = Schema.declare(isEnvelope, {
  identifier: "Envelope"
})

/**
 * Schema declaration that recognizes runtime request envelopes.
 *
 * @category serialization / deserialization
 * @since 4.0.0
 */
export const Request = Schema.declare(
  (u): u is Request.Any => isEnvelope(u) && u._tag === "Request",
  { identifier: "Request" }
)

/**
 * Transformation that decodes plain request data with `makeRequest` and encodes
 * request envelopes back to their raw representation.
 *
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
 * Returns the storage primary key for a request envelope whose payload has a
 * primary key, or `null` when the envelope is not a keyed request.
 *
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
 * Builds a storage primary-key string from an entity address, RPC tag, and
 * payload primary-key ID.
 *
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
