import type { Effect, Repeat, Retry } from "../Effect.js"
import { dual } from "../Function.js"
import * as Option from "../Option.js"
import * as Pull from "../Pull.js"
import * as Schedule from "../Schedule.js"
import type { NoInfer } from "../Types.js"
import * as effect from "./effect.js"

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
  effect.flatMap(Schedule.toStepWithSleep(schedule), (step) => {
    let lastOutput: Option.Option<B> = Option.none()
    return effect.catch_(
      effect.forever(
        effect.tap(effect.flatMap(self, step), (output) => {
          lastOutput = Option.some(output)
        }),
        { autoYield: false }
      ),
      (error) => Pull.isHalt(error) ? effect.succeed(error.leftover as B) : orElse(error as E | E2, lastOutput)
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
  effect.flatMap(Schedule.toStepWithSleep(policy), (step) => {
    let lastError: E | E1 | undefined
    const loop: Effect<A, E1 | Pull.Halt<A1>, R | R1> = effect.catch_(self, (error) => {
      lastError = error
      return effect.flatMap(step(error), () => loop)
    })
    return Pull.catchHalt(loop, (out) => orElse(lastError!, out as A1))
  }))

/** @internal */
export const repeat = dual<{
  <O extends Repeat.Options<A>, A>(
    options: O
  ): <E, R>(self: Effect<A, E, R>) => Repeat.Return<R, E, A, O>
  <Output, Input, Error, Env>(
    schedule: Schedule.Schedule<Output, Input, NoInfer<Error>, Env>
  ): <E, R>(self: Effect<Input, E, R>) => Effect<Output, E | Error, R | Env>
}, {
  <A, E, R, O extends Repeat.Options<A>>(
    self: Effect<A, E, R>,
    options: O
  ): Repeat.Return<R, E, A, O>
  <Input, E, R, Output, Error, Env>(
    self: Effect<Input, E, R>,
    schedule: Schedule.Schedule<Output, Input, NoInfer<Error>, Env>
  ): Effect<Output, E | Error, R | Env>
}>(
  2,
  (self: Effect<any, any, any>, options: Repeat.Options<any> | Schedule.Schedule<any, any, any, any>) =>
    repeatOrElse(self, Schedule.isSchedule(options) ? options : buildFromOptions(options), effect.fail)
)

/** @internal */
export const retry = dual<{
  <E, O extends Retry.Options<E>>(
    options: O
  ): <A, R>(
    self: Effect<A, E, R>
  ) => Retry.Return<R, E, A, O>
  <B, E, Error, Env>(
    policy: Schedule.Schedule<B, NoInfer<E>, Error, Env>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | Error, R | Env>
}, {
  <A, E, R, O extends Retry.Options<E>>(
    self: Effect<A, E, R>,
    options: O
  ): Retry.Return<R, E, A, O>
  <A, E, R, B, Error, Env>(
    self: Effect<A, E, R>,
    policy: Schedule.Schedule<B, E, Error, Env>
  ): Effect<A, E | Error, R | Env>
}>(
  2,
  (self: Effect<any, any, any>, options: Retry.Options<any> | Schedule.Schedule<any, any, any, any>) =>
    retryOrElse(self, Schedule.isSchedule(options) ? options : buildFromOptions(options), effect.fail)
)

/** @internal */
export const scheduleFrom = dual<
  <Input, Output, Error, Env>(
    initial: Input,
    schedule: Schedule.Schedule<Output, Input, Error, Env>
  ) => <E, R>(
    self: Effect<Input, E, R>
  ) => Effect<Output, E, R | Env>,
  <Input, E, R, Output, Error, Env>(
    self: Effect<Input, E, R>,
    initial: Input,
    schedule: Schedule.Schedule<Output, Input, Error, Env>
  ) => Effect<Output, E, R | Env>
>(3, <Input, E, R, Output, Error, Env>(
  self: Effect<Input, E, R>,
  initial: Input,
  schedule: Schedule.Schedule<Output, Input, Error, Env>
): Effect<Output, E, R | Env> =>
  effect.flatMap(Schedule.toStepWithSleep(schedule), (step) =>
    effect.catch_(
      effect.andThen(
        step(initial),
        effect.forever(
          effect.flatMap(self, step),
          { autoYield: false }
        )
      ),
      (error) => Pull.isHalt(error) ? effect.succeed(error.leftover as Output) : effect.fail(error as E)
    )))

const passthroughForever = Schedule.passthrough(Schedule.forever)
const buildFromOptions = <Input>(options: {
  schedule?: Schedule.Schedule<any, Input, any, any> | undefined
  while?: ((input: Input) => boolean | Effect<boolean, any, any>) | undefined
  until?: ((input: Input) => boolean | Effect<boolean, any, any>) | undefined
  times?: number | undefined
}) => {
  let schedule: Schedule.Schedule<any, Input, any, any> = options.schedule ?? passthroughForever
  if (options.while) {
    schedule = Schedule.while(schedule, ({ input }) => options.while!(input))
  }
  if (options.until) {
    schedule = Schedule.while(schedule, ({ input }) => {
      const applied = options.until!(input)
      return typeof applied === "boolean" ? !applied : effect.map(applied, (b) => !b)
    })
  }
  if (options.times !== undefined) {
    schedule = Schedule.while(schedule, ({ recurrence }) => recurrence < options.times!)
  }
  return schedule
}
