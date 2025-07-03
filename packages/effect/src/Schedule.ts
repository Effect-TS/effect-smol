/**
 * This module provides utilities for creating and composing schedules for retrying operations,
 * repeating effects, and implementing various timing strategies.
 *
 * A Schedule is a function that takes an input and returns a decision whether to continue or halt,
 * along with a delay duration. Schedules can be combined, transformed, and used to implement
 * sophisticated retry and repetition logic.
 *
 * @example
 * ```ts
 * import { Effect, Schedule } from "effect"
 *
 * // Retry with exponential backoff
 * const retryPolicy = Schedule.exponential("100 millis", 2.0)
 *   .pipe(Schedule.compose(Schedule.recurs(3)))
 *
 * const program = Effect.gen(function*() {
 *   // This will retry up to 3 times with exponential backoff
 *   const result = yield* Effect.retry(
 *     Effect.fail("Network error"),
 *     retryPolicy
 *   )
 * })
 *
 * // Repeat on a fixed schedule
 * const heartbeat = Effect.log("heartbeat")
 *   .pipe(Effect.repeat(Schedule.spaced("30 seconds")))
 * ```
 *
 * @since 2.0.0
 */
import * as Cron from "./Cron.js"
import type * as DateTime from "./DateTime.js"
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import type { LazyArg } from "./Function.js"
import { constant, constTrue, dual, identity } from "./Function.js"
import { isEffect } from "./internal/core.js"
import * as effect from "./internal/effect.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import * as Pull from "./Pull.js"
import * as Result from "./Result.js"
import type { Contravariant, Covariant } from "./Types.js"

/**
 * @since 2.0.0
 * @category Symbols
 */
export const TypeId: TypeId = "~effect/Schedule"

/**
 * @since 2.0.0
 * @category Symbols
 */
export type TypeId = "~effect/Schedule"

/**
 * @since 2.0.0
 * @category Models
 */
export interface Schedule<out Output, in Input = unknown, out Error = never, out Env = never>
  extends Schedule.Variance<Output, Input, Error, Env>, Pipeable
{}

/**
 * @since 2.0.0
 */
export declare namespace Schedule {
  /**
   * @since 2.0.0
   * @category Models
   */
  export interface Variance<out Output, in Input, out Error, out Env> {
    readonly [TypeId]: VarianceStruct<Output, Input, Error, Env>
  }

  /**
   * @since 2.0.0
   * @category Models
   */
  export interface VarianceStruct<out Output, in Input, out Error, out Env> {
    readonly _Out: Covariant<Output>
    readonly _In: Contravariant<Input>
    readonly _Error: Covariant<Error>
    readonly _Env: Covariant<Env>
  }

  /**
   * @since 4.0.0
   * @category Models
   */
  export interface InputMetadata<Input> {
    readonly input: Input
    readonly recurrence: number
    readonly start: number
    readonly now: number
    readonly elapsed: number
    readonly elapsedSincePrevious: number
  }

  /**
   * @since 4.0.0
   * @category Models
   */
  export interface Metadata<Output, Input> extends InputMetadata<Input> {
    readonly output: Output
  }
}

