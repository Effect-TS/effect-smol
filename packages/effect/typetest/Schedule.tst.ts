import { type Effect, hole } from "effect"
import type * as Duration from "effect/Duration"
import * as Schedule from "effect/Schedule"
import { describe, expect, it } from "tstyche"

describe("Schedule", () => {
  it("isSchedule", () => {
    const input = hole<{ a: number } | Schedule.Schedule<string, number, never, never>>()
    if (Schedule.isSchedule(input)) {
      expect(input).type.toBe<Schedule.Schedule<string, number, never, never>>()
    }
  })

  it("tap", () => {
    const self = hole<Schedule.Schedule<number, string, "error", "service">>()
    const schedule = Schedule.tap(self, (metadata) => {
      expect(metadata).type.toBe<Schedule.Metadata<number, string>>()
      return hole<Effect.Effect<void, "tapError", "tapService">>()
    })
    expect(schedule).type.toBe<Schedule.Schedule<number, string, "error" | "tapError", "service" | "tapService">>()
  })

  it("min", () => {
    const left = hole<Schedule.Schedule<number, { readonly left: string }, "leftError", "leftService">>()
    const right = hole<Schedule.Schedule<string, { readonly right: number }, "rightError", "rightService">>()
    const schedule = Schedule.min([left, right])
    expect(schedule).type.toBe<
      Schedule.Schedule<
        Duration.Duration,
        { readonly left: string } & { readonly right: number },
        "leftError" | "rightError",
        "leftService" | "rightService"
      >
    >()
  })
})
