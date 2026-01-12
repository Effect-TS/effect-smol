/**
 * @since 2.0.0
 */
import * as Arr from "./Array.ts"
import * as Data from "./Data.ts"
import type * as DateTime from "./DateTime.ts"
import * as Equal from "./Equal.ts"
import * as equivalence from "./Equivalence.ts"
import { format } from "./Formatter.ts"
import { constVoid, dual, pipe } from "./Function.ts"
import * as Hash from "./Hash.ts"
import { type Inspectable, NodeInspectSymbol } from "./Inspectable.ts"
import * as dateTime from "./internal/dateTime.ts"
import * as N from "./Number.ts"
import { type Pipeable, pipeArguments } from "./Pipeable.ts"
import { hasProperty } from "./Predicate.ts"
import * as Result from "./Result.ts"
import * as String from "./String.ts"
import type { Mutable } from "./Types.ts"
import * as UndefinedOr from "./UndefinedOr.ts"

const TypeId = "~effect/time/Cron"

/**
 * Represents a cron schedule with time constraints and timezone information.
 *
 * A Cron instance defines when a scheduled task should run, supporting
 * seconds, minutes, hours, days, months, and weekdays constraints.
 * It also supports timezone-aware scheduling.
 *
 * @example
 * ```ts
 * import { Cron } from "effect"
 *
 * // Create a cron that runs at 9 AM on weekdays
 * const weekdayMorning = Cron.make({
 *   minutes: [0],
 *   hours: [9],
 *   days: [
 *     1,
 *     2,
 *     3,
 *     4,
 *     5,
 *     6,
 *     7,
 *     8,
 *     9,
 *     10,
 *     11,
 *     12,
 *     13,
 *     14,
 *     15,
 *     16,
 *     17,
 *     18,
 *     19,
 *     20,
 *     21,
 *     22,
 *     23,
 *     24,
 *     25,
 *     26,
 *     27,
 *     28,
 *     29,
 *     30,
 *     31
 *   ],
 *   months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
 *   weekdays: [1, 2, 3, 4, 5] // Monday to Friday
 * })
 *
 * // Check if a date matches the schedule
 * const matches = Cron.match(weekdayMorning, new Date("2023-06-05T09:00:00"))
 * console.log(matches) // true if it's 9 AM on a weekday
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Cron extends Pipeable, Equal.Equal, Inspectable {
  readonly [TypeId]: typeof TypeId
  readonly tz: DateTime.TimeZone | undefined
  readonly seconds: ReadonlySet<number>
  readonly minutes: ReadonlySet<number>
  readonly hours: ReadonlySet<number>
  readonly days: ReadonlySet<number>
  readonly months: ReadonlySet<number>
  readonly weekdays: ReadonlySet<number>
  /** @internal */
  readonly first: {
    readonly second: number
    readonly minute: number
    readonly hour: number
    readonly day: number
    readonly month: number
    readonly weekday: number
  }
  /** @internal */
  readonly next: {
    readonly second: ReadonlyArray<number | undefined>
    readonly minute: ReadonlyArray<number | undefined>
    readonly hour: ReadonlyArray<number | undefined>
    readonly day: ReadonlyArray<number | undefined>
    readonly month: ReadonlyArray<number | undefined>
    readonly weekday: ReadonlyArray<number | undefined>
  }
}

function toPojo(cron: Cron): Record<string, unknown> {
  return {
    tz: cron.tz,
    seconds: Arr.fromIterable(cron.seconds),
    minutes: Arr.fromIterable(cron.minutes),
    hours: Arr.fromIterable(cron.hours),
    days: Arr.fromIterable(cron.days),
    months: Arr.fromIterable(cron.months),
    weekdays: Arr.fromIterable(cron.weekdays)
  }
}

