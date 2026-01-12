/**
 * This module provides utilities for working with durations of time. A `Duration`
 * is an immutable data type that represents a span of time with high precision,
 * supporting operations from nanoseconds to weeks.
 *
 * Durations support:
 * - **High precision**: Nanosecond-level accuracy using BigInt
 * - **Multiple formats**: Numbers (millis), BigInt (nanos), tuples, strings
 * - **Arithmetic operations**: Add, subtract, multiply, divide
 * - **Comparisons**: Equal, less than, greater than
 * - **Conversions**: Between different time units
 * - **Human-readable formatting**: Pretty printing and parsing
 *
 * @since 2.0.0
 */
import * as Combiner from "./Combiner.ts"
import * as Equal from "./Equal.ts"
import type * as equivalence from "./Equivalence.ts"
import { dual, identity } from "./Function.ts"
import * as Hash from "./Hash.ts"
import type * as Inspectable from "./Inspectable.ts"
import { NodeInspectSymbol } from "./Inspectable.ts"
import * as order from "./Order.ts"
import type { Pipeable } from "./Pipeable.ts"
import { pipeArguments } from "./Pipeable.ts"
import { hasProperty, isBigInt, isNumber, isString } from "./Predicate.ts"
import * as Reducer from "./Reducer.ts"
import * as UndefinedOr from "./UndefinedOr.ts"

const TypeId = "~effect/time/Duration"

const bigint0 = BigInt(0)
const bigint24 = BigInt(24)
const bigint60 = BigInt(60)
const bigint1e3 = BigInt(1_000)
const bigint1e6 = BigInt(1_000_000)
const bigint1e9 = BigInt(1_000_000_000)

/**
 * Represents a span of time with high precision, supporting operations from
 * nanoseconds to weeks.
 *
 * @since 2.0.0
 * @category models
 */
export interface Duration extends Equal.Equal, Pipeable, Inspectable.Inspectable {
  readonly [TypeId]: typeof TypeId
  readonly value: DurationValue
}

/**
 * The internal representation of a `Duration` value.
 *
 * @since 2.0.0
 * @category models
 */
export type DurationValue =
  | { _tag: "Millis"; millis: number }
  | { _tag: "Nanos"; nanos: bigint }
  | { _tag: "Infinity" }

/**
 * Valid time units that can be used in duration string representations.
 *
 * @since 2.0.0
 * @category models
 */
export type Unit =
  | "nano"
  | "nanos"
  | "micro"
  | "micros"
  | "milli"
  | "millis"
  | "second"
  | "seconds"
  | "minute"
  | "minutes"
  | "hour"
  | "hours"
  | "day"
  | "days"
  | "week"
  | "weeks"

/**
 * Valid input types that can be converted to a Duration.
 *
 * @since 2.0.0
 * @category models
 */
export type DurationInput =
  | Duration
  | number // millis
  | bigint // nanos
  | readonly [seconds: number, nanos: number]
  | `${number} ${Unit}`

const DURATION_REGEXP = /^(-?\d+(?:\.\d+)?)\s+(nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?)$/

