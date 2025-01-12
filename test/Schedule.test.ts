import { Array, Duration, Effect, Fiber, Pull, Schedule, TestClock } from "effect"
import { constant, constUndefined } from "effect/Function"
import { describe, expect, it } from "./utils/extend.js"

describe("Schedule", () => {
  describe("collecting", () => {
    it.effect("collectInputs - should collect all schedule inputs", () =>
      Effect.gen(function*() {
        const schedule = Schedule.collectInputs(Schedule.forever)
        const inputs = Array.range(1, 5)
        const outputs = yield* runLast(schedule, inputs)
        expect(outputs).toEqual(inputs)
      }))

    it.effect("collectOutputs - should collect all schedule outputs", () =>
      Effect.gen(function*() {
        const schedule = Schedule.collectOutputs(Schedule.forever)
        const inputs = Array.makeBy(5, constUndefined)
        const outputs = yield* runLast(schedule, inputs)
        expect(outputs).toEqual([0, 1, 2, 3, 4])
      }))

    it.effect("collectWhile - should collect while the predicate holds", () =>
      Effect.gen(function*() {
        const schedule = Schedule.collectWhile(Schedule.forever, ({ output }) => output < 3)
        const inputs = Array.makeBy(5, constUndefined)
        const outputs = yield* runLast(schedule, inputs)
        expect(outputs).toEqual([0, 1, 2, 3])
      }))

    it.effect("collectWhile - should collect while the effectful predicate holds", () =>
      Effect.gen(function*() {
        const schedule = Schedule.collectWhile(Schedule.forever, ({ output }) => Effect.succeed(output < 3))
        const inputs = Array.makeBy(5, constUndefined)
        const outputs = yield* runLast(schedule, inputs)
        expect(outputs).toEqual([0, 1, 2, 3])
      }))
  })

  describe("sequencing", () => {
    it.effect("andThenEither - executes schedules sequentially to completion", () =>
      Effect.gen(function*() {
        const left = Schedule.fixed("500 millis").pipe(
          Schedule.while(({ recurrence }) => recurrence < 3)
        )
        const right = Schedule.fixed("1 second")
        const schedule = Schedule.andThenEither(left, right)
        const inputs = Array.makeBy(6, constUndefined)
        const outputs = yield* runDelays(schedule, inputs)
        expect(outputs).toEqual([
          Duration.millis(500),
          Duration.millis(500),
          Duration.millis(500),
          Duration.zero,
          Duration.seconds(1),
          Duration.seconds(1)
        ])
      }))
  })

  describe("spaced", () => {
    it.effect("constant delays", () =>
      Effect.gen(function*() {
        const schedule = Schedule.spaced(Duration.seconds(1))
        const inputs = Array.makeBy(5, constUndefined)
        const output = yield* runDelays(schedule, inputs)
        expect(output).toEqual(Array.makeBy(5, constant(Duration.seconds(1))))
      }))
  })

  describe("fixed", () => {
    it.effect("constant delays", () =>
      Effect.gen(function*() {
        const schedule = Schedule.fixed(Duration.seconds(1))
        const inputs = Array.makeBy(5, constUndefined)
        const output = yield* runDelays(schedule, inputs)
        expect(output).toEqual(Array.makeBy(5, constant(Duration.seconds(1))))
      }))
  })

  describe("windowed", () => {
    it.effect("constant delays", () =>
      Effect.gen(function*() {
        const schedule = Schedule.windowed(Duration.seconds(1))
        const inputs = Array.makeBy(5, constUndefined)
        const output = yield* runDelays(schedule, inputs)
        expect(output).toEqual(Array.makeBy(5, constant(Duration.seconds(1))))
      }))

    it.effect("delays until the nearest window boundary", () =>
      Effect.gen(function*() {
        const delays: Array<Duration.Duration> = []
        const schedule = Schedule.windowed("1 seconds").pipe(
          Schedule.while(({ recurrence }) => recurrence < 5),
          Schedule.delays,
          Schedule.map((delay) => {
            delays.push(delay)
            return delays
          })
        )
        yield* Effect.sleep("1.5 seconds").pipe(
          Effect.schedule(schedule),
          Effect.fork
        )
        yield* TestClock.setTime(Number.POSITIVE_INFINITY)
        expect(delays).toEqual([
          Duration.millis(1000),
          Duration.millis(500),
          Duration.millis(500),
          Duration.millis(500),
          Duration.millis(500),
          Duration.zero
        ])
      }))
  })
})

const run = Effect.fnUntraced(function*<A, E, R>(effect: Effect.Effect<A, E, R>) {
  const fiber = yield* Effect.fork(effect)
  yield* TestClock.setTime(Number.POSITIVE_INFINITY)
  return yield* Fiber.join(fiber)
})

const runCollect = Effect.fnUntraced(function*<Output, Input, Error, Env>(
  schedule: Schedule.Schedule<Output, Input, Error, Env>,
  input: Iterable<Input>
) {
  const step = yield* Schedule.toStepWithSleep(schedule)
  const out: Array<Output> = []
  yield* Effect.gen(function*() {
    for (const value of input) {
      out.push(yield* step(value))
    }
  }).pipe(Pull.catchHalt((value) => {
    out.push(value as Output)
    return Effect.void
  }))
  return out
}, run)

const runDelays = <Output, Input, Error, Env>(
  schedule: Schedule.Schedule<Output, Input, Error, Env>,
  input: Iterable<Input>
) => runCollect(Schedule.delays(schedule), input)

const runLast = <Output, Input, Error, Env>(
  schedule: Schedule.Schedule<Output, Input, Error, Env>,
  input: Iterable<Input>
) =>
  runCollect(schedule, input).pipe(
    Effect.map((outputs) => outputs[outputs.length - 1])
  )
