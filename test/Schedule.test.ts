import { Array, Duration, Effect, Fiber, Pull, Schedule, TestClock } from "effect"
import { constant, constUndefined } from "effect/Function"
import { describe, expect, it } from "./utils/extend.js"

describe("Schedule", () => {
  describe("spaced", () => {
    it.effect("constant delays", () =>
      Effect.gen(function*() {
        const output = yield* runDelays(Schedule.spaced(Duration.seconds(1)), Array.makeBy(5, constUndefined))
        expect(output).toEqual(Array.makeBy(5, constant(Duration.seconds(1))))
      }))
  })

  describe("fixed", () => {
    it.effect("constant delays", () =>
      Effect.gen(function*() {
        const output = yield* runDelays(Schedule.fixed(Duration.seconds(1)), Array.makeBy(5, constUndefined))
        expect(output).toEqual(Array.makeBy(5, constant(Duration.seconds(1))))
      }))
  })

  describe("windowed", () => {
    it.effect("constant delays", () =>
      Effect.gen(function*() {
        const output = yield* runDelays(Schedule.windowed(Duration.seconds(1)), Array.makeBy(5, constUndefined))
        expect(output).toEqual(Array.makeBy(5, constant(Duration.seconds(1))))
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