/**
 * Decodes a `DurationInput` into a `Duration`.
 *
 * If the input is not a valid `DurationInput`, it throws an error.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const duration1 = Duration.fromDurationInputUnsafe(1000) // 1000 milliseconds
 * const duration2 = Duration.fromDurationInputUnsafe("5 seconds")
 * const duration3 = Duration.fromDurationInputUnsafe([2, 500_000_000]) // 2 seconds and 500ms
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromDurationInputUnsafe = (input: DurationInput): Duration => {
  if (isDuration(input)) return input
  if (isNumber(input)) return millis(input)
  if (isBigInt(input)) return nanos(input)
  if (Array.isArray(input) && input.length === 2 && input.every(isNumber)) {
    if (input[0] === -Infinity || input[1] === -Infinity || Number.isNaN(input[0]) || Number.isNaN(input[1])) {
      return zero
    }

    if (input[0] === Infinity || input[1] === Infinity) {
      return infinity
    }

    return nanos(BigInt(Math.round(input[0] * 1_000_000_000)) + BigInt(Math.round(input[1])))
  }
  if (isString(input)) {
    const match = DURATION_REGEXP.exec(input)
    if (match) {
      const [_, valueStr, unit] = match
      const value = Number(valueStr)
      switch (unit) {
        case "nano":
        case "nanos":
          return nanos(BigInt(valueStr))
        case "micro":
        case "micros":
          return micros(BigInt(valueStr))
        case "milli":
        case "millis":
          return millis(value)
        case "second":
        case "seconds":
          return seconds(value)
        case "minute":
        case "minutes":
          return minutes(value)
        case "hour":
        case "hours":
          return hours(value)
        case "day":
        case "days":
          return days(value)
        case "week":
        case "weeks":
          return weeks(value)
      }
    }
  }
  throw new Error(`Invalid DurationInput: ${input}`)
}

/**
 * Safely decodes a `DurationInput` value into a `Duration`, returning
 * `undefined` if decoding fails.
 *
 * **Example**
 *
 * ```ts
 * import { Duration } from "effect"
 *
 * Duration.fromDurationInput(1000)?.pipe(Duration.toSeconds) // 1
 *
 * Duration.fromDurationInput("invalid" as any) // undefined
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromDurationInput: (u: DurationInput) => Duration | undefined = UndefinedOr.liftThrowable(
  fromDurationInputUnsafe
)

const zeroDurationValue: DurationValue = { _tag: "Millis", millis: 0 }
const infinityDurationValue: DurationValue = { _tag: "Infinity" }

const DurationProto: Omit<Duration, "value"> = {
  [TypeId]: TypeId,
  [Hash.symbol](this: Duration) {
    return Hash.structure(this.value)
  },
  [Equal.symbol](this: Duration, that: unknown): boolean {
    return isDuration(that) && equals(this, that)
  },
  toString(this: Duration) {
    switch (this.value._tag) {
      case "Infinity":
        return "Infinity"
      case "Nanos":
        return `${this.value.nanos} nanos`
      case "Millis":
        return `${this.value.millis} millis`
    }
  },
  toJSON(this: Duration) {
    switch (this.value._tag) {
      case "Millis":
        return { _id: "Duration", _tag: "Millis", millis: this.value.millis }
      case "Nanos":
        return { _id: "Duration", _tag: "Nanos", nanos: String(this.value.nanos) }
      case "Infinity":
        return { _id: "Duration", _tag: "Infinity" }
    }
  },
  [NodeInspectSymbol]() {
    return this.toJSON()
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
} as const

const make = (input: number | bigint): Duration => {
  const duration = Object.create(DurationProto)
  if (isNumber(input)) {
    if (isNaN(input) || input <= 0) {
      duration.value = zeroDurationValue
    } else if (!Number.isFinite(input)) {
      duration.value = infinityDurationValue
    } else if (!Number.isInteger(input)) {
      duration.value = { _tag: "Nanos", nanos: BigInt(Math.round(input * 1_000_000)) }
    } else {
      duration.value = { _tag: "Millis", millis: input }
    }
  } else if (input <= bigint0) {
    duration.value = zeroDurationValue
  } else {
    duration.value = { _tag: "Nanos", nanos: input }
  }
  return duration
}

/**
 * Checks if a value is a Duration.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * console.log(Duration.isDuration(Duration.seconds(1))) // true
 * console.log(Duration.isDuration(1000)) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isDuration = (u: unknown): u is Duration => hasProperty(u, TypeId)

/**
 * Checks if a Duration is finite (not infinite).
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * console.log(Duration.isFinite(Duration.seconds(5))) // true
 * console.log(Duration.isFinite(Duration.infinity)) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isFinite = (self: Duration): boolean => self.value._tag !== "Infinity"

/**
 * Checks if a Duration is zero.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * console.log(Duration.isZero(Duration.zero)) // true
 * console.log(Duration.isZero(Duration.seconds(1))) // false
 * ```
 *
 * @since 3.5.0
 * @category guards
 */
