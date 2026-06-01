import { Schema } from "effect"
import { HttpApiSchema } from "effect/unstable/httpapi"
import { describe, expect, it } from "tstyche"

describe("HttpApiSchema", () => {
  describe("StreamSse", () => {
    it("preserves event and error schemas", () => {
      const Events = Schema.Struct({
        event: Schema.Literal("user.created"),
        data: Schema.String
      })
      const Error = Schema.Struct({ reason: Schema.String })
      const stream = HttpApiSchema.StreamSse({ events: Events, error: Error })

      expect(stream).type.toBe<HttpApiSchema.StreamSse<typeof Events, typeof Error>>()
      expect(stream.events).type.toBe<typeof Events>()
      expect(stream.error).type.toBe<typeof Error>()
      expect(stream.mode).type.toBe<"sse">()
    })

    it("preserves the declaration type when annotated with status", () => {
      const Events = Schema.Struct({
        event: Schema.Literal("user.created"),
        data: Schema.String
      })
      const Error = Schema.Struct({ reason: Schema.String })
      const stream = HttpApiSchema.status(202)(HttpApiSchema.StreamSse({ events: Events, error: Error }))

      expect(stream).type.toBe<HttpApiSchema.StreamSse<typeof Events, typeof Error>>()
    })

    it("requires event and error schemas", () => {
      expect(HttpApiSchema.StreamSse).type.not.toBeCallableWith({
        events: {},
        error: Schema.String
      })
      expect(HttpApiSchema.StreamSse).type.not.toBeCallableWith({
        events: Schema.String,
        error: {}
      })
    })
  })

  describe("StreamUint8Array", () => {
    it("constructs the stream declaration", () => {
      const stream = HttpApiSchema.StreamUint8Array()

      expect(stream).type.toBe<HttpApiSchema.StreamUint8Array>()
      expect(stream.mode).type.toBe<"uint8array">()
      expect(stream.contentType).type.toBe<string>()
    })

    it("preserves the declaration type when annotated with status", () => {
      const stream = HttpApiSchema.status("PartialContent")(HttpApiSchema.StreamUint8Array())

      expect(stream).type.toBe<HttpApiSchema.StreamUint8Array>()
    })
  })
})
