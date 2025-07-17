/**
 * @since 2.0.0
 */
import { identity } from "./Function.ts"
import type { Kind, TypeLambda } from "./HKT.ts"
import { getBugErrorMessage } from "./internal/errors.ts"
import { isNullable, isObject } from "./Predicate.ts"
import type * as Types from "./Types.ts"

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

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * console.log(Utils.GenKindTypeId) // "~effect/Utils/GenKind"
 * ```
 *
 * @category symbols
 * @since 2.0.0
 */
export const GenKindTypeId: GenKindTypeId = "~effect/Utils/GenKind"

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * type MyId = Utils.GenKindTypeId // "~effect/Utils/GenKind"
 * ```
 *
 * @category symbols
 * @since 2.0.0
 */
export type GenKindTypeId = "~effect/Utils/GenKind"

/**
 * @example
 * ```ts
 * import { Utils, Option } from "effect"
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
 * import { Utils, Option } from "effect"
 *
 * const adapter = Utils.adapter<Option.OptionTypeLambda>()
 * const genValue = adapter(Option.some(42))
 *
 * console.log(Utils.isGenKind(genValue)) // true
 * console.log(Utils.isGenKind(Option.some(42))) // false
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
 * import { Utils, Option } from "effect"
 *
 * // Variance defines the type parameter relationships
 * declare const variance: Utils.Variance<Option.OptionTypeLambda, never, never, never>
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export interface Variance<in out F extends TypeLambda, in R, out O, out E> {
  readonly [GenKindTypeId]: GenKindTypeId
  readonly _F: Types.Invariant<F>
  readonly _R: Types.Contravariant<R>
  readonly _O: Types.Covariant<O>
  readonly _E: Types.Covariant<E>
}

/**
 * @example
 * ```ts
 * import { Utils, Option } from "effect"
 *
 * // Gen enables generator-based syntax
 * declare const gen: Utils.Gen<Option.OptionTypeLambda, Utils.Adapter<Option.OptionTypeLambda>>
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export type Gen<F extends TypeLambda, Z> = <
  Self,
  K extends Variance<F, any, any, any> | YieldWrap<Kind<F, any, any, any, any>>,
  A
>(
  ...args:
    | [
      self: Self,
      body: (this: Self, resume: Z) => Generator<K, A, never>
    ]
    | [
      body: (resume: Z) => Generator<K, A, never>
    ]
) => Kind<
  F,
  [K] extends [Variance<F, infer R, any, any>] ? R
    : [K] extends [YieldWrap<Kind<F, infer R, any, any, any>>] ? R
    : never,
  [K] extends [Variance<F, any, infer O, any>] ? O
    : [K] extends [YieldWrap<Kind<F, any, infer O, any, any>>] ? O
    : never,
  [K] extends [Variance<F, any, any, infer E>] ? E
    : [K] extends [YieldWrap<Kind<F, any, any, infer E, any>>] ? E
    : never,
  A
>

/**
 * @example
 * ```ts
 * import { Utils, Option } from "effect"
 *
 * // Adapter enables chaining computations in generator functions
 * const adapter: Utils.Adapter<Option.OptionTypeLambda> = Utils.adapter()
 * const genValue = adapter(Option.some(42))
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export interface Adapter<Z extends TypeLambda> {
  <_R, _O, _E, _A>(
    self: Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, _R, _O, _E, _A>(a: A, ab: (a: A) => Kind<Z, _R, _O, _E, _A>): GenKind<Z, _R, _O, _E, _A>
  <A, B, _R, _O, _E, _A>(a: A, ab: (a: A) => B, bc: (b: B) => Kind<Z, _R, _O, _E, _A>): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: F) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (g: H) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, J, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, J, K, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, J, K, L, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, J, K, L, M, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, J, K, L, M, N, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O,
    op: (o: O) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O,
    op: (o: O) => P,
    pq: (p: P) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O,
    op: (o: O) => P,
    pq: (p: P) => Q,
    qr: (q: Q) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O,
    op: (o: O) => P,
    pq: (p: P) => Q,
    qr: (q: Q) => R,
    rs: (r: R) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O,
    op: (o: O) => P,
    pq: (p: P) => Q,
    qr: (q: Q) => R,
    rs: (r: R) => S,
    st: (s: S) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
  <A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, _R, _O, _E, _A>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O,
    op: (o: O) => P,
    pq: (p: P) => Q,
    qr: (q: Q) => R,
    rs: (r: R) => S,
    st: (s: S) => T,
    tu: (s: T) => Kind<Z, _R, _O, _E, _A>
  ): GenKind<Z, _R, _O, _E, _A>
}

/**
 * @example
 * ```ts
 * import { Utils, Result } from "effect"
 *
 * // Create an adapter for Result type
 * const adapter = Utils.adapter<Result.ResultTypeLambda>()
 *
 * // Use in generator function
 * function* program() {
 *   const a = yield* adapter(Result.succeed(1))
 *   const b = yield* adapter(Result.succeed(2))
 *   return a + b
 * }
 * ```
 *
 * @category adapters
 * @since 2.0.0
 */
