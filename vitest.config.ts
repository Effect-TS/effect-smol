import { defineConfig } from "vitest/config"

const isDeno = process.versions.deno !== undefined
const isBun = process.versions.bun !== undefined

export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      "packages/sql/*/vitest.config.ts",
      ...(isDeno ?
        [
          "!packages/platform-bun",
          "!packages/platform-node",
          "!packages/platform-node-shared"
        ] :
        []),
      ...(isBun ?
        [
          "!packages/platform-node"
        ] :
        [])
    ]
  }
})
