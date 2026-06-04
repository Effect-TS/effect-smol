/** @internal */
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as CliError from "effect/unstable/cli/CliError"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import PackageJson from "../package.json" with { type: "json" }
import { GlobResolver } from "./internal/cli/glob.ts"
import type { CliOptions } from "./internal/cli/models.ts"
import { ModuleLoader } from "./internal/cli/moduleLoader.ts"
import * as Reporter from "./internal/cli/reporter.ts"
import * as Runner from "./internal/cli/runner.ts"

const features = Flag.string("features").pipe(
  Flag.withAlias("f"),
  Flag.withDescription("Feature file glob. Can be supplied multiple times."),
  Flag.between(1, Infinity)
)

const steps = Flag.string("steps").pipe(
  Flag.withAlias("s"),
  Flag.withDescription("Step definition module glob. Can be supplied multiple times."),
  Flag.between(1, Infinity)
)

const reporter = Flag.choice("reporter", ["text", "html"] as const).pipe(
  Flag.withAlias("r"),
  Flag.withDescription("Reporter to run. Can be supplied multiple times."),
  Flag.between(0, Infinity)
)

const outputFileText = Flag.file("output-file.text").pipe(
  Flag.withDescription("File path for the text reporter. Defaults to stdout."),
  Flag.optional
)

const outputFileHtml = Flag.file("output-file.html").pipe(
  Flag.withDescription("File path for the html reporter."),
  Flag.optional
)

const parallel = Flag.integer("parallel").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("Number of scenarios to run concurrently."),
  Flag.filter((value) => value > 0, (value) => `Expected --parallel to be greater than 0, got ${value}`),
  Flag.withDefault(1)
)

/** @internal */
export const cli = Command.make(
  "effect-bdd",
  { features, steps, reporter, outputFileText, outputFileHtml, parallel },
  Effect.fnUntraced(function*({ features, steps, reporter, outputFileText, outputFileHtml, parallel }) {
    const options: CliOptions = {
      features,
      steps,
      reporters: reporter.length === 0 ? ["text"] : reporter,
      outputFiles: {
        ...(Option.isSome(outputFileText) ? { text: outputFileText.value } : {}),
        ...(Option.isSome(outputFileHtml) ? { html: outputFileHtml.value } : {})
      },
      parallel
    }
    const reporters = yield* Reporter.makeReporters(options.reporters, options.outputFiles).pipe(
      Effect.mapError(toUserError)
    )
    const result = yield* Runner.run(options).pipe(
      Effect.mapError(toUserError)
    )
    yield* Reporter.emitAll(reporters, result).pipe(
      Effect.mapError(toUserError)
    )
    if (result.summary.failed > 0) {
      return yield* Effect.fail(
        new CliError.UserError({
          cause: `${result.summary.failed} scenario(s) failed`
        })
      )
    }
  })
).pipe(
  Command.withDescription("Run @effect/bdd feature files"),
  Command.provide(Layer.mergeAll(GlobResolver.Live, ModuleLoader.Live))
)

/** @internal */
export const run = Command.run(cli, {
  version: PackageJson.version
})

const toUserError = (error: unknown): CliError.UserError => new CliError.UserError({ cause: renderUserError(error) })

const renderUserError = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return String(error)
}
