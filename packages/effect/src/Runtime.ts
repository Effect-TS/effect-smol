/**
 * @since 4.0.0
 */
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import type * as Fiber from "effect/Fiber"
import { dual } from "effect/Function"

/**
 * @category Model
 * @since 4.0.0
 */
export interface Teardown {
  <E, A>(exit: Exit.Exit<E, A>, onExit: (code: number) => void): void
}

/**
 * @category Teardown
 * @since 4.0.0
 */
export const defaultTeardown: Teardown = <E, A>(
  exit: Exit.Exit<E, A>,
  onExit: (code: number) => void
) => {
  onExit(Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause) ? 1 : 0)
}

/**
 * @category Run main
 * @since 4.0.0
 */
export const makeRunMain = (
  f: <E, A>(
    options: {
      readonly fiber: Fiber.Fiber<A, E>
      readonly teardown: Teardown
    }
  ) => void
): {
  (
    options?: {
      readonly disableErrorReporting?: boolean | undefined
      readonly teardown?: Teardown | undefined
    }
  ): <E, A>(effect: Effect.Effect<A, E>) => void
  <E, A>(
    effect: Effect.Effect<A, E>,
    options?: {
      readonly disableErrorReporting?: boolean | undefined
      readonly teardown?: Teardown | undefined
    }
  ): void
} =>
  dual((args) => Effect.isEffect(args[0]), (effect: Effect.Effect<any, any>, options?: {
    readonly disableErrorReporting?: boolean | undefined
    readonly teardown?: Teardown | undefined
  }) => {
    const fiber = options?.disableErrorReporting === true
      ? Effect.runFork(effect)
      : Effect.runFork(
        Effect.tapCause(effect, (cause) => {
          if (Cause.isInterruptedOnly(cause)) {
            return Effect.void
          }
          return Effect.logError(cause)
        })
      )
    const teardown = options?.teardown ?? defaultTeardown
    return f({ fiber, teardown })
  })
