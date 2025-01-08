/**
 * @since 2.0.0
 */
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import { constant, dual, identity } from "./Function.js"
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
export const fromStep = <Input, Output, Error, ErrorX, Env>(
  step: Effect<
    (now: number, input: Input) => Pull.Pull<[Output, Duration.Duration], ErrorX, Output>,
    Error,
    Env
  >
): Schedule<Output, Input, Error | ErrorX, Env> => {
  const self = Object.create(ScheduleProto)
  self.step = step
  return self
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromStepEnv = <Input, Output, ErrorX, EnvX, Error, Env>(
  step: Effect<
    (now: number, input: Input) => Pull.Pull<[Output, Duration.Duration], ErrorX, Output, EnvX>,
    Error,
    Env
  >
): Schedule<Output, Input, Error | ErrorX, Env | EnvX> =>
  fromStep(
    core.zipWith(
      core.context<EnvX>(),
      step,
      (context, step) => (now, input) => core.provideContext(step(now, input), context)
    )
  )

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromStepWithTiming = <Input, Output, ErrorX, Error, Env>(
  step: Effect<
    (options: {
      readonly input: Input
      readonly recurrence: number
      readonly start: number
      readonly now: number
      readonly elapsed: number
      readonly elapsedSincePrevious: number
    }) => Pull.Pull<[Output, Duration.Duration], ErrorX, Output>,
    Error,
    Env
  >
): Schedule<Output, Input, Error | ErrorX, Env> =>
  fromStep(core.map(step, (f) => {
    let n = 0
    let previous: number | undefined
    let start: number | undefined
    return (now, input) => {
      if (start === undefined) start = now
      const elapsed = now - start
      const elapsedSincePrevious = previous === undefined ? 0 : now - previous
      previous = now
      return f({ input, recurrence: n++, start, now, elapsed, elapsedSincePrevious })
    }
  }))

/**
 * @since 4.0.0
 * @category destructors
 */
export const toStep = <Output, Input, Error, Env>(
  schedule: Schedule<Output, Input, Error, Env>
): Effect<
  (now: number, input: Input) => Pull.Pull<[Output, Duration.Duration], Error, Output>,
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
  (input: Input) => Pull.Pull<Output, Error, Output>,
  never,
  Env
> =>
  core.clockWith((clock) =>
    core.map(
      toStep(schedule),
      (step) => (input) =>
        core.flatMap(
          core.suspend(() => step(clock.unsafeCurrentTimeMillis(), input)),
          ([output, duration]) => core.as(core.sleep(duration), output)
        )
    )
  )

/**
 * Combines two `Schedule`s by recurring if both of the two schedules want
 * to recur, using the maximum of the two durations between recurrences.
 *
 * @since 2.0.0
 * @category utilities
 */
export const both: {
  <Output2, Input2, Error2, Env2>(other: Schedule<Output2, Input2, Error2, Env2>): <Output, Input, Error, Env>(
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
  fromStep(core.map(
    core.zip(toStep(self), toStep(other)),
    ([stepLeft, stepRight]) => (now, input) =>
      Pull.matchEffect(stepLeft(now, input as Input), {
        onSuccess: (leftResult) =>
          stepRight(now, input as Input2).pipe(
            core.map((rightResult) =>
              [[leftResult[0], rightResult[0]], Duration.min(leftResult[1], rightResult[1])] as [
                [Output, Output2],
                Duration.Duration
              ]
            ),
            Pull.catchHalt((rightDone) => Pull.halt([leftResult[0], rightDone] as [Output, Output2]))
          ),
        onHalt: (leftDone) =>
          stepRight(now, input as Input2).pipe(
            core.flatMap((rightResult) => Pull.halt([leftDone, rightResult[0]] as [Output, Output2])),
            Pull.catchHalt((rightDone) => Pull.halt([leftDone, rightDone] as [Output, Output2]))
          ),
        onFailure: core.failCause
      })
  )))

/**
 * Returns a new schedule that passes each input and output of the specified
 * schedule to the provided `check` function.
 *
 * If the `check` function returns `true`, the schedule will continue,
 * otherwise the schedule will stop.
 *
 * @since 2.0.0
 * @category utilities
 */
export const check: {
  <Input, Output>(predicate: (input: Input, output: Output) => boolean): <Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error, Env>
  <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (input: Input, output: Output) => boolean
  ): Schedule<Output, Input, Error, Env>
} = dual(2, <Output, Input, Error, Env>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (input: Input, output: Output) => boolean
): Schedule<Output, Input, Error, Env> => checkEffect(self, (input, output) => core.succeed(predicate(input, output))))

/**
 * Returns a new schedule that passes each input and output of the specified
 * schedule to the provided effectful `check` function.
 *
 * If the `check` function returns `true`, the schedule will continue,
 * otherwise the schedule will stop.
 *
 * @since 2.0.0
 * @category utilities
 */
