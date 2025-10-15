import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/bin.ts"],
  clean: true,
  publicDir: true,
  banner: {
    js: "#!/usr/bin/env node"
  },
  treeshake: "smallest"
})
