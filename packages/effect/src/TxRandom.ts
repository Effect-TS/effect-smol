/**
 * A transactional pseudo-random number generator. The PRNG state lives in a
 * `TxRef`, so rolling back a transaction also rolls back the random state.
 *
 * Uses the PCG-XSH-RR algorithm for deterministic, high-quality random output.
 *
 * @since 4.0.0
 */

import * as Effect from "./Effect.ts"
import { dual } from "./Function.ts"
import type { Inspectable } from "./Inspectable.ts"
import { NodeInspectSymbol, toJson } from "./Inspectable.ts"
import type { Pipeable } from "./Pipeable.ts"
import { pipeArguments } from "./Pipeable.ts"
import * as TxRef from "./TxRef.ts"

const TypeId = "~effect/transactions/TxRandom"

// PCG-XSH-RR constants (64-bit state, 32-bit output)
// We use two 32-bit numbers to represent a 64-bit state since JS lacks native u64.
interface PcgState {
  readonly hi: number
  readonly lo: number
}

const PCG_MUL_HI = 0x5851_F42D
const PCG_MUL_LO = 0x4C95_7F2D
const PCG_INC_HI = 0x1405_7B7E
const PCG_INC_LO = 0xF767_814F

const mul64 = (aHi: number, aLo: number, bHi: number, bLo: number): [number, number] => {
  const aLo16 = aLo & 0xFFFF
  const aHi16 = (aLo >>> 16) & 0xFFFF
  const bLo16 = bLo & 0xFFFF
  const bHi16 = (bLo >>> 16) & 0xFFFF
  let t = (aLo16 * bLo16) >>> 0
  const lo = t & 0xFFFF
  t = ((aHi16 * bLo16) + (t >>> 16)) >>> 0
  let mid = t & 0xFFFF
  const carry = (t >>> 16) & 0xFFFF
  t = ((aLo16 * bHi16) + mid) >>> 0
  mid = t & 0xFFFF
  const hi = (((aHi * bLo) + (aLo * bHi) + carry + ((t >>> 16) & 0xFFFF)) & 0xFFFF) << 16
  return [hi | mid, (lo | (((aLo16 * bLo16) >>> 0) & 0xFFFF_0000)) >>> 0]
}

const add64 = (aHi: number, aLo: number, bHi: number, bLo: number): [number, number] => {
  const lo = (aLo + bLo) >>> 0
  const carry = lo < (aLo >>> 0) ? 1 : 0
  const hi = (aHi + bHi + carry) | 0
  return [hi, lo]
}

const pcgStep = (state: PcgState): [output: number, next: PcgState] => {
  const { hi, lo } = state
  // next = state * MUL + INC
  const [mHi, mLo] = mul64(hi, lo, PCG_MUL_HI, PCG_MUL_LO)
  const [nHi, nLo] = add64(mHi, mLo, PCG_INC_HI, PCG_INC_LO)
  // XSH-RR output function
  const xorShifted = (((hi >>> 18) ^ hi) >>> 27) | 0
  const rot = hi >>> 27
  const output = ((xorShifted >>> rot) | (xorShifted << ((-rot) & 31))) >>> 0
  return [output, { hi: nHi, lo: nLo }]
}

const seedToState = (seed: number): PcgState => {
  // Initialize: step once from zero state, add seed, step again
  const init: PcgState = { hi: 0, lo: 0 }
  const [, s1] = pcgStep(init)
  const [s2Hi, s2Lo] = add64(s1.hi, s1.lo, 0, seed >>> 0)
  const [, s3] = pcgStep({ hi: s2Hi, lo: s2Lo })
  return s3
}

