import { Command } from "@effect/cli"
import { Effect, Schema, Struct } from "effect"
import * as Model from "../model.js"
import * as Utils from "../utils.js"

export const pack = Command.make("pack", {}, () =>
  Effect.gen(function*() {
    const utils = yield* Utils.Utils
    const pkg = yield* utils.readJson("./package.json").pipe(
      Effect.flatMap(Schema.decodeUnknown(Model.PackageJson))
    )

    // TODO: Remove codegen template files (.e.g `src/.idex.ts`) from `dist/src`.
    yield* Effect.all([
      utils.rmAndMkdir("dist"),
      utils.copyIfExists("CHANGELOG.md", "dist/CHANGELOG.md"),
      utils.copyIfExists("README.md", "dist/README.md"),
      utils.copyIfExists("LICENSE", "dist/LICENSE"),
      utils.rmAndCopy("src", "dist/src"),
      utils.rmAndCopy("build", "dist/dist")
    ], { concurrency: "unbounded" })

    const json = Struct.evolve(pkg, {
      main: replaceJs,
      types: replaceDts,
      bin: replaceOptional((bin) => {
        const result: Record<string, string> = {}
        for (const [key, value] of Object.entries(bin)) {
          result[key] = replaceJs(value)!
        }

        return result
      }),
      // TODO: Actually resolve these according to node module resolution algorithm.
      exports: replaceOptional((exports) => {
        const result: Record<string, any> = {}
        for (const [key, value] of Object.entries(exports)) {
          if (value === null) {
            result[key] = null
          } else if (typeof value === "string") {
            result[key] = {
              types: replaceDts(value),
              default: replaceJs(value)
            }
          } else {
            // TODO: Support arbitrary export conditions.
            result[key] = Struct.evolve(value, {
              types: replaceDts,
              browser: replaceJs,
              default: replaceJs
            })
          }
        }

        return result
      })
    })

    yield* utils.writeJson("dist/package.json", json)
  })).pipe(
    Command.withDescription("Prepare a package for publishing"),
    Command.provide(Utils.Utils.Default)
  )

const replaceOptional = <T>(f: (value: T) => T) => (value: T | undefined): T | undefined =>
  !(value === undefined || value === null) ? f(value) as any : undefined as any
const replaceDts = replaceOptional((file: string) => file.replace(/^\.\/src\//, "./dist/").replace(/\.ts$/, ".d.ts"))
const replaceJs = replaceOptional((file: string) =>
  file.replace(/^\.\/src\//, "./dist/").replace(/\.ts$/, ".js").replace(/\.tsx$/, ".jsx")
)
