/**
 * This module provides utilities for running Effect programs and managing their execution lifecycle.
 *
 * The Runtime module contains functions for creating main program runners that handle process
 * teardown, error reporting, and exit code management. These utilities are particularly useful
 * for creating CLI applications and server processes that need to manage their lifecycle properly.
 *
 * @example
 * ```ts
 * import { Effect, Runtime, Fiber } from "effect"
 *
 * // Create a main runner for Node.js
 * const runMain = Runtime.makeRunMain((options) => {
 *   process.on('SIGINT', () => Effect.runFork(Fiber.interrupt(options.fiber)))
 *   process.on('SIGTERM', () => Effect.runFork(Fiber.interrupt(options.fiber)))
 *
 *   options.fiber.addObserver((exit) => {
 *     options.teardown(exit, (code) => process.exit(code))
 *   })
 * })
 *
 * // Use the runner
 * const program = Effect.log("Hello, World!")
 * runMain(program)
 * ```
 *
 * @since 4.0.0
 */
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import type * as Fiber from "effect/Fiber"
import { dual } from "effect/Function"

/**
 * Represents a teardown function that handles program completion and determines the exit code.
 *
 * The teardown function is called when an Effect program completes (either successfully or with failure)
 * and is responsible for determining the appropriate exit code and performing any cleanup operations.
 *
 * @param exit - The result of the Effect program execution
 * @param onExit - Callback to execute with the determined exit code
 *
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