export const isZero = (self: Duration): boolean => {
  switch (self.value._tag) {
    case "Millis":
      return self.value.millis === 0
    case "Nanos":
      return self.value.nanos === bigint0
    case "Infinity":
      return false
  }
}

/**
 * A Duration representing zero time.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * console.log(Duration.toMillis(Duration.zero)) // 0
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const zero: Duration = make(0)

/**
 * A Duration representing infinite time.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * console.log(Duration.toMillis(Duration.infinity)) // Infinity
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const infinity: Duration = make(Infinity)

/**
 * Creates a Duration from nanoseconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const duration = Duration.nanos(BigInt(500_000_000))
 * console.log(Duration.toMillis(duration)) // 500
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const nanos = (nanos: bigint): Duration => make(nanos)

/**
 * Creates a Duration from microseconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const duration = Duration.micros(BigInt(500_000))
 * console.log(Duration.toMillis(duration)) // 500
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const micros = (micros: bigint): Duration => make(micros * bigint1e3)

/**
 * Creates a Duration from milliseconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const duration = Duration.millis(1000)
 * console.log(Duration.toMillis(duration)) // 1000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const millis = (millis: number): Duration => make(millis)

/**
 * Creates a Duration from seconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const duration = Duration.seconds(30)
 * console.log(Duration.toMillis(duration)) // 30000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const seconds = (seconds: number): Duration => make(seconds * 1000)

/**
 * Creates a Duration from minutes.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const duration = Duration.minutes(5)
 * console.log(Duration.toMillis(duration)) // 300000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const minutes = (minutes: number): Duration => make(minutes * 60_000)

/**
 * Creates a Duration from hours.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const duration = Duration.hours(2)
 * console.log(Duration.toMillis(duration)) // 7200000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const hours = (hours: number): Duration => make(hours * 3_600_000)

/**
 * Creates a Duration from days.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const duration = Duration.days(1)
 * console.log(Duration.toMillis(duration)) // 86400000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const days = (days: number): Duration => make(days * 86_400_000)

/**
 * Creates a Duration from weeks.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const duration = Duration.weeks(1)
 * console.log(Duration.toMillis(duration)) // 604800000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const weeks = (weeks: number): Duration => make(weeks * 604_800_000)

/**
 * Converts a Duration to milliseconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * console.log(Duration.toMillis(Duration.seconds(5))) // 5000
 * console.log(Duration.toMillis(Duration.minutes(2))) // 120000
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const toMillis = (self: Duration): number =>
  match(self, {
    onMillis: identity,
    onNanos: (nanos) => Number(nanos) / 1_000_000,
    onInfinity: () => Infinity
  })

/**
 * Converts a Duration to seconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * console.log(Duration.toSeconds(Duration.millis(5000))) // 5
 * console.log(Duration.toSeconds(Duration.minutes(2))) // 120
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const toSeconds = (self: Duration): number =>
  match(self, {
    onMillis: (millis) => millis / 1_000,
    onNanos: (nanos) => Number(nanos) / 1_000_000_000,
    onInfinity: () => Infinity
  })

/**
 * Converts a Duration to minutes.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * console.log(Duration.toMinutes(Duration.seconds(120))) // 2
 * console.log(Duration.toMinutes(Duration.hours(1))) // 60
 * ```
 *
 * @since 3.8.0
 * @category getters
 */
export const toMinutes = (self: Duration): number =>
  match(self, {
    onMillis: (millis) => millis / 60_000,
    onNanos: (nanos) => Number(nanos) / 60_000_000_000,
    onInfinity: () => Infinity
  })

/**
 * Converts a Duration to hours.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * console.log(Duration.toHours(Duration.minutes(120))) // 2
 * console.log(Duration.toHours(Duration.days(1))) // 24
 * ```
 *
 * @since 3.8.0
 * @category getters
 */
