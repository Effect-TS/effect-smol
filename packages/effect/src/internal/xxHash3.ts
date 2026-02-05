/**
 * Port of xxHash's XXH3 64-bit (BSD 2-Clause).
 *
 * Based on the reference implementation:
 * https://github.com/Cyan4973/xxHash (xxhash.h v0.8.2)
 *
 * @internal
 */

const U64_MASK = (1n << 64n) - 1n

const u64 = (n: bigint): bigint => BigInt.asUintN(64, n)

const XXH_PRIME32_1 = 0x9e3779b1
const XXH_PRIME32_2 = 0x85ebca77
const XXH_PRIME32_3 = 0xc2b2ae3d

const XXH_PRIME64_1 = 0x9e3779b185ebca87n
const XXH_PRIME64_2 = 0xc2b2ae3d27d4eb4fn
const XXH_PRIME64_3 = 0x165667b19e3779f9n
const XXH_PRIME64_4 = 0x85ebca77c2b2ae63n
const XXH_PRIME64_5 = 0x27d4eb2f165667c5n

const PRIME_MX1 = 0x165667919e3779f9n
const PRIME_MX2 = 0x9fb21c651e98df25n

const XXH_SECRET_DEFAULT_SIZE = 192
const XXH3_SECRET_SIZE_MIN = 136

const XXH3_MIDSIZE_MAX = 240
const XXH_STRIPE_LEN = 64
const XXH_SECRET_CONSUME_RATE = 8
const XXH_ACC_NB = 8

const XXH_SECRET_LASTACC_START = 7
const XXH_SECRET_MERGEACCS_START = 11

// Pseudorandom secret taken directly from FARSH.
const XXH3_kSecret = new Uint8Array([
  0xb8,
  0xfe,
  0x6c,
  0x39,
  0x23,
  0xa4,
  0x4b,
  0xbe,
  0x7c,
  0x01,
  0x81,
  0x2c,
  0xf7,
  0x21,
  0xad,
  0x1c,
  0xde,
  0xd4,
  0x6d,
  0xe9,
  0x83,
  0x90,
  0x97,
  0xdb,
  0x72,
  0x40,
  0xa4,
  0xa4,
  0xb7,
  0xb3,
  0x67,
  0x1f,
  0xcb,
  0x79,
  0xe6,
  0x4e,
  0xcc,
  0xc0,
  0xe5,
  0x78,
  0x82,
  0x5a,
  0xd0,
  0x7d,
  0xcc,
  0xff,
  0x72,
  0x21,
  0xb8,
  0x08,
  0x46,
  0x74,
  0xf7,
  0x43,
  0x24,
  0x8e,
  0xe0,
  0x35,
  0x90,
  0xe6,
  0x81,
  0x3a,
  0x26,
  0x4c,
  0x3c,
  0x28,
  0x52,
  0xbb,
  0x91,
  0xc3,
  0x00,
  0xcb,
  0x88,
  0xd0,
  0x65,
  0x8b,
  0x1b,
  0x53,
  0x2e,
  0xa3,
  0x71,
  0x64,
  0x48,
  0x97,
  0xa2,
  0x0d,
  0xf9,
  0x4e,
  0x38,
  0x19,
  0xef,
  0x46,
  0xa9,
  0xde,
  0xac,
  0xd8,
  0xa8,
  0xfa,
  0x76,
  0x3f,
  0xe3,
  0x9c,
  0x34,
  0x3f,
  0xf9,
  0xdc,
  0xbb,
  0xc7,
  0xc7,
  0x0b,
  0x4f,
  0x1d,
  0x8a,
  0x51,
  0xe0,
  0x4b,
  0xcd,
  0xb4,
  0x59,
  0x31,
  0xc8,
  0x9f,
  0x7e,
  0xc9,
  0xd9,
  0x78,
  0x73,
  0x64,
  0xea,
  0xc5,
  0xac,
  0x83,
  0x34,
  0xd3,
  0xeb,
  0xc3,
  0xc5,
  0x81,
  0xa0,
  0xff,
  0xfa,
  0x13,
  0x63,
  0xeb,
  0x17,
  0x0d,
  0xdd,
  0x51,
  0xb7,
  0xf0,
  0xda,
  0x49,
  0xd3,
  0x16,
  0x55,
  0x26,
  0x29,
  0xd4,
  0x68,
  0x9e,
  0x2b,
  0x16,
  0xbe,
  0x58,
  0x7d,
  0x47,
  0xa1,
  0xfc,
  0x8f,
  0xf8,
  0xb8,
  0xd1,
  0x7a,
  0xd0,
  0x31,
  0xce,
  0x45,
  0xcb,
  0x3a,
  0x8f,
  0x95,
  0x16,
  0x04,
  0x28,
  0xaf,
  0xd7,
  0xfb,
  0xca,
  0xbb,
  0x4b,
  0x40,
  0x7e
])

