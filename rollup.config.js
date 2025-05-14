import { nodeResolve } from "@rollup/plugin-node-resolve"
import terser from "@rollup/plugin-terser"
import esbuild from "rollup-plugin-esbuild"

export default {
  output: {
    format: "esm"
  },
  onwarn: (warning, next) => {
    if (warning.code === "THIS_IS_UNDEFINED") return
    next(warning)
  },
  plugins: [
    nodeResolve(),
    esbuild({
      target: "node20", // Since as of May 2025 the active LTS is Node 20
      format: "esm"
    }),
    terser({
      format: { comments: false },
      compress: true,
      mangle: true
    })
  ]
}
