import { defineConfig } from "vitest/config"

const isDeno = typeof Deno !== "undefined" && Deno.version?.deno
const isBun = typeof Bun !== "undefined"
const isNode = typeof process !== "undefined" &&
  process.release?.name === "node" &&
  !isDeno &&
  !isBun

export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      ...(!isDeno ? ["!packages/platform-deno"] : []),
      ...(isDeno ?
        [
          "!packages/platform-node-shared",
          "!packages/sql/d1",
          "!packages/sql/sqlite-node"
        ] :
        []),
      ...(!isBun ? ["!packages/platform-bun"] : []),
      ...(!isNode ? ["!packages/platform-node"] : [])
    ]
  }
})
