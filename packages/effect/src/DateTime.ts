/**
 * @since 3.6.0
 */
import type { IllegalArgumentError } from "./Cause.js"
import type * as Duration from "./Duration.js"
import * as Effect from "./Effect.js"
import type * as equivalence from "./Equivalence.js"
import { dual, type LazyArg } from "./Function.js"
import type { Inspectable } from "./Inspectable.js"
import * as Internal from "./internal/dateTime.js"
import { provideService } from "./internal/effect.js"
import * as Layer from "./Layer.js"
import type * as Option from "./Option.js"
import type * as order from "./Order.js"
import type { Pipeable } from "./Pipeable.js"
import type * as Result from "./Result.js"
import * as ServiceMap from "./ServiceMap.js"

/**
 * @since 3.6.0
 * @category type ids
 */
export const TypeId: TypeId = Internal.TypeId

/**
 * @since 3.6.0
 * @category type ids
 */
export type TypeId = "~effect/DateTime"

/**
 * A `DateTime` represents a point in time. It can optionally have a time zone
 * associated with it.
 *
 * @since 3.6.0
 * @category models
 */
export type DateTime = Utc | Zoned

/**
 * @since 3.6.0
 * @category models
 */
export interface Utc extends DateTime.Proto {
  readonly _tag: "Utc"
  readonly epochMillis: number
  partsUtc: DateTime.PartsWithWeekday | undefined
}

/**
 * @since 3.6.0
 * @category models
 */
export interface Zoned extends DateTime.Proto {
  readonly _tag: "Zoned"
  readonly epochMillis: number
  readonly zone: TimeZone
  adjustedEpochMillis: number | undefined
  partsAdjusted: DateTime.PartsWithWeekday | undefined
  partsUtc: DateTime.PartsWithWeekday | undefined
}

/**
 * @since 3.6.0
 * @category models
 */
export declare namespace DateTime {
  /**
   * @since 3.6.0
   * @category models
   */
  export type Input = DateTime | Partial<Parts> | Date | number | string

  /**
   * @since 3.6.0
   * @category models
   */
  export type PreserveZone<A extends DateTime.Input> = A extends Zoned ? Zoned : Utc

  /**
   * @since 3.6.0
   * @category models
   */
  export type Unit = UnitSingular | UnitPlural

  /**
   * @since 3.6.0
   * @category models
   */
  export type UnitSingular =
    | "milli"
    | "second"
    | "minute"
    | "hour"
    | "day"
    | "week"
    | "month"
    | "year"

  /**
   * @since 3.6.0
   * @category models
   */
  export type UnitPlural =
    | "millis"
    | "seconds"
    | "minutes"
    | "hours"
    | "days"
    | "weeks"
    | "months"
    | "years"

  /**
   * @since 3.6.0
   * @category models
   */
  export interface PartsWithWeekday {
    readonly millis: number
    readonly seconds: number
    readonly minutes: number
    readonly hours: number
    readonly day: number
    readonly weekDay: number
    readonly month: number
    readonly year: number
  }

  /**
   * @since 3.6.0
   * @category models
   */
  export interface Parts {
    readonly millis: number
    readonly seconds: number
    readonly minutes: number
    readonly hours: number
    readonly day: number
    readonly month: number
    readonly year: number
  }

  /**
   * @since 3.6.0
   * @category models
   */
  export interface PartsForMath {
    readonly millis: number
    readonly seconds: number
    readonly minutes: number
    readonly hours: number
    readonly days: number
    readonly weeks: number
    readonly months: number
    readonly years: number
  }

  /**
   * @since 3.6.0
   * @category models
   */
  export interface Proto extends Pipeable, Inspectable {
    readonly [TypeId]: TypeId
  }
}

/**
 * @since 3.6.0
 * @category type ids
 */
export const TimeZoneTypeId: TimeZoneTypeId = Internal.TimeZoneTypeId

/**
 * @since 3.6.0
 * @category type ids
 */
export type TimeZoneTypeId = "~effect/DateTime/TimeZone"

/**
 * @since 3.6.0
 * @category models
 */
export type TimeZone = TimeZone.Offset | TimeZone.Named

/**
 * @since 3.6.0
 * @category models
 */
export declare namespace TimeZone {
  /**
   * @since 3.6.0
   * @category models
   */
  export interface Proto extends Inspectable {
    readonly [TimeZoneTypeId]: TimeZoneTypeId
  }

  /**
   * @since 3.6.0
   * @category models
   */
  export interface Offset extends Proto {
    readonly _tag: "Offset"
    readonly offset: number
  }

  /**
   * @since 3.6.0
   * @category models
   */
  export interface Named extends Proto {
    readonly _tag: "Named"
    readonly id: string
    /** @internal */
    readonly format: Intl.DateTimeFormat
  }
}

// =============================================================================
// guards
// =============================================================================

/**
 * Checks if a value is a `DateTime`.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * console.log(DateTime.isDateTime(DateTime.unsafeNow())) // true
 * console.log(DateTime.isDateTime(new Date())) // false
 * console.log(DateTime.isDateTime("2024-01-01")) // false
 * ```
 *
 * @category guards
 * @since 3.6.0
 */
export const isDateTime: (u: unknown) => u is DateTime = Internal.isDateTime

/**
 * Checks if a value is a `TimeZone`.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const zone = DateTime.zoneMakeOffset(3 * 60 * 60 * 1000)
 * console.log(DateTime.isTimeZone(zone)) // true
 * console.log(DateTime.isTimeZone("UTC")) // false
 * ```
 *
 * @category guards
 * @since 3.6.0
 */
export const isTimeZone: (u: unknown) => u is TimeZone = Internal.isTimeZone

/**
 * Checks if a value is an offset-based `TimeZone`.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const offsetZone = DateTime.zoneMakeOffset(3 * 60 * 60 * 1000)
 * const namedZone = DateTime.zoneUnsafeMakeNamed("Europe/London")
 *
 * console.log(DateTime.isTimeZoneOffset(offsetZone)) // true
 * console.log(DateTime.isTimeZoneOffset(namedZone)) // false
 * ```
 *
 * @category guards
 * @since 3.6.0
 */
export const isTimeZoneOffset: (u: unknown) => u is TimeZone.Offset = Internal.isTimeZoneOffset

/**
 * Checks if a value is a named `TimeZone` (IANA time zone).
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const offsetZone = DateTime.zoneMakeOffset(3 * 60 * 60 * 1000)
 * const namedZone = DateTime.zoneUnsafeMakeNamed("Europe/London")
 *
 * console.log(DateTime.isTimeZoneNamed(offsetZone)) // false
 * console.log(DateTime.isTimeZoneNamed(namedZone)) // true
 * ```
 *
 * @category guards
 * @since 3.6.0
 */
export const isTimeZoneNamed: (u: unknown) => u is TimeZone.Named = Internal.isTimeZoneNamed

/**
 * Checks if a `DateTime` is a UTC `DateTime` (no time zone information).
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const utc = DateTime.unsafeNow()
 * const zoned = DateTime.unsafeMakeZoned(new Date(), { timeZone: "Europe/London" })
 *
 * console.log(DateTime.isUtc(utc)) // true
 * console.log(DateTime.isUtc(zoned)) // false
 * ```
 *
 * @category guards
 * @since 3.6.0
 */
export const isUtc: (self: DateTime) => self is Utc = Internal.isUtc

