import * as NodeStream from "@effect/platform-node-shared/NodeStream"
import { assert, describe, it } from "@effect/vitest"
import { Stream } from "effect"
import * as Effect from "effect/Effect"
import { Readable, Transform } from "stream"

describe("Stream", () => {
  it("should read a stream", () =>
    Effect.gen(function*() {
      const stream = NodeStream.fromReadable<"error", string>({
        evaluate: () => Readable.from(["a", "b", "c"]),
        onError: () => "error"
      })
      const items = yield* Stream.runCollect(stream)
      assert.deepEqual(items, ["a", "b", "c"])
    }).pipe(Effect.runPromise))

  it("fromDuplex", () =>
    Effect.gen(function*() {
      const channel = NodeStream.fromDuplex<never, "error", string>({
        evaluate: () =>
          new Transform({
            transform(chunk, _encoding, callback) {
              callback(null, chunk.toString().toUpperCase())
            }
          }),
        onError: () => "error"
      })

      const result = yield* Stream.fromArray(["a", "b", "c"]).pipe(
        Stream.pipeThroughChannelOrFail(channel),
        Stream.decodeText(),
        Stream.mkString
      )

      assert.strictEqual(result, "ABC")
    }).pipe(Effect.runPromise))

  it("fromDuplex failure", () =>
    Effect.gen(function*() {
      const channel = NodeStream.fromDuplex<never, "error", string>({
        evaluate: () =>
          new Transform({
            transform(_chunk, _encoding, callback) {
              callback(new Error())
            }
          }),
        onError: () => "error"
      })

      const result = yield* Stream.fromArray(["a", "b", "c"]).pipe(
        Stream.pipeThroughChannelOrFail(channel),
        Stream.runDrain,
        Effect.flip
      )

      assert.strictEqual(result, "error")
    }).pipe(Effect.runPromise))

  // it("pipeThroughDuplex", () =>
  //   Effect.gen(function*(_) {
  //     const result = yield* _(
  //       Stream.make("a", "b", "c"),
  //       NodeStream.pipeThroughDuplex(
  //         () =>
  //           new Transform({
  //             transform(chunk, _encoding, callback) {
  //               callback(null, chunk.toString().toUpperCase())
  //             }
  //           }),
  //         () => "error" as const
  //       ),
  //       Stream.decodeText(),
  //       Stream.mkString,
  //       Stream.runCollect
  //     )
  //
  //     assert.deepEqual(
  //       Chunk.toReadonlyArray(result),
  //       ["ABC"]
  //     )
  //   }).pipe(Effect.runPromise))
  //
  // it("pipeThroughDuplex write error", () =>
  //   Effect.gen(function*(_) {
  //     const result = yield* _(
  //       Stream.make("a", "b", "c"),
  //       NodeStream.pipeThroughDuplex(
  //         () =>
  //           new Duplex({
  //             read() {},
  //             write(_chunk, _encoding, callback) {
  //               callback(new Error())
  //             }
  //           }),
  //         () => "error" as const
  //       ),
  //       Stream.runDrain,
  //       Effect.flip
  //     )
  //
  //     assert.strictEqual(result, "error")
  //   }).pipe(Effect.runPromise))
  //
  // it("pipeThroughSimple", () =>
  //   Effect.gen(function*(_) {
  //     const result = yield* _(
  //       Stream.make("a", Buffer.from("b"), "c"),
  //       NodeStream.pipeThroughSimple(
  //         () =>
  //           new Transform({
  //             transform(chunk, _encoding, callback) {
  //               callback(null, chunk.toString().toUpperCase())
  //             }
  //           })
  //       ),
  //       Stream.decodeText(),
  //       Stream.mkString,
  //       Stream.runCollect
  //     )
  //
  //     assert.deepEqual(
  //       Chunk.toReadonlyArray(result),
  //       ["ABC"]
  //     )
  //   }).pipe(Effect.runPromise))
  //
  // it("fromDuplex should work with node:zlib", () =>
  //   Effect.gen(function*(_) {
  //     const text = "abcdefg1234567890"
  //     const encoder = new TextEncoder()
  //     const input = encoder.encode(text)
  //     const stream = NodeStream.fromReadable<"error", Uint8Array>(() => Readable.from([input]), () => "error")
  //     const deflate = NodeStream.fromDuplex<"error", "error", Uint8Array>(() => createGzip(), () => "error")
  //     const inflate = NodeStream.fromDuplex<never, "error", Uint8Array>(() => createUnzip(), () => "error")
  //     const channel = Channel.pipeToOrFail(deflate, inflate)
  //     const items = yield* _(
  //       stream,
  //       Stream.pipeThroughChannelOrFail(channel),
  //       Stream.decodeText(),
  //       Stream.mkString,
  //       Stream.runCollect
  //     )
  //     assert.deepEqual(Chunk.toReadonlyArray(items), [text])
  //   }).pipe(Effect.runPromise))
  //
  // it("toReadable roundtrip", () =>
  //   Effect.gen(function*(_) {
  //     const stream = Stream.range(0, 10000).pipe(
  //       Stream.map((n) => String(n))
  //     )
  //     const readable = yield* _(NodeStream.toReadable(stream))
  //     const outStream = NodeStream.fromReadable<"error", Uint8Array>(() => readable, () => "error")
  //     const items = yield* _(
  //       outStream,
  //       Stream.decodeText(),
  //       Stream.runCollect
  //     )
  //     assert.strictEqual(Chunk.join(items, ""), Array.range(0, 10000).join(""))
  //   }).pipe(Effect.runPromise))
})