const textEncoder = new TextEncoder()

const readU32LE = (input: Uint8Array, offset: number): number => (
  (input[offset] |
    (input[offset + 1] << 8) |
    (input[offset + 2] << 16) |
    (input[offset + 3] << 24)) >>> 0
)

const readU64LE = (input: Uint8Array, offset: number): bigint => {
  const lo = readU32LE(input, offset)
  const hi = readU32LE(input, offset + 4)
  return (BigInt(hi) << 32n) | BigInt(lo)
}

const writeU64LE = (out: Uint8Array, offset: number, value: bigint): void => {
  let v = u64(value)
  for (let i = 0; i < 8; i++) {
    out[offset + i] = Number(v & 0xffn)
    v >>= 8n
  }
}

const rotl64 = (x: bigint, r: number): bigint => u64((x << BigInt(r)) | (x >> BigInt(64 - r)))

const swap32 = (x: number): number => (
  (((x >>> 24) & 0xff) |
    ((x >>> 8) & 0xff00) |
    ((x & 0xff00) << 8) |
    ((x & 0xff) << 24)) >>> 0
)

const swap64 = (x: bigint): bigint => {
  const v = u64(x)
  return u64(
    ((v & 0xffn) << 56n) |
      (((v >> 8n) & 0xffn) << 48n) |
      (((v >> 16n) & 0xffn) << 40n) |
      (((v >> 24n) & 0xffn) << 32n) |
      (((v >> 32n) & 0xffn) << 24n) |
      (((v >> 40n) & 0xffn) << 16n) |
      (((v >> 48n) & 0xffn) << 8n) |
      ((v >> 56n) & 0xffn)
  )
}

const xorshift64 = (v: bigint, shift: number): bigint => u64(v ^ (v >> BigInt(shift)))

const xxh64Avalanche = (hash: bigint): bigint => {
  let h = u64(hash)
  h = u64(h ^ (h >> 33n))
  h = u64(h * XXH_PRIME64_2)
  h = u64(h ^ (h >> 29n))
  h = u64(h * XXH_PRIME64_3)
  h = u64(h ^ (h >> 32n))
  return h
}

const mul128Fold64 = (lhs: bigint, rhs: bigint): bigint => {
  const product = u64(lhs) * u64(rhs)
  const low = product & U64_MASK
  const high = product >> 64n
  return u64(low ^ high)
}

const xxh3Avalanche = (h64: bigint): bigint => {
  let h = xorshift64(h64, 37)
  h = u64(h * PRIME_MX1)
  h = xorshift64(h, 32)
  return h
}

const xxh3Rrmxmx = (h64: bigint, len: number): bigint => {
  let h = u64(h64)
  h = u64(h ^ rotl64(h, 49) ^ rotl64(h, 24))
  h = u64(h * PRIME_MX2)
  h = u64(h ^ u64((h >> 35n) + BigInt(len)))
  h = u64(h * PRIME_MX2)
  return xorshift64(h, 28)
}

