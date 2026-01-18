/**
 * @since 4.0.0
 */
import * as Data from "../../Data.ts"
import * as Schema from "../../Schema.ts"
import * as Msgpack from "../encoding/Msgpack.ts"
import { type Entry, EntryId, RemoteEntry, RemoteId } from "./EventJournal.ts"
import { EncryptedEntry, EncryptedRemoteEntry } from "./EventLogEncryption.ts"

/**
 * @since 4.0.0
 * @category models
 */
export interface EventLogRemote {
  readonly id: RemoteId
  readonly changes: (startSequence: number) => ReadonlyArray<RemoteEntry>
  readonly write: (entries: ReadonlyArray<Entry>) => void
}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Hello extends Schema.Class<Hello>("effect/unstable/EventLogRemote/Hello")({
  _tag: Schema.tag("Hello"),
  remoteId: RemoteId
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class ChunkedMessage extends Schema.Class<ChunkedMessage>("effect/unstable/EventLogRemote/ChunkedMessage")({
  _tag: Schema.tag("ChunkedMessage"),
  id: Schema.Number,
  part: Schema.Tuple([Schema.Number, Schema.Number]),
  data: Schema.Uint8Array
}) {
  /**
   * @since 4.0.0
   */
  static split(id: number, data: Uint8Array): ReadonlyArray<ChunkedMessage> {
    const parts = Math.ceil(data.byteLength / constChunkSize)
    const result: Array<ChunkedMessage> = new Array(parts)
    for (let i = 0; i < parts; i++) {
      const start = i * constChunkSize
      const end = Math.min((i + 1) * constChunkSize, data.byteLength)
      result[i] = new ChunkedMessage({
        _tag: "ChunkedMessage",
        id,
        part: [i, parts],
        data: data.subarray(start, end)
      })
    }
    return result
  }

  /**
   * @since 4.0.0
   */
  static join(
    map: Map<number, {
      readonly parts: Array<Uint8Array>
      count: number
      bytes: number
    }>,
    part: ChunkedMessage
  ): Uint8Array | undefined {
    const [index, total] = part.part
    let entry = map.get(part.id)
    if (!entry) {
      entry = {
        parts: new Array(total),
        count: 0,
        bytes: 0
      }
      map.set(part.id, entry)
    }
    entry.parts[index] = part.data
    entry.count++
    entry.bytes += part.data.byteLength
    if (entry.count !== total) {
      return
    }
    const data = new Uint8Array(entry.bytes)
    let offset = 0
    for (const part of entry.parts) {
      data.set(part, offset)
      offset += part.byteLength
    }
    map.delete(part.id)
    return data
  }
}

/**
 * @since 4.0.0
 * @category protocol
 */
export class WriteEntries extends Schema.Class<WriteEntries>("effect/unstable/EventLogRemote/WriteEntries")({
  _tag: Schema.tag("WriteEntries"),
  publicKey: Schema.String,
  id: Schema.Number,
  iv: Schema.Uint8Array,
  encryptedEntries: Schema.Array(EncryptedEntry)
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Ack extends Schema.Class<Ack>("effect/unstable/EventLogRemote/Ack")({
  _tag: Schema.tag("Ack"),
  id: Schema.Number,
  sequenceNumbers: Schema.Array(Schema.Number)
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class RequestChanges extends Schema.Class<RequestChanges>("effect/unstable/EventLogRemote/RequestChanges")({
  _tag: Schema.tag("RequestChanges"),
  publicKey: Schema.String,
  startSequence: Schema.Number
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Changes extends Schema.Class<Changes>("effect/unstable/EventLogRemote/Changes")({
  _tag: Schema.tag("Changes"),
  publicKey: Schema.String,
  entries: Schema.Array(EncryptedRemoteEntry)
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class StopChanges extends Schema.Class<StopChanges>("effect/unstable/EventLogRemote/StopChanges")({
  _tag: Schema.tag("StopChanges"),
  publicKey: Schema.String
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Ping extends Schema.Class<Ping>("effect/unstable/EventLogRemote/Ping")({
  _tag: Schema.tag("Ping"),
  id: Schema.Number
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export class Pong extends Schema.Class<Pong>("effect/unstable/EventLogRemote/Pong")({
  _tag: Schema.tag("Pong"),
  id: Schema.Number
}) {}

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolRequest = Schema.Union([WriteEntries, RequestChanges, StopChanges, ChunkedMessage, Ping])

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolRequestMsgpack = Msgpack.schema(ProtocolRequest)

/**
 * @since 4.0.0
 * @category protocol
 */
export const decodeRequest = Schema.decodeUnknownEffect(ProtocolRequestMsgpack)

/**
 * @since 4.0.0
 * @category protocol
 */
export const encodeRequest = Schema.encodeUnknownEffect(ProtocolRequestMsgpack)

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolResponse = Schema.Union([Hello, Ack, Changes, ChunkedMessage, Pong])

/**
 * @since 4.0.0
 * @category protocol
 */
export const ProtocolResponseMsgpack = Msgpack.schema(ProtocolResponse)

/**
 * @since 4.0.0
 * @category protocol
 */
export const decodeResponse = Schema.decodeUnknownEffect(ProtocolResponseMsgpack)

/**
 * @since 4.0.0
 * @category protocol
 */
export const encodeResponse = Schema.encodeUnknownEffect(ProtocolResponseMsgpack)

/**
 * @since 4.0.0
 * @category change
 */
export class RemoteAdditions extends Schema.Class<RemoteAdditions>("effect/unstable/EventLogRemote/RemoteAdditions")({
  _tag: Schema.tag("RemoteAdditions"),
  entries: Schema.Array(RemoteEntry)
}) {}

const constChunkSize = 512_000

/**
 * @since 4.0.0
 * @category errors
 */
export class EventLogRemoteError extends Data.TaggedError("EventLogRemoteError")<{
  readonly method: string
  readonly cause: unknown
}> {}

/**
 * @since 4.0.0
 * @category entry
 */
export const RemoteEntryChange = Schema.Tuple([RemoteId, Schema.Array(EntryId)])