/**
 * A transactional random number generator.
 *
 * @example
 * ```ts
 * import { Effect, TxRandom } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const rng = yield* TxRandom.make(42)
 *   const a = yield* TxRandom.next(rng)
 *   const b = yield* TxRandom.next(rng)
 *   console.log(a, b)
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface TxRandom extends Inspectable, Pipeable {
  readonly [TypeId]: typeof TypeId
  readonly ref: TxRef.TxRef<PcgState>
}

const TxRandomProto: Omit<TxRandom, typeof TypeId | "ref"> = {
  [NodeInspectSymbol](this: TxRandom) {
    return toJson(this)
  },
  toJSON(this: TxRandom) {
    return { _id: "TxRandom" }
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

const makeTxRandom = (ref: TxRef.TxRef<PcgState>): TxRandom => {
  const self = Object.create(TxRandomProto)
  self[TypeId] = TypeId
  self.ref = ref
  return self
}

/**
 * Creates a new `TxRandom` with an optional seed. If no seed is provided, a
 * random one is chosen.
 *
 * @example
 * ```ts
 * import { Effect, TxRandom } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const rng = yield* TxRandom.make(42)
 *   const value = yield* TxRandom.next(rng)
 *   console.log(value) // deterministic
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make = (seed?: number | undefined): Effect.Effect<TxRandom> =>
  Effect.map(
    TxRef.make(seedToState(seed ?? (Math.random() * 0xFFFF_FFFF) >>> 0)),
    makeTxRandom
  )

/**
 * Generates a random floating-point number in `[0, 1)`.
 *
 * @example
 * ```ts
 * import { Effect, TxRandom } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const rng = yield* TxRandom.make(42)
 *   const value = yield* TxRandom.next(rng)
 *   console.log(value >= 0 && value < 1) // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const next = (self: TxRandom): Effect.Effect<number> =>
  TxRef.modify(self.ref, (state) => {
    const [output, nextState] = pcgStep(state)
    return [output / 0x1_0000_0000, nextState]
  })

/**
 * Generates a random boolean.
 *
 * @example
 * ```ts
 * import { Effect, TxRandom } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const rng = yield* TxRandom.make(42)
 *   const value = yield* TxRandom.nextBoolean(rng)
 *   console.log(typeof value === "boolean") // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const nextBoolean = (self: TxRandom): Effect.Effect<boolean> =>
  TxRef.modify(self.ref, (state) => {
    const [output, nextState] = pcgStep(state)
    return [(output & 1) === 1, nextState]
  })

/**
 * Generates a random 32-bit unsigned integer.
 *
 * @example
 * ```ts
 * import { Effect, TxRandom } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const rng = yield* TxRandom.make(42)
 *   const value = yield* TxRandom.nextInt(rng)
 *   console.log(Number.isInteger(value)) // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const nextInt = (self: TxRandom): Effect.Effect<number> =>
  TxRef.modify(self.ref, (state) => {
    const [output, nextState] = pcgStep(state)
    return [output, nextState]
  })

/**
 * Generates a random floating-point number in `[min, max)`.
 *
 * @example
 * ```ts
 * import { Effect, TxRandom } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const rng = yield* TxRandom.make(42)
 *   const value = yield* TxRandom.nextRange(rng, 10, 20)
 *   console.log(value >= 10 && value < 20) // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const nextRange: {
  (min: number, max: number): (self: TxRandom) => Effect.Effect<number>
  (self: TxRandom, min: number, max: number): Effect.Effect<number>
} = dual(
  3,
  (self: TxRandom, min: number, max: number): Effect.Effect<number> =>
    Effect.map(next(self), (n) => min + n * (max - min))
)

/**
 * Generates a random integer in `[min, max)`.
 *
 * @example
 * ```ts
 * import { Effect, TxRandom } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const rng = yield* TxRandom.make(42)
 *   const value = yield* TxRandom.nextIntBetween(rng, 0, 100)
 *   console.log(value >= 0 && value < 100) // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const nextIntBetween: {
  (min: number, max: number): (self: TxRandom) => Effect.Effect<number>
  (self: TxRandom, min: number, max: number): Effect.Effect<number>
} = dual(
  3,
  (self: TxRandom, min: number, max: number): Effect.Effect<number> =>
    Effect.map(next(self), (n) => Math.floor(min + n * (max - min)))
)

/**
 * Randomly shuffles an iterable using the Fisher-Yates algorithm.
 *
 * @example
 * ```ts
 * import { Effect, TxRandom } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const rng = yield* TxRandom.make(42)
 *   const shuffled = yield* TxRandom.shuffle(rng, [1, 2, 3, 4, 5])
 *   console.log(shuffled.length) // 5
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const shuffle: {
  <A>(elements: Iterable<A>): (self: TxRandom) => Effect.Effect<Array<A>>
  <A>(self: TxRandom, elements: Iterable<A>): Effect.Effect<Array<A>>
} = dual(
  2,
  <A>(self: TxRandom, elements: Iterable<A>): Effect.Effect<Array<A>> =>
    TxRef.modify(self.ref, (state) => {
      const arr = Array.from(elements)
      let currentState = state
      for (let i = arr.length - 1; i > 0; i--) {
        const [output, nextState] = pcgStep(currentState)
        currentState = nextState
        const j = output % (i + 1)
        const tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
      }
      return [arr, currentState]
    })
)

/**
 * Determines if the provided value is a `TxRandom`.
 *
 * @example
 * ```ts
 * import { Effect, TxRandom } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const rng = yield* TxRandom.make(42)
 *   console.log(TxRandom.isTxRandom(rng)) // true
 *   console.log(TxRandom.isTxRandom("nope")) // false
 * })
 * ```
 *
 * @since 4.0.0
 * @category guards
 */
export const isTxRandom = (u: unknown): u is TxRandom => typeof u === "object" && u !== null && TypeId in u
