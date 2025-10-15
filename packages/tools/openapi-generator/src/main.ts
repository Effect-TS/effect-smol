import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import * as OpenApiGenerator from "./OpenApiGenerator.ts"

const spec = Flag.fileParse("spec").pipe(
  Flag.withAlias("s"),
  Flag.withDescription("The OpenAPI spec file to generate the client from")
)

const name = Flag.string("name").pipe(
  Flag.withAlias("n"),
  Flag.withDescription("The name of the generated client"),
  Flag.withDefault("Client")
)

const typeOnly = Flag.boolean("type-only").pipe(
  Flag.withAlias("t"),
  Flag.withDescription("Generate a type-only client without schemas")
)

const root = Command.make("openapigen", { spec, typeOnly, name }).pipe(
  Command.withHandler(Effect.fnUntraced(function*({ name, spec, typeOnly }) {
    const generator = yield* OpenApiGenerator.OpenApiGenerator
    const source = yield* generator.generate(spec as any, { name, typeOnly })
    return yield* Console.log(source)
  })),
  Command.provide(({ typeOnly }) =>
    typeOnly
      ? OpenApiGenerator.layerTransformerTs
      : OpenApiGenerator.layerTransformerSchema
  )
)

export const run = Command.run(root, {
  version: "0.0.0"
})
