/**
 * @since 1.0.0
 */
import type { Effect } from "effect/Effect"
import { constVoid } from "effect/Function"
import type { Teardown } from "effect/Runtime"
import { makeRunMain } from "effect/Runtime"

/**
 * @since 1.0.0
 * @category Run main
 */
export const runMain: {
  (
    options?: { readonly disableErrorReporting?: boolean | undefined; readonly teardown?: Teardown | undefined }
  ): <E, A>(effect: Effect<A, E>) => void
  <E, A>(
    effect: Effect<A, E>,
    options?: { readonly disableErrorReporting?: boolean | undefined; readonly teardown?: Teardown | undefined }
  ): void
} = makeRunMain(({
  fiber,
  teardown
}) => {
  const keepAlive = setInterval(constVoid, 2 ** 31 - 1)
  let receivedSignal = false

  fiber.addObserver((exit) => {
    if (!receivedSignal) {
      process.removeListener("SIGINT", onSigint)
      process.removeListener("SIGTERM", onSigint)
    }
    clearInterval(keepAlive)
    teardown(exit, (code) => {
      if (receivedSignal || code !== 0) {
        process.exit(code)
      }
    })
  })

  function onSigint() {
    receivedSignal = true
    process.removeListener("SIGINT", onSigint)
    process.removeListener("SIGTERM", onSigint)
    fiber.unsafeInterruptAsFork(fiber.id())
  }

  process.on("SIGINT", onSigint)
  process.on("SIGTERM", onSigint)
})
