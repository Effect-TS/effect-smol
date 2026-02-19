/**
 * @since 1.0.0
 */
import * as Layer from "effect/Layer"
import { systemError } from "effect/PlatformError"
import * as Stdio from "effect/Stdio"
import { fromWritable } from "./NodeSink.ts"
import { fromReadable } from "./NodeStream.ts"

/**
 * @category Layers
 * @since 1.0.0
 */
export const layer: Layer.Layer<Stdio.Stdio> = Layer.succeed(
  Stdio.Stdio,
  Stdio.make({
    stdout: fromWritable({
      evaluate: () => process.stdout,
      onError: (cause) =>
        systemError({
          module: "Stdio",
          method: "stdout",
          _tag: "Unknown",
          cause
        })
    }),
    stderr: fromWritable({
      evaluate: () => process.stderr,
      onError: (cause) =>
        systemError({
          module: "Stdio",
          method: "stderr",
          _tag: "Unknown",
          cause
        })
    }),
    stdin: fromReadable({
      evaluate: () => process.stdin,
      onError: (cause) =>
        systemError({
          module: "Stdio",
          method: "stdin",
          _tag: "Unknown",
          cause
        }),
      closeOnDone: false
    })
  })
)
