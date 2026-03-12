import { assert, describe, it } from "@effect/vitest"
import { RpcSerialization } from "effect/unstable/rpc"

const responseExitSuccess = (requestId: string, value: unknown) => ({
  _tag: "Exit",
  requestId,
  exit: {
    _tag: "Success",
    value
  }
})

describe("RpcSerialization", () => {
  it("json decode returns flat array when server sends array of messages", () => {
    const parser = RpcSerialization.json.makeUnsafe()

    const msg1 = responseExitSuccess("0", { name: "Alice" })
    const msg2 = responseExitSuccess("1", { name: "Bob" })
    const serverResponse = JSON.stringify([msg1, msg2])

    const decoded = parser.decode(serverResponse)

    // decoded should be [msg1, msg2], NOT [[msg1, msg2]]
    assert.strictEqual(decoded.length, 2)
    assert.deepStrictEqual(decoded[0], msg1)
    assert.deepStrictEqual(decoded[1], msg2)
  })

  it("json decode wraps single non-array value in array", () => {
    const parser = RpcSerialization.json.makeUnsafe()

    const msg = responseExitSuccess("0", { name: "Alice" })
    const serverResponse = JSON.stringify(msg)

    const decoded = parser.decode(serverResponse)

    assert.strictEqual(decoded.length, 1)
    assert.deepStrictEqual(decoded[0], msg)
  })

  it("json encode/decode roundtrip preserves messages", () => {
    const parser = RpcSerialization.json.makeUnsafe()

    const messages = [
      responseExitSuccess("0", { name: "Alice" }),
      responseExitSuccess("1", { name: "Bob" })
    ]

    const encoded = parser.encode(messages)
    const decoded = parser.decode(encoded as string)

    assert.deepStrictEqual(decoded, messages)
  })

  it("jsonRpc encodes a non-batched single response array as an object", () => {
    const parser = RpcSerialization.jsonRpc().makeUnsafe()
    const decoded = parser.decode("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"users.get\"}")
    assert.strictEqual(decoded.length, 1)

    const encoded = parser.encode([responseExitSuccess("1", { id: 1 })])
    assert(encoded !== undefined)

    const message = JSON.parse(encoded as string)
    assert.strictEqual(Array.isArray(message), false)
    assert.deepStrictEqual(message, {
      jsonrpc: "2.0",
      id: 1,
      result: {
        id: 1
      }
    })
  })

  it("jsonRpc encodes batched responses as an array", () => {
    const parser = RpcSerialization.jsonRpc().makeUnsafe()
    const decoded = parser.decode(
      "[{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"users.get\"},{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"users.list\"}]"
    )
    assert.strictEqual(decoded.length, 2)

    const encoded = parser.encode([
      responseExitSuccess("1", "one"),
      responseExitSuccess("2", "two")
    ])
    assert(encoded !== undefined)

    const message = JSON.parse(encoded as string)
    assert.strictEqual(Array.isArray(message), true)
    assert.deepStrictEqual(message, [
      {
        jsonrpc: "2.0",
        id: 1,
        result: "one"
      },
      {
        jsonrpc: "2.0",
        id: 2,
        result: "two"
      }
    ])
  })
})
