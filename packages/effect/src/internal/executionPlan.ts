import * as Result from "../data/Result.ts"
import type { Effect } from "../Effect.ts"
import type * as Api from "../ExecutionPlan.ts"
import { dual } from "../Function.ts"
import * as Schedule from "../Schedule.ts"
import * as effect from "./effect.ts"
import * as internalLayer from "./layer.ts"
import * as internalSchedule from "./schedule.ts"

/** @internal */
export const withExecutionPlan: {
  <Input, Provides, PlanE, PlanR>(
    plan: Api.ExecutionPlan<{
      provides: Provides
      input: Input
      error: PlanE
      requirements: PlanR
    }>
  ): <A, E extends Input, R>(effect: Effect<A, E, R>) => Effect<
    A,
    E | PlanE,
    Exclude<R, Provides> | PlanR
  >
  <A, E extends Input, R, Provides, Input, PlanE, PlanR>(
    effect: Effect<A, E, R>,
    plan: Api.ExecutionPlan<{
      provides: Provides
      input: Input
      error: PlanE
      requirements: PlanR
    }>
  ): Effect<
    A,
    E | PlanE,
    Exclude<R, Provides> | PlanR
  >
} = dual(2, <A, E extends Input, R, Provides, Input, PlanE, PlanR>(
  self: Effect<A, E, R>,
  plan: Api.ExecutionPlan<{
    provides: Provides
    input: Input
    error: PlanE
    requirements: PlanR
  }>
) =>
  effect.suspend(() => {
    let i = 0
    let result: Result.Result<A, any> | undefined
    return effect.flatMap(
      effect.whileLoop({
        while: () => i < plan.steps.length && (result === undefined || Result.isFailure(result)),
        body() {
          const step = plan.steps[i]
          let nextEffect: Effect<A, any, any> = internalLayer.provide(self, step.provide as any)
          if (result) {
            let attempted = false
            const wrapped = nextEffect
            // ensure the schedule is applied at least once
            nextEffect = effect.suspend(() => {
              if (attempted) return wrapped
              attempted = true
              return result!.asEffect()
            })
            nextEffect = internalSchedule.retry(nextEffect, scheduleFromStep(step, false)!)
          } else {
            nextEffect = internalSchedule.retry(nextEffect, scheduleFromStep(step, true))
          }
          return effect.result(nextEffect)
        },
        step(result_) {
          result = result_
          i++
        }
      }),
      () => result!.asEffect()
    )
  }))

/** @internal */
export const scheduleFromStep = <Provides, In, PlanE, PlanR>(
  step: Api.ExecutionPlan<{
    provides: Provides
    input: In
    error: PlanE
    requirements: PlanR
  }>["steps"][number],
  first: boolean
) => {
  if (!first) {
    return internalSchedule.buildFromOptions({
      schedule: step.schedule ? step.schedule : step.attempts ? undefined : scheduleOnce,
      times: step.attempts,
      while: step.while
    })
  } else if (step.attempts === 1 || !(step.schedule || step.attempts)) {
    return scheduleZero
  }
  return internalSchedule.buildFromOptions({
    schedule: step.schedule,
    while: step.while,
    times: step.attempts ? step.attempts - 1 : undefined
  })
}

const scheduleOnce = Schedule.recurs(1)
const scheduleZero = Schedule.recurs(0)
