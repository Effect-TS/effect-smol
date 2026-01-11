import { mergeConfig, type ViteUserConfig } from "vitest/config"
import shared from "../../../vitest.shared.ts"

const config: ViteUserConfig = {
  test: {
    include: ["./test/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./vitest-setup.ts"]
  }
}

export default mergeConfig(shared, config)
