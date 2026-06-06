import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import { pathToFileURL } from "node:url"
import { ModuleLoadError } from "./errors.ts"

const load = Effect.fnUntraced(function*(path: string) {
  const pathService = yield* Path.Path
  const resolved = pathService.resolve(path)
  return yield* Effect.tryPromise({
    try: () => import(pathToFileURL(resolved).href) as Promise<Record<string, unknown>>,
    catch: (cause) => moduleLoadError(resolved, cause)
  })
})

/** @internal */
export class ModuleLoader extends Context.Service<ModuleLoader, {
  readonly load: (path: string) => Effect.Effect<Record<string, unknown>, ModuleLoadError, Path.Path>
}>()("@effect/bdd/cli/ModuleLoader") {
  static readonly Live = Layer.succeed(ModuleLoader, {
    load
  })
}

const moduleLoadError = (path: string, cause: unknown): ModuleLoadError => {
  const message = String(cause)
  const isTsLoaderFailure = message.includes("Unknown file extension") && message.includes(".ts")
  return new ModuleLoadError({
    path,
    message: isTsLoaderFailure
      ? `Could not load TypeScript step module "${path}". Register a TypeScript loader when running on Node, for example: node --import tsx ./node_modules/.bin/effect-bdd`
      : `Could not load step module "${path}"`,
    cause
  })
}
