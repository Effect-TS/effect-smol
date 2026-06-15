/**
 * @title Creating and formatting DateTime values
 *
 * Parse incoming date values safely, use Clock-powered current time, and format
 * instants for API payloads or user-facing labels.
 */
import { DateTime, Effect, Option, Schema } from "effect"

export class InvalidBookingDate extends Schema.TaggedErrorClass<InvalidBookingDate>()("InvalidBookingDate", {
  input: Schema.String
}) {}

export interface BookingRequest {
  readonly customerId: string
  readonly startsAt: string
}

export interface BookingWindow {
  readonly customerId: string
  readonly startsAt: DateTime.DateTime
  readonly endsAt: DateTime.DateTime
  readonly createdAt: DateTime.Utc
  readonly apiPayload: {
    readonly startsAt: string
    readonly endsAt: string
    readonly createdAt: string
  }
  readonly displayLabel: string
}

export const parseBookingDate = Effect.fn("parseBookingDate")(function*(
  input: string
): Effect.fn.Return<DateTime.Utc, InvalidBookingDate> {
  // Prefer the safe constructors (`make`, `makeZoned`, `zoneMakeNamed`) when
  // handling untrusted input. They return Option instead of throwing.
  const parsed = DateTime.make(input)
  if (Option.isNone(parsed)) {
    return yield* Effect.fail(new InvalidBookingDate({ input }))
  }
  return parsed.value
})

export const createBookingWindow = Effect.fn("createBookingWindow")(function*(
  request: BookingRequest
): Effect.fn.Return<BookingWindow, InvalidBookingDate> {
  const startsAt = yield* parseBookingDate(request.startsAt)

  // Use DateTime.now instead of Date.now/new Date so the current time comes
  // from Effect's Clock service and can be controlled in tests.
  const createdAt = yield* DateTime.now

  // Calendar/date-time math returns a new DateTime value; the original value is
  // immutable.
  const endsAt = DateTime.add(startsAt, { hours: 2 })

  return {
    customerId: request.customerId,
    startsAt,
    endsAt,
    createdAt,
    apiPayload: {
      // formatIso always serializes the instant in UTC, which is useful for API
      // and database boundaries.
      startsAt: DateTime.formatIso(startsAt),
      endsAt: DateTime.formatIso(endsAt),
      createdAt: DateTime.formatIso(createdAt)
    },
    // format/formatUtc wrap Intl.DateTimeFormat while keeping the DateTime
    // value as the source of truth.
    displayLabel: DateTime.formatUtc(startsAt, {
      locale: "en-US",
      dateStyle: "medium",
      timeStyle: "short"
    })
  }
})

export const bookingExample = createBookingWindow({
  customerId: "cus_123",
  startsAt: "2024-06-15T14:30:00.000Z"
})