const ScheduleProto = {
  [TypeId]: {
    _Out: identity,
    _In: identity,
    _Env: identity
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * @since 2.0.0
 * @category guards
 */
export const isSchedule = (u: unknown): u is Schedule<any, any, any, any> => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromStep = <Input, Output, EnvX, Error, ErrorX, Env>(
  step: Effect<
    (now: number, input: Input) => Pull.Pull<[Output, Duration.Duration], ErrorX, Output, EnvX>,
    Error,
    Env
  >
): Schedule<Output, Input, Error | ErrorX, Env | EnvX> => {
  const self = Object.create(ScheduleProto)
  self.step = step
  return self
}

const metadataFn = () => {
  let n = 0
  let previous: number | undefined
  let start: number | undefined
  return <In>(now: number, input: In): Schedule.InputMetadata<In> => {
    if (start === undefined) start = now
    const elapsed = now - start
    const elapsedSincePrevious = previous === undefined ? 0 : now - previous
    previous = now
    return { input, recurrence: n++, start, now, elapsed, elapsedSincePrevious }
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromStepWithMetadata = <Input, Output, EnvX, ErrorX, Error, Env>(
  step: Effect<
    (options: Schedule.InputMetadata<Input>) => Pull.Pull<[Output, Duration.Duration], ErrorX, Output, EnvX>,
    Error,
    Env
  >
): Schedule<Output, Input, Error | ErrorX, Env | EnvX> =>
  fromStep(effect.map(step, (f) => {
    const meta = metadataFn()
    return (now, input) => f(meta(now, input))
  }))

/**
 * @since 4.0.0
 * @category destructors
 */
export const toStep = <Output, Input, Error, Env>(
  schedule: Schedule<Output, Input, Error, Env>
): Effect<
  (now: number, input: Input) => Pull.Pull<[Output, Duration.Duration], Error, Output, Env>,
  never,
  Env
> =>
  effect.catchCause(
    (schedule as any).step,
    (cause) => effect.succeed(() => effect.failCause(cause) as any)
  )

/**
 * @since 4.0.0
 * @category destructors
 */
export const toStepWithSleep = <Output, Input, Error, Env>(
  schedule: Schedule<Output, Input, Error, Env>
): Effect<
  (input: Input) => Pull.Pull<Output, Error, Output, Env>,
  never,
  Env
> =>
  effect.clockWith((clock) =>
    effect.map(
      toStep(schedule),
      (step) => (input) =>
        effect.flatMap(
          effect.suspend(() => step(clock.unsafeCurrentTimeMillis(), input)),
          ([output, duration]) =>
            Duration.isZero(duration) ? effect.succeed(output) : effect.as(effect.sleep(duration), output)
        )
    )
  )

/**
 * Returns a new `Schedule` that adds the delay computed by the specified
 * effectful function to the the next recurrence of the schedule.
 *
 * @since 2.0.0
 * @category utils
 */
export const addDelay: {
  <Output, Error2 = never, Env2 = never>(
    f: (output: Output) => Duration.DurationInput | Effect<Duration.DurationInput, Error2, Env2>
  ): <Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Error2 = never, Env2 = never>(
    self: Schedule<Output, Input, Error, Env>,
    f: (output: Output) => Duration.DurationInput | Effect<Duration.DurationInput, Error2, Env>
  ): Schedule<Output, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Error2 = never, Env2 = never>(
  self: Schedule<Output, Input, Error, Env>,
  f: (output: Output) => Duration.DurationInput | Effect<Duration.DurationInput, Error2, Env>
): Schedule<Output, Input, Error | Error2, Env | Env2> =>
  modifyDelay(self, (output, delay) => {
    const addDelay = f(output)
    return isEffect(addDelay)
      ? effect.map(addDelay, Duration.sum(delay))
      : Duration.sum(addDelay, delay)
  }))

/**
 * Returns a new `Schedule` that will first execute the left (i.e. `self`)
 * schedule to completion. Once the left schedule is complete, the right (i.e.
 * `other`) schedule will be executed to completion.
 *
 * @since 2.0.0
 * @category sequencing
 */
export const andThen: {
  <Output2, Input2, Error2, Env2>(
    other: Schedule<Output2, Input2, Error2, Env2>
  ): <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output | Output2, Input & Input2, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    other: Schedule<Output2, Input2, Error2, Env2>
  ): Schedule<Output | Output2, Input & Input2, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  other: Schedule<Output2, Input2, Error2, Env2>
): Schedule<Output | Output2, Input & Input2, Error | Error2, Env | Env2> =>
  map(andThenResult(self, other), Result.merge))

/**
 * Returns a new `Schedule` that will first execute the left (i.e. `self`)
 * schedule to completion. Once the left schedule is complete, the right (i.e.
 * `other`) schedule will be executed to completion.
 *
 * The output of the resulting schedule is a `Result` where outputs of the
 * left schedule are emitted as `Result.Err<Output>` and outputs of the right
 * schedule are emitted as `Result.Ok<Output>`.
 *
 * @since 2.0.0
 * @category sequencing
 */
export const andThenResult: {
  <Output2, Input2, Error2, Env2>(
    other: Schedule<Output2, Input2, Error2, Env2>
  ): <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Result.Result<Output2, Output>, Input & Input2, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    other: Schedule<Output2, Input2, Error2, Env2>
  ): Schedule<Result.Result<Output2, Output>, Input & Input2, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  other: Schedule<Output2, Input2, Error2, Env2>
): Schedule<Result.Result<Output2, Output>, Input & Input2, Error | Error2, Env | Env2> =>
  fromStep(effect.map(
    effect.zip(toStep(self), toStep(other)),
    ([leftStep, rightStep]) => {
      let currentStep: (now: number, input: Input & Input2) => Pull.Pull<
        [Output | Output2, Duration.Duration],
        Error | Error2,
        Output | Output2,
        Env | Env2
      > = leftStep
      let toResult: (output: Output | Output2) => Result.Result<Output2, Output> = Result.fail as any
      return (now, input) =>
        Pull.matchEffect(currentStep(now, input), {
          onSuccess: ([output, duration]) =>
            effect.succeed<[Result.Result<Output2, Output>, Duration.Duration]>([toResult(output), duration]),
          onFailure: effect.failCause,
          onHalt: (output) =>
            effect.suspend(() => {
              const pull = effect.succeed<[Result.Result<Output2, Output>, Duration.Duration]>(
                [toResult(output), Duration.zero]
              )
              if (currentStep === leftStep) {
                currentStep = rightStep
                toResult = Result.succeed as any
              }
              return pull
            })
        })
    }
  )))

