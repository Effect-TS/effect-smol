/**
 * @since 2.0.0
 */
import { identity } from "./Function.ts"
import type { Kind, TypeLambda } from "./HKT.ts"
import { isObject } from "./Predicate.ts"
import type * as Types from "./Types.ts"

/**
 * @since 2.0.0
 */
const GenKindTypeId = "~effect/Utils/GenKind"

/**
 * @category models
 * @since 2.0.0
 */
export interface GenKind<F extends TypeLambda, R, O, E, A> extends Variance<F, R, O, E> {
  readonly value: Kind<F, R, O, E, A>

  [Symbol.iterator](): IterableIterator<GenKind<F, R, O, E, A>, A>
}

/**
 * @category predicates
 * @since 3.0.6
 */
export const isGenKind = (u: unknown): u is GenKind<any, any, any, any, any> => isObject(u) && GenKindTypeId in u

class GenKindImpl<F extends TypeLambda, R, O, E, A> implements GenKind<F, R, O, E, A> {
  readonly value: Kind<F, R, O, E, A>

  constructor(
    value: Kind<F, R, O, E, A>
  ) {
    this.value = value
  }

  get _F() {
    return identity
  }

  get _R() {
    return (_: R) => _
  }

  get _O() {
    return (_: never): O => _
  }

  get _E() {
    return (_: never): E => _
  }

  readonly [GenKindTypeId]: typeof GenKindTypeId = GenKindTypeId;

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
 * @category constructors
 * @since 2.0.0
 */
export const makeGenKind = <F extends TypeLambda, R, O, E, A>(
  kind: Kind<F, R, O, E, A>
): GenKind<F, R, O, E, A> => new GenKindImpl(kind)

/**
 * @example
 * ```ts
 * import type { Utils } from "effect"
 * import type * as Option from "effect/Option"
 *
 * // Variance defines the type parameter relationships
 * declare const variance: Utils.Variance<
 *   Option.OptionTypeLambda,
 *   never,
 *   never,
 *   never
 * >
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
 * import type { Option, Utils } from "effect"
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

/**
 * @example
 * ```ts
 * import type { Utils } from "effect"
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
