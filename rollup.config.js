import { nodeResolve } from "@rollup/plugin-node-resolve"
import terser from "@rollup/plugin-terser"

export default {
  output: {
    format: "cjs"
  },
  plugins: [nodeResolve(), terser({ mangle: true, compress: true })]
}
