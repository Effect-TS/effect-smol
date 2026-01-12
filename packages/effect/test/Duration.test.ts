import { describe, it } from "@effect/vitest"
import { assertFalse, assertTrue, assertUndefined, deepStrictEqual, strictEqual, throws } from "@effect/vitest/utils"
import { Duration, Equal, pipe } from "effect"

describe("Duration", () => {
  it("fromDurationInputUnsafe", () => {
    const millis100 = Duration.millis(100)
    assertTrue(Duration.fromDurationInputUnsafe(millis100) === millis100)

    deepStrictEqual(Duration.fromDurationInputUnsafe(100), millis100)

    deepStrictEqual(Duration.fromDurationInputUnsafe(10n), Duration.nanos(10n))

    deepStrictEqual(Duration.fromDurationInputUnsafe("1 nano"), Duration.nanos(1n))
    deepStrictEqual(Duration.fromDurationInputUnsafe("10 nanos"), Duration.nanos(10n))
    deepStrictEqual(Duration.fromDurationInputUnsafe("1 micro"), Duration.micros(1n))
    deepStrictEqual(Duration.fromDurationInputUnsafe("10 micros"), Duration.micros(10n))
    deepStrictEqual(Duration.fromDurationInputUnsafe("1 milli"), Duration.millis(1))
    deepStrictEqual(Duration.fromDurationInputUnsafe("10 millis"), Duration.millis(10))
    deepStrictEqual(Duration.fromDurationInputUnsafe("1 second"), Duration.seconds(1))
    deepStrictEqual(Duration.fromDurationInputUnsafe("10 seconds"), Duration.seconds(10))
    deepStrictEqual(Duration.fromDurationInputUnsafe("1 minute"), Duration.minutes(1))
    deepStrictEqual(Duration.fromDurationInputUnsafe("10 minutes"), Duration.minutes(10))
    deepStrictEqual(Duration.fromDurationInputUnsafe("1 hour"), Duration.hours(1))
    deepStrictEqual(Duration.fromDurationInputUnsafe("10 hours"), Duration.hours(10))
    deepStrictEqual(Duration.fromDurationInputUnsafe("1 day"), Duration.days(1))
    deepStrictEqual(Duration.fromDurationInputUnsafe("10 days"), Duration.days(10))
    deepStrictEqual(Duration.fromDurationInputUnsafe("1 week"), Duration.weeks(1))
    deepStrictEqual(Duration.fromDurationInputUnsafe("10 weeks"), Duration.weeks(10))

    deepStrictEqual(Duration.fromDurationInputUnsafe("1.5 seconds"), Duration.seconds(1.5))
    deepStrictEqual(Duration.fromDurationInputUnsafe("-1.5 seconds"), Duration.zero)

    deepStrictEqual(Duration.fromDurationInputUnsafe([500, 123456789]), Duration.nanos(500123456789n))
    deepStrictEqual(Duration.fromDurationInputUnsafe([-500, 123456789]), Duration.zero)
    deepStrictEqual(Duration.fromDurationInputUnsafe([Infinity, 0]), Duration.infinity)
    deepStrictEqual(Duration.fromDurationInputUnsafe([-Infinity, 0]), Duration.zero)
    deepStrictEqual(Duration.fromDurationInputUnsafe([NaN, 0]), Duration.zero)
    deepStrictEqual(Duration.fromDurationInputUnsafe([0, Infinity]), Duration.infinity)
    deepStrictEqual(Duration.fromDurationInputUnsafe([0, -Infinity]), Duration.zero)
    deepStrictEqual(Duration.fromDurationInputUnsafe([0, NaN]), Duration.zero)
  })

  it("fromDurationInput", () => {
    const millis100 = Duration.millis(100)
    deepStrictEqual(Duration.fromDurationInput(millis100), millis100)

    deepStrictEqual(Duration.fromDurationInput(100), millis100)

    deepStrictEqual(Duration.fromDurationInput(10n), Duration.nanos(10n))

    deepStrictEqual(Duration.fromDurationInput("1 nano"), Duration.nanos(1n))
    deepStrictEqual(Duration.fromDurationInput("10 nanos"), Duration.nanos(10n))
    deepStrictEqual(Duration.fromDurationInput("1 micro"), Duration.micros(1n))
    deepStrictEqual(Duration.fromDurationInput("10 micros"), Duration.micros(10n))
    deepStrictEqual(Duration.fromDurationInput("1 milli"), Duration.millis(1))
    deepStrictEqual(Duration.fromDurationInput("10 millis"), Duration.millis(10))
    deepStrictEqual(Duration.fromDurationInput("1 second"), Duration.seconds(1))
    deepStrictEqual(Duration.fromDurationInput("10 seconds"), Duration.seconds(10))
    deepStrictEqual(Duration.fromDurationInput("1 minute"), Duration.minutes(1))
    deepStrictEqual(Duration.fromDurationInput("10 minutes"), Duration.minutes(10))
    deepStrictEqual(Duration.fromDurationInput("1 hour"), Duration.hours(1))
    deepStrictEqual(Duration.fromDurationInput("10 hours"), Duration.hours(10))
    deepStrictEqual(Duration.fromDurationInput("1 day"), Duration.days(1))
    deepStrictEqual(Duration.fromDurationInput("10 days"), Duration.days(10))
    deepStrictEqual(Duration.fromDurationInput("1 week"), Duration.weeks(1))
    deepStrictEqual(Duration.fromDurationInput("10 weeks"), Duration.weeks(10))

    deepStrictEqual(Duration.fromDurationInput("1.5 seconds"), Duration.seconds(1.5))
    deepStrictEqual(Duration.fromDurationInput("-1.5 seconds"), Duration.zero)

    deepStrictEqual(Duration.fromDurationInput([500, 123456789]), Duration.nanos(500123456789n))
    deepStrictEqual(Duration.fromDurationInput([-500, 123456789]), Duration.zero)
    deepStrictEqual(Duration.fromDurationInput([Infinity, 0]), Duration.infinity)
    deepStrictEqual(Duration.fromDurationInput([-Infinity, 0]), Duration.zero)
    deepStrictEqual(Duration.fromDurationInput([NaN, 0]), Duration.zero)
    deepStrictEqual(Duration.fromDurationInput([0, Infinity]), Duration.infinity)
    deepStrictEqual(Duration.fromDurationInput([0, -Infinity]), Duration.zero)
    deepStrictEqual(Duration.fromDurationInput([0, NaN]), Duration.zero)
  })

  it("Order", () => {
    // millis
    deepStrictEqual(Duration.Order(Duration.millis(1), Duration.millis(2)), -1)
    deepStrictEqual(Duration.Order(Duration.millis(2), Duration.millis(1)), 1)
    deepStrictEqual(Duration.Order(Duration.millis(2), Duration.millis(2)), 0)
    deepStrictEqual(Duration.Order(Duration.millis(1), Duration.nanos(2_000_000n)), -1)

    // nanos
    deepStrictEqual(Duration.Order(Duration.nanos(1n), Duration.nanos(2n)), -1)
    deepStrictEqual(Duration.Order(Duration.nanos(2n), Duration.nanos(1n)), 1)
    deepStrictEqual(Duration.Order(Duration.nanos(2n), Duration.nanos(2n)), 0)
    deepStrictEqual(Duration.Order(Duration.nanos(2_000_000n), Duration.millis(1)), 1)

    // infinity
    deepStrictEqual(Duration.Order(Duration.infinity, Duration.infinity), 0)
    deepStrictEqual(Duration.Order(Duration.infinity, Duration.millis(1)), 1)
    deepStrictEqual(Duration.Order(Duration.infinity, Duration.nanos(1n)), 1)
    deepStrictEqual(Duration.Order(Duration.millis(1), Duration.infinity), -1)
    deepStrictEqual(Duration.Order(Duration.nanos(1n), Duration.infinity), -1)
  })

  it("Equivalence", () => {
    // millis
    assertTrue(Duration.Equivalence(Duration.millis(1), Duration.millis(1)))
    assertTrue(Duration.Equivalence(Duration.millis(1), Duration.nanos(1_000_000n)))
    assertFalse(Duration.Equivalence(Duration.millis(1), Duration.millis(2)))
    assertFalse(Duration.Equivalence(Duration.millis(1), Duration.millis(2)))

    // nanos
    assertTrue(Duration.Equivalence(Duration.nanos(1n), Duration.nanos(1n)))
    assertTrue(Duration.Equivalence(Duration.nanos(1_000_000n), Duration.millis(1)))
    assertFalse(Duration.Equivalence(Duration.nanos(1n), Duration.nanos(2n)))
    assertFalse(Duration.Equivalence(Duration.nanos(1n), Duration.nanos(2n)))

    // infinity
    assertTrue(Duration.Equivalence(Duration.infinity, Duration.infinity))
    assertFalse(Duration.Equivalence(Duration.infinity, Duration.millis(1)))
    assertFalse(Duration.Equivalence(Duration.infinity, Duration.nanos(1n)))
    assertFalse(Duration.Equivalence(Duration.millis(1), Duration.infinity))
    assertFalse(Duration.Equivalence(Duration.nanos(1n), Duration.infinity))
  })

  it("max", () => {
    deepStrictEqual(Duration.max(Duration.millis(1), Duration.millis(2)), Duration.millis(2))
    deepStrictEqual(Duration.max(Duration.minutes(1), Duration.millis(2)), Duration.minutes(1))
  })

  it("min", () => {
    deepStrictEqual(Duration.min(Duration.millis(1), Duration.millis(2)), Duration.millis(1))
    deepStrictEqual(Duration.min(Duration.minutes(1), Duration.millis(2)), Duration.millis(2))
  })

  it("clamp", () => {
    deepStrictEqual(
      Duration.clamp(Duration.millis(1), {
        minimum: Duration.millis(2),
        maximum: Duration.millis(3)
      }),
      Duration.millis(2)
    )
    deepStrictEqual(
      Duration.clamp(Duration.minutes(1.5), {
        minimum: Duration.minutes(1),
        maximum: Duration.minutes(2)
      }),
      Duration.minutes(1.5)
    )
  })

  it("equals", () => {
    assertTrue(pipe(Duration.hours(1), Duration.equals(Duration.minutes(60))))
  })

  it("between", () => {
    assertTrue(Duration.between(Duration.hours(1), {
      minimum: Duration.minutes(59),
      maximum: Duration.minutes(61)
    }))
    assertTrue(
      Duration.between(Duration.minutes(1), {
        minimum: Duration.seconds(59),
        maximum: Duration.seconds(61)
      })
    )
  })

  it("divide", () => {
    // millis
    deepStrictEqual(Duration.divide(Duration.minutes(1), 2), Duration.seconds(30))
    deepStrictEqual(Duration.divide(Duration.seconds(1), 3), Duration.nanos(333333333n))
    deepStrictEqual(Duration.divide(Duration.zero, 2), Duration.zero)
    deepStrictEqual(Duration.divide(Duration.minutes(1), 0.5), Duration.minutes(2))
    deepStrictEqual(Duration.divide(Duration.minutes(1), 1.5), Duration.seconds(40))

    // nanos
    deepStrictEqual(Duration.divide(Duration.nanos(2n), 2), Duration.nanos(1n))
    deepStrictEqual(Duration.divide(Duration.nanos(1n), 3), Duration.zero)
    throws(() => Duration.divide(Duration.nanos(1n), 0.5))
    throws(() => Duration.divide(Duration.nanos(1n), 1.5))

    // infinity
    deepStrictEqual(Duration.divide(Duration.infinity, 2), Duration.infinity)

    // divide by zero
    deepStrictEqual(Duration.divide(Duration.minutes(1), 0), undefined)
    deepStrictEqual(Duration.divide(Duration.minutes(1), -0), undefined)
    deepStrictEqual(Duration.divide(Duration.nanos(1n), 0), undefined)
    deepStrictEqual(Duration.divide(Duration.nanos(1n), -0), undefined)

    // bad by
    deepStrictEqual(Duration.divide(Duration.minutes(1), NaN), undefined)
    deepStrictEqual(Duration.divide(Duration.nanos(1n), NaN), undefined)
    deepStrictEqual(Duration.divide(Duration.infinity, NaN), undefined)

    deepStrictEqual(Duration.divide(Duration.minutes(1), Infinity), undefined)
    deepStrictEqual(Duration.divide(Duration.nanos(1n), Infinity), undefined)
    deepStrictEqual(Duration.divide(Duration.infinity, Infinity), undefined)

    deepStrictEqual(Duration.divide(Duration.minutes(1), -Infinity), undefined)
    deepStrictEqual(Duration.divide(Duration.nanos(1n), -Infinity), undefined)
    deepStrictEqual(Duration.divide(Duration.infinity, -Infinity), undefined)
  })

  it("divideUnsafe", () => {
    // millis
    deepStrictEqual(Duration.divideUnsafe(Duration.minutes(1), 2), Duration.seconds(30))
    deepStrictEqual(Duration.divideUnsafe(Duration.seconds(1), 3), Duration.nanos(333333333n))
    deepStrictEqual(Duration.divideUnsafe(Duration.zero, 2), Duration.zero)
    deepStrictEqual(Duration.divideUnsafe(Duration.minutes(1), 0.5), Duration.minutes(2))
    deepStrictEqual(Duration.divideUnsafe(Duration.minutes(1), 1.5), Duration.seconds(40))

    // nanos
    deepStrictEqual(Duration.divideUnsafe(Duration.nanos(2n), 2), Duration.nanos(1n))
    deepStrictEqual(Duration.divideUnsafe(Duration.nanos(1n), 3), Duration.zero)
    throws(() => Duration.divideUnsafe(Duration.nanos(1n), 0.5))
    throws(() => Duration.divideUnsafe(Duration.nanos(1n), 1.5))

    // infinity
    deepStrictEqual(Duration.divideUnsafe(Duration.infinity, 2), Duration.infinity)

    // divide by zero
    deepStrictEqual(Duration.divideUnsafe(Duration.minutes(1), 0), Duration.infinity)
    deepStrictEqual(Duration.divideUnsafe(Duration.minutes(1), -0), Duration.zero)
    deepStrictEqual(Duration.divideUnsafe(Duration.nanos(1n), 0), Duration.infinity)
    deepStrictEqual(Duration.divideUnsafe(Duration.nanos(1n), -0), Duration.zero)

    // bad by
    deepStrictEqual(Duration.divideUnsafe(Duration.minutes(1), NaN), Duration.zero)
    deepStrictEqual(Duration.divideUnsafe(Duration.nanos(1n), NaN), Duration.zero)
    deepStrictEqual(Duration.divideUnsafe(Duration.infinity, NaN), Duration.zero)

    deepStrictEqual(Duration.divideUnsafe(Duration.minutes(1), Infinity), Duration.zero)
    deepStrictEqual(Duration.divideUnsafe(Duration.nanos(1n), Infinity), Duration.zero)
    deepStrictEqual(Duration.divideUnsafe(Duration.infinity, Infinity), Duration.zero)

    deepStrictEqual(Duration.divideUnsafe(Duration.minutes(1), -Infinity), Duration.zero)
    deepStrictEqual(Duration.divideUnsafe(Duration.nanos(1n), -Infinity), Duration.zero)
    deepStrictEqual(Duration.divideUnsafe(Duration.infinity, -Infinity), Duration.zero)
  })

  it("times", () => {
    deepStrictEqual(Duration.times(Duration.seconds(1), 60), Duration.minutes(1))
    deepStrictEqual(Duration.times(Duration.nanos(2n), 10), Duration.nanos(20n))
    deepStrictEqual(Duration.times(Duration.infinity, 60), Duration.infinity)
  })

  it("sum", () => {
    // millis
    deepStrictEqual(Duration.sum(Duration.seconds(30), Duration.seconds(30)), Duration.minutes(1))

    // nanos
    deepStrictEqual(Duration.sum(Duration.nanos(30n), Duration.nanos(30n)), Duration.nanos(60n))

    // infinity
    deepStrictEqual(Duration.sum(Duration.infinity, Duration.seconds(30)), Duration.infinity)
    deepStrictEqual(Duration.sum(Duration.seconds(30), Duration.infinity), Duration.infinity)
    deepStrictEqual(Duration.sum(Duration.infinity, Duration.nanos(1n)), Duration.infinity)
    deepStrictEqual(Duration.sum(Duration.nanos(1n), Duration.infinity), Duration.infinity)
    deepStrictEqual(Duration.sum(Duration.infinity, Duration.infinity), Duration.infinity)
  })

  it("subtract", () => {
    // millis
    deepStrictEqual(Duration.subtract(Duration.seconds(30), Duration.seconds(10)), Duration.seconds(20))
    deepStrictEqual(Duration.subtract(Duration.seconds(30), Duration.seconds(30)), Duration.zero)
    deepStrictEqual(Duration.subtract(Duration.seconds(30), Duration.seconds(40)), Duration.zero)

    // nanos
    deepStrictEqual(Duration.subtract(Duration.nanos(30n), Duration.nanos(10n)), Duration.nanos(20n))
    deepStrictEqual(Duration.subtract(Duration.nanos(30n), Duration.nanos(30n)), Duration.zero)
    deepStrictEqual(Duration.subtract(Duration.nanos(30n), Duration.nanos(40n)), Duration.zero)

    // infinity
    deepStrictEqual(Duration.subtract(Duration.infinity, Duration.seconds(30)), Duration.infinity)
    deepStrictEqual(Duration.subtract(Duration.infinity, Duration.nanos(30n)), Duration.infinity)
    deepStrictEqual(Duration.subtract(Duration.seconds(30), Duration.infinity), Duration.zero)
    deepStrictEqual(Duration.subtract(Duration.nanos(30n), Duration.infinity), Duration.zero)
    deepStrictEqual(Duration.subtract(Duration.infinity, Duration.infinity), Duration.zero)
  })

  it("isGreaterThan", () => {
    assertTrue(pipe(Duration.seconds(30), Duration.isGreaterThan(Duration.seconds(20))))
    assertFalse(pipe(Duration.seconds(30), Duration.isGreaterThan(Duration.seconds(30))))
    assertFalse(pipe(Duration.seconds(30), Duration.isGreaterThan(Duration.seconds(60))))

    assertTrue(pipe(Duration.nanos(30n), Duration.isGreaterThan(Duration.nanos(20n))))
    assertFalse(pipe(Duration.nanos(30n), Duration.isGreaterThan(Duration.nanos(30n))))
    assertFalse(pipe(Duration.nanos(30n), Duration.isGreaterThan(Duration.nanos(60n))))

    assertTrue(pipe(Duration.millis(1), Duration.isGreaterThan(Duration.nanos(1n))))

    assertTrue(pipe(Duration.infinity, Duration.isGreaterThan(Duration.seconds(20))))
    assertFalse(pipe(Duration.seconds(-Infinity), Duration.isGreaterThan(Duration.infinity)))
    assertFalse(pipe(Duration.nanos(1n), Duration.isGreaterThan(Duration.infinity)))
  })

  it("isGreaterThanOrEqualTo", () => {
    assertTrue(pipe(Duration.seconds(30), Duration.isGreaterThanOrEqualTo(Duration.seconds(20))))
    assertTrue(pipe(Duration.seconds(30), Duration.isGreaterThanOrEqualTo(Duration.seconds(30))))
    assertFalse(pipe(Duration.seconds(30), Duration.isGreaterThanOrEqualTo(Duration.seconds(60))))

    assertTrue(pipe(Duration.nanos(30n), Duration.isGreaterThanOrEqualTo(Duration.nanos(20n))))
    assertTrue(pipe(Duration.nanos(30n), Duration.isGreaterThanOrEqualTo(Duration.nanos(30n))))
    assertFalse(pipe(Duration.nanos(30n), Duration.isGreaterThanOrEqualTo(Duration.nanos(60n))))
  })

  it("isLessThan", () => {
    assertTrue(pipe(Duration.seconds(20), Duration.isLessThan(Duration.seconds(30))))
    assertFalse(pipe(Duration.seconds(30), Duration.isLessThan(Duration.seconds(30))))
    assertFalse(pipe(Duration.seconds(60), Duration.isLessThan(Duration.seconds(30))))

    assertTrue(pipe(Duration.nanos(20n), Duration.isLessThan(Duration.nanos(30n))))
    assertFalse(pipe(Duration.nanos(30n), Duration.isLessThan(Duration.nanos(30n))))
    assertFalse(pipe(Duration.nanos(60n), Duration.isLessThan(Duration.nanos(30n))))

    assertTrue(pipe(Duration.nanos(1n), Duration.isLessThan(Duration.millis(1))))
  })

  it("isLessThanOrEqualTo", () => {
    assertTrue(pipe(Duration.seconds(20), Duration.isLessThanOrEqualTo(Duration.seconds(30))))
    assertTrue(pipe(Duration.seconds(30), Duration.isLessThanOrEqualTo(Duration.seconds(30))))
    assertFalse(pipe(Duration.seconds(60), Duration.isLessThanOrEqualTo(Duration.seconds(30))))

    assertTrue(pipe(Duration.nanos(20n), Duration.isLessThanOrEqualTo(Duration.nanos(30n))))
    assertTrue(pipe(Duration.nanos(30n), Duration.isLessThanOrEqualTo(Duration.nanos(30n))))
    assertFalse(pipe(Duration.nanos(60n), Duration.isLessThanOrEqualTo(Duration.nanos(30n))))
  })

  it("toString()", () => {
    strictEqual(String(Duration.infinity), `Infinity`)
    strictEqual(String(Duration.nanos(10n)), `10 nanos`)
    strictEqual(String(Duration.millis(2)), `2 millis`)
    strictEqual(String(Duration.millis(2.125)), `2125000 nanos`)
    strictEqual(String(Duration.seconds(2)), `2000 millis`)
    strictEqual(String(Duration.seconds(2.5)), `2500 millis`)
  })

  it("format", () => {
    strictEqual(Duration.format(Duration.infinity), `Infinity`)
    strictEqual(Duration.format(Duration.minutes(5)), `5m`)
    strictEqual(Duration.format(Duration.minutes(5.325)), `5m 19s 500ms`)
    strictEqual(Duration.format(Duration.hours(3)), `3h`)
    strictEqual(Duration.format(Duration.hours(3.11125)), `3h 6m 40s 500ms`)
    strictEqual(Duration.format(Duration.days(2)), `2d`)
    strictEqual(Duration.format(Duration.days(2.25)), `2d 6h`)
    strictEqual(Duration.format(Duration.weeks(1)), `7d`)
    strictEqual(Duration.format(Duration.zero), `0`)
  })

  it("parts", () => {
    deepStrictEqual(Duration.parts(Duration.infinity), {
      days: Infinity,
      hours: Infinity,
      minutes: Infinity,
      seconds: Infinity,
      millis: Infinity,
      nanos: Infinity
    })

    deepStrictEqual(Duration.parts(Duration.minutes(5.325)), {
      days: 0,
      hours: 0,
      minutes: 5,
      seconds: 19,
      millis: 500,
      nanos: 0
    })

    deepStrictEqual(Duration.parts(Duration.minutes(3.11125)), {
      days: 0,
      hours: 0,
      minutes: 3,
      seconds: 6,
      millis: 675,
      nanos: 0
    })
  })

  it("toJSON", () => {
    deepStrictEqual(Duration.seconds(2).toJSON(), { _id: "Duration", _tag: "Millis", millis: 2000 })
    deepStrictEqual(Duration.nanos(5n).toJSON(), { _id: "Duration", _tag: "Nanos", nanos: "5" })
    deepStrictEqual(Duration.millis(1.5).toJSON(), { _id: "Duration", _tag: "Nanos", nanos: "1500000" })
    deepStrictEqual(Duration.infinity.toJSON(), { _id: "Duration", _tag: "Infinity" })
  })

  it(`inspect`, () => {
    if (typeof window === "undefined") {
      // oxlint-disable-next-line @typescript-eslint/no-require-imports
      const { inspect } = require("node:util")
      deepStrictEqual(inspect(Duration.millis(1000)), inspect({ _id: "Duration", _tag: "Millis", millis: 1000 }))
    }
  })

  it(".pipe()", () => {
    deepStrictEqual(Duration.seconds(1).pipe(Duration.sum(Duration.seconds(1))), Duration.seconds(2))
  })

  it("isDuration", () => {
    assertTrue(Duration.isDuration(Duration.millis(100)))
    assertFalse(Duration.isDuration(null))
  })

  it("zero", () => {
    deepStrictEqual(Duration.sum(Duration.seconds(1), Duration.zero), Duration.seconds(1))
  })

  it("weeks", () => {
    assertTrue(Equal.equals(Duration.weeks(1), Duration.days(7)))
    assertFalse(Equal.equals(Duration.weeks(1), Duration.days(1)))
  })

  it("toMillis", () => {
    strictEqual(Duration.millis(1).pipe(Duration.toMillis), 1)
    strictEqual(Duration.nanos(1n).pipe(Duration.toMillis), 0.000001)
    strictEqual(Duration.infinity.pipe(Duration.toMillis), Infinity)
  })

  it("toSeconds", () => {
    strictEqual(Duration.millis(1).pipe(Duration.toSeconds), 0.001)
    strictEqual(Duration.nanos(1n).pipe(Duration.toSeconds), 1e-9)
    strictEqual(Duration.infinity.pipe(Duration.toSeconds), Infinity)
  })

  it("toNanos", () => {
    deepStrictEqual(Duration.nanos(1n).pipe(Duration.toNanos), 1n)
    assertUndefined(Duration.infinity.pipe(Duration.toNanos))
    deepStrictEqual(Duration.millis(1.0005).pipe(Duration.toNanos), 1_000_500n)
    deepStrictEqual(Duration.millis(100).pipe(Duration.toNanos), 100_000_000n)
  })

  it("toNanosUnsafe", () => {
    strictEqual(Duration.nanos(1n).pipe(Duration.toNanosUnsafe), 1n)
    throws(() => Duration.infinity.pipe(Duration.toNanosUnsafe))
    strictEqual(Duration.millis(1.0005).pipe(Duration.toNanosUnsafe), 1_000_500n)
    strictEqual(Duration.millis(100).pipe(Duration.toNanosUnsafe), 100_000_000n)
  })

  it("toHrTime", () => {
    deepStrictEqual(Duration.millis(1).pipe(Duration.toHrTime), [0, 1_000_000])
    deepStrictEqual(Duration.nanos(1n).pipe(Duration.toHrTime), [0, 1])
    deepStrictEqual(Duration.nanos(1_000_000_001n).pipe(Duration.toHrTime), [1, 1])
    deepStrictEqual(Duration.millis(1001).pipe(Duration.toHrTime), [1, 1_000_000])
    deepStrictEqual(Duration.infinity.pipe(Duration.toHrTime), [Infinity, 0])
  })

  it("floor is 0", () => {
    deepStrictEqual(Duration.millis(-1), Duration.zero)
    deepStrictEqual(Duration.nanos(-1n), Duration.zero)
  })

  it("match", () => {
    const match = Duration.match({
      onMillis: (millis) => `millis: ${millis}`,
      onNanos: (nanos) => `nanos: ${nanos}`,
      onInfinity: () => "infinity"
    })
    strictEqual(match(Duration.millis(100)), "millis: 100")
    strictEqual(match(Duration.nanos(10n)), "nanos: 10")
    strictEqual(match(Duration.infinity), "infinity")
  })

  it("isFinite", () => {
    assertTrue(Duration.isFinite(Duration.millis(100)))
    assertTrue(Duration.isFinite(Duration.nanos(100n)))
    assertFalse(Duration.isFinite(Duration.infinity))
  })

  it("isZero", () => {
    assertTrue(Duration.isZero(Duration.zero))
    assertTrue(Duration.isZero(Duration.millis(0)))
    assertTrue(Duration.isZero(Duration.nanos(0n)))
    assertFalse(Duration.isZero(Duration.infinity))
    assertFalse(Duration.isZero(Duration.millis(1)))
    assertFalse(Duration.isZero(Duration.nanos(1n)))
  })

  it("toMinutes", () => {
    strictEqual(Duration.millis(60000).pipe(Duration.toMinutes), 1)
    strictEqual(Duration.nanos(60000000000n).pipe(Duration.toMinutes), 1)
    strictEqual(Duration.infinity.pipe(Duration.toMinutes), Infinity)
  })

  it("toHours", () => {
    strictEqual(Duration.millis(3_600_000).pipe(Duration.toHours), 1)
    strictEqual(Duration.nanos(3_600_000_000_000n).pipe(Duration.toHours), 1)
    strictEqual(Duration.infinity.pipe(Duration.toHours), Infinity)
  })

  it("toDays", () => {
    strictEqual(Duration.millis(86_400_000).pipe(Duration.toDays), 1)
    strictEqual(Duration.nanos(86_400_000_000_000n).pipe(Duration.toDays), 1)
    strictEqual(Duration.infinity.pipe(Duration.toDays), Infinity)
  })

  it("toWeeks", () => {
    strictEqual(Duration.millis(604_800_000).pipe(Duration.toWeeks), 1)
    strictEqual(Duration.nanos(604_800_000_000_000n).pipe(Duration.toWeeks), 1)
    strictEqual(Duration.infinity.pipe(Duration.toWeeks), Infinity)
  })

  it("ReducerSum", () => {
    deepStrictEqual(Duration.ReducerSum.combine(Duration.millis(1), Duration.millis(2)), Duration.millis(3))
  })

  it("CombinerMax", () => {
    deepStrictEqual(Duration.CombinerMax.combine(Duration.millis(1), Duration.millis(2)), Duration.millis(2))
  })

  it("CombinerMin", () => {
    deepStrictEqual(Duration.CombinerMin.combine(Duration.millis(1), Duration.millis(2)), Duration.millis(1))
  })
})
