import * as Option from "../data/Option.ts"
import type { Effect, Repeat, Retry } from "../Effect.ts"
import { constant, constTrue, dual } from "../Function.ts"
import * as Schedule from "../Schedule.ts"
import * as Pull from "../stream/Pull.ts"
import type { NoInfer } from "../types/Types.ts"
import { internalCall } from "../Utils.ts"
import * as effect from "./effect.ts"

/** @internal */
export const repeatOrElse: {
  <R2, A, B, E, E2, E3, R3>(
    schedule: Schedule.Schedule<B, A, E2, R2>,
    orElse: (error: E | E2, meta: Option.Option<Schedule.Metadata<B, A>>) => Effect<B, E3, R3>
  ): <R>(
    self: Effect<A, E, R>
  ) => Effect<B, E3, Exclude<R, Schedule.CurrentMetadata> | R2 | R3>
  <A, E, R, R2, B, E2, E3, R3>(
    self: Effect<A, E, R>,
    schedule: Schedule.Schedule<B, A, E2, R2>,
    orElse: (error: E | E2, meta: Option.Option<Schedule.Metadata<B, A>>) => Effect<B, E3, R3>
  ): Effect<B, E3, Exclude<R, Schedule.CurrentMetadata> | R2 | R3>
} = dual(3, <A, E, R, R2, B, E2, E3, R3>(
  self: Effect<A, E, R>,
  schedule: Schedule.Schedule<B, A, E2, R2>,
  orElse: (error: E | E2, meta: Option.Option<Schedule.Metadata<B, A>>) => Effect<B, E3, R3>
): Effect<B, E3, Exclude<R, Schedule.CurrentMetadata> | R2 | R3> =>
  effect.flatMap(Schedule.toStepWithMetadata(schedule), (step) => {
    let meta = Schedule.metadataEmpty()
    return effect.catch_(
      effect.forever(
        effect.tap(
          effect.flatMap(effect.suspend(() => effect.provideService(self, Schedule.CurrentMetadata, meta)), step),
          (meta_) => {
            meta = meta_
          }
        ),
        { autoYield: false }
      ),
      (error) =>
        Pull.isHalt(error)
          ? effect.succeed(error.leftover as B)
          : orElse(error as E | E2, meta.attempt === 0 ? Option.none() : Option.some(meta as any))
    )
  }))

/** @internal */
export const retryOrElse: {
  <A1, E, E1, R1, A2, E2, R2>(
    policy: Schedule.Schedule<A1, NoInfer<E>, E1, R1>,
    orElse: (e: NoInfer<E | E1>, out: A1) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | A2, E1 | E2, Exclude<R, Schedule.CurrentMetadata> | R1 | R2>
  <A, E, R, A1, E1, R1, A2, E2, R2>(
    self: Effect<A, E, R>,
    policy: Schedule.Schedule<A1, NoInfer<E>, E1, R1>,
    orElse: (e: NoInfer<E | E1>, out: A1) => Effect<A2, E2, R2>
  ): Effect<A | A2, E1 | E2, Exclude<R, Schedule.CurrentMetadata> | R1 | R2>
} = dual(3, <A, E, R, A1, E1, R1, A2, E2, R2>(
  self: Effect<A, E, R>,
  policy: Schedule.Schedule<A1, NoInfer<E>, E1, R1>,
  orElse: (e: NoInfer<E | E1>, out: A1) => Effect<A2, E2, R2>
): Effect<A | A2, E1 | E2, Exclude<R, Schedule.CurrentMetadata> | R1 | R2> =>
  effect.flatMap(Schedule.toStepWithMetadata(policy), (step) => {
    let meta = Schedule.metadataEmpty()
    const loop: Effect<A, E1 | Pull.Halt<A1>, Exclude<R, Schedule.CurrentMetadata> | R1> = effect.catch_(
      effect.suspend(() => effect.provideService(self, Schedule.CurrentMetadata, meta)),
      (error) =>
        effect.flatMap(step(error), (meta_) => {
          meta = meta_
          return loop
        })
    )
    return Pull.catchHalt(loop, (out) => internalCall(() => orElse(meta.input as any, out as A1)))
  }))

/** @internal */
export const repeat = dual<{
  <O extends Repeat.Options<A>, A>(
    options: O
  ): <E, R>(self: Effect<A, E, R>) => Repeat.Return<R, E, A, O>
  <Output, Input, Error, Env>(
    schedule: Schedule.Schedule<Output, NoInfer<Input>, Error, Env>
  ): <E, R>(self: Effect<Input, E, R>) => Effect<Output, E | Error, Exclude<R, Schedule.CurrentMetadata> | Env>
}, {
  <A, E, R, O extends Repeat.Options<A>>(
    self: Effect<A, E, R>,
    options: O
  ): Repeat.Return<R, E, A, O>
  <Input, E, R, Output, Error, Env>(
    self: Effect<Input, E, R>,
    schedule: Schedule.Schedule<Output, NoInfer<Input>, Error, Env>
  ): Effect<Output, E | Error, Exclude<R, Schedule.CurrentMetadata> | Env>
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
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | Error, Exclude<R, Schedule.CurrentMetadata> | Env>
}, {
  <A, E, R, O extends Retry.Options<E>>(
    self: Effect<A, E, R>,
    options: O
  ): Retry.Return<R, E, A, O>
  <A, E, R, B, Error, Env>(
    self: Effect<A, E, R>,
    policy: Schedule.Schedule<B, NoInfer<E>, Error, Env>
  ): Effect<A, E | Error, Exclude<R, Schedule.CurrentMetadata> | Env>
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
  ) => Effect<Output, E, Exclude<R, Schedule.CurrentMetadata> | Env>,
  <Input, E, R, Output, Error, Env>(
    self: Effect<Input, E, R>,
    initial: Input,
    schedule: Schedule.Schedule<Output, Input, Error, Env>
  ) => Effect<Output, E, Exclude<R, Schedule.CurrentMetadata> | Env>
>(3, <Input, E, R, Output, Error, Env>(
  self: Effect<Input, E, R>,
  initial: Input,
  schedule: Schedule.Schedule<Output, Input, Error, Env>
): Effect<Output, E, Exclude<R, Schedule.CurrentMetadata> | Env> =>
  effect.flatMap(Schedule.toStepWithMetadata(schedule), (step) => {
    let meta = Schedule.metadataEmpty()
    const selfWithMeta = effect.suspend(() => effect.provideService(self, Schedule.CurrentMetadata, meta))
    return effect.catch_(
      effect.flatMap(
        step(initial),
        (meta_) => {
          meta = meta_
          const body = constant(effect.flatMap(selfWithMeta, step))
          return effect.whileLoop({
            while: constTrue,
            body,
            step(meta_) {
              meta = meta_
            }
          }) as Effect<never, E, Exclude<R, Schedule.CurrentMetadata> | Env>
        }
      ),
      (error) => Pull.isHalt(error) ? effect.succeed(error.leftover as Output) : effect.fail(error as E)
    )
  }))

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
    schedule = Schedule.while(schedule, ({ attempt }) => attempt <= options.times!)
  }
  return schedule
}