/**
 * Checks if a `DateTime` is a zoned `DateTime` (has time zone information).
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const utc = DateTime.unsafeNow()
 * const zoned = DateTime.unsafeMakeZoned(new Date(), { timeZone: "Europe/London" })
 *
 * console.log(DateTime.isZoned(utc)) // false
 * console.log(DateTime.isZoned(zoned)) // true
 * ```
 *
 * @category guards
 * @since 3.6.0
 */
export const isZoned: (self: DateTime) => self is Zoned = Internal.isZoned

// =============================================================================
// instances
// =============================================================================

/**
 * An `Equivalence` for comparing two `DateTime` values for equality.
 *
 * Two `DateTime` values are considered equivalent if they represent the same
 * point in time, regardless of their time zone.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const utc = DateTime.unsafeMake("2024-01-01T12:00:00Z")
 * const zoned = DateTime.unsafeMakeZoned("2024-01-01T12:00:00Z", {
 *   timeZone: "Europe/London"
 * })
 *
 * console.log(DateTime.Equivalence(utc, zoned)) // true
 * ```
 *
 * @category instances
 * @since 3.6.0
 */
export const Equivalence: equivalence.Equivalence<DateTime> = Internal.Equivalence

/**
 * An `Order` for comparing and sorting `DateTime` values.
 *
 * `DateTime` values are ordered by their epoch milliseconds, so earlier times
 * come before later times regardless of time zone.
 *
 * @example
 * ```ts
 * import { DateTime, Array } from "effect"
 *
 * const dates = [
 *   DateTime.unsafeMake("2024-03-01"),
 *   DateTime.unsafeMake("2024-01-01"),
 *   DateTime.unsafeMake("2024-02-01")
 * ]
 *
 * const sorted = Array.sort(dates, DateTime.Order)
 * // Results in chronological order: 2024-01-01, 2024-02-01, 2024-03-01
 * ```
 *
 * @category instances
 * @since 3.6.0
 */
export const Order: order.Order<DateTime> = Internal.Order

/**
 * Clamp a `DateTime` between a minimum and maximum value.
 *
 * If the `DateTime` is before the minimum, the minimum is returned.
 * If the `DateTime` is after the maximum, the maximum is returned.
 * Otherwise, the original `DateTime` is returned.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const min = DateTime.unsafeMake("2024-01-01")
 * const max = DateTime.unsafeMake("2024-12-31")
 * const date = DateTime.unsafeMake("2025-06-15")
 *
 * const clamped = DateTime.clamp(date, { minimum: min, maximum: max })
 * // clamped equals max (2024-12-31)
 * ```
 *
 * @category instances
 * @since 3.6.0
 */
export const clamp: {
  <Min extends DateTime, Max extends DateTime>(
    options: { readonly minimum: Min; readonly maximum: Max }
  ): <A extends DateTime>(self: A) => A | Min | Max
  <A extends DateTime, Min extends DateTime, Max extends DateTime>(
    self: A,
    options: { readonly minimum: Min; readonly maximum: Max }
  ): A | Min | Max
} = Internal.clamp

// =============================================================================
// constructors
// =============================================================================

/**
 * Create a `DateTime` from a `Date`.
 *
 * If the `Date` is invalid, an `IllegalArgumentError` will be thrown.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const date = new Date("2024-01-01T12:00:00Z")
 * const dateTime = DateTime.unsafeFromDate(date)
 *
 * console.log(DateTime.formatIso(dateTime)) // "2024-01-01T12:00:00.000Z"
 * ```
 *
 * @category constructors
 * @since 3.6.0
 */
export const unsafeFromDate: (date: Date) => Utc = Internal.unsafeFromDate

/**
 * Create a `DateTime` from one of the following:
 *
 * - A `DateTime`
 * - A `Date` instance (invalid dates will throw an `IllegalArgumentError`)
 * - The `number` of milliseconds since the Unix epoch
 * - An object with the parts of a date
 * - A `string` that can be parsed by `Date.parse`
 *
 * @since 3.6.0
 * @category constructors
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // from Date
 * DateTime.unsafeMake(new Date())
 *
 * // from parts
 * DateTime.unsafeMake({ year: 2024 })
 *
 * // from string
 * DateTime.unsafeMake("2024-01-01")
 * ```
 */
export const unsafeMake: <A extends DateTime.Input>(input: A) => DateTime.PreserveZone<A> = Internal.unsafeMake

/**
 * Create a `DateTime.Zoned` using `DateTime.unsafeMake` and a time zone.
 *
 * The input is treated as UTC and then the time zone is attached, unless
 * `adjustForTimeZone` is set to `true`. In that case, the input is treated as
 * already in the time zone.
 *
 * @since 3.6.0
 * @category constructors
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * DateTime.unsafeMakeZoned(new Date(), { timeZone: "Europe/London" })
 * ```
 */
export const unsafeMakeZoned: (input: DateTime.Input, options?: {
  readonly timeZone?: number | string | TimeZone | undefined
  readonly adjustForTimeZone?: boolean | undefined
}) => Zoned = Internal.unsafeMakeZoned

/**
 * Create a `DateTime.Zoned` using `DateTime.make` and a time zone.
 *
 * The input is treated as UTC and then the time zone is attached.
 *
 * If the date time input or time zone is invalid, `None` will be returned.
 *
 * @since 3.6.0
 * @category constructors
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * DateTime.makeZoned(new Date(), { timeZone: "Europe/London" })
 * ```
 */
export const makeZoned: (
  input: DateTime.Input,
  options?: {
    readonly timeZone?: number | string | TimeZone | undefined
    readonly adjustForTimeZone?: boolean | undefined
  }
) => Option.Option<Zoned> = Internal.makeZoned

/**
 * Create a `DateTime` from one of the following:
 *
 * - A `DateTime`
 * - A `Date` instance (invalid dates will throw an `IllegalArgumentError`)
 * - The `number` of milliseconds since the Unix epoch
 * - An object with the parts of a date
 * - A `string` that can be parsed by `Date.parse`
 *
 * If the input is invalid, `None` will be returned.
 *
 * @since 3.6.0
 * @category constructors
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // from Date
 * DateTime.make(new Date())
 *
 * // from parts
 * DateTime.make({ year: 2024 })
 *
 * // from string
 * DateTime.make("2024-01-01")
 * ```
 */
export const make: <A extends DateTime.Input>(input: A) => Option.Option<DateTime.PreserveZone<A>> = Internal.make

/**
 * Create a `DateTime.Zoned` from a string.
 *
 * It uses the format: `YYYY-MM-DDTHH:mm:ss.sss+HH:MM[Time/Zone]`.
 *
 * @since 3.6.0
 * @category constructors
 */
export const makeZonedFromString: (input: string) => Option.Option<Zoned> = Internal.makeZonedFromString

/**
 * Get the current time using the `Clock` service and convert it to a `DateTime`.
 *
 * @since 3.6.0
 * @category constructors
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   const now = yield* DateTime.now
 * })
 * ```
 */
export const now: Effect.Effect<Utc> = Internal.now

/**
 * Get the current time using `Date.now`.
 *
 * This is a synchronous version of `now` that directly uses `Date.now()`
 * instead of the Effect `Clock` service.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const now = DateTime.unsafeNow()
 * console.log(DateTime.formatIso(now))
 * ```
 *
 * @category constructors
 * @since 3.6.0
 */
export const unsafeNow: LazyArg<Utc> = Internal.unsafeNow

// =============================================================================
// time zones
// =============================================================================

/**
 * Set the time zone of a `DateTime`, returning a new `DateTime.Zoned`.
 *
 * @since 3.6.0
 * @category time zones
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   const now = yield* DateTime.now
 *   const zone = DateTime.zoneUnsafeMakeNamed("Europe/London")
 *
 *   // set the time zone
 *   const zoned: DateTime.Zoned = DateTime.setZone(now, zone)
 * })
 * ```
 */