export const toHours = (self: Duration): number =>
  match(self, {
    onMillis: (millis) => millis / 3_600_000,
    onNanos: (nanos) => Number(nanos) / 3_600_000_000_000,
    onInfinity: () => Infinity
  })

/**
 * Converts a Duration to days.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * console.log(Duration.toDays(Duration.hours(48))) // 2
 * console.log(Duration.toDays(Duration.weeks(1))) // 7
 * ```
 *
 * @since 3.8.0
 * @category getters
 */
export const toDays = (self: Duration): number =>
  match(self, {
    onMillis: (millis) => millis / 86_400_000,
    onNanos: (nanos) => Number(nanos) / 86_400_000_000_000,
    onInfinity: () => Infinity
  })

/**
 * Converts a Duration to weeks.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * console.log(Duration.toWeeks(Duration.days(14))) // 2
 * console.log(Duration.toWeeks(Duration.days(7))) // 1
 * ```
 *
 * @since 3.8.0
 * @category getters
 */
export const toWeeks = (self: Duration): number =>
  match(self, {
    onMillis: (millis) => millis / 604_800_000,
    onNanos: (nanos) => Number(nanos) / 604_800_000_000_000,
    onInfinity: () => Infinity
  })

/**
 * Get the duration in nanoseconds as a bigint.
 *
 * If the duration is infinite, it throws an error.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const duration = Duration.seconds(2)
 * const nanos = Duration.toNanosUnsafe(duration)
 * console.log(nanos) // 2000000000n
 *
 * // This will throw an error
 * try {
 *   Duration.toNanosUnsafe(Duration.infinity)
 * } catch (error) {
 *   console.log((error as Error).message) // "Cannot convert infinite duration to nanos"
 * }
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const toNanosUnsafe = (self: Duration): bigint => {
  switch (self.value._tag) {
    case "Infinity":
      throw new Error("Cannot convert infinite duration to nanos")
    case "Nanos":
      return self.value.nanos
    case "Millis":
      return BigInt(Math.round(self.value.millis * 1_000_000))
  }
}

/**
 * Get the duration in nanoseconds as a bigint.
 *
 * If the duration is infinite, returns `undefined`.
 *
 * **Example**
 *
 * ```ts
 * import { Duration } from "effect"
 *
 * Duration.toNanos(Duration.seconds(1)) // 1000000000n
 *
 * Duration.toNanos(Duration.infinity) // undefined
 * ```
 *
 * @category getters
 * @since 4.0.0
 */
export const toNanos: (self: Duration) => bigint | undefined = UndefinedOr.liftThrowable(toNanosUnsafe)

/**
 * Converts a Duration to high-resolution time format [seconds, nanoseconds].
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const duration = Duration.millis(1500)
 * const hrtime = Duration.toHrTime(duration)
 * console.log(hrtime) // [1, 500000000]
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const toHrTime = (self: Duration): [seconds: number, nanos: number] => {
  switch (self.value._tag) {
    case "Infinity":
      return [Infinity, 0]
    case "Nanos":
      return [
        Number(self.value.nanos / bigint1e9),
        Number(self.value.nanos % bigint1e9)
      ]
    case "Millis":
      return [
        Math.floor(self.value.millis / 1000),
        Math.round((self.value.millis % 1000) * 1_000_000)
      ]
  }
}

/**
 * Pattern matches on a Duration, providing different handlers for millis and nanos.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const result = Duration.match(Duration.seconds(5), {
 *   onMillis: (millis) => `${millis} milliseconds`,
 *   onNanos: (nanos) => `${nanos} nanoseconds`,
 *   onInfinity: () => "infinite"
 * })
 * console.log(result) // "5000 milliseconds"
 * ```
 *
 * @since 2.0.0
 * @category pattern matching
 */