const xxh3Len1to3_64b = (
  input: Uint8Array,
  offset: number,
  len: number,
  secret: Uint8Array,
  secretOffset: number,
  seed: bigint
): bigint => {
  const c1 = input[offset]
  const c2 = input[offset + (len >> 1)]
  const c3 = input[offset + len - 1]
  const combined = ((c1 << 16) | (c2 << 24) | (c3 << 0) | (len << 8)) >>> 0
  const bitflip = u64(BigInt((readU32LE(secret, secretOffset) ^ readU32LE(secret, secretOffset + 4)) >>> 0) + seed)
  const keyed = u64(BigInt(combined)) ^ bitflip
  return xxh64Avalanche(keyed)
}

const xxh3Len4to8_64b = (
  input: Uint8Array,
  offset: number,
  len: number,
  secret: Uint8Array,
  secretOffset: number,
  seed: bigint
): bigint => {
  const seed32 = Number(seed & 0xffffffffn) >>> 0
  const seedPrime = u64(seed ^ (BigInt(swap32(seed32)) << 32n))
  const input1 = readU32LE(input, offset)
  const input2 = readU32LE(input, offset + len - 4)
  const bitflip = u64((readU64LE(secret, secretOffset + 8) ^ readU64LE(secret, secretOffset + 16)) - seedPrime)
  const input64 = u64(BigInt(input2) + (BigInt(input1) << 32n))
  const keyed = input64 ^ bitflip
  return xxh3Rrmxmx(keyed, len)
}

const xxh3Len9to16_64b = (
  input: Uint8Array,
  offset: number,
  len: number,
  secret: Uint8Array,
  secretOffset: number,
  seed: bigint
): bigint => {
  const bitflip1 = u64((readU64LE(secret, secretOffset + 24) ^ readU64LE(secret, secretOffset + 32)) + seed)
  const bitflip2 = u64((readU64LE(secret, secretOffset + 40) ^ readU64LE(secret, secretOffset + 48)) - seed)
  const inputLo = u64(readU64LE(input, offset) ^ bitflip1)
  const inputHi = u64(readU64LE(input, offset + len - 8) ^ bitflip2)
  const acc = u64(BigInt(len) + swap64(inputLo) + inputHi + mul128Fold64(inputLo, inputHi))
  return xxh3Avalanche(acc)
}

const xxh3Len0to16_64b = (
  input: Uint8Array,
  offset: number,
  len: number,
  secret: Uint8Array,
  secretOffset: number,
  seed: bigint
): bigint => {
  if (len > 8) return xxh3Len9to16_64b(input, offset, len, secret, secretOffset, seed)
  if (len >= 4) return xxh3Len4to8_64b(input, offset, len, secret, secretOffset, seed)
  if (len !== 0) return xxh3Len1to3_64b(input, offset, len, secret, secretOffset, seed)
  return xxh64Avalanche(u64(seed ^ (readU64LE(secret, secretOffset + 56) ^ readU64LE(secret, secretOffset + 64))))
}

const xxh3Mix16B = (
  input: Uint8Array,
  inputOffset: number,
  secret: Uint8Array,
  secretOffset: number,
  seed: bigint
): bigint => {
  const inputLo = readU64LE(input, inputOffset)
  const inputHi = readU64LE(input, inputOffset + 8)
  const secretLo = u64(readU64LE(secret, secretOffset) + seed)
  const secretHi = u64(readU64LE(secret, secretOffset + 8) - seed)
  return mul128Fold64(
    u64(inputLo ^ secretLo),
    u64(inputHi ^ secretHi)
  )
}

const xxh3Len17to128_64b = (
  input: Uint8Array,
  len: number,
  secret: Uint8Array,
  secretLen: number,
  seed: bigint
): bigint => {
  // secretLen is a precondition in the reference implementation.
  void secretLen
  let acc = u64(BigInt(len) * XXH_PRIME64_1)
  if (len > 32) {
    if (len > 64) {
      if (len > 96) {
        acc = u64(acc + xxh3Mix16B(input, 48, secret, 96, seed))
        acc = u64(acc + xxh3Mix16B(input, len - 64, secret, 112, seed))
      }
      acc = u64(acc + xxh3Mix16B(input, 32, secret, 64, seed))
      acc = u64(acc + xxh3Mix16B(input, len - 48, secret, 80, seed))
    }
    acc = u64(acc + xxh3Mix16B(input, 16, secret, 32, seed))
    acc = u64(acc + xxh3Mix16B(input, len - 32, secret, 48, seed))
  }
  acc = u64(acc + xxh3Mix16B(input, 0, secret, 0, seed))
  acc = u64(acc + xxh3Mix16B(input, len - 16, secret, 16, seed))
  return xxh3Avalanche(acc)
}

