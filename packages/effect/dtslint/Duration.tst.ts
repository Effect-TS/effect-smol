import { hole } from "effect"
import * as Duration from "effect/Duration"
import { describe, expect, it } from "tstyche"

describe("Duration", () => {
  it("unit getters accept Input", () => {
    const input = hole<Duration.Input>()
    expect(Duration.toSeconds(input)).type.toBe<number>()
    expect(Duration.toMinutes(input)).type.toBe<number>()
    expect(Duration.toHours(input)).type.toBe<number>()
    expect(Duration.toDays(input)).type.toBe<number>()
    expect(Duration.toWeeks(input)).type.toBe<number>()
  })
})