export const setZone: {
  (zone: TimeZone, options?: {
    readonly adjustForTimeZone?: boolean | undefined
  }): (self: DateTime) => Zoned
  (self: DateTime, zone: TimeZone, options?: {
    readonly adjustForTimeZone?: boolean | undefined
  }): Zoned
} = Internal.setZone

/**
 * Add a fixed offset time zone to a `DateTime`.
 *
 * The offset is in milliseconds.
 *
 * @since 3.6.0
 * @category time zones
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   const now = yield* DateTime.now
 *
 *   // set the offset time zone in milliseconds
 *   const zoned: DateTime.Zoned = DateTime.setZoneOffset(now, 3 * 60 * 60 * 1000)
 * })
 * ```
 */
export const setZoneOffset: {
  (offset: number, options?: {
    readonly adjustForTimeZone?: boolean | undefined
  }): (self: DateTime) => Zoned
  (self: DateTime, offset: number, options?: {
    readonly adjustForTimeZone?: boolean | undefined
  }): Zoned
} = Internal.setZoneOffset

/**
 * Attempt to create a named time zone from a IANA time zone identifier.
 *
 * If the time zone is invalid, an `IllegalArgumentError` will be thrown.
 *
 * @since 3.6.0
 * @category time zones
 */
export const zoneUnsafeMakeNamed: (zoneId: string) => TimeZone.Named = Internal.zoneUnsafeMakeNamed

/**
 * Create a fixed offset time zone.
 *
 * The offset is specified in milliseconds from UTC. Positive values are
 * ahead of UTC, negative values are behind UTC.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // Create a time zone with +3 hours offset
 * const zone = DateTime.zoneMakeOffset(3 * 60 * 60 * 1000)
 *
 * const dt = DateTime.unsafeMakeZoned("2024-01-01T12:00:00Z", {
 *   timeZone: zone
 * })
 * ```
 *
 * @category time zones
 * @since 3.6.0
 */
export const zoneMakeOffset: (offset: number) => TimeZone.Offset = Internal.zoneMakeOffset

/**
 * Create a named time zone from a IANA time zone identifier.
 *
 * If the time zone is invalid, `None` will be returned.
 *
 * @example
 * ```ts
 * import { DateTime, Option } from "effect"
 *
 * const validZone = DateTime.zoneMakeNamed("Europe/London")
 * console.log(Option.isSome(validZone)) // true
 *
 * const invalidZone = DateTime.zoneMakeNamed("Invalid/Zone")
 * console.log(Option.isNone(invalidZone)) // true
 * ```
 *
 * @category time zones
 * @since 3.6.0
 */
export const zoneMakeNamed: (zoneId: string) => Option.Option<TimeZone.Named> = Internal.zoneMakeNamed

/**
 * Create a named time zone from a IANA time zone identifier.
 *
 * If the time zone is invalid, it will fail with an `IllegalArgumentError`.
 *
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const zone = yield* DateTime.zoneMakeNamedEffect("Europe/London")
 *   const now = yield* DateTime.now
 *   return DateTime.setZone(now, zone)
 * })
 * ```
 *
 * @category time zones
 * @since 3.6.0
 */
export const zoneMakeNamedEffect: (zoneId: string) => Effect.Effect<TimeZone.Named, IllegalArgumentError> =
  Internal.zoneMakeNamedEffect

/**
 * Create a named time zone from the system's local time zone.
 *
 * This uses the system's configured time zone, which may vary depending
 * on the runtime environment.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const localZone = DateTime.zoneMakeLocal()
 * const now = DateTime.unsafeNow()
 * const localTime = DateTime.setZone(now, localZone)
 *
 * console.log(DateTime.formatIsoZoned(localTime))
 * ```
 *
 * @category time zones
 * @since 3.6.0
 */
export const zoneMakeLocal: () => TimeZone.Named = Internal.zoneMakeLocal

/**
 * Try to parse a `TimeZone` from a string.
 *
 * Supports both IANA time zone identifiers and offset formats like "+03:00".
 *
 * @example
 * ```ts
 * import { DateTime, Option } from "effect"
 *
 * const namedZone = DateTime.zoneFromString("Europe/London")
 * const offsetZone = DateTime.zoneFromString("+03:00")
 * const invalid = DateTime.zoneFromString("invalid")
 *
 * console.log(Option.isSome(namedZone)) // true
 * console.log(Option.isSome(offsetZone)) // true
 * console.log(Option.isNone(invalid)) // true
 * ```
 *
 * @category time zones
 * @since 3.6.0
 */
export const zoneFromString: (zone: string) => Option.Option<TimeZone> = Internal.zoneFromString

/**
 * Format a `TimeZone` as a string.
 *
 * @since 3.6.0
 * @category time zones
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * // Outputs "+03:00"
 * DateTime.zoneToString(DateTime.zoneMakeOffset(3 * 60 * 60 * 1000))
 *
 * // Outputs "Europe/London"
 * DateTime.zoneToString(DateTime.zoneUnsafeMakeNamed("Europe/London"))
 * ```
 */
export const zoneToString: (self: TimeZone) => string = Internal.zoneToString

/**
 * Set the time zone of a `DateTime` from an IANA time zone identifier. If the
 * time zone is invalid, `None` will be returned.
 *
 * @since 3.6.0
 * @category time zones
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   const now = yield* DateTime.now
 *   // set the time zone, returns an Option
 *   DateTime.setZoneNamed(now, "Europe/London")
 * })
 * ```
 */
export const setZoneNamed: {
  (zoneId: string, options?: {
    readonly adjustForTimeZone?: boolean | undefined
  }): (self: DateTime) => Option.Option<Zoned>
  (self: DateTime, zoneId: string, options?: {
    readonly adjustForTimeZone?: boolean | undefined
  }): Option.Option<Zoned>
} = Internal.setZoneNamed

/**
 * Set the time zone of a `DateTime` from an IANA time zone identifier. If the
 * time zone is invalid, an `IllegalArgumentError` will be thrown.
 *
 * @since 3.6.0
 * @category time zones
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   const now = yield* DateTime.now
 *   // set the time zone
 *   DateTime.unsafeSetZoneNamed(now, "Europe/London")
 * })
 * ```
 */
export const unsafeSetZoneNamed: {
  (zoneId: string, options?: {
    readonly adjustForTimeZone?: boolean | undefined
  }): (self: DateTime) => Zoned
  (self: DateTime, zoneId: string, options?: {
    readonly adjustForTimeZone?: boolean | undefined
  }): Zoned
} = Internal.unsafeSetZoneNamed

// =============================================================================
// comparisons
// =============================================================================

/**
 * Calulate the difference between two `DateTime` values, returning the number
 * of milliseconds the `other` DateTime is from `self`.
 *
 * If `other` is *after* `self`, the result will be a positive number.
 *
 * @since 3.6.0
 * @category comparisons
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   const now = yield* DateTime.now
 *   const other = DateTime.add(now, { minutes: 1 })
 *
 *   // returns 60000
 *   DateTime.distance(now, other)
 * })
 * ```
 */
export const distance: {
  (other: DateTime): (self: DateTime) => number
  (self: DateTime, other: DateTime): number
} = Internal.distance

