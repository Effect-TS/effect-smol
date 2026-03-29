/**
 * @since 1.0.0
 */
import type * as Path from "effect/Path"
import * as Predicate from "effect/Predicate"
import type { Plugin } from "rolldown"
import { visualizer } from "rollup-plugin-visualizer"

const EFFECT_PACKAGE_REGEX = /^(@effect\/[\w-]+|effect)(\/.*)?$/

/**
 * Options for configuring Rolldown plugins.
 *
 * @since 1.0.0
 * @category models
 */
export interface PluginOptions {
  readonly visualize?: boolean | undefined
}

/**
 * Creates a custom Rolldown plugin that resolves Effect package imports to their
 * local dist directories.
 *
 * @since 1.0.0
 * @category constructors
 */
export const createResolveLocalPackageImports = (pathService: Path.Path): Plugin => ({
  name: "rolldown-plugin-resolve-imports",
  async resolveId(source, importer) {
    const match = source.match(EFFECT_PACKAGE_REGEX)
    if (Predicate.isNotNull(match)) {
      const packageName = match[1]
      const subpath = match[2]
      const resolved = await this.resolve(`${packageName}/package.json`, importer, { skipSelf: true })
      if (resolved === null) return null
      const packageDir = pathService.dirname(resolved.id)
      const modulePath = subpath ? subpath.slice(1) : "index"
      const distPath = pathService.join(packageDir, "dist", `${modulePath}.js`)
      return { id: distPath, external: false }
    }
    return null
  }
})

/**
 * Creates the full Rolldown plugin pipeline for bundling.
 *
 * @since 1.0.0
 * @category constructors
 */
export const createPlugins = (pathService: Path.Path, options: PluginOptions = {}): Array<Plugin> => {
  const plugins: Array<Plugin> = [
    createResolveLocalPackageImports(pathService)
  ]

  if (options.visualize) {
    plugins.push(visualizer({
      open: true,
      gzipSize: true
    }) as unknown as Plugin)
  }

  return plugins
}
