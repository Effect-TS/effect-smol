/**
 * The Random module provides a service for generating random numbers in Effect
 * programs. It offers a testable and composable way to work with randomness,
 * supporting integers, floating-point numbers, and range-based generation.
 *
 * @example
 * ```ts
 * import { Effect, Random } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const random = yield* Random
 *
 *   const randomFloat = yield* random.next()
 *   console.log("Random float:", randomFloat)
 *
 *   const randomInt = yield* random.nextInt()
 *   console.log("Random integer:", randomInt)
 *
 *   const diceRoll = yield* random.nextIntBetween(1, 6)
 *   console.log("Dice roll:", diceRoll)
 * })
 * ```
 *
 * @since 4.0.0
 */
import * as Effect from "./Effect.ts"
import type { LazyArg } from "./Function.ts"
import * as ServiceMap from "./ServiceMap.ts"

/**
 * Represents a service for generating random numbers.
 *
 * @example
 * ```ts
 * import { Effect, Random } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const random = yield* Random
 *
 *   const float = yield* random.next()
 *   const integer = yield* random.nextInt()
 *   const inRange = yield* random.nextIntBetween(1, 100)
 *
 *   console.log("Float:", float)
 *   console.log("Integer:", integer)
 *   console.log("In range:", inRange)
 * })
 * ```
 *
 * @since 4.0.0
 * @category Services
 */
export const Random = ServiceMap.Reference<Service>("effect/Random", {
  defaultValue: () => new RandomImpl(() => Math.random())
})

/**
 * @since 4.0.0
 * @category Models
 */
export interface Service {
  /**
   * Generates a random number between 0 (inclusive) and 1 (exclusive).
   *
   * NOTE: This method is unsafe because it directly relies on side-effecting
   * code without being wrapped in an effect.
   *
   * @example
   * ```ts
   * import { Effect, Random } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   const random = yield* Random
   *   const value = random.nextUnsafe()
   *   console.log("Random value:", value)
   * })
   * ```
   */
  readonly nextUnsafe: () => number

  /**
   * Generates a random number between 0 (inclusive) and 1 (exclusive).
   *
   * @example
   * ```ts
   * import { Effect, Random } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   const random = yield* Random
   *   const value = yield* random.next()
   *   console.log("Random value:", value)
   * })
   * ```
   */
  readonly next: () => Effect.Effect<number>

  /**
   * Generates a random integer between `0` and `Number.MAX_SAFE_INTEGER`.
   *
   * @example
   * ```ts
   * import { Effect, Random } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   const random = yield* Random
   *   const randomInt = yield* random.nextInt()
   *   console.log("Random integer:", randomInt)
   * })
   * ```
   */
  readonly nextInt: () => Effect.Effect<number>

  /**
   * Generates a random number between `min` and `max`.
   *
   * By default generates numbers in the closed range `[min, max]`. Set
   * `options.halfOpen: true` to generate in the half-open range `[min, max)`.
   *
   * @example
   * ```ts
   * import { Effect, Random } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   const random = yield* Random
   *   const value1 = yield* random.nextBetween(0, 1)
   *   const value2 = yield* random.nextBetween(0, 1, {
   *     halfOpen: true
   *   })
   *   const value3 = yield* random.nextBetween(10, 20)
   * })
   * ```
   */
  readonly nextBetween: (min: number, max: number, options?: {
    readonly halfOpen?: boolean
  }) => Effect.Effect<number>

  /**
   * Generates a random integer between `min` and `max`.
   *
   * By default generates integers in the closed range `[min, max]`. Set
   * `options.halfOpen: true` to generate in the half-open range `[min, max)`.
   *
   * @example
   * ```ts
   * import { Effect, Random } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   const random = yield* Random
   *   const diceRoll1 = yield* random.nextIntBetween(1, 6)
   *   const diceRoll2 = yield* random.nextIntBetween(1, 6, {
   *     halfOpen: true
   *   })
   *   const diceRoll3 = yield* random.nextIntBetween(0, 10)
   * })
   * ```
   */
  readonly nextIntBetween: (min: number, max: number, options?: {
    readonly halfOpen?: boolean
  }) => Effect.Effect<number>
}