/**
 * Calulate the difference between two `DateTime` values.
 *
 * If the `other` DateTime is before `self`, the result will be a negative
 * `Duration`, returned as a `Err`.
 *
 * If the `other` DateTime is after `self`, the result will be a positive
 * `Duration`, returned as a `Ok`.
 *
 * @since 3.6.0
 * @category comparisons
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   const now = yield* DateTime.now
 *   const other = DateTime.add(now, { minutes: 1 })
 *
 *   // returns Result.succeed(Duration.minutes(1))
 *   DateTime.distanceDurationResult(now, other)
 *
 *   // returns Result.fail(Duration.minutes(1))
 *   DateTime.distanceDurationResult(other, now)
 * })
 * ```
 */
export const distanceDurationResult: {
  (other: DateTime): (self: DateTime) => Result.Result<Duration.Duration, Duration.Duration>
  (self: DateTime, other: DateTime): Result.Result<Duration.Duration, Duration.Duration>
} = Internal.distanceDurationResult

/**
 * Calulate the distance between two `DateTime` values.
 *
 * @since 3.6.0
 * @category comparisons
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   const now = yield* DateTime.now
 *   const other = DateTime.add(now, { minutes: 1 })
 *
 *   // returns Duration.minutes(1)
 *   DateTime.distanceDuration(now, other)
 * })
 * ```
 */
export const distanceDuration: {
  (other: DateTime): (self: DateTime) => Duration.Duration
  (self: DateTime, other: DateTime): Duration.Duration
} = Internal.distanceDuration

/**
 * Returns the earlier of two `DateTime` values.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const date1 = DateTime.unsafeMake("2024-01-01")
 * const date2 = DateTime.unsafeMake("2024-02-01")
 *
 * const earlier = DateTime.min(date1, date2)
 * // earlier equals date1 (2024-01-01)
 * ```
 *
 * @category comparisons
 * @since 3.6.0
 */
export const min: {
  <That extends DateTime>(that: That): <Self extends DateTime>(self: Self) => Self | That
  <Self extends DateTime, That extends DateTime>(self: Self, that: That): Self | That
} = Internal.min

/**
 * Returns the later of two `DateTime` values.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const date1 = DateTime.unsafeMake("2024-01-01")
 * const date2 = DateTime.unsafeMake("2024-02-01")
 *
 * const later = DateTime.max(date1, date2)
 * // later equals date2 (2024-02-01)
 * ```
 *
 * @category comparisons
 * @since 3.6.0
 */
export const max: {
  <That extends DateTime>(that: That): <Self extends DateTime>(self: Self) => Self | That
  <Self extends DateTime, That extends DateTime>(self: Self, that: That): Self | That
} = Internal.max

/**
 * Checks if the first `DateTime` is after the second `DateTime`.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const date1 = DateTime.unsafeMake("2024-02-01")
 * const date2 = DateTime.unsafeMake("2024-01-01")
 *
 * console.log(DateTime.greaterThan(date1, date2)) // true
 * console.log(DateTime.greaterThan(date2, date1)) // false
 * ```
 *
 * @category comparisons
 * @since 3.6.0
 */
export const greaterThan: {
  (that: DateTime): (self: DateTime) => boolean
  (self: DateTime, that: DateTime): boolean
} = Internal.greaterThan

/**
 * Checks if the first `DateTime` is after or equal to the second `DateTime`.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const date1 = DateTime.unsafeMake("2024-01-01")
 * const date2 = DateTime.unsafeMake("2024-01-01")
 * const date3 = DateTime.unsafeMake("2024-02-01")
 *
 * console.log(DateTime.greaterThanOrEqualTo(date1, date2)) // true
 * console.log(DateTime.greaterThanOrEqualTo(date3, date1)) // true
 * console.log(DateTime.greaterThanOrEqualTo(date1, date3)) // false
 * ```
 *
 * @category comparisons
 * @since 3.6.0
 */
export const greaterThanOrEqualTo: {
  (that: DateTime): (self: DateTime) => boolean
  (self: DateTime, that: DateTime): boolean
} = Internal.greaterThanOrEqualTo

/**
 * Checks if the first `DateTime` is before the second `DateTime`.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const date1 = DateTime.unsafeMake("2024-01-01")
 * const date2 = DateTime.unsafeMake("2024-02-01")
 *
 * console.log(DateTime.lessThan(date1, date2)) // true
 * console.log(DateTime.lessThan(date2, date1)) // false
 * ```
 *
 * @category comparisons
 * @since 3.6.0
 */
export const lessThan: {
  (that: DateTime): (self: DateTime) => boolean
  (self: DateTime, that: DateTime): boolean
} = Internal.lessThan

/**
 * Checks if the first `DateTime` is before or equal to the second `DateTime`.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const date1 = DateTime.unsafeMake("2024-01-01")
 * const date2 = DateTime.unsafeMake("2024-01-01")
 * const date3 = DateTime.unsafeMake("2024-02-01")
 *
 * console.log(DateTime.lessThanOrEqualTo(date1, date2)) // true
 * console.log(DateTime.lessThanOrEqualTo(date1, date3)) // true
 * console.log(DateTime.lessThanOrEqualTo(date3, date1)) // false
 * ```
 *
 * @category comparisons
 * @since 3.6.0
 */
export const lessThanOrEqualTo: {
  (that: DateTime): (self: DateTime) => boolean
  (self: DateTime, that: DateTime): boolean
} = Internal.lessThanOrEqualTo

/**
 * Checks if a `DateTime` is between two other `DateTime` values (inclusive).
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const min = DateTime.unsafeMake("2024-01-01")
 * const max = DateTime.unsafeMake("2024-12-31")
 * const date = DateTime.unsafeMake("2024-06-15")
 *
 * console.log(DateTime.between(date, { minimum: min, maximum: max })) // true
 * ```
 *
 * @category comparisons
 * @since 3.6.0
 */
export const between: {
  (options: { minimum: DateTime; maximum: DateTime }): (self: DateTime) => boolean
  (self: DateTime, options: { minimum: DateTime; maximum: DateTime }): boolean
} = Internal.between

/**
 * Checks if a `DateTime` is in the future compared to the current time.
 *
 * This is an effectful operation that uses the current time from the `Clock` service.
 *
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const futureDate = DateTime.add(yield* DateTime.now, { hours: 1 })
 *   const isFuture = yield* DateTime.isFuture(futureDate)
 *   console.log(isFuture) // true
 * })
 * ```
 *
 * @category comparisons
 * @since 3.6.0
 */
export const isFuture: (self: DateTime) => Effect.Effect<boolean> = Internal.isFuture

/**
 * Checks if a `DateTime` is in the future compared to the current time.
 *
 * This is a synchronous version that uses `Date.now()` directly.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const now = DateTime.unsafeNow()
 * const futureDate = DateTime.add(now, { hours: 1 })
 *
 * console.log(DateTime.unsafeIsFuture(futureDate)) // true
 * console.log(DateTime.unsafeIsFuture(now)) // false
 * ```
 *
 * @category comparisons
 * @since 3.6.0
 */
export const unsafeIsFuture: (self: DateTime) => boolean = Internal.unsafeIsFuture

/**
 * Checks if a `DateTime` is in the past compared to the current time.
 *
 * This is an effectful operation that uses the current time from the `Clock` service.
 *
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const pastDate = DateTime.subtract(yield* DateTime.now, { hours: 1 })
 *   const isPast = yield* DateTime.isPast(pastDate)
 *   console.log(isPast) // true
 * })
 * ```
 *
 * @category comparisons
 * @since 3.6.0
 */
export const isPast: (self: DateTime) => Effect.Effect<boolean> = Internal.isPast