export const match: {
  <A, B, C>(
    options: {
      readonly onMillis: (millis: number) => A
      readonly onNanos: (nanos: bigint) => B
      readonly onInfinity: () => C
    }
  ): (self: Duration) => A | B | C
  <A, B, C>(
    self: Duration,
    options: {
      readonly onMillis: (millis: number) => A
      readonly onNanos: (nanos: bigint) => B
      readonly onInfinity: () => C
    }
  ): A | B | C
} = dual(2, <A, B, C>(
  self: Duration,
  options: {
    readonly onMillis: (millis: number) => A
    readonly onNanos: (nanos: bigint) => B
    readonly onInfinity: () => C
  }
): A | B | C => {
  switch (self.value._tag) {
    case "Millis":
      return options.onMillis(self.value.millis)
    case "Nanos":
      return options.onNanos(self.value.nanos)
    case "Infinity":
      return options.onInfinity()
  }
})

/**
 * Pattern matches on two `Duration`s, providing handlers that receive both values.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const sum = Duration.matchPair(Duration.seconds(3), Duration.seconds(2), {
 *   onMillis: (a, b) => a + b,
 *   onNanos: (a, b) => Number(a + b),
 *   onInfinity: () => Infinity
 * })
 * console.log(sum) // 5000
 * ```
 *
 * @since 2.0.0
 * @category pattern matching
 */
export const matchPair: {
  <A, B, C>(
    that: Duration,
    options: {
      readonly onMillis: (self: number, that: number) => A
      readonly onNanos: (self: bigint, that: bigint) => B
      readonly onInfinity: (self: Duration, that: Duration) => C
    }
  ): (self: Duration) => A | B | C
  <A, B, C>(
    self: Duration,
    that: Duration,
    options: {
      readonly onMillis: (self: number, that: number) => A
      readonly onNanos: (self: bigint, that: bigint) => B
      readonly onInfinity: (self: Duration, that: Duration) => C
    }
  ): A | B | C
} = dual(3, <A, B, C>(
  self: Duration,
  that: Duration,
  options: {
    readonly onMillis: (self: number, that: number) => A
    readonly onNanos: (self: bigint, that: bigint) => B
    readonly onInfinity: (self: Duration, that: Duration) => C
  }
): A | B | C => {
  if (self.value._tag === "Infinity" || that.value._tag === "Infinity") return options.onInfinity(self, that)
  if (self.value._tag === "Millis") {
    return that.value._tag === "Millis"
      ? options.onMillis(self.value.millis, that.value.millis)
      : options.onNanos(toNanosUnsafe(self), that.value.nanos)
  } else {
    return options.onNanos(self.value.nanos, toNanosUnsafe(that))
  }
})

/**
 * Order instance for `Duration`, allowing comparison operations.
 *
 * Two infinite durations are considered equivalent (`0`).
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const durations = [
 *   Duration.seconds(3),
 *   Duration.seconds(1),
 *   Duration.seconds(2)
 * ]
 * const sorted = durations.sort((a, b) => Duration.Order(a, b))
 * console.log(sorted.map(Duration.toSeconds)) // [1, 2, 3]
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const Order: order.Order<Duration> = order.make((self, that) =>
  matchPair(self, that, {
    onMillis: (self, that) => (self < that ? -1 : self > that ? 1 : 0),
    onNanos: (self, that) => (self < that ? -1 : self > that ? 1 : 0),
    onInfinity: (self, that) => {
      switch (self.value._tag) {
        case "Infinity":
          return that.value._tag === "Infinity" ? 0 : 1
        case "Millis":
        case "Nanos":
          return -1
      }
    }
  })
)

/**
 * Checks if a `Duration` is between a `minimum` and `maximum` value.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const isInRange = Duration.between(Duration.seconds(3), {
 *   minimum: Duration.seconds(2),
 *   maximum: Duration.seconds(5)
 * })
 * console.log(isInRange) // true
 * ```
 *
 * @category predicates
 * @since 2.0.0
 */
export const between: {
  (options: { minimum: Duration; maximum: Duration }): (self: Duration) => boolean
  (self: Duration, options: { minimum: Duration; maximum: Duration }): boolean
} = order.isBetween(Order)