export const checkEffect: {
  <Input, Output, Error2, Env2>(
    predicate: (input: Input, output: Output) => Effect<boolean, Error2, Env2>
  ): <Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (input: Input, output: Output) => Effect<boolean, Error2, Env2>
  ): Schedule<Output, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (input: Input, output: Output) => Effect<boolean, Error2, Env2>
): Schedule<Output, Input, Error | Error2, Env | Env2> =>
  fromStepEnv(core.map(toStep(self), (step) =>
    core.fnUntraced(function*(now, input) {
      const result = yield* step(now, input)
      const check = yield* predicate(input, result[0])
      return yield* (check ? core.succeed(result) : Pull.halt(result[0]))
    }))))

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
 * Combines two `Schedule`s by recurring if either of the two schedules wants
 * to recur, using the minimum of the two durations between recurrences.
 *
 * @since 2.0.0
 * @category utilities
 */
export const either: {
  <Output2, Input2, Error2, Env2>(other: Schedule<Output2, Input2, Error2, Env2>): <Output, Input, Error, Env>(
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
  fromStep(core.map(
    core.zip(toStep(self), toStep(other)),
    ([stepLeft, stepRight]) => (now, input) =>
      Pull.matchEffect(stepLeft(now, input as Input), {
        onSuccess: (leftResult) =>
          stepRight(now, input as Input2).pipe(
            core.map((rightResult) =>
              [[leftResult[0], rightResult[0]], Duration.min(leftResult[1], rightResult[1])] as [
                [Output, Output2],
                Duration.Duration
              ]
            ),
            Pull.catchHalt((rightDone) =>
              core.succeed<[[Output, Output2], Duration.Duration]>([
                [leftResult[0], rightDone as Output2],
                leftResult[1]
              ])
            )
          ),
        onFailure: core.failCause,
        onHalt: (leftDone) =>
          stepRight(now, input as Input2).pipe(
            core.map((rightResult) =>
              [[leftDone, rightResult[0]], rightResult[1]] as [
                [Output, Output2],
                Duration.Duration
              ]
            ),
            Pull.catchHalt((rightDone) => Pull.halt([leftDone, rightDone] as [Output, Output2]))
          )
      })
  )))

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
  return fromStepWithTiming(core.succeed((options) => {
    const duration = Duration.millis(baseMillis * Math.pow(factor, options.recurrence))
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
  return fromStepWithTiming(core.succeed((options) =>
    core.sync(() => [
      options.recurrence,
      window === 0 || options.elapsedSincePrevious > window
        ? Duration.zero
        : Duration.millis(window - (options.elapsed % window))
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
  <Output, Output2>(f: (output: Output) => Output2): <Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output2, Input, Error, Env>
  <Output, Input, Error, Env, Output2>(
    self: Schedule<Output, Input, Error, Env>,
    f: (output: Output) => Output2
  ): Schedule<Output2, Input, Error, Env>
} = dual(2, <Output, Input, Error, Env, Output2>(
  self: Schedule<Output, Input, Error, Env>,
  f: (output: Output) => Output2
): Schedule<Output2, Input, Error, Env> => mapEffect(self, (output) => core.succeed(f(output))))

/**
 * Returns a new `Schedule` that maps the output of this schedule using the
 * specified effectful function.
 *
 * @since 2.0.0
 * @category mapping
 */
export const mapEffect: {
  <Output, Output2, Error2, Env2>(f: (output: Output) => Effect<Output2, Error2, Env2>): <Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output2, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Output2, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    f: (output: Output) => Effect<Output2, Error2, Env2>
  ): Schedule<Output2, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Output2, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  f: (output: Output) => Effect<Output2, Error2, Env2>
): Schedule<Output2, Input, Error | Error2, Env | Env2> =>
  fromStepEnv(core.map(toStep(self), (step) => (now, input) =>
    Pull.matchEffect(step(now, input), {
      onSuccess: ([output, duration]) => core.map(f(output), (output) => [output, duration]),
      onFailure: core.failCause,
      onHalt: (output) => core.flatMap(f(output), Pull.halt)
    }))))

/**
 * Returns a new `Schedule` that outputs the inputs of the specified schedule.
 *
 * @since 2.0.0
 * @category utilities
 */
export const passthrough = <Output, Input, Error, Env>(
  self: Schedule<Output, Input, Error, Env>
): Schedule<Input, Input, Error, Env> =>
  fromStepEnv(core.map(toStep(self), (step) => (now, input) =>
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
export const recurs = (times: number): Schedule<number> => whileOutput(forever, (n) => n < times)

/**
 * Returns a schedule that recurs continuously, each repetition spaced the
 * specified duration from the last run.
 *
 * @since 2.0.0
 * @category constructors
 */
export const spaced = (duration: Duration.DurationInput): Schedule<number> => {
  const decoded = Duration.decode(duration)
  return fromStepWithTiming(core.succeed((options) => core.succeed([options.recurrence, decoded])))
}

/**
 * @since 2.0.0
 * @category constructors
 */
export const unfold = <State>(
  initial: State,
  next: (state: State) => State
): Schedule<State> => unfoldEffect(initial, (state) => core.succeed(next(state)))

/**
 * @since 2.0.0
 * @category constructors
 */
export const unfoldEffect = <State, Error, Env>(
  initial: State,
  next: (state: State) => Effect<State, Error, Env>
): Schedule<State, unknown, Error, Env> =>
  fromStepEnv(core.sync(() => {
    let state = initial
    return constant(core.map(core.suspend(() => next(state)), (nextState) => {
      const prev = state
      state = nextState
      return [prev, Duration.zero] as const
    }))
  }))

/**
 * Returns a new schedule that continues until the specified predicate on the
 * input of the schedule evaluates to `true`.
 *
 * @since 2.0.0
 * @category utilities
 */
export const untilInput: {
  <Input>(predicate: (input: Input) => boolean): <Output, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error, Env>
  <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (input: Input) => boolean
  ): Schedule<Output, Input, Error, Env>
} = dual(2, <Output, Input, Error, Env>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (input: Input) => boolean
): Schedule<Output, Input, Error, Env> => check(self, (input) => !predicate(input)))

/**
 * Returns a new schedule that continues until the specified effectful
 * predicate on the input of the schedule evaluates to `true`.
 *
 * @since 2.0.0
 * @category utilities
 */
export const untilInputEffect: {
  <Input, Error2, Env2>(predicate: (input: Input) => Effect<boolean, Error2, Env2>): <Output, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (input: Input) => Effect<boolean, Error2, Env2>
  ): Schedule<Output, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (input: Input) => Effect<boolean, Error2, Env2>
): Schedule<Output, Input, Error | Error2, Env | Env2> =>
  checkEffect(self, (input) => core.map(predicate(input), (bool) => !bool)))

/**
 * Returns a new schedule that continues for as long the specified predicate
 * on the input of the schedule evaluates to `true`.
 *
 * @since 2.0.0
 * @category utilities
 */
export const whileInput: {
  <Input>(predicate: (input: Input) => boolean): <Output, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error, Env>
  <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (input: Input) => boolean
  ): Schedule<Output, Input, Error, Env>
} = dual(2, <Output, Input, Error, Env>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (input: Input) => boolean
): Schedule<Output, Input, Error, Env> => check(self, (input) => predicate(input)))

/**
 * Returns a new schedule that continues for as long the specified effectful
 * predicate on the input of the schedule evaluates to `true`.
 *
 * @since 2.0.0
 * @category utilities
 */
export const whileInputEffect: {
  <Input, Error2, Env2>(predicate: (input: Input) => Effect<boolean, Error2, Env2>): <Output, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (input: Input) => Effect<boolean, Error2, Env2>
  ): Schedule<Output, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (input: Input) => Effect<boolean, Error2, Env2>
): Schedule<Output, Input, Error | Error2, Env | Env2> => checkEffect(self, (input) => predicate(input)))

