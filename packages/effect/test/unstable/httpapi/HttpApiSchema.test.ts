import { assert, describe, it } from "@effect/vitest"
import { Schema } from "effect"
import { HttpApiSchema } from "effect/unstable/httpapi"

describe("HttpApiSchema", () => {
  describe("StreamSse", () => {
    it("stores default metadata", () => {
      const events = Schema.Struct({
        event: Schema.Literal("user.created"),
        data: Schema.String
      })
      const error = Schema.Struct({ reason: Schema.String })
      const stream = HttpApiSchema.StreamSse({ events, error })

      assert.isTrue(HttpApiSchema.isStreamDeclaration(stream))
      assert.isTrue(HttpApiSchema.isStreamSse(stream))
      assert.isFalse(HttpApiSchema.isStreamUint8Array(stream))
      assert.strictEqual(stream.mode, "sse")
      assert.strictEqual(stream.contentType, "text/event-stream")
      assert.strictEqual(stream.events, events)
      assert.strictEqual(stream.error, error)

      const metadata = HttpApiSchema.getStreamDeclarationMetadata(stream)
      assert.strictEqual(metadata.mode, "sse")
      assert.strictEqual(metadata.contentType, "text/event-stream")
      if (metadata.mode === "sse") {
        assert.strictEqual(metadata.events, events)
        assert.strictEqual(metadata.error, error)
      }
    })

    it("stores custom content type", () => {
      const events = Schema.Struct({
        event: Schema.Literal("custom"),
        data: Schema.String
      })
      const error = Schema.String
      const stream = HttpApiSchema.StreamSse({
        contentType: "text/event-stream; charset=utf-8",
        events,
        error
      })

      assert.strictEqual(stream.contentType, "text/event-stream; charset=utf-8")
    })
  })

  describe("StreamUint8Array", () => {
    it("stores default metadata", () => {
      const stream = HttpApiSchema.StreamUint8Array()

      assert.isTrue(HttpApiSchema.isStreamDeclaration(stream))
      assert.isFalse(HttpApiSchema.isStreamSse(stream))
      assert.isTrue(HttpApiSchema.isStreamUint8Array(stream))
      assert.strictEqual(stream.mode, "uint8array")
      assert.strictEqual(stream.contentType, "application/octet-stream")
      assert.deepStrictEqual(HttpApiSchema.getStreamDeclarationMetadata(stream), {
        mode: "uint8array",
        contentType: "application/octet-stream"
      })
    })

    it("stores custom content type", () => {
      const stream = HttpApiSchema.StreamUint8Array({
        contentType: "application/custom-binary"
      })

      assert.strictEqual(stream.contentType, "application/custom-binary")
    })
  })

  it("does not identify buffered schemas as stream declarations", () => {
    assert.isFalse(HttpApiSchema.isStreamDeclaration(Schema.String))
    assert.isFalse(HttpApiSchema.isStreamDeclaration(Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array())))
  })
})