export const adapter: <F extends TypeLambda>() => Adapter<F> = () => (function() {
  let x = arguments[0]
  for (let i = 1; i < arguments.length; i++) {
    x = arguments[i](x)
  }
  return new GenKindImpl(x) as any
})

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
    if (isNullable(seedLo) && isNullable(seedHi)) {
      seedLo = (Math.random() * 0xffffffff) >>> 0
      seedHi = 0
    } else if (isNullable(seedLo)) {
      seedLo = seedHi
      seedHi = 0
    }
    if (isNullable(incLo) && isNullable(incHi)) {
      incLo = this._state ? this._state[3] : defaultIncLo
      incHi = this._state ? this._state[2] : defaultIncHi
    } else if (isNullable(incLo)) {
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

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * console.log(Utils.YieldWrapTypeId) // Symbol(effect/Utils/YieldWrap)
 * ```
 *
 * @category symbols
 * @since 3.0.6
 */
export const YieldWrapTypeId: unique symbol = Symbol.for("effect/Utils/YieldWrap")

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * const wrapped = new Utils.YieldWrap(42)
 * const value = Utils.yieldWrapGet(wrapped)
 * console.log(value) // 42
 * ```
 *
 * @category constructors
 * @since 3.0.6
 */
export class YieldWrap<T> {
  /**
   * @since 3.0.6
   */
  readonly #value: T
  constructor(value: T) {
    this.#value = value
  }
  /**
   * @since 3.0.6
   */
  [YieldWrapTypeId](): T {
    return this.#value
  }
}

/**
 * @example
 * ```ts
 * import { Utils } from "effect"
 *
 * const wrapped = new Utils.YieldWrap("hello")
 * const value = Utils.yieldWrapGet(wrapped)
 * console.log(value) // "hello"
 * ```
 *
 * @category getters
 * @since 3.0.6
 */
export function yieldWrapGet<T>(self: YieldWrap<T>): T {
  if (typeof self === "object" && self !== null && YieldWrapTypeId in self) {
    return self[YieldWrapTypeId]()
  }
  throw new Error(getBugErrorMessage("yieldWrapGet"))
}

const standard = {
  "~effect/Effect/internal": <A>(body: () => A) => {
    return body()
  }
}

const internal = "~effect/Effect/internal"
const forced = {
  [internal]: <A>(body: () => A) => {
    try {
      return body()
    } finally {
      //
    }
  }
}

const isNotOptimizedAway = standard[internal](() => new Error().stack)?.includes(internal) === true

/**
 * @since 3.2.2
 * @status experimental
 * @category tracing
 */
export const internalCall = isNotOptimizedAway ? standard[internal] : forced[internal]

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
