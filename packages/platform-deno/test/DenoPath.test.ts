import * as DenoPath from "@effect/platform-deno/DenoPath"
import { it } from "@effect/vitest"
import { Effect, Path } from "effect"

it.layer(DenoPath.layer)("Integration", (it) => {
  it.effect("Runs demo program.", ({ expect }) =>
    Effect.gen(function*() {
      // Access the Path service
      const path = yield* Path.Path

      // Join parts of a path to create a complete file path
      const tmpPath = path.join("tmp", "file.txt")

      expect(tmpPath).toBe("tmp/file.txt")
    }))
})
