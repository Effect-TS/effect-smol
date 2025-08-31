/**
 * @since 2.0.0
 */
import { isNullish, isObject } from "./data/Predicate.ts"
import { identity } from "./Function.ts"
import type { Kind, TypeLambda } from "./types/HKT.ts"
import type * as Types from "./types/Types.ts"

/**
 * Copyright 2014 Thom Chiovoloni, released under the MIT license.
 *
 * A random number generator based on the basic implementation of the PCG algorithm,
 * as described here: http://www.pcg-random.org/
 *
 * Adapted for TypeScript from Thom's original code at https://github.com/thomcc/pcg-random
 *
 * forked from https://github.com/frptools
 *
 * @since 2.0.0
 */

const GenKindTypeId = "~effect/Utils/GenKind"

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
import * as Option from "effect/data/Option"
 *
 * // A GenKind wraps types to make them generator-compatible
 * declare const genKind: Utils.GenKind<Option.OptionTypeLambda, never, never, never, number>
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export interface GenKind<F extends TypeLambda, R, O, E, A> extends Variance<F, R, O, E> {
  readonly value: Kind<F, R, O, E, A>

  [Symbol.iterator](): IterableIterator<GenKind<F, R, O, E, A>, A>
}

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * // Check if a value is a GenKind wrapper
 * declare const someValue: unknown
 *
 * if (Utils.isGenKind(someValue)) {
 *   console.log("Value is a GenKind")
 * } else {
 *   console.log("Value is not a GenKind")
 * }
 * ```
 *
 * @category predicates
 * @since 3.0.6
 */
export const isGenKind = (u: unknown): u is GenKind<any, any, any, any, any> => isObject(u) && GenKindTypeId in u

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * // GenKindImpl is used internally by the Effect generator system
 * // This is typically not used directly by end users
 * declare const existingGenKind: Utils.GenKind<any, any, any, any, any>
 * console.log(Utils.isGenKind(existingGenKind)) // true
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export class GenKindImpl<F extends TypeLambda, R, O, E, A> implements GenKind<F, R, O, E, A> {
  /**
   * @since 2.0.0
   */
  readonly value: Kind<F, R, O, E, A>

  constructor(
    /**
     * @since 2.0.0
     */
    value: Kind<F, R, O, E, A>
  ) {
    this.value = value
  }

  /**
   * @since 2.0.0
   */
  get _F() {
    return identity
  }

  /**
   * @since 2.0.0
   */
  get _R() {
    return (_: R) => _
  }

  /**
   * @since 2.0.0
   */
  get _O() {
    return (_: never): O => _
  }

  /**
   * @since 2.0.0
   */
  get _E() {
    return (_: never): E => _
  }

  /**
   * @since 2.0.0
   */
  readonly [GenKindTypeId]: typeof GenKindTypeId = GenKindTypeId;

  /**
   * @since 2.0.0
   */
  [Symbol.iterator](): IterableIterator<GenKind<F, R, O, E, A>, A> {
    return new SingleShotGen<GenKind<F, R, O, E, A>, A>(this as any)
  }
}

/**
 * @category constructors
 * @since 2.0.0
 */
export class SingleShotGen<T, A> implements IterableIterator<T, A> {
  private called = false
  readonly self: T

  constructor(self: T) {
    this.self = self
  }

  /**
   * @since 2.0.0
   */
  next(a: A): IteratorResult<T, A> {
    return this.called ?
      ({
        value: a,
        done: true
      }) :
      (this.called = true,
        ({
          value: this.self,
          done: false
        }))
  }

  /**
   * @since 2.0.0
   */
  [Symbol.iterator](): IterableIterator<T, A> {
    return new SingleShotGen<T, A>(this.self)
  }
}

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * // makeGenKind is used internally by the Effect generator system
 * // This is typically not used directly by end users
 * declare const existingGenKind: Utils.GenKind<any, any, any, any, any>
 * console.log(Utils.isGenKind(existingGenKind)) // true
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const makeGenKind = <F extends TypeLambda, R, O, E, A>(
  kind: Kind<F, R, O, E, A>
): GenKind<F, R, O, E, A> => new GenKindImpl(kind)

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
import * as Option from "effect/data/Option"
 *
 * // Variance defines the type parameter relationships
 * declare const variance: Utils.Variance<Option.OptionTypeLambda, never, never, never>
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export interface Variance<in out F extends TypeLambda, in R, out O, out E> {
  readonly [GenKindTypeId]: typeof GenKindTypeId
  readonly _F: Types.Invariant<F>
  readonly _R: Types.Contravariant<R>
  readonly _O: Types.Covariant<O>
  readonly _E: Types.Covariant<E>
}

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 * import { Option } from "effect/data"
 *
 * // Gen enables generator-based syntax for any TypeLambda
 * declare const gen: Utils.Gen<Option.OptionTypeLambda>
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export type Gen<F extends TypeLambda> = <
  Self,
  K extends Variance<F, any, any, any> | Kind<F, any, any, any, any>,
  A
>(
  ...args:
    | [
      self: Self,
      body: (this: Self) => Generator<K, A, never>
    ]
    | [
      body: () => Generator<K, A, never>
    ]
) => Kind<
  F,
  [K] extends [Variance<F, infer R, any, any>] ? R
    : [K] extends [Kind<F, infer R, any, any, any>] ? R
    : never,
  [K] extends [Variance<F, any, infer O, any>] ? O
    : [K] extends [Kind<F, any, infer O, any, any>] ? O
    : never,
  [K] extends [Variance<F, any, any, infer E>] ? E
    : [K] extends [Kind<F, any, any, infer E, any>] ? E
    : never,
  A
>

const defaultIncHi = 0x14057b7e
const defaultIncLo = 0xf767814f
const MUL_HI = 0x5851f42d >>> 0
const MUL_LO = 0x4c957f2d >>> 0
const BIT_53 = 9007199254740992.0
const BIT_27 = 134217728.0

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * const state: Utils.PCGRandomState = [123, 456, 789, 1011]
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export type PCGRandomState = [number, number, number, number]

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * const value1: Utils.OptionalNumber = 42
 * const value2: Utils.OptionalNumber = null
 * const value3: Utils.OptionalNumber = undefined
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export type OptionalNumber = number | null | undefined

/**
 * PCG is a family of simple fast space-efficient statistically good algorithms
 * for random number generation. Unlike many general-purpose RNGs, they are also
 * hard to predict.
 *
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * const rng = new Utils.PCGRandom(12345)
 * const randomNumber = rng.number()
 * console.log(randomNumber) // Random number between 0 and 1
 *
 * const randomInt = rng.integer(100)
 * console.log(randomInt) // Random integer between 0 and 99
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export class PCGRandom {
  private _state!: Int32Array

  /**
   * Creates an instance of PCGRandom.
   *
   * @param seed - The low 32 bits of the seed (0 is used for high 32 bits).
   *
   * @memberOf PCGRandom
   */
  constructor(seed?: OptionalNumber)
  /**
   * Creates an instance of PCGRandom.
   *
   * @param seedHi - The high 32 bits of the seed.
   * @param seedLo - The low 32 bits of the seed.
   * @param inc - The low 32 bits of the incrementer (0 is used for high 32 bits).
   *
   * @memberOf PCGRandom
   */
  constructor(seedHi: OptionalNumber, seedLo: OptionalNumber, inc?: OptionalNumber)
  /**
   * Creates an instance of PCGRandom.
   *
   * @param seedHi - The high 32 bits of the seed.
   * @param seedLo - The low 32 bits of the seed.
   * @param incHi - The high 32 bits of the incrementer.
   * @param incLo - The low 32 bits of the incrementer.
   *
   * @memberOf PCGRandom
   */
  constructor(
    seedHi: OptionalNumber,
    seedLo: OptionalNumber,
    incHi: OptionalNumber,
    incLo: OptionalNumber
  )
  constructor(
    seedHi?: OptionalNumber,
    seedLo?: OptionalNumber,
    incHi?: OptionalNumber,
    incLo?: OptionalNumber
  ) {
    if (isNullish(seedLo) && isNullish(seedHi)) {
      seedLo = (Math.random() * 0xffffffff) >>> 0
      seedHi = 0
    } else if (isNullish(seedLo)) {
      seedLo = seedHi
      seedHi = 0
    }
    if (isNullish(incLo) && isNullish(incHi)) {
      incLo = this._state ? this._state[3] : defaultIncLo
      incHi = this._state ? this._state[2] : defaultIncHi
    } else if (isNullish(incLo)) {
      incLo = incHi as number
      incHi = 0
    }

    this._state = new Int32Array([0, 0, (incHi as number) >>> 0, ((incLo || 0) | 1) >>> 0])
    this._next()
    add64(
      this._state,
      this._state[0]!,
      this._state[1]!,
      (seedHi as number) >>> 0,
      (seedLo as number) >>> 0
    )
    this._next()
    return this
  }

  /**
   * Returns a copy of the internal state of this random number generator as a
   * JavaScript Array.
   *
   * @category getters
   * @since 2.0.0
   */
  getState(): PCGRandomState {
    return [this._state[0]!, this._state[1]!, this._state[2]!, this._state[3]!]
  }

  /**
   * Restore state previously retrieved using `getState()`.
   *
   * @since 2.0.0
   */
  setState(state: PCGRandomState) {
    this._state[0] = state[0]
    this._state[1] = state[1]
    this._state[2] = state[2]
    this._state[3] = state[3] | 1
  }

  /**
   * Get a uniformly distributed 32 bit integer between [0, max).
   *
   * @category getter
   * @since 2.0.0
   */
  integer(max: number) {
    return Math.round(this.number() * Number.MAX_SAFE_INTEGER) % max
  }

  /**
   * Get a uniformly distributed IEEE-754 double between 0.0 and 1.0, with
   * 53 bits of precision (every bit of the mantissa is randomized).
   *
   * @category getters
   * @since 2.0.0
   */
  number() {
    const hi = (this._next() & 0x03ffffff) * 1.0
    const lo = (this._next() & 0x07ffffff) * 1.0
    return (hi * BIT_27 + lo) / BIT_53
  }

  /** @internal */
  private _next() {
    // save current state (what we'll use for this number)
    const oldHi = this._state[0]! >>> 0
    const oldLo = this._state[1]! >>> 0

    // churn LCG.
    mul64(this._state, oldHi, oldLo, MUL_HI, MUL_LO)
    add64(this._state, this._state[0]!, this._state[1]!, this._state[2]!, this._state[3]!)

    // get least sig. 32 bits of ((oldstate >> 18) ^ oldstate) >> 27
    let xsHi = oldHi >>> 18
    let xsLo = ((oldLo >>> 18) | (oldHi << 14)) >>> 0
    xsHi = (xsHi ^ oldHi) >>> 0
    xsLo = (xsLo ^ oldLo) >>> 0
    const xorshifted = ((xsLo >>> 27) | (xsHi << 5)) >>> 0
    // rotate xorshifted right a random amount, based on the most sig. 5 bits
    // bits of the old state.
    const rot = oldHi >>> 27
    const rot2 = ((-rot >>> 0) & 31) >>> 0
    return ((xorshifted >>> rot) | (xorshifted << rot2)) >>> 0
  }
}

function mul64(
  out: Int32Array,
  aHi: number,
  aLo: number,
  bHi: number,
  bLo: number
): void {
  let c1 = ((aLo >>> 16) * (bLo & 0xffff)) >>> 0
  let c0 = ((aLo & 0xffff) * (bLo >>> 16)) >>> 0

  let lo = ((aLo & 0xffff) * (bLo & 0xffff)) >>> 0
  let hi = ((aLo >>> 16) * (bLo >>> 16) + ((c0 >>> 16) + (c1 >>> 16))) >>> 0

  c0 = (c0 << 16) >>> 0
  lo = (lo + c0) >>> 0
  if ((lo >>> 0) < (c0 >>> 0)) {
    hi = (hi + 1) >>> 0
  }

  c1 = (c1 << 16) >>> 0
  lo = (lo + c1) >>> 0
  if ((lo >>> 0) < (c1 >>> 0)) {
    hi = (hi + 1) >>> 0
  }

  hi = (hi + Math.imul(aLo, bHi)) >>> 0
  hi = (hi + Math.imul(aHi, bLo)) >>> 0

  out[0] = hi
  out[1] = lo
}

// add two 64 bit numbers (given in parts), and store the result in `out`.
function add64(
  out: Int32Array,
  aHi: number,
  aLo: number,
  bHi: number,
  bLo: number
): void {
  let hi = (aHi + bHi) >>> 0
  const lo = (aLo + bLo) >>> 0
  if ((lo >>> 0) < (aLo >>> 0)) {
    hi = (hi + 1) | 0
  }
  out[0] = hi
  out[1] = lo
}

const InternalTypeId = "~effect/Effect/internal"

const standard = {
  [InternalTypeId]: <A>(body: () => A) => {
    return body()
  }
}

const forced = {
  [InternalTypeId]: <A>(body: () => A) => {
    try {
      return body()
    } finally {
      //
    }
  }
}

const isNotOptimizedAway = standard[InternalTypeId](() => new Error().stack)?.includes(InternalTypeId) === true

/**
 * @since 3.2.2
 * @status experimental
 * @category tracing
 */
export const internalCall = isNotOptimizedAway ? standard[InternalTypeId] : forced[InternalTypeId]

const genConstructor = (function*() {}).constructor

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * function* generatorFn() {
 *   yield 1
 *   yield 2
 * }
 *
 * console.log(Utils.isGeneratorFunction(generatorFn)) // true
 * console.log(Utils.isGeneratorFunction(() => {})) // false
 * ```
 *
 * @category predicates
 * @since 3.11.0
 */
export const isGeneratorFunction = (u: unknown): u is (...args: Array<any>) => Generator<any, any, any> =>
  isObject(u) && u.constructor === genConstructor
