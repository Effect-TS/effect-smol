import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
import { assert, describe, it } from "@effect/vitest"
import * as Crypto from "effect/Crypto"
import * as Effect from "effect/Effect"

const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

describe("NodeCrypto", () => {
  it.effect("generates empty random bytes", () =>
    Effect.gen(function*() {
      const bytes = yield* Crypto.randomBytes(0)
      assert.deepStrictEqual(bytes, new Uint8Array(0))
    }).pipe(Effect.provide(NodeCrypto.layer)))

  it.effect("generates random bytes with the requested size", () =>
    Effect.gen(function*() {
      const bytes = yield* Crypto.randomBytes(32)
      assert.strictEqual(bytes.length, 32)
    }).pipe(Effect.provide(NodeCrypto.layer)))

  it.effect("fails invalid random byte sizes", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(Crypto.randomBytes(-1))
      assert.strictEqual(error._tag, "PlatformError")
    }).pipe(Effect.provide(NodeCrypto.layer)))

  it.effect("generates UUIDv4 values", () =>
    Effect.gen(function*() {
      const uuid1 = yield* Crypto.randomUUIDv4
      const uuid2 = yield* Crypto.randomUUIDv4
      assert.match(uuid1, uuidV4Regex)
      assert.match(uuid2, uuidV4Regex)
      assert.notStrictEqual(uuid1, uuid2)
    }).pipe(Effect.provide(NodeCrypto.layer)))

  it.effect("computes SHA-256 digests", () =>
    Effect.gen(function*() {
      const digest = yield* Crypto.digest(Crypto.DigestAlgorithm.Sha256(), new TextEncoder().encode("hello"))
      assert.strictEqual(hex(digest), "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
    }).pipe(Effect.provide(NodeCrypto.layer)))
})
