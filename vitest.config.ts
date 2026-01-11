import path from "node:path"
import aliases from "vite-tsconfig-paths"
import { mergeConfig } from "vitest/config"
import type { ViteUserConfig } from "vitest/config"

const isDeno = process.versions.deno !== undefined
const isBun = process.versions.bun !== undefined

export const shared: ViteUserConfig = {
  esbuild: {
    target: "es2020"
  },
  optimizeDeps: {
    exclude: ["bun:sqlite"]
  },
  plugins: [aliases()],
  test: {
    setupFiles: [path.join(__dirname, "vitest.setup.ts")],
    fakeTimers: {
      toFake: undefined
    },
    sequence: {
      concurrent: true
    },
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["html"],
      reportsDirectory: "coverage",
      exclude: [
        "node_modules/",
        "dist/",
        "benchmark/",
        "bundle/",
        "dtslint/",
        "build/",
        "coverage/",
        "test/utils/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/vitest.setup.*"
      ]
    }
  }
}

export default mergeConfig(shared, {
  test: {
    projects: [
      "packages/*",
      "packages/sql/*",
      // "packages/tools/*",
      ...(isDeno ?
        [
          "!packages/platform-bun",
          "!packages/platform-node",
          "!packages/platform-node-shared",
          "!packages/sql/d1",
          "!packages/sql/sqlite-node"
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