/**
 * Equivalence instance for `Duration`, allowing equality comparisons.
 *
 * Two infinite durations are considered equivalent.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const isEqual = Duration.Equivalence(Duration.seconds(5), Duration.millis(5000))
 * console.log(isEqual) // true
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const Equivalence: equivalence.Equivalence<Duration> = (self, that) =>
  matchPair(self, that, {
    onMillis: (self, that) => self === that,
    onNanos: (self, that) => self === that,
    onInfinity: (self, that) => self.value._tag === that.value._tag
  })

/**
 * Returns the smaller of two Durations.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const shorter = Duration.min(Duration.seconds(5), Duration.seconds(3))
 * console.log(Duration.toSeconds(shorter)) // 3
 * ```
 *
 * @since 2.0.0
 * @category order
 */
export const min: {
  (that: Duration): (self: Duration) => Duration
  (self: Duration, that: Duration): Duration
} = order.min(Order)

/**
 * Returns the larger of two Durations.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const longer = Duration.max(Duration.seconds(5), Duration.seconds(3))
 * console.log(Duration.toSeconds(longer)) // 5
 * ```
 *
 * @since 2.0.0
 * @category order
 */
export const max: {
  (that: Duration): (self: Duration) => Duration
  (self: Duration, that: Duration): Duration
} = order.max(Order)

/**
 * Clamps a Duration between a minimum and maximum value.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const clamped = Duration.clamp(Duration.seconds(10), {
 *   minimum: Duration.seconds(2),
 *   maximum: Duration.seconds(5)
 * })
 * console.log(Duration.toSeconds(clamped)) // 5
 * ```
 *
 * @since 2.0.0
 * @category order
 */
export const clamp: {
  (options: { minimum: Duration; maximum: Duration }): (self: Duration) => Duration
  (self: Duration, options: { minimum: Duration; maximum: Duration }): Duration
} = order.clamp(Order)

/**
 * Divides a Duration by a number, returning `undefined` if division is invalid.
 *
 * **Example**
 *
 * ```ts
 * import { Duration } from "effect"
 *
 * const d = Duration.divide(Duration.seconds(10), 2)
 * console.log(d?.pipe(Duration.toSeconds)) // 5
 *
 * Duration.divide(Duration.seconds(10), 0) // undefined
 * ```
 *
 * @since 4.0.0
 * @category math
 */
export const divide: {
  (by: number): (self: Duration) => Duration | undefined
  (self: Duration, by: number): Duration | undefined
} = dual(
  2,
  (self: Duration, by: number): Duration | undefined => {
    if (!Number.isFinite(by)) return undefined
    return match(self, {
      onMillis: (millis) => {
        if (by === 0) return undefined
        return make(millis / by)
      },
      onNanos: (nanos) => {
        if (by <= 0) return undefined
        try {
          return make(nanos / BigInt(by))
        } catch {
          return undefined
        }
      },
      onInfinity: () => infinity
    })
  }
)

/**
 * Divides a Duration by a number, potentially returning infinity or zero.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const half = Duration.divideUnsafe(Duration.seconds(10), 2)
 * console.log(Duration.toSeconds(half)) // 5
 *
 * const infinite = Duration.divideUnsafe(Duration.seconds(10), 0)
 * console.log(Duration.toMillis(infinite)) // Infinity
 * ```
 *
 * @since 2.4.19
 * @category math
 */
export const divideUnsafe: {
  (by: number): (self: Duration) => Duration
  (self: Duration, by: number): Duration
} = dual(
  2,
  (self: Duration, by: number): Duration => {
    if (!Number.isFinite(by)) return zero
    return match(self, {
      onMillis: (millis) => make(millis / by),
      onNanos: (nanos) => {
        if (by < 0 || Object.is(by, -0)) return zero
        if (Object.is(by, 0)) return infinity
        return make(nanos / BigInt(by))
      },
      onInfinity: () => infinity
    })
  }
)

