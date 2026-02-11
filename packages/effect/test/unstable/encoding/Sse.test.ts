import { assert, describe, it } from "@effect/vitest"
import * as Schema from "effect/Schema"
import * as Sse from "effect/unstable/encoding/Sse"

describe("Sse", () => {
  it("Event preserves string payloads", () => {
    const decode = Schema.decodeUnknownSync(Sse.Event)
    const encode = Schema.encodeSync(Sse.Event)

    const event = decode({
      _tag: "Event",
      event: "message",
      id: undefined,
      data: "{\"type\":\"ok\"}"
    })

    assert.strictEqual(event.data, "{\"type\":\"ok\"}")
    assert.deepStrictEqual(encode(event), {
      _tag: "Event",
      event: "message",
      id: undefined,
      data: "{\"type\":\"ok\"}"
    })
  })

  it("EventEncoded consumers can explicitly decode json payloads", () => {
    const EventWithJsonPayload = Schema.Struct({
      ...Sse.EventEncoded.fields,
      data: Schema.fromJsonString(Schema.Struct({
        type: Schema.String
      }))
    })
    const decode = Schema.decodeUnknownSync(EventWithJsonPayload)

    const event = decode({
      event: "message",
      id: undefined,
      data: "{\"type\":\"ok\"}"
    })

    assert.deepStrictEqual(event.data, { type: "ok" })
  })
})