/**
 * Checks if a `DateTime` is in the past compared to the current time.
 *
 * This is a synchronous version that uses `Date.now()` directly.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const now = DateTime.unsafeNow()
 * const pastDate = DateTime.subtract(now, { hours: 1 })
 *
 * console.log(DateTime.unsafeIsPast(pastDate)) // true
 * console.log(DateTime.unsafeIsPast(now)) // false
 * ```
 *
 * @category comparisons
 * @since 3.6.0
 */
export const unsafeIsPast: (self: DateTime) => boolean = Internal.unsafeIsPast

// =============================================================================
// conversions
// =============================================================================

/**
 * Get the UTC `Date` of a `DateTime`.
 *
 * This always returns the UTC representation, ignoring any time zone information.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const dt = DateTime.unsafeMakeZoned("2024-01-01T12:00:00Z", {
 *   timeZone: "Europe/London"
 * })
 *
 * const utcDate = DateTime.toDateUtc(dt)
 * console.log(utcDate.toISOString()) // "2024-01-01T12:00:00.000Z"
 * ```
 *
 * @category conversions
 * @since 3.6.0
 */
export const toDateUtc: (self: DateTime) => Date = Internal.toDateUtc

/**
 * Convert a `DateTime` to a `Date`, applying the time zone first.
 *
 * For `DateTime.Zoned`, this adjusts for the time zone before converting.
 * For `DateTime.Utc`, this is equivalent to `toDateUtc`.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const utc = DateTime.unsafeMake("2024-01-01T12:00:00Z")
 * const zoned = DateTime.unsafeMakeZoned("2024-01-01T12:00:00Z", {
 *   timeZone: "Europe/London"
 * })
 *
 * console.log(DateTime.toDate(utc).toISOString())
 * console.log(DateTime.toDate(zoned).toISOString())
 * ```
 *
 * @category conversions
 * @since 3.6.0
 */
export const toDate: (self: DateTime) => Date = Internal.toDate

/**
 * Calculate the time zone offset of a `DateTime.Zoned` in milliseconds.
 *
 * Returns the offset from UTC in milliseconds. Positive values indicate
 * time zones ahead of UTC, negative values indicate time zones behind UTC.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const zoned = DateTime.unsafeMakeZoned("2024-01-01T12:00:00Z", {
 *   timeZone: "Europe/London"
 * })
 *
 * const offset = DateTime.zonedOffset(zoned)
 * console.log(offset) // 0 (London is UTC+0 in winter)
 * ```
 *
 * @category conversions
 * @since 3.6.0
 */
export const zonedOffset: (self: Zoned) => number = Internal.zonedOffset

/**
 * Format the time zone offset of a `DateTime.Zoned` as an ISO string.
 *
 * The offset is formatted as "±HH:MM".
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const zoned = DateTime.unsafeMakeZoned("2024-01-01T12:00:00Z", {
 *   timeZone: DateTime.zoneMakeOffset(3 * 60 * 60 * 1000) // +3 hours
 * })
 *
 * const offsetString = DateTime.zonedOffsetIso(zoned)
 * console.log(offsetString) // "+03:00"
 * ```
 *
 * @category conversions
 * @since 3.6.0
 */
export const zonedOffsetIso: (self: Zoned) => string = Internal.zonedOffsetIso

/**
 * Get the milliseconds since the Unix epoch of a `DateTime`.
 *
 * This returns the UTC timestamp regardless of any time zone information.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const dt = DateTime.unsafeMake("2024-01-01T00:00:00Z")
 * const epochMillis = DateTime.toEpochMillis(dt)
 *
 * console.log(epochMillis) // 1704067200000
 * console.log(new Date(epochMillis).toISOString()) // "2024-01-01T00:00:00.000Z"
 * ```
 *
 * @category conversions
 * @since 3.6.0
 */
export const toEpochMillis: (self: DateTime) => number = Internal.toEpochMillis

/**
 * Remove the time aspect of a `DateTime`, first adjusting for the time
 * zone. It will return a `DateTime.Utc` only containing the date.
 *
 * @since 3.6.0
 * @category conversions
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // returns "2024-01-01T00:00:00Z"
 * DateTime.unsafeMakeZoned("2024-01-01T05:00:00Z", {
 *   timeZone: "Pacific/Auckland",
 *   adjustForTimeZone: true
 * }).pipe(
 *   DateTime.removeTime,
 *   DateTime.formatIso
 * )
 * ```
 */
export const removeTime: (self: DateTime) => Utc = Internal.removeTime

// =============================================================================
// parts
// =============================================================================

/**
 * Get the different parts of a `DateTime` as an object.
 *
 * The parts will be time zone adjusted if the `DateTime` is zoned.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const dt = DateTime.unsafeMake("2024-01-01T12:30:45.123Z")
 * const parts = DateTime.toParts(dt)
 *
 * console.log(parts)
 * // {
 * //   year: 2024,
 * //   month: 1,
 * //   day: 1,
 * //   hours: 12,
 * //   minutes: 30,
 * //   seconds: 45,
 * //   millis: 123,
 * //   weekDay: 1 // Monday
 * // }
 * ```
 *
 * @category parts
 * @since 3.6.0
 */
export const toParts: (self: DateTime) => DateTime.PartsWithWeekday = Internal.toParts

/**
 * Get the different parts of a `DateTime` as an object.
 *
 * The parts will always be in UTC, ignoring any time zone information.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const zoned = DateTime.unsafeMakeZoned("2024-01-01T12:30:45.123Z", {
 *   timeZone: "Europe/London"
 * })
 * const parts = DateTime.toPartsUtc(zoned)
 *
 * console.log(parts)
 * // Always returns UTC parts regardless of time zone
 * ```
 *
 * @category parts
 * @since 3.6.0
 */
export const toPartsUtc: (self: DateTime) => DateTime.PartsWithWeekday = Internal.toPartsUtc

/**
 * Get a part of a `DateTime` as a number.
 *
 * The part will be in the UTC time zone.
 *
 * @since 3.6.0
 * @category parts
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { DateTime } from "effect"
 *
 * const now = DateTime.unsafeMake({ year: 2024 })
 * const year = DateTime.getPartUtc(now, "year")
 * assert.strictEqual(year, 2024)
 * ```
 */
export const getPartUtc: {
  (part: keyof DateTime.PartsWithWeekday): (self: DateTime) => number
  (self: DateTime, part: keyof DateTime.PartsWithWeekday): number
} = Internal.getPartUtc

/**
 * Get a part of a `DateTime` as a number.
 *
 * The part will be time zone adjusted.
 *
 * @since 3.6.0
 * @category parts
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { DateTime } from "effect"
 *
 * const now = DateTime.unsafeMakeZoned({ year: 2024 }, { timeZone: "Europe/London" })
 * const year = DateTime.getPart(now, "year")
 * assert.strictEqual(year, 2024)
 * ```
 */
export const getPart: {
  (part: keyof DateTime.PartsWithWeekday): (self: DateTime) => number
  (self: DateTime, part: keyof DateTime.PartsWithWeekday): number
} = Internal.getPart

/**
 * Set the different parts of a `DateTime` as an object.
 *
 * The date will be time zone adjusted for `DateTime.Zoned`.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const dt = DateTime.unsafeMake("2024-01-01T12:00:00Z")
 * const updated = DateTime.setParts(dt, {
 *   year: 2025,
 *   month: 6,
 *   day: 15
 * })
 *
 * console.log(DateTime.formatIso(updated)) // "2025-06-15T12:00:00.000Z"
 * ```
 *
 * @category parts
 * @since 3.6.0
 */
