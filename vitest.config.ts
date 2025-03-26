import * as path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  esbuild: {
    target: "es2020"
  },
  optimizeDeps: {
    // exclude: ["bun:sqlite"]
  },
  resolve: {
    alias: {
      "effect": path.join(__dirname, "src"),
      "effect/test": path.join(__dirname, "test")
    }
  },
  test: {
    coverage: {
      reporter: ["html"],
      include: ["src/Result.ts", "src/internal/result.ts"]
    },
    // setupFiles: [path.join(__dirname, "setupTests.ts")],
    fakeTimers: {
      toFake: undefined
    },
    sequence: {
      concurrent: true
    },
    include: ["test/**/*.test.ts"]
  }
})