/**
 * Combines two `Schedule`s by recurring if both of the two schedules want
 * to recur, using the maximum of the two durations between recurrences and
 * outputting a tuple of the outputs of both schedules.
 *
 * @since 2.0.0
 * @category utilities
 */
export const both: {
  <Output2, Input2, Error2, Env2, Output>(
    other: Schedule<Output2, Input2, Error2, Env2>
  ): <Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<[Output, Output2], Input & Input2, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    other: Schedule<Output2, Input2, Error2, Env2>
  ): Schedule<[Output, Output2], Input & Input2, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  other: Schedule<Output2, Input2, Error2, Env2>
): Schedule<[Output, Output2], Input & Input2, Error | Error2, Env | Env2> =>
  bothWith(self, other, (left, right) => [left, right]))

/**
 * Combines two `Schedule`s by recurring if both of the two schedules want
 * to recur, using the maximum of the two durations between recurrences and
 * outputting the result of the left schedule (i.e. `self`).
 *
 * @since 2.0.0
 * @category utilities
 */
export const bothLeft: {
  <Output2, Input2, Error2, Env2>(
    other: Schedule<Output2, Input2, Error2, Env2>
  ): <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input & Input2, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    other: Schedule<Output2, Input2, Error2, Env2>
  ): Schedule<Output, Input & Input2, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  other: Schedule<Output2, Input2, Error2, Env2>
): Schedule<Output, Input & Input2, Error | Error2, Env | Env2> => bothWith(self, other, (output) => output))

/**
 * Combines two `Schedule`s by recurring if both of the two schedules want
 * to recur, using the maximum of the two durations between recurrences and
 * outputting the result of the right schedule (i.e. `other`).
 *
 * @since 2.0.0
 * @category utilities
 */
export const bothRight: {
  <Output2, Input2, Error2, Env2>(
    other: Schedule<Output2, Input2, Error2, Env2>
  ): <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input & Input2, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    other: Schedule<Output2, Input2, Error2, Env2>
  ): Schedule<Output, Input & Input2, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  other: Schedule<Output2, Input2, Error2, Env2>
): Schedule<Output2, Input & Input2, Error | Error2, Env | Env2> => bothWith(self, other, (_, output) => output))

/**
 * Combines two `Schedule`s by recurring if both of the two schedules want
 * to recur, using the maximum of the two durations between recurrences and
 * outputting the result of the combination of both schedule outputs using the
 * specified `combine` function.
 *
 * @since 2.0.0
 * @category utilities
 */
export const bothWith: {
  <Output2, Input2, Error2, Env2, Output, Output3>(
    other: Schedule<Output2, Input2, Error2, Env2>,
    combine: (selfOutput: Output, otherOutput: Output2) => Output3
  ): <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output3, Input & Input2, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Input2, Error2, Env2, Output3>(
    self: Schedule<Output, Input, Error, Env>,
    other: Schedule<Output2, Input2, Error2, Env2>,
    combine: (selfOutput: Output, otherOutput: Output2) => Output3
  ): Schedule<Output3, Input & Input2, Error | Error2, Env | Env2>
} = dual(3, <Output, Input, Error, Env, Output2, Input2, Error2, Env2, Output3>(
  self: Schedule<Output, Input, Error, Env>,
  other: Schedule<Output2, Input2, Error2, Env2>,
  combine: (selfOutput: Output, otherOutput: Output2) => Output3
): Schedule<Output3, Input & Input2, Error | Error2, Env | Env2> =>
  fromStep(effect.map(
    effect.zip(toStep(self), toStep(other)),
    ([stepLeft, stepRight]) => (now, input) =>
      Pull.matchEffect(stepLeft(now, input as Input), {
        onSuccess: (leftResult) =>
          stepRight(now, input as Input2).pipe(
            effect.map((rightResult) =>
              [
                combine(leftResult[0], rightResult[0]),
                Duration.min(leftResult[1], rightResult[1])
              ] as [Output3, Duration.Duration]
            ),
            Pull.catchHalt((rightDone) => Pull.halt(combine(leftResult[0], rightDone as Output2)))
          ),
        onHalt: (leftDone) =>
          stepRight(now, input as Input2).pipe(
            effect.flatMap((rightResult) => Pull.halt(combine(leftDone, rightResult[0]))),
            Pull.catchHalt((rightDone) => Pull.halt(combine(leftDone, rightDone as Output2)))
          ),
        onFailure: effect.failCause
      })
  )))

