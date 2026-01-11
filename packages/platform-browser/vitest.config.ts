import { mergeConfig } from "vitest/config"
import { shared } from "../../vitest.config.ts"

export default mergeConfig(shared, {
  test: {
    environment: "happy-dom",
    setupFiles: "./vitest.setup.ts"
  }
})
