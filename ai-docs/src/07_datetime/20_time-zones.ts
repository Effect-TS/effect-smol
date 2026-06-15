/**
 * @title Working with time zones
 *
 * Attach IANA zones to instants, render zoned ISO strings, and provide a
 * CurrentTimeZone service for code that should use the workspace/user zone.
 */
import { type Cause, DateTime, Effect } from "effect"

export interface WorkspaceTime {
  readonly zoneId: string
  readonly iso: string
  readonly localDate: string
  readonly label: string
}

export const renderInstantForWorkspace = Effect.fn("renderInstantForWorkspace")(function*(
  instant: DateTime.DateTime,
  zoneId: string
): Effect.fn.Return<WorkspaceTime, Cause.IllegalArgumentError> {
  // Use the effectful constructor when an invalid IANA identifier should fail
  // through the Effect error channel instead of throwing.
  const zone = yield* DateTime.zoneMakeNamedEffect(zoneId)

  // setZone preserves the same absolute instant and changes only the zone used
  // for calendar parts and formatting.
  const zoned = DateTime.setZone(instant, zone)

  return {
    zoneId,
    iso: DateTime.formatIsoZoned(zoned),
    // formatIsoDate respects the DateTime's zone, so late-night UTC instants can
    // become the next calendar date for users east of UTC.
    localDate: DateTime.formatIsoDate(zoned),
    label: DateTime.format(zoned, {
      locale: "en-US",
      dateStyle: "full",
      timeStyle: "short"
    })
  }
})

export const renderCurrentWorkspaceTime = Effect.fn("renderCurrentWorkspaceTime")(function*(
  zoneId: string
): Effect.fn.Return<WorkspaceTime, Cause.IllegalArgumentError> {
  const now = yield* DateTime.nowInCurrentZone.pipe(
    // CurrentTimeZone is a service. Providing it at the edge keeps the rest of
    // the program independent from system-local time-zone settings.
    DateTime.withCurrentZoneNamed(zoneId)
  )

  return {
    zoneId,
    iso: DateTime.formatIsoZoned(now),
    localDate: DateTime.formatIsoDate(now),
    label: DateTime.format(now, {
      locale: "en-US",
      dateStyle: "full",
      timeStyle: "short"
    })
  }
})

export const workspaceTimeExample = renderInstantForWorkspace(
  DateTime.makeUnsafe("2024-01-01T23:30:00.000Z"),
  "Pacific/Auckland"
)