/**
 * Returns a new `Schedule` that always recurs, collecting all inputs of the
 * schedule into an array.
 *
 * @since 2.0.0
 * @category utilities
 */
export const collectInputs = <Output, Input, Error, Env>(
  self: Schedule<Output, Input, Error, Env>
): Schedule<Array<Input>, Input, Error, Env> => collectWhile(passthrough(self), constTrue)

/**
 * Returns a new `Schedule` that always recurs, collecting all outputs of the
 * schedule into an array.
 *
 * @since 2.0.0
 * @category utilities
 */
export const collectOutputs = <Output, Input, Error, Env>(
  self: Schedule<Output, Input, Error, Env>
): Schedule<Array<Output>, Input, Error, Env> => collectWhile(self, constTrue)

/**
 * Returns a new `Schedule` that recurs as long as the specified `predicate`
 * returns `true`, collecting all outputs of the schedule into an array.
 *
 * @since 2.0.0
 * @category utilities
 */
export const collectWhile: {
  <Input, Output, Error2 = never, Env2 = never>(
    predicate: (
      metadata: Schedule.Metadata<Output, Input>
    ) => boolean | Effect<boolean, Error2, Env2>
  ): <Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Array<Output>, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Error2 = never, Env2 = never>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (
      metadata: Schedule.Metadata<Output, Input>
    ) => boolean | Effect<boolean, Error2, Env2>
  ): Schedule<Array<Output>, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Error2 = never, Env2 = never>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (
    metadata: Schedule.Metadata<Output, Input>
  ) => boolean | Effect<boolean, Error2, Env2>
): Schedule<Array<Output>, Input, Error | Error2, Env | Env2> =>
  reduce(while_(self, predicate), () => [] as Array<Output>, (outputs, output) => {
    outputs.push(output)
    return outputs
  }))

/**
 * Returns a new `Schedule` that recurs on the specified `Cron` schedule and
 * outputs the duration between recurrences.
 *
 * @since 4.0.0
 * @category constructors
 */
export const cron: {
  (expression: Cron.Cron): Schedule<Duration.Duration, unknown, Cron.CronParseError>
  (expression: string, tz?: string | DateTime.TimeZone): Schedule<Duration.Duration, unknown, Cron.CronParseError>
} = (expression: string | Cron.Cron, tz?: string | DateTime.TimeZone) => {
  const parsed = Cron.isCron(expression) ? Result.succeed(expression) : Cron.parse(expression, tz)
  return fromStep(effect.map(parsed.asEffect(), (cron) => (now, _) =>
    effect.sync(() => {
      const next = Cron.next(cron, now).getTime()
      const duration = Duration.millis(next - now)
      return [duration, duration]
    })))
}

/**
 * Returns a new schedule that outputs the delay between each occurence.
 *
 * @since 2.0.0
 * @category constructors
 */
export const delays = <Out, In, E, R>(self: Schedule<Out, In, E, R>): Schedule<Duration.Duration, In, E, R> =>
  fromStep(
    effect.map(
      toStep(self),
      (step) => (now, input) =>
        Pull.catchHalt(
          effect.map(step(now, input), ([_, duration]) => [duration, duration]),
          (_) => Pull.halt(Duration.zero)
        )
    )
  )

/**
 * Returns a new `Schedule` that will always recur, but only during the
 * specified `duration` of time.
 *
 * @since 4.0.0
 * @category constructors
 */
export const during = (duration: Duration.DurationInput): Schedule<Duration.Duration> =>
  while_(elapsed, ({ output }) => Duration.lessThanOrEqualTo(output, duration))

/**
 * Combines two `Schedule`s by recurring if either of the two schedules wants
 * to recur, using the minimum of the two durations between recurrences and
 * outputting a tuple of the outputs of both schedules.
 *
 * @since 2.0.0
 * @category utilities
 */
export const either: {
  <Output2, Input2, Error2, Env2>(
    other: Schedule<Output2, Input2, Error2, Env2>
  ): <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<[Output, Output2], Input & Input2, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    other: Schedule<Output2, Input2, Error2, Env2>
  ): Schedule<[Output, Output2], Input & Input2, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  other: Schedule<Output2, Input2, Error2, Env2>
): Schedule<[Output, Output2], Input & Input2, Error | Error2, Env | Env2> =>
  eitherWith(self, other, (left, right) => [left, right]))

