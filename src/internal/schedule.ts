import type { Effect, Repeat, Retry } from "../Effect.js"
import { dual } from "../Function.js"
import * as Option from "../Option.js"
import * as Pull from "../Pull.js"
import * as Schedule from "../Schedule.js"
import type { NoInfer } from "../Types.js"
import * as core from "./core.js"

/** @internal */
export const repeatOrElse: {
  <R2, A, B, E, E2, E3, R3>(
    schedule: Schedule.Schedule<B, A, E2, R2>,
    orElse: (error: E | E2, option: Option.Option<B>) => Effect<B, E3, R3>
  ): <R>(
    self: Effect<A, E, R>
  ) => Effect<B, E3, R | R2 | R3>
  <A, E, R, R2, B, E2, E3, R3>(
    self: Effect<A, E, R>,
    schedule: Schedule.Schedule<B, A, E2, R2>,
    orElse: (error: E | E2, option: Option.Option<B>) => Effect<B, E3, R3>
  ): Effect<B, E3, R | R2 | R3>
} = dual(3, <A, E, R, R2, B, E2, E3, R3>(
  self: Effect<A, E, R>,
  schedule: Schedule.Schedule<B, A, E2, R2>,
  orElse: (error: E | E2, option: Option.Option<B>) => Effect<B, E3, R3>
): Effect<B, E3, R | R2 | R3> =>
  core.flatMap(Schedule.toStepWithSleep(schedule), (step) => {
    let lastOutput: Option.Option<B> = Option.none()
    return core.catch_(
      core.forever(
        core.tap(core.flatMap(self, step), (output) => {
          lastOutput = Option.some(output)
        }),
        { autoYield: false }
      ),
      (error) => Pull.isHalt(error) ? core.succeed(error.leftover as B) : orElse(error as E | E2, lastOutput)
    )
  }))

/** @internal */
export const retryOrElse: {
  <A1, E, E1, R1, A2, E2, R2>(
    policy: Schedule.Schedule<A1, NoInfer<E>, E1, R1>,
    orElse: (e: NoInfer<E | E1>, out: A1) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | A2, E1 | E2, R | R1 | R2>
  <A, E, R, A1, E1, R1, A2, E2, R2>(
    self: Effect<A, E, R>,
    policy: Schedule.Schedule<A1, NoInfer<E>, E1, R1>,
    orElse: (e: NoInfer<E | E1>, out: A1) => Effect<A2, E2, R2>
  ): Effect<A | A2, E1 | E2, R | R1 | R2>
} = dual(3, <A, E, R, A1, E1, R1, A2, E2, R2>(
  self: Effect<A, E, R>,
  policy: Schedule.Schedule<A1, NoInfer<E>, E1, R1>,
  orElse: (e: NoInfer<E | E1>, out: A1) => Effect<A2, E2, R2>
): Effect<A | A2, E1 | E2, R | R1 | R2> =>
  core.flatMap(Schedule.toStepWithSleep(policy), (step) => {
    let lastError: E | E1 | undefined
    const loop: Effect<A, E1 | Pull.Halt<A1>, R> = core.catch_(self, (error) => {
      lastError = error
      return core.flatMap(step(error), () => loop)
    })
    return Pull.catchHalt(loop, (out) => orElse(lastError!, out as A1))
  }))

/** @internal */
export const repeat = dual<{
  <O extends Repeat.Options<A>, A>(
    options: O
  ): <E, R>(self: Effect<A, E, R>) => Repeat.Return<R, E, A, O>
  <B, A, R1>(
    schedule: Schedule.Schedule<B, A, R1>
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, E, R | R1>
}, {
  <A, E, R, O extends Repeat.Options<A>>(
    self: Effect<A, E, R>,
    options: O
  ): Repeat.Return<R, E, A, O>
  <A, E, R, B, R1>(
    self: Effect<A, E, R>,
    schedule: Schedule.Schedule<B, A, R1>
  ): Effect<B, E, R | R1>
}>(
  2,
  (self: Effect<any, any, any>, options: Repeat.Options<any> | Schedule.Schedule<any, any, any>) =>
    repeatOrElse(self, Schedule.isSchedule(options) ? options : buildFromOptions(options), core.fail)
)

/** @internal */
export const retry = dual<{
  <E, O extends Retry.Options<E>>(
    options: O
  ): <A, R>(
    self: Effect<A, E, R>
  ) => Retry.Return<R, E, A, O>
  <B, E, R1>(
    policy: Schedule.Schedule<B, NoInfer<E>, R1>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E, R1 | R>
}, {
  <A, E, R, O extends Retry.Options<E>>(
    self: Effect<A, E, R>,
    options: O
  ): Retry.Return<R, E, A, O>
  <A, E, R, B, R1>(
    self: Effect<A, E, R>,
    policy: Schedule.Schedule<B, E, R1>
  ): Effect<A, E, R1 | R>
}>(
  2,
  (self: Effect<any, any, any>, options: Retry.Options<any> | Schedule.Schedule<any, any, any>) =>
    retryOrElse(self, Schedule.isSchedule(options) ? options : buildFromOptions(options), core.fail)
)

const passthroughForever = Schedule.passthrough(Schedule.forever)
const buildFromOptions = <Input>(options: {
  schedule?: Schedule.Schedule<any, Input, any> | undefined
  while?: ((input: Input) => boolean | Effect<boolean, any, any>) | undefined
  until?: ((input: Input) => boolean | Effect<boolean, any, any>) | undefined
  times?: number | undefined
}) => {
  let schedule: Schedule.Schedule<any, Input, any, any> = options.schedule ?? passthroughForever
  if (options.while) {
    schedule = Schedule.whileEffect(schedule, ({ input }) => {
      const applied = options.while!(input)
      return typeof applied === "boolean" ? core.succeed(applied) : applied
    })
  }
  if (options.until) {
    schedule = Schedule.whileEffect(schedule, ({ input }) => {
      const applied = options.until!(input)
      return typeof applied === "boolean" ? core.succeed(!applied) : core.map(applied, (b) => !b)
    })
  }
  if (options.times !== undefined) {
    schedule = Schedule.while(schedule, ({ recurrence }) => recurrence < options.times!)
  }
  return schedule
}
