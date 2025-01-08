/**
 * @since 2.0.0
 */
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import { constant, dual, identity } from "./Function.js"
import * as core from "./internal/core.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
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
export interface Schedule<out Output, in Input = unknown, out Env = never>
  extends Schedule.Variance<Output, Input, Env>, Pipeable
{}

/**
 * @since 2.0.0
 */
export declare namespace Schedule {
  /**
   * @since 2.0.0
   * @category Models
   */
  export interface Variance<out Output, in Input, out Env> {
    readonly [TypeId]: VarianceStruct<Output, Input, Env>
  }

  /**
   * @since 2.0.0
   * @category Models
   */
  export interface VarianceStruct<out Output, in Input, out Env> {
    readonly _Out: Covariant<Output>
    readonly _In: Contravariant<Input>
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
 * @since 4.0.0
 * @category constructors
 */
export const fromStep = <Input, Output, Env>(
  step: Effect<
    (now: number, input: Input) => Pull.Pull<[Output, Duration.Duration], never, Output>,
    never,
    Env
  >
): Schedule<Output, Input, Env> => {
  const self = Object.create(ScheduleProto)
  self.step = step
  return self
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromStepEnv = <Input, Output, EnvX, Env>(
  step: Effect<
    (now: number, input: Input) => Pull.Pull<[Output, Duration.Duration], never, Output, EnvX>,
    never,
    Env
  >
): Schedule<Output, Input, Env | EnvX> =>
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
export const fromStepWithTiming = <Input, Output, Env>(
  step: Effect<
    (options: {
      readonly input: Input
      readonly recurrence: number
      readonly start: number
      readonly now: number
      readonly elapsed: number
      readonly elapsedSincePrevious: number
    }) => Pull.Pull<[Output, Duration.Duration], never, Output>,
    never,
    Env
  >
): Schedule<Output, Input, Env> =>
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
export const toStep = <Output, Input, Env>(
  schedule: Schedule<Output, Input, Env>
): Effect<
  (now: number, input: Input) => Pull.Pull<[Output, Duration.Duration], never, Output>,
  never,
  Env
> => (schedule as any).step

/**
 * @since 4.0.0
 * @category destructors
 */
export const toStepWithSleep = <Output, Input, Env>(
  schedule: Schedule<Output, Input, Env>
): Effect<
  (input: Input) => Pull.Pull<Output, never, Output>,
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
export const both = dual<
  <Output2, Input2, Env2>(
    other: Schedule<Output2, Input2, Env2>
  ) => <Output, Input, Env>(
    self: Schedule<Output, Input, Env>
  ) => Schedule<[Output, Output2], Input & Input2, Env | Env2>,
  <Output, Input, Env, Output2, Input2, Env2>(
    self: Schedule<Output, Input, Env>,
    other: Schedule<Output2, Input2, Env2>
  ) => Schedule<[Output, Output2], Input & Input2, Env | Env2>
>(2, <Output, Input, Env, Output2, Input2, Env2>(
  self: Schedule<Output, Input, Env>,
  other: Schedule<Output2, Input2, Env2>
) =>
  fromStep(core.map(
    core.zip(toStep(self), toStep(other)),
    ([stepLeft, stepRight]) => (now, input) =>
      core.matchEffect(stepLeft(now, input as Input), {
        onSuccess: (leftResult) =>
          stepRight(now, input as Input2).pipe(
            core.map((rightResult) =>
              [[leftResult[0], rightResult[0]], Duration.min(leftResult[1], rightResult[1])] as [
                [Output, Output2],
                Duration.Duration
              ]
            ),
            core.catch_((rightHalt) => Pull.halt([leftResult[0], rightHalt.leftover] as [Output, Output2]))
          ),
        onFailure: (leftHalt) =>
          stepRight(now, input as Input2).pipe(
            core.flatMap((rightResult) => Pull.halt([leftHalt.leftover, rightResult[0]] as [Output, Output2])),
            core.catch_((rightHalt) => Pull.halt([leftHalt.leftover, rightHalt.leftover] as [Output, Output2]))
          )
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
export const check = dual<
  <Input, Output>(
    predicate: (input: Input, output: Output) => boolean
  ) => <Env>(
    self: Schedule<Output, Input, Env>
  ) => Schedule<Output, Input, Env>,
  <Output, Input, Env>(
    self: Schedule<Output, Input, Env>,
    predicate: (input: Input, output: Output) => boolean
  ) => Schedule<Output, Input, Env>
>(2, (self, predicate) => checkEffect(self, (input, output) => core.succeed(predicate(input, output))))

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
export const checkEffect = dual<
  <Input, Output, Env2>(
    predicate: (input: Input, output: Output) => Effect<boolean, never, Env2>
  ) => <Env>(
    self: Schedule<Output, Input, Env>
  ) => Schedule<Output, Input, Env | Env2>,
  <Output, Input, Env, Env2>(
    self: Schedule<Output, Input, Env>,
    predicate: (input: Input, output: Output) => Effect<boolean, never, Env2>
  ) => Schedule<Output, Input, Env | Env2>
>(2, (self, predicate) =>
  fromStepEnv(core.map(toStep(self), (step) =>
    core.fnUntraced(function*(now, input) {
      const result = yield* step(now, input)
      const check = yield* predicate(input, result[0])
      return yield* (check ? core.succeed(result) : Pull.halt(result[0]))
    }))))

/**
 * Combines two `Schedule`s by recurring if either of the two schedules wants
 * to recur, using the minimum of the two durations between recurrences.
 *
 * @since 2.0.0
 * @category utilities
 */
export const either = dual<
  <Output2, Input2, Env2>(
    other: Schedule<Output2, Input2, Env2>
  ) => <Output, Input, Env>(
    self: Schedule<Output, Input, Env>
  ) => Schedule<[Output, Output2], Input & Input2, Env | Env2>,
  <Output, Input, Env, Output2, Input2, Env2>(
    self: Schedule<Output, Input, Env>,
    other: Schedule<Output2, Input2, Env2>
  ) => Schedule<[Output, Output2], Input & Input2, Env | Env2>
>(2, <Output, Input, Env, Output2, Input2, Env2>(
  self: Schedule<Output, Input, Env>,
  other: Schedule<Output2, Input2, Env2>
) =>
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
            core.catch_((rightHalt) =>
              core.succeed<[[Output, Output2], Duration.Duration]>([
                [leftResult[0], rightHalt.leftover],
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
            core.catch_((rightHalt) => Pull.halt([leftDone, rightHalt.leftover] as [Output, Output2]))
          )
      })
  )))

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
 * Returns a `Schedule` which can only be stepped the specified number of
 * `times` before it terminates.
 *
 * @category constructors
 * @since 2.0.0
 */
export const recurs = (times: number): Schedule<number> => whileOutput(forever, (n) => n < times)

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
export const unfoldEffect = <State, Env>(
  initial: State,
  next: (state: State) => Effect<State, never, Env>
): Schedule<State, unknown, Env> =>
  fromStepEnv(core.sync(() => {
    let state = initial
    return constant(core.map(core.suspend(() => next(state)), (nextState) => {
      const prev = state
      state = nextState
      return [prev, Duration.zero] as const
    }))
  }))

/**
 * Returns a new schedule that continues for as long the specified effectful
 * predicate on the input of the schedule evaluates to `true`.
 *
 * @since 2.0.0
 * @category utilities
 */
export const whileInput = dual<
  <Input>(
    predicate: (input: Input) => boolean
  ) => <Output, Env>(
    self: Schedule<Output, Input, Env>
  ) => Schedule<Output, Input, Env>,
  <Output, Input, Env>(
    self: Schedule<Output, Input, Env>,
    predicate: (input: Input) => boolean
  ) => Schedule<Output, Input, Env>
>(2, (self, predicate) => check(self, (input) => predicate(input)))

/**
 * Returns a new schedule that continues for as long the specified effectful
 * predicate on the input of the schedule evaluates to `true`.
 *
 * @since 2.0.0
 * @category utilities
 */
export const whileInputEffect = dual<
  <Input, Env2>(
    predicate: (input: Input) => Effect<boolean, never, Env2>
  ) => <Output, Env>(
    self: Schedule<Output, Input, Env>
  ) => Schedule<Output, Input, Env | Env2>,
  <Output, Input, Env, Env2>(
    self: Schedule<Output, Input, Env>,
    predicate: (input: Input) => Effect<boolean, never, Env2>
  ) => Schedule<Output, Input, Env | Env2>
>(2, (self, predicate) => checkEffect(self, (input) => predicate(input)))

/**
 * Returns a new schedule that continues for as long the specified predicate on
 * the output of the schedule evaluates to `true`.
 *
 * @since 2.0.0
 * @category utilities
 */
export const whileOutput = dual<
  <Output>(
    predicate: (output: Output) => boolean
  ) => <Input, Env>(
    self: Schedule<Output, Input, Env>
  ) => Schedule<Output, Input, Env>,
  <Output, Input, Env>(
    self: Schedule<Output, Input, Env>,
    predicate: (output: Output) => boolean
  ) => Schedule<Output, Input, Env>
>(2, (self, predicate) => check(self, (_, output) => predicate(output)))

/**
 * Returns a new schedule that continues for as long the specified effectful
 * predicate on the output of the schedule evaluates to `true`.
 *
 * @since 2.0.0
 * @category utilities
 */
export const whileOutputEffect = dual<
  <Output, Env2>(
    predicate: (output: Output) => Effect<boolean, never, Env2>
  ) => <Input, Env>(
    self: Schedule<Output, Input, Env>
  ) => Schedule<Output, Input, Env | Env2>,
  <Output, Input, Env, Env2>(
    self: Schedule<Output, Input, Env>,
    predicate: (output: Output) => Effect<boolean, never, Env2>
  ) => Schedule<Output, Input, Env | Env2>
>(2, (self, predicate) => checkEffect(self, (_, output) => predicate(output)))

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
 * Returns a new schedule that outputs the delay between each occurence.
 *
 * @since 2.0.0
 * @category constructors
 */
export const delays = <Out, In, R>(self: Schedule<Out, In, R>): Schedule<Duration.Duration, In, R> =>
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