export const setParts: {
  (parts: Partial<DateTime.PartsWithWeekday>): <A extends DateTime>(self: A) => A
  <A extends DateTime>(self: A, parts: Partial<DateTime.PartsWithWeekday>): A
} = Internal.setParts

/**
 * Set the different parts of a `DateTime` as an object.
 *
 * The parts are always interpreted as UTC, ignoring any time zone information.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const dt = DateTime.unsafeMake("2024-01-01T12:00:00Z")
 * const updated = DateTime.setPartsUtc(dt, {
 *   year: 2025,
 *   hours: 18
 * })
 *
 * console.log(DateTime.formatIso(updated)) // "2025-01-01T18:00:00.000Z"
 * ```
 *
 * @category parts
 * @since 3.6.0
 */
export const setPartsUtc: {
  (parts: Partial<DateTime.PartsWithWeekday>): <A extends DateTime>(self: A) => A
  <A extends DateTime>(self: A, parts: Partial<DateTime.PartsWithWeekday>): A
} = Internal.setPartsUtc

// =============================================================================
// current time zone
// =============================================================================

/**
 * @since 3.11.0
 * @category current time zone
 */
export class CurrentTimeZone extends ServiceMap.Key<CurrentTimeZone, TimeZone>()("effect/DateTime/CurrentTimeZone") {}

/**
 * Set the time zone of a `DateTime` to the current time zone, which is
 * determined by the `CurrentTimeZone` service.
 *
 * @since 3.6.0
 * @category current time zone
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   const now = yield* DateTime.now
 *
 *   // set the time zone to "Europe/London"
 *   const zoned = yield* DateTime.setZoneCurrent(now)
 * }).pipe(DateTime.withCurrentZoneNamed("Europe/London"))
 * ```
 */
export const setZoneCurrent = (self: DateTime): Effect.Effect<Zoned, never, CurrentTimeZone> =>
  Effect.map(CurrentTimeZone.asEffect(), (zone) => setZone(self, zone))

/**
 * Provide the `CurrentTimeZone` to an effect.
 *
 * @since 3.6.0
 * @category current time zone
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * const zone = DateTime.zoneUnsafeMakeNamed("Europe/London")
 *
 * Effect.gen(function* () {
 *   const now = yield* DateTime.nowInCurrentZone
 * }).pipe(DateTime.withCurrentZone(zone))
 * ```
 */
export const withCurrentZone: {
  (value: TimeZone): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, CurrentTimeZone>>
  <A, E, R>(self: Effect.Effect<A, E, R>, value: TimeZone): Effect.Effect<A, E, Exclude<R, CurrentTimeZone>>
} = provideService(CurrentTimeZone)

/**
 * Provide the `CurrentTimeZone` to an effect, using the system's local time
 * zone.
 *
 * @since 3.6.0
 * @category current time zone
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   // will use the system's local time zone
 *   const now = yield* DateTime.nowInCurrentZone
 * }).pipe(DateTime.withCurrentZoneLocal)
 * ```
 */
export const withCurrentZoneLocal = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, Exclude<R, CurrentTimeZone>> =>
  Effect.provideServiceEffect(effect, CurrentTimeZone, Effect.sync(zoneMakeLocal))

/**
 * Provide the `CurrentTimeZone` to an effect, using a offset.
 *
 * @since 3.6.0
 * @category current time zone
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   // will use the system's local time zone
 *   const now = yield* DateTime.nowInCurrentZone
 * }).pipe(DateTime.withCurrentZoneOffset(3 * 60 * 60 * 1000))
 * ```
 */
export const withCurrentZoneOffset: {
  (offset: number): <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Exclude<R, CurrentTimeZone>>
  <A, E, R>(effect: Effect.Effect<A, E, R>, offset: number): Effect.Effect<A, E, Exclude<R, CurrentTimeZone>>
} = dual(
  2,
  <A, E, R>(effect: Effect.Effect<A, E, R>, offset: number): Effect.Effect<A, E, Exclude<R, CurrentTimeZone>> =>
    Effect.provideService(effect, CurrentTimeZone, zoneMakeOffset(offset))
)

/**
 * Provide the `CurrentTimeZone` to an effect using an IANA time zone
 * identifier.
 *
 * If the time zone is invalid, it will fail with an `IllegalArgumentError`.
 *
 * @since 3.6.0
 * @category current time zone
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   // will use the "Europe/London" time zone
 *   const now = yield* DateTime.nowInCurrentZone
 * }).pipe(DateTime.withCurrentZoneNamed("Europe/London"))
 * ```
 */
export const withCurrentZoneNamed: {
  (zone: string): <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | IllegalArgumentError, Exclude<R, CurrentTimeZone>>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    zone: string
  ): Effect.Effect<A, E | IllegalArgumentError, Exclude<R, CurrentTimeZone>>
} = dual(
  2,
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    zone: string
  ): Effect.Effect<A, E | IllegalArgumentError, Exclude<R, CurrentTimeZone>> =>
    Effect.provideServiceEffect(effect, CurrentTimeZone, zoneMakeNamedEffect(zone))
)

/**
 * Get the current time as a `DateTime.Zoned`, using the `CurrentTimeZone`.
 *
 * @since 3.6.0
 * @category current time zone
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   // will use the "Europe/London" time zone
 *   const now = yield* DateTime.nowInCurrentZone
 * }).pipe(DateTime.withCurrentZoneNamed("Europe/London"))
 * ```
 */
export const nowInCurrentZone: Effect.Effect<Zoned, never, CurrentTimeZone> = Effect.flatMap(now, setZoneCurrent)

// =============================================================================
// mapping
// =============================================================================

/**
 * Modify a `DateTime` by applying a function to a cloned `Date` instance.
 *
 * The `Date` will first have the time zone applied if possible, and then be
 * converted back to a `DateTime` within the same time zone.
 *
 * @since 3.6.0
 * @category mapping
 */
export const mutate: {
  (f: (date: Date) => void): <A extends DateTime>(self: A) => A
  <A extends DateTime>(self: A, f: (date: Date) => void): A
} = Internal.mutate

/**
 * Modify a `DateTime` by applying a function to a cloned UTC `Date` instance.
 *
 * @since 3.6.0
 * @category mapping
 */
export const mutateUtc: {
  (f: (date: Date) => void): <A extends DateTime>(self: A) => A
  <A extends DateTime>(self: A, f: (date: Date) => void): A
} = Internal.mutateUtc

/**
 * Transform a `DateTime` by applying a function to the number of milliseconds
 * since the Unix epoch.
 *
 * @since 3.6.0
 * @category mapping
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // add 10 milliseconds
 * DateTime.unsafeMake(0).pipe(
 *   DateTime.mapEpochMillis((millis) => millis + 10)
 * )
 * ```
 */
export const mapEpochMillis: {
  (f: (millis: number) => number): <A extends DateTime>(self: A) => A
  <A extends DateTime>(self: A, f: (millis: number) => number): A
} = Internal.mapEpochMillis

/**
 * Using the time zone adjusted `Date`, apply a function to the `Date` and
 * return the result.
 *
 * @since 3.6.0
 * @category mapping
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // get the time zone adjusted date in milliseconds
 * DateTime.unsafeMakeZoned(0, { timeZone: "Europe/London" }).pipe(
 *   DateTime.withDate((date) => date.getTime())
 * )
 * ```
 */
export const withDate: {
  <A>(f: (date: Date) => A): (self: DateTime) => A
  <A>(self: DateTime, f: (date: Date) => A): A
} = Internal.withDate

