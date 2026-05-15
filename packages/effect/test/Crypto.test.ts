import { assert, describe, it } from "@effect/vitest"
import * as Crypto from "effect/Crypto"
import * as Effect from "effect/Effect"

const testCrypto = Crypto.make({
  randomBytes: (size) => Effect.succeed(Uint8Array.from({ length: size }, (_, i) => i)),
  nextIntUnsafe: () => 123,
  nextDoubleUnsafe: () => 0.75,
  digest: (algorithm, data) => Effect.succeed(Uint8Array.of(data.length, algorithm._tag.length))
})

describe("Crypto", () => {
  describe("DigestAlgorithm", () => {
    it("constructs tagged enum values", () => {
      assert.strictEqual(Crypto.DigestAlgorithm.Sha1()._tag, "Sha1")
      assert.strictEqual(Crypto.DigestAlgorithm.Sha256()._tag, "Sha256")
      assert.strictEqual(Crypto.DigestAlgorithm.Sha384()._tag, "Sha384")
      assert.strictEqual(Crypto.DigestAlgorithm.Sha512()._tag, "Sha512")
    })
  })

  it.effect("randomBytes delegates to the service", () =>
    Effect.gen(function*() {
      const bytes = yield* Crypto.randomBytes(4)
      assert.deepStrictEqual(bytes, Uint8Array.of(0, 1, 2, 3))
    }).pipe(Effect.provideService(Crypto.Crypto, testCrypto)))

  it.effect("random generators delegate to the service", () =>
    Effect.gen(function*() {
      const random = yield* Crypto.random
      const randomInt = yield* Crypto.randomInt
      const randomBoolean = yield* Crypto.randomBoolean
      const randomBetween = yield* Crypto.randomBetween(10, 20)
      const randomIntBetween = yield* Crypto.randomIntBetween(1, 6)
      const randomShuffle = yield* Crypto.randomShuffle([1, 2, 3])

      assert.strictEqual(random, 0.75)
      assert.strictEqual(randomInt, 123)
      assert.strictEqual(randomBoolean, true)
      assert.strictEqual(randomBetween, 17.5)
      assert.strictEqual(randomIntBetween, 5)
      assert.deepStrictEqual(randomShuffle, [1, 2, 3])
    }).pipe(Effect.provideService(Crypto.Crypto, testCrypto)))

  it.effect("randomUUIDv4 formats UUID bytes from randomBytes", () =>
    Effect.gen(function*() {
      const uuid = yield* Crypto.randomUUIDv4
      assert.strictEqual(uuid, "00010203-0405-4607-8809-0a0b0c0d0e0f")
    }).pipe(Effect.provideService(Crypto.Crypto, testCrypto)))

  it.effect("digest delegates to the service", () =>
    Effect.gen(function*() {
      const digest = yield* Crypto.digest(Crypto.DigestAlgorithm.Sha256(), Uint8Array.of(1, 2, 3))
      assert.deepStrictEqual(digest, Uint8Array.of(3, "Sha256".length))
    }).pipe(Effect.provideService(Crypto.Crypto, testCrypto)))

  it.effect("can access a provided custom Crypto service", () =>
    Effect.gen(function*() {
      const crypto = yield* Crypto.Crypto
      const bytes = yield* crypto.randomBytes(1)
      assert.deepStrictEqual(bytes, Uint8Array.of(0))
    }).pipe(Effect.provideService(Crypto.Crypto, testCrypto)))
})