const xxh3Len129to240_64b = (
  input: Uint8Array,
  len: number,
  secret: Uint8Array,
  secretLen: number,
  seed: bigint
): bigint => {
  void secretLen
  const nbRounds = (len / 16) >>> 0
  let acc = u64(BigInt(len) * XXH_PRIME64_1)
  for (let i = 0; i < 8; i++) {
    acc = u64(acc + xxh3Mix16B(input, 16 * i, secret, 16 * i, seed))
  }
  let accEnd = xxh3Mix16B(input, len - 16, secret, XXH3_SECRET_SIZE_MIN - 17, seed)
  acc = xxh3Avalanche(acc)
  for (let i = 8; i < nbRounds; i++) {
    accEnd = u64(accEnd + xxh3Mix16B(input, 16 * i, secret, 16 * (i - 8) + 3, seed))
  }
  return xxh3Avalanche(u64(acc + accEnd))
}

const xxh3Accumulate512Scalar = (
  acc: Array<bigint>,
  input: Uint8Array,
  inputOffset: number,
  secret: Uint8Array,
  secretOffset: number
): void => {
  for (let lane = 0; lane < XXH_ACC_NB; lane++) {
    const dataVal = readU64LE(input, inputOffset + lane * 8)
    const dataKey = dataVal ^ readU64LE(secret, secretOffset + lane * 8)
    acc[lane ^ 1] = u64(acc[lane ^ 1] + dataVal)
    const low32 = dataKey & 0xffffffffn
    const high32 = (dataKey >> 32n) & 0xffffffffn
    acc[lane] = u64(acc[lane] + low32 * high32)
  }
}

const xxh3Accumulate = (
  acc: Array<bigint>,
  input: Uint8Array,
  inputOffset: number,
  secret: Uint8Array,
  secretOffset: number,
  nbStripes: number
): void => {
  for (let n = 0; n < nbStripes; n++) {
    xxh3Accumulate512Scalar(
      acc,
      input,
      inputOffset + n * XXH_STRIPE_LEN,
      secret,
      secretOffset + n * XXH_SECRET_CONSUME_RATE
    )
  }
}

const xxh3ScrambleAcc = (acc: Array<bigint>, secret: Uint8Array, secretOffset: number): void => {
  for (let lane = 0; lane < XXH_ACC_NB; lane++) {
    const key64 = readU64LE(secret, secretOffset + lane * 8)
    let acc64 = acc[lane]
    acc64 = xorshift64(acc64, 47)
    acc64 = u64(acc64 ^ key64)
    acc64 = u64(acc64 * BigInt(XXH_PRIME32_1))
    acc[lane] = acc64
  }
}

const xxh3HashLongInternalLoop = (
  acc: Array<bigint>,
  input: Uint8Array,
  len: number,
  secret: Uint8Array,
  secretLen: number
): void => {
  const nbStripesPerBlock = ((secretLen - XXH_STRIPE_LEN) / XXH_SECRET_CONSUME_RATE) >>> 0
  const blockLen = XXH_STRIPE_LEN * nbStripesPerBlock
  const nbBlocks = ((len - 1) / blockLen) >>> 0

  for (let n = 0; n < nbBlocks; n++) {
    xxh3Accumulate(acc, input, n * blockLen, secret, 0, nbStripesPerBlock)
    xxh3ScrambleAcc(acc, secret, secretLen - XXH_STRIPE_LEN)
  }

  // last partial block
  const nbStripes = (((len - 1) - (blockLen * nbBlocks)) / XXH_STRIPE_LEN) >>> 0
  xxh3Accumulate(acc, input, nbBlocks * blockLen, secret, 0, nbStripes)
  xxh3Accumulate512Scalar(
    acc,
    input,
    len - XXH_STRIPE_LEN,
    secret,
    secretLen - XXH_STRIPE_LEN - XXH_SECRET_LASTACC_START
  )
}