/**
 * Using the time zone adjusted `Date`, apply a function to the `Date` and
 * return the result.
 *
 * @since 3.6.0
 * @category mapping
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // get the date in milliseconds
 * DateTime.unsafeMake(0).pipe(
 *   DateTime.withDateUtc((date) => date.getTime())
 * )
 * ```
 */
export const withDateUtc: {
  <A>(f: (date: Date) => A): (self: DateTime) => A
  <A>(self: DateTime, f: (date: Date) => A): A
} = Internal.withDateUtc

/**
 * Pattern match on a `DateTime` to handle `Utc` and `Zoned` cases differently.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const dt1 = DateTime.unsafeNow() // Utc
 * const dt2 = DateTime.unsafeMakeZoned(new Date(), { timeZone: "Europe/London" }) // Zoned
 *
 * const result1 = DateTime.match(dt1, {
 *   onUtc: (utc) => `UTC: ${DateTime.formatIso(utc)}`,
 *   onZoned: (zoned) => `Zoned: ${DateTime.formatIsoZoned(zoned)}`
 * })
 *
 * const result2 = DateTime.match(dt2, {
 *   onUtc: (utc) => `UTC: ${DateTime.formatIso(utc)}`,
 *   onZoned: (zoned) => `Zoned: ${DateTime.formatIsoZoned(zoned)}`
 * })
 * ```
 *
 * @category mapping
 * @since 3.6.0
 */
export const match: {
  <A, B>(options: {
    readonly onUtc: (_: Utc) => A
    readonly onZoned: (_: Zoned) => B
  }): (self: DateTime) => A | B
  <A, B>(self: DateTime, options: {
    readonly onUtc: (_: Utc) => A
    readonly onZoned: (_: Zoned) => B
  }): A | B
} = Internal.match

// =============================================================================
// math
// =============================================================================

/**
 * Add the given `Duration` to a `DateTime`.
 *
 * @since 3.6.0
 * @category math
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // add 5 minutes
 * DateTime.unsafeMake(0).pipe(
 *   DateTime.addDuration("5 minutes")
 * )
 * ```
 */
export const addDuration: {
  (duration: Duration.DurationInput): <A extends DateTime>(self: A) => A
  <A extends DateTime>(self: A, duration: Duration.DurationInput): A
} = Internal.addDuration

/**
 * Subtract the given `Duration` from a `DateTime`.
 *
 * @since 3.6.0
 * @category math
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // subtract 5 minutes
 * DateTime.unsafeMake(0).pipe(
 *   DateTime.subtractDuration("5 minutes")
 * )
 * ```
 */
export const subtractDuration: {
  (duration: Duration.DurationInput): <A extends DateTime>(self: A) => A
  <A extends DateTime>(self: A, duration: Duration.DurationInput): A
} = Internal.subtractDuration

/**
 * Add the given `amount` of `unit`'s to a `DateTime`.
 *
 * The time zone is taken into account when adding days, weeks, months, and
 * years.
 *
 * @since 3.6.0
 * @category math
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // add 5 minutes
 * DateTime.unsafeMake(0).pipe(
 *   DateTime.add({ minutes: 5 })
 * )
 * ```
 */
export const add: {
  (parts: Partial<DateTime.PartsForMath>): <A extends DateTime>(self: A) => A
  <A extends DateTime>(self: A, parts: Partial<DateTime.PartsForMath>): A
} = Internal.add

/**
 * Subtract the given `amount` of `unit`'s from a `DateTime`.
 *
 * @since 3.6.0
 * @category math
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // subtract 5 minutes
 * DateTime.unsafeMake(0).pipe(
 *   DateTime.subtract({ minutes: 5 })
 * )
 * ```
 */
export const subtract: {
  (parts: Partial<DateTime.PartsForMath>): <A extends DateTime>(self: A) => A
  <A extends DateTime>(self: A, parts: Partial<DateTime.PartsForMath>): A
} = Internal.subtract

/**
 * Converts a `DateTime` to the start of the given `part`.
 *
 * If the part is `week`, the `weekStartsOn` option can be used to specify the
 * day of the week that the week starts on. The default is 0 (Sunday).
 *
 * @since 3.6.0
 * @category math
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // returns "2024-01-01T00:00:00Z"
 * DateTime.unsafeMake("2024-01-01T12:00:00Z").pipe(
 *   DateTime.startOf("day"),
 *   DateTime.formatIso
 * )
 * ```
 */
export const startOf: {
  (
    part: DateTime.UnitSingular,
    options?: { readonly weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined }
  ): <A extends DateTime>(self: A) => A
  <A extends DateTime>(
    self: A,
    part: DateTime.UnitSingular,
    options?: { readonly weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined }
  ): A
} = Internal.startOf

/**
 * Converts a `DateTime` to the end of the given `part`.
 *
 * If the part is `week`, the `weekStartsOn` option can be used to specify the
 * day of the week that the week starts on. The default is 0 (Sunday).
 *
 * @since 3.6.0
 * @category math
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // returns "2024-01-01T23:59:59.999Z"
 * DateTime.unsafeMake("2024-01-01T12:00:00Z").pipe(
 *   DateTime.endOf("day"),
 *   DateTime.formatIso
 * )
 * ```
 */
export const endOf: {
  (
    part: DateTime.UnitSingular,
    options?: { readonly weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined }
  ): <A extends DateTime>(self: A) => A
  <A extends DateTime>(
    self: A,
    part: DateTime.UnitSingular,
    options?: { readonly weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined }
  ): A
} = Internal.endOf

/**
 * Converts a `DateTime` to the nearest given `part`.
 *
 * If the part is `week`, the `weekStartsOn` option can be used to specify the
 * day of the week that the week starts on. The default is 0 (Sunday).
 *
 * @since 3.6.0
 * @category math
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * // returns "2024-01-02T00:00:00Z"
 * DateTime.unsafeMake("2024-01-01T12:01:00Z").pipe(
 *   DateTime.nearest("day"),
 *   DateTime.formatIso
 * )
 * ```
 */
export const nearest: {
  (
    part: DateTime.UnitSingular,
    options?: { readonly weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined }
  ): <A extends DateTime>(self: A) => A
  <A extends DateTime>(
    self: A,
    part: DateTime.UnitSingular,
    options?: { readonly weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined }
  ): A
} = Internal.nearest

// =============================================================================
// formatting
// =============================================================================

/**
 * Format a `DateTime` as a string using the `DateTimeFormat` API.
 *
 * The `timeZone` option is set to the offset of the time zone.
 *
 * Note: On Node versions < 22, fixed "Offset" zones will set the time zone to
 * "UTC" and use the adjusted `Date`.
 *
 * @since 3.6.0
 * @category formatting
 */
export const format: {
  (
    options?:
      | Intl.DateTimeFormatOptions & {
        readonly locale?: string | undefined
      }
      | undefined
  ): (self: DateTime) => string
  (
    self: DateTime,
    options?:
      | Intl.DateTimeFormatOptions & {
        readonly locale?: string | undefined
      }
      | undefined
  ): string
} = Internal.format

/**
 * Format a `DateTime` as a string using the `DateTimeFormat` API.
 *
 * It will use the system's local time zone & locale.
 *
 * @since 3.6.0
 * @category formatting
 */
export const formatLocal: {
  (
    options?:
      | Intl.DateTimeFormatOptions & {
        readonly locale?: string | undefined
      }
      | undefined
  ): (self: DateTime) => string
  (
    self: DateTime,
    options?:
      | Intl.DateTimeFormatOptions & {
        readonly locale?: string | undefined
      }
      | undefined
  ): string
} = Internal.formatLocal