/**
 * Generates a random number between 0 (inclusive) and 1 (exclusive).
 *
 * @example
 * ```ts
 * import { Effect, Random } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const value = yield* Random.next()
 *   console.log("Random value:", value)
 * })
 * ```
 *
 * @since 4.0.0
 * @category Random Number Generators
 */
export const next: Effect.Effect<number> = Effect.flatMap(
  Effect.service(Random),
  (random) => random.next()
)

/**
 * Generates a random integer between `0` and `Number.MAX_SAFE_INTEGER`.
 *
 * @example
 * ```ts
 * import { Effect, Random } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const randomInt = yield* Random.nextInt()
 *   console.log("Random integer:", randomInt)
 * })
 * ```
 *
 * @since 4.0.0
 * @category Random Number Generators
 */
export const nextInt: Effect.Effect<number> = Effect.flatMap(
  Effect.service(Random),
  (random) => random.nextInt()
)

/**
 * Generates a random number between `min` and `max`.
 *
 * By default generates numbers in the closed range `[min, max]`. Set
 * `options.halfOpen: true` to generate in the half-open range `[min, max)`.
 *
 * @example
 * ```ts
 * import { Effect, Random } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const value1 = yield* Random.nextBetween(0, 1)
 *   const value2 = yield* Random.nextBetween(0, 1, {
 *     halfOpen: true
 *   })
 *   const value3 = yield* Random.nextBetween(10, 20)
 * })
 * ```
 *
 * @since 4.0.0
 * @category Random Number Generators
 */
export const nextBetween = (min: number, max: number, options?: {
  readonly halfOpen?: boolean
}): Effect.Effect<number> =>
  Effect.flatMap(
    Effect.service(Random),
    (random) => random.nextBetween(min, max, options)
  )

/**
 * Generates a random integer between `min` and `max`.
 *
 * By default generates integers in the closed range `[min, max]`. Set
 * `options.halfOpen: true` to generate in the half-open range `[min, max)`.
 *
 * @example
 * ```ts
 * import { Effect, Random } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const diceRoll1 = yield* Random.nextIntBetween(1, 6)
 *   const diceRoll2 = yield* Random.nextIntBetween(1, 6, {
 *     halfOpen: true
 *   })
 *   const diceRoll3 = yield* Random.nextIntBetween(0, 10)
 * })
 * ```
 *
 * @since 4.0.0
 * @category Random Number Generators
 */
export const nextIntBetween = (min: number, max: number, options?: {
  readonly halfOpen?: boolean
}): Effect.Effect<number> =>
  Effect.flatMap(
    Effect.service(Random),
    (random) => random.nextIntBetween(min, max, options)
  )

class RandomImpl implements Service {
  readonly nextUnsafe: () => number
  constructor(next: LazyArg<number>) {
    this.nextUnsafe = next
  }
  next(): Effect.Effect<number> {
    return Effect.sync(() => this.nextUnsafe())
  }
  nextInt(): Effect.Effect<number> {
    return Effect.sync(() => Math.floor(this.nextUnsafe() * Number.MAX_SAFE_INTEGER))
  }
  nextBetween(min: number, max: number, options?: {
    readonly halfOpen?: boolean
  }): Effect.Effect<number> {
    return Effect.sync(() =>
      options?.halfOpen === false
        ? this.nextUnsafe() * (max - min + Number.EPSILON) + min
        : this.nextUnsafe() * (max - min) + min
    )
  }
  nextIntBetween(min: number, max: number, options?: {
    readonly halfOpen?: boolean
  }): Effect.Effect<number> {
    return Effect.sync(() => {
      const minInt = Math.ceil(min)
      const maxInt = Math.floor(max)
      return options?.halfOpen === false
        ? Math.floor(this.nextUnsafe() * (maxInt - minInt + 1)) + minInt
        : Math.floor(this.nextUnsafe() * (maxInt - minInt)) + minInt
    })
  }
}