/**
 * Combines two `Schedule`s by recurring if either of the two schedules wants
 * to recur, using the minimum of the two durations between recurrences and
 * outputting the result of the left schedule (i.e. `self`).
 *
 * @since 2.0.0
 * @category utilities
 */
export const eitherLeft: {
  <Output2, Input2, Error2, Env2>(
    other: Schedule<Output2, Input2, Error2, Env2>
  ): <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input & Input2, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    other: Schedule<Output2, Input2, Error2, Env2>
  ): Schedule<Output, Input & Input2, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  other: Schedule<Output2, Input2, Error2, Env2>
): Schedule<Output, Input & Input2, Error | Error2, Env | Env2> => eitherWith(self, other, (output) => output))

/**
 * Combines two `Schedule`s by recurring if either of the two schedules wants
 * to recur, using the minimum of the two durations between recurrences and
 * outputting the result of the right schedule (i.e. `other`).
 *
 * @since 2.0.0
 * @category utilities
 */
export const eitherRight: {
  <Output2, Input2, Error2, Env2>(
    other: Schedule<Output2, Input2, Error2, Env2>
  ): <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output2, Input & Input2, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    other: Schedule<Output2, Input2, Error2, Env2>
  ): Schedule<Output2, Input & Input2, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  other: Schedule<Output2, Input2, Error2, Env2>
): Schedule<Output2, Input & Input2, Error | Error2, Env | Env2> => eitherWith(self, other, (_, output) => output))

/**
 * Combines two `Schedule`s by recurring if either of the two schedules wants
 * to recur, using the minimum of the two durations between recurrences and
 * outputting the result of the combination of both schedule outputs using the
 * specified `combine` function.
 *
 * @since 2.0.0
 * @category utilities
 */
export const eitherWith: {
  <Output2, Input2, Error2, Env2, Output, Output3>(
    other: Schedule<Output2, Input2, Error2, Env2>,
    combine: (selfOutput: Output, otherOutput: Output2) => Output3
  ): <Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output3, Input & Input2, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Input2, Error2, Env2, Output3>(
    self: Schedule<Output, Input, Error, Env>,
    other: Schedule<Output2, Input2, Error2, Env2>,
    combine: (selfOutput: Output, otherOutput: Output2) => Output3
  ): Schedule<Output3, Input & Input2, Error | Error2, Env | Env2>
} = dual(3, <Output, Input, Error, Env, Output2, Input2, Error2, Env2, Output3>(
  self: Schedule<Output, Input, Error, Env>,
  other: Schedule<Output2, Input2, Error2, Env2>,
  combine: (selfOutput: Output, otherOutput: Output2) => Output3
): Schedule<Output3, Input & Input2, Error | Error2, Env | Env2> =>
  fromStep(effect.map(
    effect.zip(toStep(self), toStep(other)),
    ([stepLeft, stepRight]) => (now, input) =>
      Pull.matchEffect(stepLeft(now, input as Input), {
        onSuccess: (leftResult) =>
          stepRight(now, input as Input2).pipe(
            effect.map((rightResult) =>
              [combine(leftResult[0], rightResult[0]), Duration.min(leftResult[1], rightResult[1])] as [
                Output3,
                Duration.Duration
              ]
            ),
            Pull.catchHalt((rightDone) =>
              effect.succeed<[Output3, Duration.Duration]>([
                combine(leftResult[0], rightDone as Output2),
                leftResult[1]
              ])
            )
          ),
        onFailure: effect.failCause,
        onHalt: (leftDone) =>
          stepRight(now, input as Input2).pipe(
            effect.map((rightResult) =>
              [combine(leftDone, rightResult[0]), rightResult[1]] as [
                Output3,
                Duration.Duration
              ]
            ),
            Pull.catchHalt((rightDone) => Pull.halt(combine(leftDone, rightDone as Output2)))
          )
      })
  )))

/**
 * A schedule that always recurs and returns the total elapsed duration since the first recurrence.
 *
 * This schedule never stops and outputs the cumulative time that has passed since the schedule
 * started executing. Useful for tracking execution time or implementing time-based logic.
 *
 * @returns A schedule that outputs the elapsed duration and never stops
 *
 * @example
 * ```ts
 * import { Effect, Schedule } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.repeat(
 *     Effect.gen(function*() {
 *       const elapsed = yield* Schedule.elapsed
 *       console.log(`Elapsed time: ${elapsed}`)
 *       yield* Effect.sleep("1 second")
 *     }),
 *     Schedule.spaced("500 millis").pipe(Schedule.take(5))
 *   )
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const elapsed: Schedule<Duration.Duration> = fromStepWithMetadata(
  effect.succeed((meta) => effect.succeed([Duration.millis(meta.elapsed), Duration.zero] as const))
)

/**
 * A schedule that always recurs, but will wait a certain amount between
 * repetitions, given by `base * factor.pow(n)`, where `n` is the number of
 * repetitions so far. Returns the current duration between recurrences.
 *
 * @since 2.0.0
 * @category constructors
 */
