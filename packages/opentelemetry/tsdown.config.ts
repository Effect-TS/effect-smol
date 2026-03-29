import { pureAnnotations } from "@effect/oxc/rolldown-plugin-pure-annotations"
import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/**/*.ts"],
  unbundle: true,
  format: "esm",
  dts: false,
  fixedExtension: false,
  sourcemap: true,
  clean: false,
  plugins: [pureAnnotations()]
})
