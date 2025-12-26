/**
 * This module exposes an {@link https://effect.website/docs/runtime/ | Effect Runtime} powered by Deno.
 * @module
 *
 * @example
 * ```ts
 * import { DenoRuntime } from "@effect/platform-deno";
 * import { Console } from "effect";
 *
 * DenoRuntime.runMain(Console.log("Hello, World"));
 * ```
 *
 * @since 1.0.0
 */

import type { Effect } from "effect/Effect"
import * as Runtime from "effect/Runtime"

/**
 * Run an Effect as the entrypoint to a Deno application.
 *
 * @since 1.0.0
 * @category runtime
 */

export const runMain: {
  (
    options?: {
      readonly disableErrorReporting?: boolean | undefined
      readonly teardown?: Runtime.Teardown | undefined
    }
  ): <E, A>(effect: Effect<A, E>) => void
  <E, A>(
    effect: Effect<A, E>,
    options?: {
      readonly disableErrorReporting?: boolean | undefined
      readonly teardown?: Runtime.Teardown | undefined
    }
  ): void
} = Runtime.makeRunMain(({
  fiber,
  teardown
}) => {
  let receivedSignal = false

  fiber.addObserver((exit) => {
    if (!receivedSignal) {
      Deno.removeSignalListener("SIGINT", onSigint)
      Deno.removeSignalListener("SIGTERM", onSigint)
    }

    teardown(exit, (code) => {
      if (receivedSignal || code !== 0) {
        Deno.exit(code)
      }
    })
  })

  function onSigint(): void {
    receivedSignal = true
    Deno.removeSignalListener("SIGINT", onSigint)
    Deno.removeSignalListener("SIGTERM", onSigint)
    fiber.unsafeInterrupt(fiber.id)
  }

  Deno.addSignalListener("SIGINT", onSigint)
  Deno.addSignalListener("SIGTERM", onSigint) // Not supported on Windows.
})