export const exponential = (
  base: Duration.DurationInput,
  factor: number = 2
): Schedule<Duration.Duration> => {
  const baseMillis = Duration.toMillis(base)
  return fromStepWithMetadata(effect.succeed((meta) => {
    const duration = Duration.millis(baseMillis * Math.pow(factor, meta.recurrence))
    return effect.succeed([duration, duration])
  }))
}

/**
 * A schedule that always recurs, increasing delays by summing the preceding
 * two delays (similar to the fibonacci sequence). Returns the current
 * duration between recurrences.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fibonacci = (one: Duration.DurationInput): Schedule<Duration.Duration> => {
  const oneMillis = Duration.toMillis(one)
  return fromStep(effect.sync(() => {
    let a = 0
    let b = oneMillis
    return constant(effect.sync(() => {
      const next = a + b
      a = b
      b = next
      const duration = Duration.millis(next)
      return [duration, duration]
    }))
  }))
}

/**
 * Returns a `Schedule` that recurs on the specified fixed `interval` and
 * outputs the number of repetitions of the schedule so far.
 *
 * If the action run between updates takes longer than the interval, then the
 * action will be run immediately, but re-runs will not "pile up".
 *
 * ```
 * |-----interval-----|-----interval-----|-----interval-----|
 * |---------action--------||action|-----|action|-----------|
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const fixed = (interval: Duration.DurationInput): Schedule<number> => {
  const window = Duration.toMillis(interval)
  return fromStepWithMetadata(effect.succeed((meta) =>
    effect.succeed([
      meta.recurrence,
      window === 0 || meta.elapsedSincePrevious > window
        ? Duration.zero
        : Duration.millis(window - (meta.elapsed % window))
    ])
  ))
}

/**
 * Returns a new `Schedule` that maps the output of this schedule using the
 * specified function.
 *
 * @since 2.0.0
 * @category mapping
 */
export const map: {
  <Output, Output2, Error2 = never, Env2 = never>(
    f: (output: Output) => Output2 | Effect<Output2, Error2, Env2>
  ): <Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output2, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Error2 = never, Env2 = never>(
    self: Schedule<Output, Input, Error, Env>,
    f: (output: Output) => Output2 | Effect<Output2, Error2, Env2>
  ): Schedule<Output2, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Output2, Error2 = never, Env2 = never>(
  self: Schedule<Output, Input, Error, Env>,
  f: (output: Output) => Output2 | Effect<Output2, Error2, Env2>
): Schedule<Output2, Input, Error | Error2, Env | Env2> => {
  const handle = Pull.matchEffect({
    onSuccess: ([output, duration]: [Output, Duration.Duration]) => {
      const mapper = f(output)
      return isEffect(mapper)
        ? effect.map(mapper, (output) => [output, duration] as [Output2, Duration.Duration])
        : effect.succeed([mapper, duration] as [Output2, Duration.Duration])
    },
    onFailure: effect.failCause<Error>,
    onHalt: (output: Output) => {
      const mapper = f(output)
      return isEffect(mapper) ? effect.flatMap(mapper, Pull.halt) : Pull.halt(mapper)
    }
  })
  return fromStep(effect.map(toStep(self), (step) => (now, input) => handle(step(now, input))))
})

/**
 * Returns a new `Schedule` that modifies the delay of the next recurrence
 * of the schedule using the specified effectual function.
 *
 * @since 2.0.0
 * @category utilities
 */
export const modifyDelay: {
  <Output, Error2 = never, Env2 = never>(
    f: (
      output: Output,
      delay: Duration.Duration
    ) => Duration.DurationInput | Effect<Duration.DurationInput, Error2, Env2>
  ): <Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Error2 = never, Env2 = never>(
    self: Schedule<Output, Input, Error, Env>,
    f: (
      output: Output,
      delay: Duration.DurationInput
    ) => Duration.DurationInput | Effect<Duration.DurationInput, Error2, Env2>
  ): Schedule<Output, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Error2 = never, Env2 = never>(
  self: Schedule<Output, Input, Error, Env>,
  f: (
    output: Output,
    delay: Duration.DurationInput
  ) => Duration.DurationInput | Effect<Duration.DurationInput, Error2, Env2>
): Schedule<Output, Input, Error | Error2, Env | Env2> =>
  fromStep(effect.map(toStep(self), (step) => (now, input) =>
    effect.flatMap(
      step(now, input),
      ([output, delay]) => {
        const duration = f(output, delay)
        return isEffect(duration)
          ? effect.map(duration, (delay) => [output, Duration.decode(delay)])
          : effect.succeed([output, Duration.decode(duration)])
      }
    ))))

