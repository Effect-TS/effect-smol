/**
 * An event stream encoding parser for Amazon Bedrock streaming responses.
 *
 * See the [AWS Documentation](https://docs.aws.amazon.com/lexv2/latest/dg/event-stream-encoding.html)
 * for more information.
 *
 * @since 1.0.0
 */
import { EventStreamCodec } from "@smithy/eventstream-codec"
import { fromUtf8, toUtf8 } from "@smithy/util-utf8"
import type * as Arr from "effect/Array"
import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"
import type * as Pull from "effect/Pull"
import * as Schema from "effect/Schema"

const isNonEmpty = <A>(self: Array<A>): self is Arr.NonEmptyArray<A> => self.length > 0

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeChannel = <T>(schema: Schema.Schema<T>): Channel.Channel<
  Arr.NonEmptyReadonlyArray<T>,
  Schema.SchemaError,
  unknown,
  Arr.NonEmptyReadonlyArray<Uint8Array<ArrayBufferLike>>,
  unknown,
  unknown
> =>
  Channel.fromTransform((
    upstream: Pull.Pull<Arr.NonEmptyReadonlyArray<Uint8Array<ArrayBufferLike>>, unknown, unknown>,
    _scope
  ) => {
    const codec = new EventStreamCodec(toUtf8, fromUtf8)
    const decodeMessage = Schema.decodeUnknownEffect(schema)
    const textDecoder = new TextDecoder()

    let buffer = new Uint8Array(0)
    let pending: Array<T> = []

    const pull = Effect.gen(function*() {
      // Drain pending messages first
      if (isNonEmpty(pending)) {
        const result = pending
        pending = []
        return result
      }

      // Keep pulling upstream until we have at least one decoded message
      while (true) {
        const chunks = yield* upstream

        for (const chunk of chunks) {
          // Append new chunk to buffer
          const newBuffer = new Uint8Array(buffer.length + chunk.length)
          newBuffer.set(buffer)
          newBuffer.set(chunk, buffer.length)
          buffer = newBuffer

          // Try to decode messages from the buffer
          while (buffer.length >= 4) {
            // The first four bytes are the total length of the message (big-endian)
            const totalLength = new DataView(
              buffer.buffer,
              buffer.byteOffset,
              buffer.byteLength
            ).getUint32(0, false)

            // If we don't have the full message yet, keep looping
            if (buffer.length < totalLength) {
              break
            }

            // Decode exactly the sub-slice for this event
            const subView = buffer.subarray(0, totalLength)
            const decoded = codec.decode(subView)

            // Slice the used bytes off the buffer, removing this message
            buffer = buffer.slice(totalLength)

            // Process the message
            if (decoded.headers[":message-type"]?.value === "event") {
              const data = textDecoder.decode(decoded.body)

              // Wrap the data in the `":event-type"` field to match the
              // expected schema
              const message = yield* decodeMessage({
                [decoded.headers[":event-type"]?.value as string]: JSON.parse(data)
              })

              pending.push(message)
            }
          }
        }

        // If we decoded at least one message, emit them
        if (isNonEmpty(pending)) {
          const result: Arr.NonEmptyArray<T> = [pending[0], ...pending.slice(1)]
          pending = []
          return result
        }
      }
    })

    return Effect.succeed(pull as any)
  }) as any
