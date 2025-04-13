import { defineConfig } from "vitest/config"

const isDeno = process.versions.deno !== undefined

export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      ...(isDeno ?
        [
          "!./packages/platform-bun",
          "!./packages/platform-node",
          "!./packages/platform-node-shared"
        ] :
        [])
    ]
  }
})