/**
 * Returns a new schedule that continues for as long the specified predicate on
 * the output of the schedule evaluates to `true`.
 *
 * @since 2.0.0
 * @category utilities
 */
export const whileOutput: {
  <Output>(predicate: (output: Output) => boolean): <Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error, Env>
  <Output, Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (output: Output) => boolean
  ): Schedule<Output, Input, Error, Env>
} = dual(2, <Output, Input, Error, Env>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (output: Output) => boolean
): Schedule<Output, Input, Error, Env> => check(self, (_, output) => predicate(output)))

/**
 * Returns a new schedule that continues for as long the specified effectful
 * predicate on the output of the schedule evaluates to `true`.
 *
 * @since 2.0.0
 * @category utilities
 */
export const whileOutputEffect: {
  <Output, Error2, Env2>(predicate: (output: Output) => Effect<boolean, Error2, Env2>): <Input, Error, Env>(
    self: Schedule<Output, Input, Error, Env>
  ) => Schedule<Output, Input, Error | Error2, Env | Env2>
  <Output, Input, Error, Env, Error2, Env2>(
    self: Schedule<Output, Input, Error, Env>,
    predicate: (output: Output) => Effect<boolean, Error2, Env2>
  ): Schedule<Output, Input, Error | Error2, Env | Env2>
} = dual(2, <Output, Input, Error, Env, Error2, Env2>(
  self: Schedule<Output, Input, Error, Env>,
  predicate: (output: Output) => Effect<boolean, Error2, Env2>
): Schedule<Output, Input, Error | Error2, Env | Env2> => checkEffect(self, (_, output) => predicate(output)))

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
