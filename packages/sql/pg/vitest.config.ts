import path from "node:path"
import viteTsconfigPaths from "vite-tsconfig-paths"
import { mergeConfig, type ViteUserConfig } from "vitest/config"
import shared from "../../../vitest.shared.ts"

const config: ViteUserConfig = {
  plugins: [viteTsconfigPaths({
    root: path.resolve(__dirname)
  })]
}

export default mergeConfig(shared, config)
