/**
 * @since 1.0.0
 */
import * as Predicate from "effect/data/Predicate"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as PlatformError from "effect/platform/PlatformError"
import * as Terminal from "effect/platform/Terminal"
import * as Queue from "effect/Queue"
import * as RcRef from "effect/RcRef"
import type * as Scope from "effect/Scope"
import * as readline from "node:readline"

/**
 * @since 1.0.0
 * @category constructors
 */
export const make: (
  shouldQuit?: (input: Terminal.UserInput) => boolean
) => Effect.Effect<Terminal.Terminal, never, Scope.Scope> = Effect.fnUntraced(
  function*(shouldQuit: (input: Terminal.UserInput) => boolean = defaultShouldQuit) {
    const stdin = process.stdin
    const stdout = process.stdout

    // Acquire readline interface with TTY setup/cleanup inside the scope
    const rlRef = yield* RcRef.make({
      acquire: Effect.acquireRelease(
        Effect.sync(() => {
          const rl = readline.createInterface({ input: stdin, escapeCodeTimeout: 50 })
          readline.emitKeypressEvents(stdin, rl)

          if (stdin.isTTY) {
            stdin.setRawMode(true)
          }
          return rl
        }),
        (rl) =>
          Effect.sync(() => {
            if (stdin.isTTY) {
              stdin.setRawMode(false)
            }
            rl.close()
          })
      )
    })

    const columns = Effect.sync(() => stdout.columns ?? 0)

    const readInput = Effect.gen(function*() {
      yield* RcRef.get(rlRef)
      const queue = yield* Queue.make<Terminal.UserInput, Queue.Done>()
      const handleKeypress = (s: string | undefined, k: readline.Key) => {
        const userInput = {
          input: s,
          key: { name: k.name ?? "", ctrl: !!k.ctrl, meta: !!k.meta, shift: !!k.shift }
        }
        Queue.offerUnsafe(queue, userInput)
        if (shouldQuit(userInput)) {
          Queue.doneUnsafe(queue, Exit.void)
        }
      }
      yield* Effect.addFinalizer(() => Effect.sync(() => stdin.off("keypress", handleKeypress)))
      stdin.on("keypress", handleKeypress)
      return queue as Queue.Dequeue<Terminal.UserInput, Queue.Done>
    })

    const readLine = Effect.scoped(
      Effect.flatMap(RcRef.get(rlRef), (readlineInterface) =>
        Effect.callback<string, Terminal.QuitError>((resume) => {
          const onLine = (line: string) => resume(Effect.succeed(line))
          readlineInterface.once("line", onLine)
          return Effect.sync(() => readlineInterface.off("line", onLine))
        }))
    )

    const display = (prompt: string) =>
      Effect.uninterruptible(
        Effect.callback<void, PlatformError.PlatformError>((resume) => {
          stdout.write(prompt, (err) =>
            Predicate.isNullish(err)
              ? resume(Effect.void)
              : resume(Effect.fail(
                new PlatformError.BadArgument({
                  module: "Terminal",
                  method: "display",
                  description: "Failed to write prompt to stdout",
                  cause: err
                })
              )))
        })
      )

    return Terminal.make({
      columns,
      readInput,
      readLine,
      display
    })
  }
)

/**
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<Terminal.Terminal> = Layer.effect(Terminal.Terminal, make(defaultShouldQuit))

function defaultShouldQuit(input: Terminal.UserInput) {
  return input.key.ctrl && (input.key.name === "c" || input.key.name === "d")
}