/**
 * Format a `DateTime` as a string using the `DateTimeFormat` API.
 *
 * This forces the time zone to be UTC.
 *
 * @since 3.6.0
 * @category formatting
 */
export const formatUtc: {
  (
    options?:
      | Intl.DateTimeFormatOptions & {
        readonly locale?: string | undefined
      }
      | undefined
  ): (self: DateTime) => string
  (
    self: DateTime,
    options?:
      | Intl.DateTimeFormatOptions & {
        readonly locale?: string | undefined
      }
      | undefined
  ): string
} = Internal.formatUtc

/**
 * Format a `DateTime` as a string using the `DateTimeFormat` API.
 *
 * @since 3.6.0
 * @category formatting
 */
export const formatIntl: {
  (format: Intl.DateTimeFormat): (self: DateTime) => string
  (self: DateTime, format: Intl.DateTimeFormat): string
} = Internal.formatIntl

/**
 * Format a `DateTime` as a UTC ISO string.
 *
 * Always returns the UTC representation in ISO 8601 format, ignoring any time zone.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const dt = DateTime.unsafeMake("2024-01-01T12:30:45.123Z")
 * console.log(DateTime.formatIso(dt)) // "2024-01-01T12:30:45.123Z"
 *
 * const zoned = DateTime.unsafeMakeZoned("2024-01-01T12:30:45.123Z", {
 *   timeZone: "Europe/London"
 * })
 * console.log(DateTime.formatIso(zoned)) // "2024-01-01T12:30:45.123Z"
 * ```
 *
 * @category formatting
 * @since 3.6.0
 */
export const formatIso: (self: DateTime) => string = Internal.formatIso

/**
 * Format a `DateTime` as a time zone adjusted ISO date string.
 *
 * Returns only the date part (YYYY-MM-DD) after applying time zone adjustments.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const dt = DateTime.unsafeMake("2024-01-01T23:30:00Z")
 * console.log(DateTime.formatIsoDate(dt)) // "2024-01-01"
 *
 * const zoned = DateTime.unsafeMakeZoned("2024-01-01T23:30:00Z", {
 *   timeZone: "Pacific/Auckland" // UTC+12/13
 * })
 * console.log(DateTime.formatIsoDate(zoned)) // "2024-01-02" (next day in Auckland)
 * ```
 *
 * @category formatting
 * @since 3.6.0
 */
export const formatIsoDate: (self: DateTime) => string = Internal.formatIsoDate

/**
 * Format a `DateTime` as a UTC ISO date string.
 *
 * Returns only the date part (YYYY-MM-DD) in UTC, ignoring any time zone.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const dt = DateTime.unsafeMake("2024-01-01T23:30:00Z")
 * console.log(DateTime.formatIsoDateUtc(dt)) // "2024-01-01"
 *
 * const zoned = DateTime.unsafeMakeZoned("2024-01-01T23:30:00Z", {
 *   timeZone: "Pacific/Auckland"
 * })
 * console.log(DateTime.formatIsoDateUtc(zoned)) // "2024-01-01" (always UTC)
 * ```
 *
 * @category formatting
 * @since 3.6.0
 */
export const formatIsoDateUtc: (self: DateTime) => string = Internal.formatIsoDateUtc

/**
 * Format a `DateTime.Zoned` as an ISO string with an offset.
 *
 * For `DateTime.Utc`, returns the same as `formatIso`. For `DateTime.Zoned`,
 * includes the time zone offset in the format.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 *
 * const utc = DateTime.unsafeMake("2024-01-01T12:00:00Z")
 * console.log(DateTime.formatIsoOffset(utc)) // "2024-01-01T12:00:00.000Z"
 *
 * const zoned = DateTime.unsafeMakeZoned("2024-01-01T12:00:00Z", {
 *   timeZone: DateTime.zoneMakeOffset(3 * 60 * 60 * 1000)
 * })
 * console.log(DateTime.formatIsoOffset(zoned)) // "2024-01-01T15:00:00.000+03:00"
 * ```
 *
 * @category formatting
 * @since 3.6.0
 */
export const formatIsoOffset: (self: DateTime) => string = Internal.formatIsoOffset

/**
 * Format a `DateTime.Zoned` as a string.
 *
 * It uses the format: `YYYY-MM-DDTHH:mm:ss.sss+HH:MM[Time/Zone]`.
 *
 * @since 3.6.0
 * @category formatting
 */
export const formatIsoZoned: (self: Zoned) => string = Internal.formatIsoZoned

/**
 * Create a Layer from the given time zone.
 *
 * This layer provides the `CurrentTimeZone` service with the specified time zone.
 *
 * @example
 * ```ts
 * import { DateTime, Effect, Layer } from "effect"
 *
 * const zone = DateTime.zoneUnsafeMakeNamed("Europe/London")
 * const layer = DateTime.layerCurrentZone(zone)
 *
 * const program = Effect.gen(function* () {
 *   const now = yield* DateTime.nowInCurrentZone
 *   return DateTime.formatIsoZoned(now)
 * })
 *
 * // Use the layer to provide the time zone
 * Effect.provide(program, layer)
 * ```
 *
 * @category current time zone
 * @since 3.6.0
 */
export const layerCurrentZone = (zone: TimeZone): Layer.Layer<CurrentTimeZone> => Layer.succeed(CurrentTimeZone, zone)

/**
 * Create a Layer from the given time zone offset.
 *
 * This layer provides the `CurrentTimeZone` service with a fixed offset time zone.
 *
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * // Create a layer for UTC+3
 * const layer = DateTime.layerCurrentZoneOffset(3 * 60 * 60 * 1000)
 *
 * const program = Effect.gen(function* () {
 *   const now = yield* DateTime.nowInCurrentZone
 *   return DateTime.formatIsoZoned(now)
 * })
 *
 * Effect.provide(program, layer)
 * ```
 *
 * @category current time zone
 * @since 3.6.0
 */
export const layerCurrentZoneOffset = (offset: number): Layer.Layer<CurrentTimeZone> =>
  Layer.succeed(CurrentTimeZone, Internal.zoneMakeOffset(offset))

/**
 * Create a Layer from the given IANA time zone identifier.
 *
 * This layer provides the `CurrentTimeZone` service with a named time zone.
 * If the time zone identifier is invalid, the layer will fail.
 *
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * const layer = DateTime.layerCurrentZoneNamed("Europe/London")
 *
 * const program = Effect.gen(function* () {
 *   const now = yield* DateTime.nowInCurrentZone
 *   return DateTime.formatIsoZoned(now)
 * })
 *
 * Effect.provide(program, layer)
 * ```
 *
 * @category current time zone
 * @since 3.6.0
 */
export const layerCurrentZoneNamed = (
  zoneId: string
): Layer.Layer<CurrentTimeZone, IllegalArgumentError> =>
  Layer.effect(CurrentTimeZone, Internal.zoneMakeNamedEffect(zoneId))

/**
 * Create a Layer from the system's local time zone.
 *
 * This layer provides the `CurrentTimeZone` service using the system's
 * configured local time zone.
 *
 * @example
 * ```ts
 * import { DateTime, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const now = yield* DateTime.nowInCurrentZone
 *   return DateTime.formatIsoZoned(now)
 * })
 *
 * // Use the system's local time zone
 * Effect.provide(program, DateTime.layerCurrentZoneLocal)
 * ```
 *
 * @category current time zone
 * @since 3.6.0
 */
export const layerCurrentZoneLocal: Layer.Layer<CurrentTimeZone> = Layer.sync(CurrentTimeZone, zoneMakeLocal)
