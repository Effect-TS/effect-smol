/**
 * @title Calendar-aware DateTime math
 *
 * Use DateTime arithmetic and rounding for billing periods, reminders, grace
 * periods, and business-calendar boundaries.
 */
import { Context, DateTime, Layer } from "effect"

export interface BillingCycle {
  readonly startsAt: DateTime.DateTime
  readonly endsAt: DateTime.DateTime
  readonly reminderAt: DateTime.DateTime
  readonly gracePeriodEndsAt: DateTime.DateTime
}

const openCycle = (signupAt: DateTime.DateTime): BillingCycle => {
  // Rounding is calendar-aware. If signupAt is zoned, startOf uses that zone's
  // calendar day rather than blindly rounding UTC milliseconds.
  const startsAt = DateTime.startOf(signupAt, "day")
  const endsAt = DateTime.endOf(DateTime.add(startsAt, { months: 1 }), "day")

  return {
    startsAt,
    endsAt,
    reminderAt: DateTime.subtract(endsAt, { days: 3 }),
    gracePeriodEndsAt: DateTime.add(endsAt, { days: 7 })
  }
}

const isInGracePeriod = (checkedAt: DateTime.DateTime, cycle: BillingCycle): boolean =>
  // Comparisons are based on the absolute instant, so values can be UTC or
  // zoned and still compare correctly.
  DateTime.between(checkedAt, {
    minimum: cycle.endsAt,
    maximum: cycle.gracePeriodEndsAt
  })

const nextBusinessMorning = (value: DateTime.DateTime): DateTime.DateTime => {
  const morning = DateTime.startOf(value, "day").pipe(
    DateTime.add({ hours: 9 })
  )
  const weekDay = DateTime.getPart(morning, "weekDay")

  if (weekDay === 6) {
    // Saturday -> Monday morning.
    return DateTime.add(morning, { days: 2 })
  }
  if (weekDay === 0) {
    // Sunday -> Monday morning.
    return DateTime.add(morning, { days: 1 })
  }
  return morning
}

export class BillingCalendar extends Context.Service<BillingCalendar, {
  readonly openCycle: (signupAt: DateTime.DateTime) => BillingCycle
  readonly isInGracePeriod: (checkedAt: DateTime.DateTime, cycle: BillingCycle) => boolean
  readonly nextBusinessMorning: (value: DateTime.DateTime) => DateTime.DateTime
}>()("app/BillingCalendar") {
  static readonly layer = Layer.succeed(
    BillingCalendar,
    BillingCalendar.of({
      openCycle,
      isInGracePeriod,
      nextBusinessMorning
    })
  )
}

export const sampleCycle = openCycle(
  DateTime.makeZonedUnsafe("2024-05-31T16:45:00.000Z", {
    timeZone: "America/New_York"
  })
)