const xxh3MergeAccs = (acc: Array<bigint>, secret: Uint8Array, secretOffset: number, start: bigint): bigint => {
  let result = u64(start)
  for (let i = 0; i < 4; i++) {
    const base = i * 2
    const sec = secretOffset + 16 * i
    result = u64(result + mul128Fold64(acc[base] ^ readU64LE(secret, sec), acc[base + 1] ^ readU64LE(secret, sec + 8)))
  }
  return xxh3Avalanche(result)
}

const XXH3_INIT_ACC: ReadonlyArray<bigint> = [
  BigInt(XXH_PRIME32_3),
  XXH_PRIME64_1,
  XXH_PRIME64_2,
  XXH_PRIME64_3,
  XXH_PRIME64_4,
  BigInt(XXH_PRIME32_2),
  XXH_PRIME64_5,
  BigInt(XXH_PRIME32_1)
]

const xxh3HashLong64Internal = (input: Uint8Array, len: number, secret: Uint8Array, secretLen: number): bigint => {
  const acc = Array.from(XXH3_INIT_ACC)
  xxh3HashLongInternalLoop(acc, input, len, secret, secretLen)
  return xxh3MergeAccs(acc, secret, XXH_SECRET_MERGEACCS_START, BigInt(len) * XXH_PRIME64_1)
}

const initCustomSecret = (seed: bigint): Uint8Array => {
  const out = new Uint8Array(XXH_SECRET_DEFAULT_SIZE)
  const seed64 = u64(seed)
  for (let i = 0; i < XXH_SECRET_DEFAULT_SIZE / 16; i++) {
    const lo = readU64LE(XXH3_kSecret, 16 * i) + seed64
    const hi = readU64LE(XXH3_kSecret, 16 * i + 8) - seed64
    writeU64LE(out, 16 * i, lo)
    writeU64LE(out, 16 * i + 8, hi)
  }
  return out
}

const xxh3HashLong64WithSeed = (input: Uint8Array, len: number, seed: bigint): bigint => {
  const seed64 = u64(seed)
  if (seed64 === 0n) {
    return xxh3HashLong64Internal(input, len, XXH3_kSecret, XXH3_kSecret.length)
  }
  const secret = initCustomSecret(seed64)
  return xxh3HashLong64Internal(input, len, secret, secret.length)
}

const xxh3_64bitsInternal = (input: Uint8Array, seed: bigint): bigint => {
  const len = input.length
  const seed64 = u64(seed)
  const secret = XXH3_kSecret
  const secretLen = secret.length
  if (secretLen < XXH3_SECRET_SIZE_MIN) {
    throw new Error("BUG: XXH3 secret too small")
  }
  if (len <= 16) {
    return xxh3Len0to16_64b(input, 0, len, secret, 0, seed64)
  }
  if (len <= 128) {
    return xxh3Len17to128_64b(input, len, secret, secretLen, seed64)
  }
  if (len <= XXH3_MIDSIZE_MAX) {
    return xxh3Len129to240_64b(input, len, secret, secretLen, seed64)
  }
  return xxh3HashLong64WithSeed(input, len, seed64)
}

export const xxh3_64bits = (input: Uint8Array): bigint => xxh3_64bitsInternal(input, 0n)

export const xxh3_64bitsWithSeed = (input: Uint8Array, seed: bigint): bigint => xxh3_64bitsInternal(input, seed)

export const xxh3_64bitsString = (input: string): bigint => xxh3_64bitsInternal(textEncoder.encode(input), 0n)

export const xxh3_64bitsStringWithSeed = (input: string, seed: bigint): bigint =>
  xxh3_64bitsInternal(textEncoder.encode(input), seed)
