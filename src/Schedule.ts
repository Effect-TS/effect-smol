/**
 * @since 2.0.0
 */
import * as Clock from "./Clock.js"
import * as Duration from "./Duration.js"
import * as Effect from "./Effect.js"
import { dual, identity } from "./Function.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import * as Pull from "./Pull.js"
import type { Contravariant, Covariant } from "./Types.js"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/Schedule")

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * @since 4.0.0
 * @category Models
 */
export interface Schedule<out Output, in Input = unknown, out Env = never>
  extends Schedule.Variance<Output, Input, Env>, Pipeable
{}

/**
 * @since 4.0.0
 */
export declare namespace Schedule {
  /**
   * @since 4.0.0
   * @category Models
   */
  export interface Variance<out Output, in Input, out Env> {
    readonly [TypeId]: VarianceStruct<Output, Input, Env>
  }

  /**
   * @since 4.0.0
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
export const fromStep = <Input, Output, EnvX, Env>(
  step: Effect.Effect<
    (input: Input) => Pull.Pull<[Output, Duration.Duration], never, Output, EnvX>,
    never,
    Env
  >
): Schedule<Output, Input, Env | EnvX> => {
  const self = Object.create(ScheduleProto)
  self.step = step
  return self
}

const stepWithSleep = <Input, Output, EnvX, Env>(
  step: Effect.Effect<
    (now: number, input: Input) => Pull.Pull<[Output, Duration.Duration], never, Output, EnvX>,
    never,
    Env
  >
): Schedule<Output, Input, Env | EnvX> =>
  fromStep(Effect.map(
    Effect.zip(Clock.currentTimeMillis, step),
    ([now, step]) => {
      return Effect.fnUntraced(function*(input) {
        const result = yield* step(now, input)
        yield* Effect.sleep(Duration.subtract(result[1], now))
        return result
      })
    }
  ))

/**
 * @since 4.0.0
 * @category destructors
 */
export const toStep = <Output, Input, Env>(
  schedule: Schedule<Output, Input, Env>
): Effect.Effect<
  (input: Input) => Pull.Pull<[Output, Duration.Duration], never, Output>,
  never,
  Env
> => (schedule as any).step

/**
 * Combines two `Schedule`s by recurring if both of the two schedules want
 * to recur, using the maximum of the two durations between recurrences.
 *
 * @since 4.0.0
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
  fromStep(Effect.map(
    Effect.zip(toStep(self), toStep(other)),
    ([stepLeft, stepRight]) => (input) =>
      Effect.matchEffect(stepLeft(input as Input), {
        onSuccess: (leftResult) =>
          stepRight(input as Input2).pipe(
            Effect.map((rightResult) =>
              [[leftResult[0], rightResult[0]], Duration.min(leftResult[1], rightResult[1])] as [
                [Output, Output2],
                Duration.Duration
              ]
            ),
            Effect.catch((rightHalt) => Pull.halt([leftResult[0], rightHalt.leftover] as [Output, Output2]))
          ),
        onFailure: (leftHalt) =>
          stepRight(input as Input2).pipe(
            Effect.flatMap((rightResult) => Pull.halt([leftHalt.leftover, rightResult[0]] as [Output, Output2])),
            Effect.catch((rightHalt) => Pull.halt([leftHalt.leftover, rightHalt.leftover] as [Output, Output2]))
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
 * @since 4.0.0
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
>(2, (self, predicate) => checkEffect(self, (input, output) => Effect.succeed(predicate(input, output))))

/**
 * Returns a new schedule that passes each input and output of the specified
 * schedule to the provided effectful `check` function.
 *
 * If the `check` function returns `true`, the schedule will continue,
 * otherwise the schedule will stop.
 *
 * @since 4.0.0
 * @category utilities
 */
export const checkEffect = dual<
  <Input, Output, Env2>(
    predicate: (input: Input, output: Output) => Effect.Effect<boolean, never, Env2>
  ) => <Env>(
    self: Schedule<Output, Input, Env>
  ) => Schedule<Output, Input, Env | Env2>,
  <Output, Input, Env, Env2>(
    self: Schedule<Output, Input, Env>,
    predicate: (input: Input, output: Output) => Effect.Effect<boolean, never, Env2>
  ) => Schedule<Output, Input, Env | Env2>
>(2, (self, predicate) =>
  fromStep(Effect.map(toStep(self), (step) =>
    Effect.fnUntraced(function*(input) {
      const result = yield* step(input)
      const check = yield* predicate(input, result[0])
      return yield* (check ? Effect.succeed(result) : Pull.halt(result[0]))
    }))))

/**
 * Combines two `Schedule`s by recurring if either of the two schedules wants
 * to recur, using the minimum of the two durations between recurrences.
 *
 * @since 4.0.0
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
  fromStep(Effect.map(
    Effect.zip(toStep(self), toStep(other)),
    ([stepLeft, stepRight]) => (input) =>
      Effect.matchEffect(stepLeft(input as Input), {
        onSuccess: (leftResult) =>
          stepRight(input as Input2).pipe(
            Effect.map((rightResult) =>
              [[leftResult[0], rightResult[0]], Duration.min(leftResult[1], rightResult[1])] as [
                [Output, Output2],
                Duration.Duration
              ]
            ),
            Effect.catch((rightHalt) =>
              Effect.succeed<[[Output, Output2], Duration.Duration]>([
                [leftResult[0], rightHalt.leftover],
                leftResult[1]
              ])
            )
          ),
        onFailure: (leftHalt) =>
          stepRight(input as Input2).pipe(
            Effect.map((rightResult) =>
              [[leftHalt.leftover, rightResult[0]], rightResult[1]] as [
                [Output, Output2],
                Duration.Duration
              ]
            ),
            Effect.catch((rightHalt) => Pull.halt([leftHalt.leftover, rightHalt.leftover] as [Output, Output2]))
          )
      })
  )))

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
 * @since 4.0.0
 * @category constructors
 */
export const fixed = (interval: Duration.DurationInput): Schedule<number> =>
  stepWithSleep(Effect.sync(() => {
    const window = Duration.toMillis(interval)
    let startTime = 0
    let lastTime = 0
    let recurrences = 0
    return Effect.fnUntraced(function*(now) {
      if (recurrences === 0) {
        startTime = now
        lastTime = now
        return [recurrences++, Duration.sum(now, window)]
      }
      const isRunningBehind = now > (lastTime + window)
      const boundary = window <= 0 ? window : window - ((now - startTime) % window)
      const sleepTime = boundary <= 0 ? window : boundary
      lastTime = isRunningBehind ? now : now + sleepTime
      return [recurrences++, Duration.millis(lastTime)]
    })
  }))

/**
 * Returns a `Schedule` which can only be stepped the specified number of
 * `times` before it terminates.
 *
 * @category constructors
 * @since 4.0.0
 */
export const recurs = (times: number): Schedule<number> => whileOutput(forever, (n) => n < times)

/**
 * @since 4.0.0
 * @category constructors
 */
export const unfold = <State>(
  initial: State,
  next: (state: State) => State
): Schedule<State> => unfoldEffect(initial, (state) => Effect.succeed(next(state)))

/**
 * @since 4.0.0
 * @category constructors
 */
export const unfoldEffect = <State, Env>(
  initial: State,
  next: (state: State) => Effect.Effect<State, never, Env>
): Schedule<State, unknown, Env> =>
  fromStep(Effect.sync(() => {
    let state = initial
    return Effect.fnUntraced(function*() {
      const prevState = state
      state = yield* next(state)
      return [prevState, Duration.zero]
    })
  }))

/**
 * Returns a new schedule that continues for as long the specified effectful
 * predicate on the input of the schedule evaluates to `true`.
 *
 * @since 4.0.0
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
 * @since 4.0.0
 * @category utilities
 */
export const whileInputEffect = dual<
  <Input, Env2>(
    predicate: (input: Input) => Effect.Effect<boolean, never, Env2>
  ) => <Output, Env>(
    self: Schedule<Output, Input, Env>
  ) => Schedule<Output, Input, Env | Env2>,
  <Output, Input, Env, Env2>(
    self: Schedule<Output, Input, Env>,
    predicate: (input: Input) => Effect.Effect<boolean, never, Env2>
  ) => Schedule<Output, Input, Env | Env2>
>(2, (self, predicate) => checkEffect(self, (input) => predicate(input)))

/**
 * Returns a new schedule that continues for as long the specified predicate on
 * the output of the schedule evaluates to `true`.
 *
 * @since 4.0.0
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
 * @since 4.0.0
 * @category utilities
 */
export const whileOutputEffect = dual<
  <Output, Env2>(
    predicate: (output: Output) => Effect.Effect<boolean, never, Env2>
  ) => <Input, Env>(
    self: Schedule<Output, Input, Env>
  ) => Schedule<Output, Input, Env | Env2>,
  <Output, Input, Env, Env2>(
    self: Schedule<Output, Input, Env>,
    predicate: (output: Output) => Effect.Effect<boolean, never, Env2>
  ) => Schedule<Output, Input, Env | Env2>
>(2, (self, predicate) => checkEffect(self, (_, output) => predicate(output)))

/**
 * Returns a new `Schedule` that will recur forever.
 *
 * The output of the schedule is the current count of its repetitions thus far
 * (i.e. `0, 1, 2, ...`).
 *
 * @since 4.0.0
 * @category constructors
 */
export const forever: Schedule<number> = unfold(0, (n) => n + 1)
