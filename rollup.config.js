/* eslint-disable no-undef */
import { nodeResolve } from "@rollup/plugin-node-resolve"
import replace from "@rollup/plugin-replace"
import terser from "@rollup/plugin-terser"
import esbuild from "rollup-plugin-esbuild"
import { visualizer } from "rollup-plugin-visualizer"

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
    replace({
      "process.env.NODE_ENV": JSON.stringify("production"),
      preventAssignment: true
    }),
    esbuild({
      target: "node20", // Since as of May 2025 the active LTS is Node 20
      format: "esm"
    }),
    terser({
      format: { comments: false },
      compress: true,
      mangle: true
    }),
    ...(process.env.VISUALIZE === "true" ?
      [visualizer({
        open: true,
        gzipSize: true
      })] :
      [])
  ]
}