/**
 * Multiplies a Duration by a number.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const doubled = Duration.times(Duration.seconds(5), 2)
 * console.log(Duration.toSeconds(doubled)) // 10
 * ```
 *
 * @since 2.0.0
 * @category math
 */
export const times: {
  (times: number): (self: Duration) => Duration
  (self: Duration, times: number): Duration
} = dual(
  2,
  (self: Duration, times: number): Duration =>
    match(self, {
      onMillis: (millis) => make(millis * times),
      onNanos: (nanos) => make(nanos * BigInt(times)),
      onInfinity: () => infinity
    })
)

/**
 * Subtracts one Duration from another.
 *
 * **Infinity Subtraction Rules**
 * - infinity - infinity = 0
 * - infinity - millis = infinity
 * - infinity - nanos = infinity
 * - millis - infinity = 0
 * - nanos - infinity = 0
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const result = Duration.subtract(Duration.seconds(10), Duration.seconds(3))
 * console.log(Duration.toSeconds(result)) // 7
 * ```
 *
 * @since 2.0.0
 * @category math
 */
export const subtract: {
  (that: Duration): (self: Duration) => Duration
  (self: Duration, that: Duration): Duration
} = dual(
  2,
  (self: Duration, that: Duration): Duration =>
    matchPair(self, that, {
      onMillis: (self, that) => make(self - that),
      onNanos: (self, that) => make(self - that),
      onInfinity: (self, that) => {
        switch (self.value._tag) {
          case "Infinity":
            return that.value._tag === "Infinity" ? zero : self
          case "Millis":
          case "Nanos":
            return zero
        }
      }
    })
)

/**
 * Adds two Durations together.
 *
 * **Infinity Addition Rules**
 * - infinity + `*` = infinity
 * - `*` + infinity = infinity
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const total = Duration.sum(Duration.seconds(5), Duration.seconds(3))
 * console.log(Duration.toSeconds(total)) // 8
 * ```
 *
 * @since 2.0.0
 * @category math
 */
export const sum: {
  (that: Duration): (self: Duration) => Duration
  (self: Duration, that: Duration): Duration
} = dual(
  2,
  (self: Duration, that: Duration): Duration =>
    matchPair(self, that, {
      onMillis: (self, that) => make(self + that),
      onNanos: (self, that) => make(self + that),
      onInfinity: () => infinity
    })
)

/**
 * Checks if the first Duration is less than the second.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const isLess = Duration.isLessThan(Duration.seconds(3), Duration.seconds(5))
 * console.log(isLess) // true
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const isLessThan: {
  (that: Duration): (self: Duration) => boolean
  (self: Duration, that: Duration): boolean
} = order.isLessThan(Order)

/**
 * Checks if the first Duration is less than or equal to the second.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const isLessOrEqual = Duration.isLessThanOrEqualTo(
 *   Duration.seconds(5),
 *   Duration.seconds(5)
 * )
 * console.log(isLessOrEqual) // true
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const isLessThanOrEqualTo: {
  (that: Duration): (self: Duration) => boolean
  (self: Duration, that: Duration): boolean
} = order.isLessThanOrEqualTo(Order)

/**
 * Checks if the first Duration is greater than the second.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const isGreater = Duration.isGreaterThan(Duration.seconds(5), Duration.seconds(3))
 * console.log(isGreater) // true
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const isGreaterThan: {
  (that: Duration): (self: Duration) => boolean
  (self: Duration, that: Duration): boolean
} = order.isGreaterThan(Order)

/**
 * Checks if the first Duration is greater than or equal to the second.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const isGreaterOrEqual = Duration.isGreaterThanOrEqualTo(
 *   Duration.seconds(5),
 *   Duration.seconds(5)
 * )
 * console.log(isGreaterOrEqual) // true
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const isGreaterThanOrEqualTo: {
  (that: Duration): (self: Duration) => boolean
  (self: Duration, that: Duration): boolean
} = order.isGreaterThanOrEqualTo(Order)

/**
 * Checks if two Durations are equal.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * const isEqual = Duration.equals(Duration.seconds(5), Duration.millis(5000))
 * console.log(isEqual) // true
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const equals: {
  (that: Duration): (self: Duration) => boolean
  (self: Duration, that: Duration): boolean
} = dual(2, (self: Duration, that: Duration): boolean => Equivalence(self, that))

/**
 * Converts a `Duration` to its parts.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * // Create a complex duration by adding multiple parts
 * const duration = Duration.sum(
 *   Duration.sum(
 *     Duration.sum(Duration.days(1), Duration.hours(2)),
 *     Duration.sum(Duration.minutes(30), Duration.seconds(45))
 *   ),
 *   Duration.millis(123)
 * )
 * const components = Duration.parts(duration)
 * console.log(components)
 * // {
 * //   days: 1,
 * //   hours: 2,
 * //   minutes: 30,
 * //   seconds: 45,
 * //   millis: 123,
 * //   nanos: 0
 * // }
 *
 * const complex = Duration.sum(Duration.hours(25), Duration.minutes(90))
 * const complexParts = Duration.parts(complex)
 * console.log(complexParts)
 * // {
 * //   days: 1,
 * //   hours: 2,
 * //   minutes: 30,
 * //   seconds: 0,
 * //   millis: 0,
 * //   nanos: 0
 * // }
 * ```
 *
 * @since 3.8.0
 * @category conversions
 */
