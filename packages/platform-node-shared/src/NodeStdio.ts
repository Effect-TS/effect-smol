/**
 * @since 1.0.0
 */
import * as Layer from "effect/Layer"
import { SystemError } from "effect/PlatformError"
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
        new SystemError({
          module: "Stdio",
          method: "stdout",
          reason: "Unknown",
          cause
        })
    }),
    stderr: fromWritable({
      evaluate: () => process.stderr,
      onError: (cause) =>
        new SystemError({
          module: "Stdio",
          method: "stderr",
          reason: "Unknown",
          cause
        })
    }),
    stdin: fromReadable({
      evaluate: () => process.stdin,
      onError: (cause) =>
        new SystemError({
          module: "Stdio",
          method: "stdin",
          reason: "Unknown",
          cause
        }),
      closeOnDone: false
    })
  })
)
