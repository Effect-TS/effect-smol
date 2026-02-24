import { Schema } from "effect"
import * as Rpc from "effect/unstable/rpc/Rpc"
import { describe, expect, it } from "tstyche"

const GetUser = Rpc.make("GetUser", { success: Schema.String })
const StreamEvents = Rpc.make("StreamEvents", { success: Schema.String, stream: true })

type Mixed = typeof GetUser | typeof StreamEvents

describe("Rpc", () => {
  describe("IsStream", () => {
    it("returns true for stream RPCs in a mixed group", () => {
      expect<Rpc.IsStream<Mixed, "StreamEvents">>().type.toBe<true>()
    })

    it("returns never for non-stream RPCs in a mixed group", () => {
      expect<Rpc.IsStream<Mixed, "GetUser">>().type.toBe<never>()
    })
  })
})