export const parts = (self: Duration): {
  days: number
  hours: number
  minutes: number
  seconds: number
  millis: number
  nanos: number
} => {
  if (self.value._tag === "Infinity") {
    return {
      days: Infinity,
      hours: Infinity,
      minutes: Infinity,
      seconds: Infinity,
      millis: Infinity,
      nanos: Infinity
    }
  }

  const nanos = toNanosUnsafe(self)
  const ms = nanos / bigint1e6
  const sec = ms / bigint1e3
  const min = sec / bigint60
  const hr = min / bigint60
  const days = hr / bigint24

  return {
    days: Number(days),
    hours: Number(hr % bigint24),
    minutes: Number(min % bigint60),
    seconds: Number(sec % bigint60),
    millis: Number(ms % bigint1e3),
    nanos: Number(nanos % bigint1e6)
  }
}

/**
 * Converts a `Duration` to a human readable string.
 *
 * @since 2.0.0
 * @category conversions
 * @example
 * ```ts
 * import { Duration } from "effect"
 *
 * Duration.format(Duration.millis(1000)) // "1s"
 * Duration.format(Duration.millis(1001)) // "1s 1ms"
 * ```
 */
export const format = (self: Duration): string => {
  if (self.value._tag === "Infinity") {
    return "Infinity"
  }
  if (isZero(self)) {
    return "0"
  }

  const fragments = parts(self)
  const pieces = []
  if (fragments.days !== 0) {
    pieces.push(`${fragments.days}d`)
  }

  if (fragments.hours !== 0) {
    pieces.push(`${fragments.hours}h`)
  }

  if (fragments.minutes !== 0) {
    pieces.push(`${fragments.minutes}m`)
  }

  if (fragments.seconds !== 0) {
    pieces.push(`${fragments.seconds}s`)
  }

  if (fragments.millis !== 0) {
    pieces.push(`${fragments.millis}ms`)
  }

  if (fragments.nanos !== 0) {
    pieces.push(`${fragments.nanos}ns`)
  }

  return pieces.join(" ")
}

/**
 * A `Reducer` for summing `Duration`s.
 *
 * @since 4.0.0
 */
export const ReducerSum: Reducer.Reducer<Duration> = Reducer.make(sum, zero)

/**
 * A `Combiner` that returns the maximum `Duration`.
 *
 * @since 4.0.0
 */
export const CombinerMax: Combiner.Combiner<Duration> = Combiner.max(Order)

/**
 * A `Combiner` that returns the minimum `Duration`.
 *
 * @since 4.0.0
 */
export const CombinerMin: Combiner.Combiner<Duration> = Combiner.min(Order)
