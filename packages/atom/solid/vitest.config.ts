import { mergeConfig } from "vitest/config"
import shared from "../../../vitest.shared.ts"

export default mergeConfig(shared, {
  resolve: {
    conditions: ["browser"],
    alias: {
      "solid-js/web": "solid-js/web/dist/web.cjs",
      "solid-js/web/dist/server": "solid-js/web/dist/web.cjs",
      "solid-js/web/dist/server.js": "solid-js/web/dist/web.cjs",
      "solid-js/web/dist/server.cjs": "solid-js/web/dist/web.cjs"
    }
  },
  esbuild: {
    target: "es2022"
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"]
  }
})
