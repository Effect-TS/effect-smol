import { assert, describe, it } from "@effect/vitest"
import * as Crypto from "effect/Crypto"
import * as Effect from "effect/Effect"

const testCrypto = Crypto.make({
  randomBytes: (size) => Effect.succeed(Uint8Array.of(size)),
  randomUUIDv4: Effect.succeed("00000000-0000-4000-8000-000000000000"),
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
      assert.deepStrictEqual(bytes, Uint8Array.of(4))
    }).pipe(Effect.provideService(Crypto.Crypto, testCrypto)))

  it.effect("randomUUIDv4 delegates to the service", () =>
    Effect.gen(function*() {
      const uuid = yield* Crypto.randomUUIDv4
      assert.strictEqual(uuid, "00000000-0000-4000-8000-000000000000")
    }).pipe(Effect.provideService(Crypto.Crypto, testCrypto)))

  it.effect("digest delegates to the service", () =>
    Effect.gen(function*() {
      const digest = yield* Crypto.digest(Crypto.DigestAlgorithm.Sha256(), Uint8Array.of(1, 2, 3))
      assert.deepStrictEqual(digest, Uint8Array.of(3, "Sha256".length))
    }).pipe(Effect.provideService(Crypto.Crypto, testCrypto)))

  it.effect("can access a provided custom Crypto service", () =>
    Effect.gen(function*() {
      const crypto = yield* Crypto.Crypto
      const uuid = yield* crypto.randomUUIDv4
      assert.strictEqual(uuid, "00000000-0000-4000-8000-000000000000")
    }).pipe(Effect.provideService(Crypto.Crypto, testCrypto)))
})
