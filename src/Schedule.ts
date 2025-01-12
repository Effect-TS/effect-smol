/**
 * @since 2.0.0
 */
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import * as Either from "./Either.js"
import type { LazyArg } from "./Function.js"
import { constant, constTrue, dual, identity } from "./Function.js"
import * as core from "./internal/core.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import * as Pull from "./Pull.js"
import type { Contravariant, Covariant } from "./Types.js"

/**
 * @since 2.0.0
 * @category Symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/Schedule")

/**
 * @since 2.0.0
 * @category Symbols
 */
export type TypeId = typeof TypeId

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
  export interface Metadata<Input> {
    readonly input: Input
    readonly recurrence: number
    readonly start: number
    readonly now: number
    readonly elapsed: number
    readonly elapsedSincePrevious: number
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
  return <In>(now: number, input: In): Schedule.Metadata<In> => {
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
    (options: {
      readonly input: Input
      readonly recurrence: number
      readonly start: number
      readonly now: number
      readonly elapsed: number
      readonly elapsedSincePrevious: number
    }) => Pull.Pull<[Output, Duration.Duration], ErrorX, Output, EnvX>,
    Error,
    Env
  >
): Schedule<Output, Input, Error | ErrorX, Env | EnvX> =>
  fromStep(core.map(step, (f) => {
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
  core.catchCause(
    (schedule as any).step,
    (cause) => core.succeed(() => core.failCause(cause) as any)
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
  core.clockWith((clock) =>
    core.map(
      toStep(schedule),
      (step) => (input) =>
        core.flatMap(
          core.suspend(() => step(clock.unsafeCurrentTimeMillis(), input)),
          ([output, duration]) =>
            Duration.isZero(duration) ? core.succeed(output) : core.as(core.sleep(duration), output)
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
    return core.isEffect(addDelay)
      ? core.map(addDelay, Duration.sum(delay))
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
  map(andThenEither(self, other), Either.merge))

/**
 * Returns a new `Schedule` that will first execute the left (i.e. `self`)
 * schedule to completion. Once the left schedule is complete, the right (i.e.
 * `other`) schedule will be executed to completion.
 *
 * The output of the resulting schedule is an `Either` where outputs of the
 * left schedule are emitted as `Either.Left<Output>` and outputs of the right
 * schedule are emitted as `Either.Right<Output>`.
 *
 * @since 2.0.0
 * @category sequencing
 */
export const andThenEither: {
  <Output2, Input2, Error2, Env2>(
    other: Schedule<Output2, Input2, Error2, Env2>
  ): <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Either.Either<Output2, Output>, Input & Input2, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    other: Schedule<Output2, Input2, Error2, Env2>
  ): Schedule<Either.Either<Output2, Output>, Input & Input2, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Output2, Input2, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  other: Schedule<Output2, Input2, Error2, Env2>
): Schedule<Either.Either<Output2, Output>, Input & Input2, Error | Error2, Env | Env2> =>
  fromStep(core.map(
    core.zip(toStep(self), toStep(other)),
    ([leftStep, rightStep]) => {
      let currentStep: (now: number, input: Input & Input2) => Pull.Pull<
        [Output | Output2, Duration.Duration],
        Error | Error2,
        Output | Output2,
        Env | Env2
      > = leftStep
      let toEither: (output: Output | Output2) => Either.Either<Output2, Output> = Either.left as any
      return (now, input) =>
        Pull.matchEffect(currentStep(now, input), {
          onSuccess: ([output, duration]) =>
            core.succeed<[Either.Either<Output2, Output>, Duration.Duration]>([toEither(output), duration]),
          onFailure: core.failCause,
          onHalt: (output) =>
            core.suspend(() => {
              const pull = core.succeed<[Either.Either<Output2, Output>, Duration.Duration]>(
                [toEither(output), Duration.zero]
              )
              if (currentStep === leftStep) {
                currentStep = rightStep
                toEither = Either.right as any
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
  fromStep(core.map(
    core.zip(toStep(self), toStep(other)),
    ([stepLeft, stepRight]) => (now, input) =>
      Pull.matchEffect(stepLeft(now, input as Input), {
        onSuccess: (leftResult) =>
          stepRight(now, input as Input2).pipe(
            core.map((rightResult) =>
              [
                combine(leftResult[0], rightResult[0]),
                Duration.min(leftResult[1], rightResult[1])
              ] as [Output3, Duration.Duration]
            ),
            Pull.catchHalt((rightDone) => Pull.halt(combine(leftResult[0], rightDone as Output2)))
          ),
        onHalt: (leftDone) =>
          stepRight(now, input as Input2).pipe(
            core.flatMap((rightResult) => Pull.halt(combine(leftDone, rightResult[0]))),
            Pull.catchHalt((rightDone) => Pull.halt(combine(leftDone, rightDone as Output2)))
          ),
        onFailure: core.failCause
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
      metadata: Schedule.Metadata<Input> & { readonly output: Output }
    ) => boolean | Effect<boolean, Error2, Env2>
  ): <Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Array<Output>, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Error2 = never, Env2 = never>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (
      metadata: Schedule.Metadata<Input> & { readonly output: Output }
    ) => boolean | Effect<boolean, Error2, Env2>
  ): Schedule<Array<Output>, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Error2 = never, Env2 = never>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (
    metadata: Schedule.Metadata<Input> & { readonly output: Output }
  ) => boolean | Effect<boolean, Error2, Env2>
): Schedule<Array<Output>, Input, Error | Error2, Env | Env2> =>
  reduce(while_(self, predicate), () => [] as Array<Output>, (outputs, output) => {
    outputs.push(output)
    return outputs
  }))

/**
 * Returns a new schedule that outputs the delay between each occurence.
 *
 * @since 2.0.0
 * @category constructors
 */
export const delays = <Out, In, E, R>(self: Schedule<Out, In, E, R>): Schedule<Duration.Duration, In, E, R> =>
  fromStep(
    core.map(
      toStep(self),
      (step) => (now, input) =>
        Pull.catchHalt(
          core.map(step(now, input), ([_, duration]) => [duration, duration]),
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
  fromStep(core.map(
    core.zip(toStep(self), toStep(other)),
    ([stepLeft, stepRight]) => (now, input) =>
      Pull.matchEffect(stepLeft(now, input as Input), {
        onSuccess: (leftResult) =>
          stepRight(now, input as Input2).pipe(
            core.map((rightResult) =>
              [combine(leftResult[0], rightResult[0]), Duration.min(leftResult[1], rightResult[1])] as [
                Output3,
                Duration.Duration
              ]
            ),
            Pull.catchHalt((rightDone) =>
              core.succeed<[Output3, Duration.Duration]>([
                combine(leftResult[0], rightDone as Output2),
                leftResult[1]
              ])
            )
          ),
        onFailure: core.failCause,
        onHalt: (leftDone) =>
          stepRight(now, input as Input2).pipe(
            core.map((rightResult) =>
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
 * A schedule that always recurs and returns the total elapsed duration
 * since the first recurrence.
 *
 * @since 2.0.0
 * @category constructors
 */
export const elapsed: Schedule<Duration.Duration> = fromStepWithMetadata(
  core.succeed((meta) => core.succeed([Duration.millis(meta.elapsed), Duration.zero] as const))
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
  return fromStepWithMetadata(core.succeed((meta) => {
    const duration = Duration.millis(baseMillis * Math.pow(factor, meta.recurrence))
    return core.succeed([duration, duration])
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
  return fromStep(core.sync(() => {
    let a = 0
    let b = oneMillis
    return constant(core.sync(() => {
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
  return fromStepWithMetadata(core.succeed((meta) =>
    core.succeed([
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
      return core.isEffect(mapper)
        ? core.map(mapper, (output) => [output, duration] as [Output2, Duration.Duration])
        : core.succeed([mapper, duration] as [Output2, Duration.Duration])
    },
    onFailure: core.failCause<Error>,
    onHalt: (output: Output) => {
      const mapper = f(output)
      return core.isEffect(mapper) ? core.flatMap(mapper, Pull.halt) : Pull.halt(mapper)
    }
  })
  return fromStep(core.map(toStep(self), (step) => (now, input) => handle(step(now, input))))
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
  fromStep(core.map(toStep(self), (step) => (now, input) =>
    core.flatMap(
      step(now, input),
      ([output, delay]) => {
        const duration = f(output, delay)
        return core.isEffect(duration)
          ? core.map(duration, (delay) => [output, Duration.decode(delay)])
          : core.succeed([output, Duration.decode(duration)])
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
  fromStep(core.map(toStep(self), (step) => (now, input) =>
    Pull.matchEffect(step(now, input), {
      onSuccess: (result) => core.succeed([input, result[1]]),
      onFailure: core.failCause,
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
  fromStep(core.map(toStep(self), (step) => {
    let state = initial()
    return (now, input) =>
      Pull.matchEffect(step(now, input), {
        onSuccess: ([output, delay]) => {
          const reduce = combine(state, output)
          if (!core.isEffect(reduce)) {
            state = reduce
            return core.succeed([reduce, delay])
          }
          return core.map(reduce, (nextState) => {
            state = nextState
            return [nextState, delay]
          })
        },
        onFailure: core.failCause,
        onHalt: (output) => {
          const reduce = combine(state, output)
          return core.isEffect(reduce) ? core.flatMap(reduce, Pull.halt) : Pull.halt(reduce)
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
  return fromStepWithMetadata(core.succeed((meta) => core.succeed([meta.recurrence, decoded])))
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
  fromStep(core.map(
    toStep(self),
    (step) => (now, input) => core.andThen(f(input), step(now, input))
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
  fromStep(core.map(
    toStep(self),
    (step) => (now, input) => core.tap(step(now, input), ([output]) => f(output))
  )))

/**
 * @since 2.0.0
 * @category constructors
 */
export const unfold = <State, Error = never, Env = never>(
  initial: State,
  next: (state: State) => State | Effect<State, Error, Env>
): any =>
  fromStep(core.sync(() => {
    let state = initial
    return constant(core.map(
      core.suspend(() => {
        const result = next(state)
        return core.isEffect(result) ? result : core.succeed(result)
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
      metadata: Schedule.Metadata<Input> & { readonly output: Output }
    ) => boolean | Effect<boolean, Error2, Env2>
  ): <Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Error2 = never, Env2 = never>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (
      metadata: Schedule.Metadata<Input> & { readonly output: Output }
    ) => boolean | Effect<boolean, Error2, Env2>
  ): Schedule<Output, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Error2 = never, Env2 = never>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (
    metadata: Schedule.Metadata<Input> & { readonly output: Output }
  ) => boolean | Effect<boolean, Error2, Env2>
): Schedule<Output, Input, Error | Error2, Env | Env2> =>
  fromStep(core.map(toStep(self), (step) => {
    const meta = metadataFn()
    return (now, input) =>
      core.flatMap(step(now, input), (result) => {
        const check = predicate({ ...meta(now, input), output: result[0] })
        return core.isEffect(check)
          ? core.flatMap(check, (check) => (check ? core.succeed(result) : Pull.halt(result[0])))
          : (check ? core.succeed(result) : Pull.halt(result[0]))
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
  return fromStepWithMetadata(core.succeed((meta) =>
    core.sync(() => [
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