/**
 * Returns a new `Schedule` that outputs the inputs of the specified schedule.
 *
 * @since 2.0.0
 * @category utilities
 */
export const passthrough = <Output, Input, Error, Env>(
  self: Schedule<Output, Input, Error, Env>
): Schedule<Input, Input, Error, Env> =>
  fromStep(effect.map(toStep(self), (step) => (now, input) =>
    Pull.matchEffect(step(now, input), {
      onSuccess: (result) => effect.succeed([input, result[1]]),
      onFailure: effect.failCause,
      onHalt: () => Pull.halt(input)
    })))

/**
 * Returns a `Schedule` which can only be stepped the specified number of
 * `times` before it terminates.
 *
 * @category constructors
 * @since 2.0.0
 */
export const recurs = (times: number): Schedule<number> => while_(forever, ({ recurrence }) => recurrence < times)

/**
 * Returns a new `Schedule` that combines the outputs of the provided schedule
 * using the specified effectful `combine` function and starting from the
 * specified `initial` state.
 *
 * @since 2.0.0
 * @category utilities
 */
export const reduce: {
  <State, Output, Error2 = never, Env2 = never>(
    initial: LazyArg<State>,
    combine: (state: State, output: Output) => State | Effect<State, Error2, Env2>
  ): <Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<State, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, State, Error2 = never, Env2 = never>(
    self: Schedule<Output, Input, Error, Env>,
    initial: LazyArg<State>,
    combine: (state: State, output: Output) => State | Effect<State, Error2, Env2>
  ): Schedule<State, Input, Error | Error2, Env | Env2>
} = dual(3, <Output, Input, Error, Env, State, Error2 = never, Env2 = never>(
  self: Schedule<Output, Input, Error, Env>,
  initial: LazyArg<State>,
  combine: (state: State, output: Output) => State | Effect<State, Error2, Env2>
): Schedule<State, Input, Error | Error2, Env | Env2> =>
  fromStep(effect.map(toStep(self), (step) => {
    let state = initial()
    return (now, input) =>
      Pull.matchEffect(step(now, input), {
        onSuccess: ([output, delay]) => {
          const reduce = combine(state, output)
          if (!isEffect(reduce)) {
            state = reduce
            return effect.succeed([reduce, delay])
          }
          return effect.map(reduce, (nextState) => {
            state = nextState
            return [nextState, delay]
          })
        },
        onFailure: effect.failCause,
        onHalt: (output) => {
          const reduce = combine(state, output)
          return isEffect(reduce) ? effect.flatMap(reduce, Pull.halt) : Pull.halt(reduce)
        }
      })
  })))

/**
 * Returns a schedule that recurs continuously, each repetition spaced the
 * specified duration from the last run.
 *
 * @since 2.0.0
 * @category constructors
 */
export const spaced = (duration: Duration.DurationInput): Schedule<number> => {
  const decoded = Duration.decode(duration)
  return fromStepWithMetadata(effect.succeed((meta) => effect.succeed([meta.recurrence, decoded])))
}

/**
 * Returns a new `Schedule` that allows execution of an effectful function for
 * every input to the schedule, but does not alter the inputs and outputs of
 * the schedule.
 *
 * @since 2.0.0
 * @category sequencing
 */
export const tapInput: {
  <Input, X, Error2, Env2>(
    f: (input: Input) => Effect<X, Error2, Env2>
  ): <Output, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, X, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    f: (input: Input) => Effect<X, Error2, Env2>
  ): Schedule<Output, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, X, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  f: (input: Input) => Effect<X, Error2, Env2>
): Schedule<Output, Input, Error | Error2, Env | Env2> =>
  fromStep(effect.map(
    toStep(self),
    (step) => (now, input) => effect.andThen(f(input), step(now, input))
  )))

/**
 * Returns a new `Schedule` that allows execution of an effectful function for
 * every output of the schedule, but does not alter the inputs and outputs of
 * the schedule.
 *
 * @since 2.0.0
 * @category sequencing
 */
