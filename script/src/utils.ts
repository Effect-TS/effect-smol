import { FileSystem } from "@effect/platform"
import { Effect, Predicate } from "effect"

export class Utils extends Effect.Service<Utils>()("NozzleUtils/Utils", {
  dependencies: [],
  effect: Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    const modifyFile = (
      path: string,
      f: (s: string, path: string) => string
    ) =>
      fs.readFileString(path).pipe(
        Effect.bindTo("original"),
        Effect.let("modified", ({ original }) => f(original, path)),
        Effect.flatMap(({ modified, original }) =>
          original === modified
            ? Effect.void
            : fs.writeFile(path, new TextEncoder().encode(modified))
        )
      )

    const existsOrFail = (path: string) =>
      fs.exists(path).pipe(
        Effect.filterOrFail(Predicate.isTruthy, () => new Error(`File ${path} does not exist`))
      )

    const rmAndCopy = (from: string, to: string) =>
      fs.remove(to, { recursive: true }).pipe(
        Effect.ignore,
        Effect.zipRight(fs.copy(from, to))
      )

    const copyIfExists = (from: string, to: string) =>
      fs.access(from).pipe(
        Effect.zipRight(Effect.ignore(fs.remove(to, { recursive: true }))),
        Effect.zipRight(fs.copy(from, to)),
        Effect.catchTag("SystemError", (e) => e.reason === "NotFound" ? Effect.void : Effect.fail(e))
      )

    const rmAndMkdir = (path: string) =>
      fs.remove(path, { recursive: true }).pipe(
        Effect.ignore,
        Effect.zipRight(fs.makeDirectory(path, { recursive: true }))
      )

    const readJson = (path: string) =>
      Effect.tryMap(fs.readFileString(path), {
        try: (_) => JSON.parse(_),
        catch: (e) => new Error(`readJson failed (${path}): ${e}`)
      })

    const writeJson = (path: string, json: any) => fs.writeFileString(path, JSON.stringify(json, null, 2) + "\n")

    return {
      modifyFile,
      copyIfExists,
      rmAndMkdir,
      rmAndCopy,
      readJson,
      writeJson,
      existsOrFail
    }
  })
}) {}
