import { xxh3_64bits, xxh3_64bitsWithSeed } from "effect/internal/xxHash3"
import { describe, expect, it } from "vitest"

const u64 = (n: bigint): bigint => BigInt.asUintN(64, n)

const PRIME32 = 2654435761n
const PRIME64 = 11400714785074694797n

const SANITY_BUFFER_SIZE = 4096 + 64 + 1

const createSanityBuffer = (): Uint8Array => {
  const buffer = new Uint8Array(SANITY_BUFFER_SIZE)
  let byteGen = PRIME32
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = Number((byteGen >> 56n) & 0xffn)
    byteGen = u64(byteGen * PRIME64)
  }
  return buffer
}

// Extracted from xxHash v0.8.2 tests/sanity_test_vectors.h (XSUM_XXH3_testdata)
const vectors: ReadonlyArray<{ len: number; seed: bigint; expected: bigint }> = [
  { len: 0, seed: 0x0000000000000000n, expected: 0x2d06800538d394c2n },
  { len: 0, seed: 0x9e3779b185ebca8dn, expected: 0xa8a6b918b2f0364an },
  { len: 1, seed: 0x0000000000000000n, expected: 0xc44bdff4074eecdbn },
  { len: 1, seed: 0x9e3779b185ebca8dn, expected: 0x032be332dd766ef8n },
  { len: 2, seed: 0x0000000000000000n, expected: 0x7a9978044cb8a8bbn },
  { len: 2, seed: 0x9e3779b185ebca8dn, expected: 0x764b35c90519ad88n },
  { len: 3, seed: 0x0000000000000000n, expected: 0x54247382a8d6b94dn },
  { len: 3, seed: 0x9e3779b185ebca8dn, expected: 0x634b8990b4976373n },
  { len: 4, seed: 0x0000000000000000n, expected: 0xe5dc74bc51848a51n },
  { len: 4, seed: 0x9e3779b185ebca8dn, expected: 0xaa2e7eccb0c8f747n },
  { len: 8, seed: 0x0000000000000000n, expected: 0x24ccc9acaa9f65e4n },
  { len: 8, seed: 0x9e3779b185ebca8dn, expected: 0x8f973410999b8f6bn },
  { len: 16, seed: 0x0000000000000000n, expected: 0x981b17d36c7498c9n },
  { len: 16, seed: 0x9e3779b185ebca8dn, expected: 0x663f29333b4db6b1n },
  { len: 17, seed: 0x0000000000000000n, expected: 0x796f5acd3a60f862n },
  { len: 17, seed: 0x9e3779b185ebca8dn, expected: 0xf3ec5067f4306db3n },
  { len: 32, seed: 0x0000000000000000n, expected: 0x9feaddbdbf57eed3n },
  { len: 32, seed: 0x9e3779b185ebca8dn, expected: 0x2199fab1534893d9n },
  { len: 33, seed: 0x0000000000000000n, expected: 0xabfb2d081b400a10n },
  { len: 33, seed: 0x9e3779b185ebca8dn, expected: 0xad56348da574bb6dn },
  { len: 64, seed: 0x0000000000000000n, expected: 0x9cb48487720ec49dn },
  { len: 64, seed: 0x9e3779b185ebca8dn, expected: 0x4fe8895db9b8c077n },
  { len: 65, seed: 0x0000000000000000n, expected: 0xfd81aac4bebc3883n },
  { len: 65, seed: 0x9e3779b185ebca8dn, expected: 0xad80aeec1fc9e0a7n },
  { len: 128, seed: 0x0000000000000000n, expected: 0xfcff24126754d861n },
  { len: 128, seed: 0x9e3779b185ebca8dn, expected: 0x73fde75280646649n },
  { len: 129, seed: 0x0000000000000000n, expected: 0x98f1b0a679a2ca29n },
  { len: 129, seed: 0x9e3779b185ebca8dn, expected: 0x21fffdbca099c844n },
  { len: 240, seed: 0x0000000000000000n, expected: 0x81c3c2b67f568ccfn },
  { len: 240, seed: 0x9e3779b185ebca8dn, expected: 0xcc0f58c27ef3d8een },
  { len: 241, seed: 0x0000000000000000n, expected: 0xc5a639ecd2030e5en },
  { len: 241, seed: 0x9e3779b185ebca8dn, expected: 0xdda9b0a161d4829an },
  { len: 256, seed: 0x0000000000000000n, expected: 0x55de574ad89d0ac5n },
  { len: 256, seed: 0x9e3779b185ebca8dn, expected: 0x4d30234b7a3aa61cn },
  { len: 257, seed: 0x0000000000000000n, expected: 0xb17fd5a8ae75bb0bn },
  { len: 257, seed: 0x9e3779b185ebca8dn, expected: 0x802a6fbf3cacd97cn },
  { len: 1024, seed: 0x0000000000000000n, expected: 0xdd85c9b5c1109c5cn },
  { len: 1024, seed: 0x9e3779b185ebca8dn, expected: 0xef368a8a2ebabaefn },
  { len: 4096, seed: 0x0000000000000000n, expected: 0xe91206429d1f48f9n },
  { len: 4096, seed: 0x9e3779b185ebca8dn, expected: 0x2a3bbb20a5439dcdn },
  { len: 4160, seed: 0x0000000000000000n, expected: 0x4f323b15321e94e1n },
  { len: 4160, seed: 0x9e3779b185ebca8dn, expected: 0x1bf6f5faf9eecabdn }
]

describe("xxHash3", () => {
  it("matches XXH3_64bits_withSeed sanity vectors", () => {
    const sanityBuffer = createSanityBuffer()
    for (const v of vectors) {
      const got = xxh3_64bitsWithSeed(sanityBuffer.subarray(0, v.len), v.seed)
      expect(got).toBe(u64(v.expected))
    }
  })

  it("xxh3_64bits equals seed 0", () => {
    const sanityBuffer = createSanityBuffer()
    const lengths = [0, 1, 16, 17, 128, 129, 240, 241, 256, 1024, 4096, 4160]
    for (const len of lengths) {
      expect(xxh3_64bits(sanityBuffer.subarray(0, len))).toBe(
        xxh3_64bitsWithSeed(sanityBuffer.subarray(0, len), 0n)
      )
    }
  })
})