const CronProto = {
  [TypeId]: TypeId,
  [Equal.symbol](this: Cron, that: unknown) {
    return isCron(that) && equals(this, that)
  },
  [Hash.symbol](this: Cron): number {
    return pipe(
      Hash.hash(this.tz),
      Hash.combine(Hash.array(Arr.fromIterable(this.seconds))),
      Hash.combine(Hash.array(Arr.fromIterable(this.minutes))),
      Hash.combine(Hash.array(Arr.fromIterable(this.hours))),
      Hash.combine(Hash.array(Arr.fromIterable(this.days))),
      Hash.combine(Hash.array(Arr.fromIterable(this.months))),
      Hash.combine(Hash.array(Arr.fromIterable(this.weekdays)))
    )
  },
  toObject(this: Cron) {
    return {
      tz: this.tz,
      seconds: Arr.fromIterable(this.seconds),
      minutes: Arr.fromIterable(this.minutes),
      hours: Arr.fromIterable(this.hours),
      days: Arr.fromIterable(this.days),
      months: Arr.fromIterable(this.months),
      weekdays: Arr.fromIterable(this.weekdays)
    }
  },
  toString(this: Cron) {
    return `Cron(${format(toPojo(this))})`
  },
  toJSON(this: Cron) {
    const out = toPojo(this)
    out["_id"] = "Cron"
    return out
  },
  [NodeInspectSymbol](this: Cron) {
    return this.toJSON()
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * Checks if a given value is a Cron instance.
 *
 * This function is a type guard that determines whether the provided
 * value is a valid Cron instance by checking for the presence of the
 * Cron type identifier.
 *
 * @example
 * ```ts
 * import { Cron } from "effect"
 *
 * const cron = Cron.make({
 *   minutes: [0],
 *   hours: [9],
 *   days: [1, 15],
 *   months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
 *   weekdays: [1, 2, 3, 4, 5]
 * })
 *
 * console.log(Cron.isCron(cron)) // true
 * console.log(Cron.isCron({})) // false
 * console.log(Cron.isCron("not a cron")) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isCron = (u: unknown): u is Cron => hasProperty(u, TypeId)

/**
 * Creates a Cron instance from time constraints.
 *
 * Constructs a cron schedule by specifying which seconds, minutes, hours,
 * days, months, and weekdays the schedule should match. Empty arrays mean
 * "match all" for that time unit.
 *
 * @example
 * ```ts
 * import { Cron } from "effect"
 *
 * // Every day at midnight
 * const midnight = Cron.make({
 *   minutes: [0],
 *   hours: [0],
 *   days: [
 *     1,
 *     2,
 *     3,
 *     4,
 *     5,
 *     6,
 *     7,
 *     8,
 *     9,
 *     10,
 *     11,
 *     12,
 *     13,
 *     14,
 *     15,
 *     16,
 *     17,
 *     18,
 *     19,
 *     20,
 *     21,
 *     22,
 *     23,
 *     24,
 *     25,
 *     26,
 *     27,
 *     28,
 *     29,
 *     30,
 *     31
 *   ],
 *   months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
 *   weekdays: [0, 1, 2, 3, 4, 5, 6]
 * })
 *
 * // Every 15 minutes during business hours on weekdays
 * const businessHours = Cron.make({
 *   minutes: [0, 15, 30, 45],
 *   hours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
 *   days: [
 *     1,
 *     2,
 *     3,
 *     4,
 *     5,
 *     6,
 *     7,
 *     8,
 *     9,
 *     10,
 *     11,
 *     12,
 *     13,
 *     14,
 *     15,
 *     16,
 *     17,
 *     18,
 *     19,
 *     20,
 *     21,
 *     22,
 *     23,
 *     24,
 *     25,
 *     26,
 *     27,
 *     28,
 *     29,
 *     30,
 *     31
 *   ],
 *   months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
 *   weekdays: [1, 2, 3, 4, 5] // Monday to Friday
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const make = (values: {
  readonly seconds?: Iterable<number> | undefined
  readonly minutes: Iterable<number>
  readonly hours: Iterable<number>
  readonly days: Iterable<number>
  readonly months: Iterable<number>
  readonly weekdays: Iterable<number>
  readonly tz?: DateTime.TimeZone | undefined
}): Cron => {
  const o: Mutable<Cron> = Object.create(CronProto)
  o.seconds = new Set(Arr.sort(values.seconds ?? [0], N.Order))
  o.minutes = new Set(Arr.sort(values.minutes, N.Order))
  o.hours = new Set(Arr.sort(values.hours, N.Order))
  o.days = new Set(Arr.sort(values.days, N.Order))
  o.months = new Set(Arr.sort(values.months, N.Order))
  o.weekdays = new Set(Arr.sort(values.weekdays, N.Order))
  o.tz = values.tz

  const seconds = Array.from(o.seconds)
  const minutes = Array.from(o.minutes)
  const hours = Array.from(o.hours)
  const days = Array.from(o.days)
  const months = Array.from(o.months)
  const weekdays = Array.from(o.weekdays)

  o.first = {
    second: seconds[0] ?? 0,
    minute: minutes[0] ?? 0,
    hour: hours[0] ?? 0,
    day: days[0] ?? 1,
    month: (months[0] ?? 1) - 1,
    weekday: weekdays[0] ?? 0
  }

  o.next = {
    second: nextLookupTable(seconds, 60),
    minute: nextLookupTable(minutes, 60),
    hour: nextLookupTable(hours, 24),
    day: nextLookupTable(days, 32),
    month: nextLookupTable(months, 13),
    weekday: nextLookupTable(weekdays, 7)
  }

  return o
}

const nextLookupTable = (values: ReadonlyArray<number>, size: number): Array<number | undefined> => {
  const result = new Array(size).fill(undefined)
  if (values.length === 0) {
    return result
  }

  let current: number | undefined = undefined
  let index = values.length - 1
  for (let i = size - 1; i >= 0; i--) {
    while (index >= 0 && values[index] >= i) {
      current = values[index--]
    }
    result[i] = current
  }

  return result
}

const CronParseErrorTypeId = "~effect/time/Cron/CronParseError"

/**
 * Represents an error that occurs when parsing a cron expression fails.
 *
 * This error provides detailed information about what went wrong during
 * the parsing process, including the error message and optionally the
 * input that caused the error.
 *
 * @example
 * ```ts
 * import { Cron, Result } from "effect"
 *
 * const result = Cron.parse("invalid expression")
 * if (Result.isFailure(result)) {
 *   const error: Cron.CronParseError = result.failure
 *   console.log(error.message) // "Invalid number of segments in cron expression"
 *   console.log(error.input) // "invalid expression"
 * }
 * ```
 *
 * @since 4.0.0
 * @category models
 */
/**
 * @category Models
 * @since 4.0.0
 */
export class CronParseError extends Data.TaggedError("CronParseError")<{
  readonly message: string
  readonly input?: string
}> {
  readonly [CronParseErrorTypeId] = CronParseErrorTypeId
}

/**
 * Checks if a given value is a CronParseError instance.
 *
 * This function is a type guard that determines whether the provided
 * value is a CronParseError by checking for the presence of the
 * CronParseError type identifier.
 *
 * @example
 * ```ts
 * import { Cron, Result } from "effect"
 *
 * const result = Cron.parse("invalid cron expression")
 * if (Result.isFailure(result)) {
 *   const error = result.failure
 *   console.log(Cron.isCronParseError(error)) // true
 * }
 *
 * console.log(Cron.isCronParseError(new Error("regular error"))) // false
 * console.log(Cron.isCronParseError("not an error")) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isCronParseError = (u: unknown): u is CronParseError => hasProperty(u, CronParseErrorTypeId)

/**
 * Parses a cron expression into a `Cron` instance.
 *
 * @param cron - The cron expression to parse.
 *
 * @example
 * ```ts
 * import { Cron, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * // At 04:00 on every day-of-month from 8 through 14.
 * assert.deepStrictEqual(
 *   Cron.parse("0 0 4 8-14 * *"),
 *   Result.succeed(Cron.make({
 *     seconds: [0],
 *     minutes: [0],
 *     hours: [4],
 *     days: [8, 9, 10, 11, 12, 13, 14],
 *     months: [],
 *     weekdays: []
 *   }))
 * )
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const parse = (cron: string, tz?: DateTime.TimeZone | string): Result.Result<Cron, CronParseError> => {
  const segments = cron.split(" ").filter(String.isNonEmpty)
  if (segments.length !== 5 && segments.length !== 6) {
    return Result.fail(new CronParseError({ message: `Invalid number of segments in cron expression`, input: cron }))
  }

  if (segments.length === 5) {
    segments.unshift("0")
  }

  const [seconds, minutes, hours, days, months, weekdays] = segments
  const zone = tz === undefined || dateTime.isTimeZone(tz) ?
    Result.succeed(tz) :
    UndefinedOr.match(dateTime.zoneFromString(tz), {
      onUndefined: () =>
        Result.fail(new CronParseError({ message: `Invalid time zone in cron expression`, input: tz })),
      onDefined: (zone) => Result.succeed(zone)
    })

  return Result.all({
    tz: zone,
    seconds: parseSegment(seconds, secondOptions),
    minutes: parseSegment(minutes, minuteOptions),
    hours: parseSegment(hours, hourOptions),
    days: parseSegment(days, dayOptions),
    months: parseSegment(months, monthOptions),
    weekdays: parseSegment(weekdays, weekdayOptions)
  }).pipe(Result.map(make))
}

/**
 * Parses a cron expression into a Cron instance, throwing on failure.
 *
 * This function provides a convenience method for parsing cron expressions
 * when you're confident the input is valid and want to avoid handling
 * the Result type.
 *
 * @example
 * ```ts
 * import { Cron } from "effect"
 *
 * // At 04:00 on every day-of-month from 8 through 14
 * const cron = Cron.parseUnsafe("0 0 4 8-14 * *")
 *
 * // With timezone
 * const cronWithTz = Cron.parseUnsafe("0 0 9 * * *", "America/New_York")
 *
 * // This would throw an error
 * // const invalid = Cron.parseUnsafe("invalid expression")
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const parseUnsafe = (cron: string, tz?: DateTime.TimeZone | string): Cron => Result.getOrThrow(parse(cron, tz))

/**
 * Checks if a given date/time falls within an active Cron time window.
 *
 * This function determines whether a specific date and time matches
 * the cron schedule, taking into account all time constraints and
 * the optional timezone.
 *
 * @example
 * ```ts
 * import { Cron, Result } from "effect"
 *
 * const cron = Result.getOrThrow(Cron.parse("0 0 4 8-14 * *"))
 *
 * // Check if specific dates match
 * const matches1 = Cron.match(cron, new Date("2021-01-08T04:00:00Z"))
 * console.log(matches1) // true - 4 AM on the 8th
 *
 * const matches2 = Cron.match(cron, new Date("2021-01-08T05:00:00Z"))
 * console.log(matches2) // false - wrong hour
 *
 * const matches3 = Cron.match(cron, new Date("2021-01-07T04:00:00Z"))
 * console.log(matches3) // false - wrong day
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const match = (cron: Cron, date: DateTime.DateTime.Input): boolean => {
  const parts = dateTime.makeZonedUnsafe(date, {
    timeZone: cron.tz
  }).pipe(dateTime.toParts)

  if (cron.seconds.size !== 0 && !cron.seconds.has(parts.seconds)) {
    return false
  }

  if (cron.minutes.size !== 0 && !cron.minutes.has(parts.minutes)) {
    return false
  }

  if (cron.hours.size !== 0 && !cron.hours.has(parts.hours)) {
    return false
  }

  if (cron.months.size !== 0 && !cron.months.has(parts.month)) {
    return false
  }

  if (cron.days.size === 0 && cron.weekdays.size === 0) {
    return true
  }

  if (cron.weekdays.size === 0) {
    return cron.days.has(parts.day)
  }

  if (cron.days.size === 0) {
    return cron.weekdays.has(parts.weekDay)
  }

  return cron.days.has(parts.day) || cron.weekdays.has(parts.weekDay)
}

const daysInMonth = (date: Date): number =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()

/**
 * Returns the next scheduled date/time for the given Cron instance.
 *
 * This function calculates the next date and time when the cron schedule
 * should trigger, starting from the specified date (or current time if
 * not provided).
 *
 * @example
 * ```ts
 * import { Cron, Result } from "effect"
 *
 * const cron = Result.getOrThrow(Cron.parse("0 0 4 8-14 * *"))
 *
 * // Get next run after a specific date
 * const after = new Date("2021-01-01T00:00:00Z")
 * const nextRun = Cron.next(cron, after)
 * console.log(nextRun) // 2021-01-08T04:00:00.000Z
 *
 * // Get next run from current time
 * const nextFromNow = Cron.next(cron)
 * console.log(nextFromNow) // Next occurrence from now
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const next = (cron: Cron, now?: DateTime.DateTime.Input): Date => {
  const tz = cron.tz
  const zoned = dateTime.makeZonedUnsafe(now ?? new Date(), {
    timeZone: tz
  })

  const utc = tz !== undefined && dateTime.isTimeZoneNamed(tz) && tz.id === "UTC"
  const adjustDst = utc ? constVoid : (current: Date) => {
    const adjusted = dateTime.makeZonedUnsafe(current, {
      timeZone: zoned.zone,
      adjustForTimeZone: true
    }).pipe(dateTime.toDate)

    // TODO: This implementation currently only skips forward when transitioning into daylight savings time.
    const drift = current.getTime() - adjusted.getTime()
    if (drift > 0) {
      current.setTime(current.getTime() + drift)
    }
  }

  const result = dateTime.mutate(zoned, (current) => {
    current.setUTCSeconds(current.getUTCSeconds() + 1, 0)

    for (let i = 0; i < 10_000; i++) {
      if (cron.seconds.size !== 0) {
        const currentSecond = current.getUTCSeconds()
        const nextSecond = cron.next.second[currentSecond]
        if (nextSecond === undefined) {
          current.setUTCMinutes(current.getUTCMinutes() + 1, cron.first.second)
          adjustDst(current)
          continue
        }
        if (nextSecond > currentSecond) {
          current.setUTCSeconds(nextSecond)
          adjustDst(current)
          continue
        }
      }

      if (cron.minutes.size !== 0) {
        const currentMinute = current.getUTCMinutes()
        const nextMinute = cron.next.minute[currentMinute]
        if (nextMinute === undefined) {
          current.setUTCHours(current.getUTCHours() + 1, cron.first.minute, cron.first.second)
          adjustDst(current)
          continue
        }
        if (nextMinute > currentMinute) {
          current.setUTCMinutes(nextMinute, cron.first.second)
          adjustDst(current)
          continue
        }
      }

      if (cron.hours.size !== 0) {
        const currentHour = current.getUTCHours()
        const nextHour = cron.next.hour[currentHour]
        if (nextHour === undefined) {
          current.setUTCDate(current.getUTCDate() + 1)
          current.setUTCHours(cron.first.hour, cron.first.minute, cron.first.second)
          adjustDst(current)
          continue
        }
        if (nextHour > currentHour) {
          current.setUTCHours(nextHour, cron.first.minute, cron.first.second)
          adjustDst(current)
          continue
        }
      }

      if (cron.weekdays.size !== 0 || cron.days.size !== 0) {
        let a: number = Infinity
        let b: number = Infinity

        if (cron.weekdays.size !== 0) {
          const currentWeekday = current.getUTCDay()
          const nextWeekday = cron.next.weekday[currentWeekday]
          a = nextWeekday === undefined ? 7 - currentWeekday + cron.first.weekday : nextWeekday - currentWeekday
        }

        if (cron.days.size !== 0 && a !== 0) {
          const currentDay = current.getUTCDate()
          const nextDay = cron.next.day[currentDay]
          b = nextDay === undefined ? daysInMonth(current) - currentDay + cron.first.day : nextDay - currentDay
        }

        const addDays = Math.min(a, b)
        if (addDays !== 0) {
          current.setUTCDate(current.getUTCDate() + addDays)
          current.setUTCHours(cron.first.hour, cron.first.minute, cron.first.second)
          adjustDst(current)
          continue
        }
      }

      if (cron.months.size !== 0) {
        const currentMonth = current.getUTCMonth() + 1
        const nextMonth = cron.next.month[currentMonth]
        if (nextMonth === undefined) {
          current.setUTCFullYear(current.getUTCFullYear() + 1)
          current.setUTCMonth(cron.first.month, cron.first.day)
          current.setUTCHours(cron.first.hour, cron.first.minute, cron.first.second)
          adjustDst(current)
          continue
        }
        if (nextMonth > currentMonth) {
          current.setUTCMonth(nextMonth - 1, cron.first.day)
          current.setUTCHours(cron.first.hour, cron.first.minute, cron.first.second)
          adjustDst(current)
          continue
        }
      }

      return
    }

    throw new Error("Unable to find next cron date")
  })

  return dateTime.toDateUtc(result)
}

/**
 * Returns an infinite iterator that yields dates matching the Cron schedule.
 *
 * This function creates an iterator that generates an infinite sequence
 * of dates when the cron schedule should trigger, starting from the
 * specified date.
 *
 * @example
 * ```ts
 * import { Cron, Result } from "effect"
 *
 * const cron = Result.getOrThrow(Cron.parse("0 0 9 * * 1-5")) // 9 AM weekdays
 *
 * // Get first 5 occurrences
 * const iterator = Cron.sequence(cron, new Date("2023-01-01"))
 * const next5 = Array.from({ length: 5 }, () => iterator.next().value)
 *
 * console.log(next5)
 * // [Mon Jan 02 2023 09:00:00, Tue Jan 03 2023 09:00:00, ...]
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const sequence = function*(cron: Cron, now?: DateTime.DateTime.Input): IterableIterator<Date> {
  while (true) {
    yield now = next(cron, now)
  }
}

/**
 * An Equivalence instance for comparing Cron schedules.
 *
 * This equivalence compares two Cron instances by checking if their
 * time constraints (seconds, minutes, hours, days, months, weekdays)
 * are equivalent, regardless of the internal order.
 *
 * @example
 * ```ts
 * import { Cron } from "effect"
 *
 * const cron1 = Cron.make({
 *   minutes: [0, 30],
 *   hours: [9],
 *   days: [1, 15],
 *   months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
 *   weekdays: [1, 2, 3, 4, 5]
 * })
 *
 * const cron2 = Cron.make({
 *   minutes: [30, 0], // Different order
 *   hours: [9],
 *   days: [15, 1], // Different order
 *   months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
 *   weekdays: [1, 2, 3, 4, 5]
 * })
 *
 * console.log(Cron.Equivalence(cron1, cron2)) // true
 * ```
 *
 * @since 2.0.0
 * @category instances
 */
export const Equivalence: equivalence.Equivalence<Cron> = equivalence.make((self, that) =>
  restrictionsEquals(self.seconds, that.seconds) &&
  restrictionsEquals(self.minutes, that.minutes) &&
  restrictionsEquals(self.hours, that.hours) &&
  restrictionsEquals(self.days, that.days) &&
  restrictionsEquals(self.months, that.months) &&
  restrictionsEquals(self.weekdays, that.weekdays)
)

const restrictionsArrayEquals = equivalence.Array(equivalence.strictEqual<number>())
const restrictionsEquals = (self: ReadonlySet<number>, that: ReadonlySet<number>): boolean =>
  restrictionsArrayEquals(Arr.fromIterable(self), Arr.fromIterable(that))

/**
 * Checks if two Cron instances are equal.
 *
 * This function compares two Cron instances to determine if they represent
 * the same schedule by checking all their time constraints for equality.
 *
 * @example
 * ```ts
 * import { Cron } from "effect"
 *
 * const cron1 = Cron.make({
 *   minutes: [0],
 *   hours: [9],
 *   days: [1, 15],
 *   months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
 *   weekdays: [1, 2, 3, 4, 5]
 * })
 *
 * const cron2 = Cron.make({
 *   minutes: [0],
 *   hours: [9],
 *   days: [1, 15],
 *   months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
 *   weekdays: [1, 2, 3, 4, 5]
 * })
 *
 * console.log(Cron.equals(cron1, cron2)) // true
 * console.log(Cron.equals(cron1)(cron2)) // true (curried form)
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const equals: {
  (that: Cron): (self: Cron) => boolean
  (self: Cron, that: Cron): boolean
} = dual(2, (self: Cron, that: Cron): boolean => Equivalence(self, that))

interface SegmentOptions {
  min: number
  max: number
  aliases?: Record<string, number> | undefined
}

const secondOptions: SegmentOptions = {
  min: 0,
  max: 59
}

const minuteOptions: SegmentOptions = {
  min: 0,
  max: 59
}

const hourOptions: SegmentOptions = {
  min: 0,
  max: 23
}

const dayOptions: SegmentOptions = {
  min: 1,
  max: 31
}

const monthOptions: SegmentOptions = {
  min: 1,
  max: 12,
  aliases: {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12
  }
}

const weekdayOptions: SegmentOptions = {
  min: 0,
  max: 6,
  aliases: {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
  }
}

const parseSegment = (
  input: string,
  options: SegmentOptions
): Result.Result<ReadonlySet<number>, CronParseError> => {
  const capacity = options.max - options.min + 1
  const values = new Set<number>()
  const fields = input.split(",")

  for (const field of fields) {
    const [raw, step] = splitStep(field)
    if (raw === "*" && step === undefined) {
      return Result.succeed(new Set())
    }

    if (step !== undefined) {
      if (!Number.isInteger(step)) {
        return Result.fail(new CronParseError({ message: `Expected step value to be a positive integer`, input }))
      }
      if (step < 1) {
        return Result.fail(new CronParseError({ message: `Expected step value to be greater than 0`, input }))
      }
      if (step > options.max) {
        return Result.fail(new CronParseError({ message: `Expected step value to be less than ${options.max}`, input }))
      }
    }

    if (raw === "*") {
      for (let i = options.min; i <= options.max; i += step ?? 1) {
        values.add(i)
      }
    } else {
      const [left, right] = splitRange(raw, options.aliases)
      if (!Number.isInteger(left)) {
        return Result.fail(new CronParseError({ message: `Expected a positive integer`, input }))
      }
      if (left < options.min || left > options.max) {
        return Result.fail(
          new CronParseError({ message: `Expected a value between ${options.min} and ${options.max}`, input })
        )
      }

      if (right === undefined) {
        values.add(left)
      } else {
        if (!Number.isInteger(right)) {
          return Result.fail(new CronParseError({ message: `Expected a positive integer`, input }))
        }
        if (right < options.min || right > options.max) {
          return Result.fail(
            new CronParseError({ message: `Expected a value between ${options.min} and ${options.max}`, input })
          )
        }
        if (left > right) {
          return Result.fail(new CronParseError({ message: `Invalid value range`, input }))
        }

        for (let i = left; i <= right; i += step ?? 1) {
          values.add(i)
        }
      }
    }

    if (values.size >= capacity) {
      return Result.succeed(new Set())
    }
  }

  return Result.succeed(values)
}

const splitStep = (input: string): [string, number | undefined] => {
  const separator = input.indexOf("/")
  if (separator !== -1) {
    return [input.slice(0, separator), Number(input.slice(separator + 1))]
  }

  return [input, undefined]
}

const splitRange = (input: string, aliases?: Record<string, number>): [number, number | undefined] => {
  const separator = input.indexOf("-")
  if (separator !== -1) {
    return [aliasOrValue(input.slice(0, separator), aliases), aliasOrValue(input.slice(separator + 1), aliases)]
  }

  return [aliasOrValue(input, aliases), undefined]
}

function aliasOrValue(field: string, aliases?: Record<string, number>): number {
  return aliases?.[field.toLocaleLowerCase()] ?? Number(field)
}
