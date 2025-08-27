import * as path from "node:path"
import viteTsconfigPaths from "vite-tsconfig-paths"
import type { ViteUserConfig } from "vitest/config"

const config: ViteUserConfig = {
  plugins: [viteTsconfigPaths()],
  esbuild: {
    target: "es2020"
  },
  optimizeDeps: {
    exclude: ["bun:sqlite"]
  },
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
        "**/vitest.setup.*",
        "**/vitest.shared.*"
      ],
      all: true
    }
  }
}

export default config
