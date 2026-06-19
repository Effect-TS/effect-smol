import { svelte } from "@sveltejs/vite-plugin-svelte"
import { mergeConfig } from "vitest/config"
import shared from "../../../vitest.shared.ts"

export default mergeConfig(shared, {
  plugins: [svelte()],
  resolve: {
    conditions: ["browser"]
  },
  esbuild: {
    target: "es2022"
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Testing Library renders into a shared `document.body`, so these DOM tests
    // must not run concurrently within a file.
    sequence: {
      concurrent: false
    }
  }
})
