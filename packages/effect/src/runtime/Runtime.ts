/**
 * This module provides utilities for running Effect programs and managing their execution lifecycle.
 *
 * The Runtime module contains functions for creating main program runners that handle process
 * teardown, error reporting, and exit code management. These utilities are particularly useful
 * for creating CLI applications and server processes that need to manage their lifecycle properly.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Runtime } from "effect/runtime"
 * import { Fiber } from "effect/runtime"
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
import { dual } from "effect/Function"
import type * as Fiber from "../runtime/Fiber.ts"

/**
 * Represents a teardown function that handles program completion and determines the exit code.
 *
 * The teardown function is called when an Effect program completes (either successfully or with failure)
 * and is responsible for determining the appropriate exit code and performing any cleanup operations.
 *
 * @param exit - The result of the Effect program execution
 * @param onExit - Callback to execute with the determined exit code
 *
 * @example
 * ```ts
 * import { Effect, Exit } from "effect"
 * import { Runtime } from "effect/runtime"
 *
 * // Custom teardown that logs completion status
 * const customTeardown: Runtime.Teardown = (exit, onExit) => {
 *   if (Exit.isSuccess(exit)) {
 *     console.log("Program completed successfully with value:", exit.value)
 *     onExit(0)
 *   } else {
 *     console.log("Program failed with cause:", exit.cause)
 *     onExit(1)
 *   }
 * }
 *
 * // Use with makeRunMain
 * const runMain = Runtime.makeRunMain(({ fiber, teardown }) => {
 *   fiber.addObserver((exit) => {
 *     teardown(exit, (code) => {
 *       console.log(`Exiting with code: ${code}`)
 *     })
 *   })
 * })
 *
 * const program = Effect.succeed("Hello, World!")
 * runMain(program, { teardown: customTeardown })
 * ```
 *
 * @category Model
 * @since 4.0.0
 */
export interface Teardown {
  <E, A>(exit: Exit.Exit<E, A>, onExit: (code: number) => void): void
}

/**
 * The default teardown function that determines exit codes based on Effect completion.
 *
 * This teardown function follows standard Unix conventions:
 * - Returns exit code 0 for successful completion
 * - Returns exit code 1 for failures (except interruption-only failures)
 * - Returns exit code 0 for interruption-only failures
 *
 * @example
 * ```ts
 * import { Effect, Exit, Cause } from "effect"
 * import { Runtime } from "effect/runtime"
 *
 * // The default teardown behavior
 * const program1 = Effect.succeed(42)
 * const program2 = Effect.fail("error")
 * const program3 = Effect.interrupt
 *
 * // Using defaultTeardown directly
 * const logExitCode = (exit: Exit.Exit<any, any>) => {
 *   Runtime.defaultTeardown(exit, (code) => {
 *     console.log(`Exit code: ${code}`)
 *   })
 * }
 *
 * // Success case - exit code 0
 * logExitCode(Exit.succeed(42))
 *
 * // Failure case - exit code 1
 * logExitCode(Exit.fail("error"))
 *
 * // Interruption case - exit code 0
 * logExitCode(Exit.interrupt(123))
 * ```
 *
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
 * Creates a platform-specific main program runner that handles Effect execution lifecycle.
 *
 * This function creates a runner that can execute Effect programs as main entry points,
 * handling process signals, fiber management, and teardown operations. The provided
 * function receives a fiber and teardown callback to implement platform-specific behavior.
 *
 * @param f - Function that sets up platform-specific behavior for the running Effect
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Runtime } from "effect/runtime"
 * import { Fiber } from "effect/runtime"
 *
 * // Create a simple runner for a hypothetical platform
 * const runMain = Runtime.makeRunMain(({ fiber, teardown }) => {
 *   // Set up signal handling
 *   const handleSignal = () => {
 *     Effect.runSync(Fiber.interrupt(fiber))
 *   }
 *
 *   // Add signal listeners (platform-specific)
 *   // process.on('SIGINT', handleSignal)
 *   // process.on('SIGTERM', handleSignal)
 *
 *   // Handle fiber completion
 *   fiber.addObserver((exit) => {
 *     teardown(exit, (code) => {
 *       console.log(`Program finished with exit code: ${code}`)
 *       // process.exit(code)
 *     })
 *   })
 * })
 *
 * // Use the runner
 * const program = Effect.gen(function* () {
 *   yield* Effect.log("Starting program")
 *   yield* Effect.sleep(1000)
 *   yield* Effect.log("Program completed")
 *   return "success"
 * })
 *
 * // Run with default options
 * runMain(program)
 *
 * // Run with custom teardown
 * runMain(program, {
 *   teardown: (exit, onExit) => {
 *     console.log("Custom teardown logic")
 *     Runtime.defaultTeardown(exit, onExit)
 *   }
 * })
 * ```
 *
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
