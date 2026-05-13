import * as BrowserCrypto from "@effect/platform-browser/BrowserCrypto"
import { assert, describe, it } from "@effect/vitest"
import * as Crypto from "effect/Crypto"
import * as Effect from "effect/Effect"

const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
  if (array instanceof Uint8Array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = i & 0xff
    }
  }
  return array
}

describe("BrowserCrypto", () => {
  it.effect("generates random bytes and chunks large requests", () =>
    Effect.gen(function*() {
      let calls = 0
      const service = BrowserCrypto.make({
        getRandomValues: (array) => {
          calls++
          return getRandomValues(array)
        }
      })

      const bytes = yield* service.randomBytes(65_537)
      assert.strictEqual(bytes.length, 65_537)
      assert.strictEqual(calls, 2)
    }))

  it.effect("uses native randomUUID when available", () =>
    Effect.gen(function*() {
      const service = BrowserCrypto.make({
        randomUUID: () => "00000000-0000-4000-8000-000000000000"
      })

      const uuid = yield* service.randomUUIDv4
      assert.strictEqual(uuid, "00000000-0000-4000-8000-000000000000")
    }))

  it.effect("falls back to getRandomValues for UUIDv4", () =>
    Effect.gen(function*() {
      const service = BrowserCrypto.make({ getRandomValues })

      const uuid = yield* service.randomUUIDv4
      assert.strictEqual(uuid, "00010203-0405-4607-8809-0a0b0c0d0e0f")
      assert.match(uuid, uuidV4Regex)
    }))

  it.effect("fails when random byte generation is unavailable", () =>
    Effect.gen(function*() {
      const service = BrowserCrypto.make({})
      const error = yield* Effect.flip(service.randomBytes(1))
      assert.strictEqual(error._tag, "PlatformError")
    }))

  it.effect("computes digests with subtle crypto", () =>
    Effect.gen(function*() {
      const buffer = new ArrayBuffer(3)
      new Uint8Array(buffer).set([1, 2, 3])
      const service = BrowserCrypto.make({
        subtle: {
          digest: () => Promise.resolve(buffer)
        }
      })

      const digest = yield* service.digest(Crypto.DigestAlgorithm.Sha256(), Uint8Array.of(1))
      assert.deepStrictEqual(digest, Uint8Array.of(1, 2, 3))
    }))
})