export const tapOutput: {
  <Output, X, Error2, Env2>(
    f: (output: Output) => Effect<X, Error2, Env2>
  ): <Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, X, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    f: (output: Output) => Effect<X, Error2, Env2>
  ): Schedule<Output, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, X, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  f: (output: Output) => Effect<X, Error2, Env2>
): Schedule<Output, Input, Error | Error2, Env | Env2> =>
  fromStep(effect.map(
    toStep(self),
    (step) => (now, input) => effect.tap(step(now, input), ([output]) => f(output))
  )))

/**
 * @since 2.0.0
 * @category constructors
 */
export const unfold = <State, Error = never, Env = never>(
  initial: State,
  next: (state: State) => State | Effect<State, Error, Env>
): any =>
  fromStep(effect.sync(() => {
    let state = initial
    return constant(effect.map(
      effect.suspend(() => {
        const result = next(state)
        return isEffect(result) ? result : effect.succeed(result)
      }),
      (nextState) => {
        const prev = state
        state = nextState
        return [prev, Duration.zero] as const
      }
    ))
  }))

const while_: {
  <Input, Output, Error2 = never, Env2 = never>(
    predicate: (
      metadata: Schedule.Metadata<Output, Input>
    ) => boolean | Effect<boolean, Error2, Env2>
  ): <Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Error2 = never, Env2 = never>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (
      metadata: Schedule.Metadata<Output, Input>
    ) => boolean | Effect<boolean, Error2, Env2>
  ): Schedule<Output, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Error2 = never, Env2 = never>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (
    metadata: Schedule.Metadata<Output, Input>
  ) => boolean | Effect<boolean, Error2, Env2>
): Schedule<Output, Input, Error | Error2, Env | Env2> =>
  fromStep(effect.map(toStep(self), (step) => {
    const meta = metadataFn()
    return (now, input) =>
      effect.flatMap(step(now, input), (result) => {
        const check = predicate({ ...meta(now, input), output: result[0] })
        return isEffect(check)
          ? effect.flatMap(check, (check) => (check ? effect.succeed(result) : Pull.halt(result[0])))
          : (check ? effect.succeed(result) : Pull.halt(result[0]))
      })
  })))

export {
  /**
   * Returns a new schedule that passes each input and output of the specified
   * schedule to the provided `predicate`.
   *
   * If the `predicate` returns `true`, the schedule will continue, otherwise
   * the schedule will stop.
   *
   * @since 2.0.0
   * @category utilities
   */
  while_ as while
}

/**
 * A schedule that divides the timeline to `interval`-long windows, and sleeps
 * until the nearest window boundary every time it recurs.
 *
 * For example, `Schedule.windowed("10 seconds")` would produce a schedule as
 * follows:
 *
 * ```
 *      10s        10s        10s       10s
 * |----------|----------|----------|----------|
 * |action------|sleep---|act|-sleep|action----|
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const windowed = (interval: Duration.DurationInput): Schedule<number> => {
  const window = Duration.toMillis(interval)
  return fromStepWithMetadata(effect.succeed((meta) =>
    effect.sync(() => [
      meta.recurrence,
      window === 0 ? Duration.zero : Duration.millis(window - (meta.elapsed % window))
    ])
  ))
}

/**
 * Returns a new `Schedule` that will recur forever.
 *
 * The output of the schedule is the current count of its repetitions thus far
 * (i.e. `0, 1, 2, ...`).
 *
 * @since 2.0.0
 * @category constructors
 */
export const forever: Schedule<number> = spaced(Duration.zero)

/**
 * Ensures that the provided schedule respects a specified input type
 *
 * @since 2.0.0
 * @category ensuring types
 */
export const ensureInput = <T>() =>
<Input extends T, Output = never, Error = never, Env = never>(
  self: Schedule<Output, Input, Error, Env>
): Schedule<Output, Input, Error, Env> => self

/**
 * Ensures that the provided schedule respects a specified output type
 *
 * @since 2.0.0
 * @category ensuring types
 */
export const ensureOutput = <T>() =>
<Output extends T, Error = never, Input = unknown, Env = never>(
  self: Schedule<Output, Input, Error, Env>
): Schedule<Output, Input, Error, Env> => self

/**
 * Ensures that the provided schedule respects a specified error type
 *
 * @since 2.0.0
 * @category ensuring types
 */
export const ensureError = <T>() =>
<Error extends T, Output = never, Input = unknown, Env = never>(
  self: Schedule<Output, Input, Error, Env>
): Schedule<Output, Input, Error, Env> => self

/**
 * Ensures that the provided schedule respects a specified context type
 *
 * @since 2.0.0
 * @category ensuring types
 */
export const ensureServices = <T>() =>
<Env extends T, Output = never, Input = unknown, Error = never>(
  self: Schedule<Output, Input, Error, Env>
): Schedule<Output, Input, Error, Env> => self
