/**
 * @since 4.0.0
 */
import * as Context from "./Context.js"
import type { Effect } from "./Effect.js"
import type { BadArgument } from "./PlatformError.js"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: unique symbol = Symbol.for("effect/Path")

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 4.0.0
 * @category model
 */
export interface Path {
  readonly [TypeId]: TypeId
  readonly sep: string
  readonly basename: (path: string, suffix?: string) => string
  readonly dirname: (path: string) => string
  readonly extname: (path: string) => string
  readonly format: (pathObject: Partial<Path.Parsed>) => string
  readonly fromFileUrl: (url: URL) => Effect<string, BadArgument>
  readonly isAbsolute: (path: string) => boolean
  readonly join: (...paths: ReadonlyArray<string>) => string
  readonly normalize: (path: string) => string
  readonly parse: (path: string) => Path.Parsed
  readonly relative: (from: string, to: string) => string
  readonly resolve: (...pathSegments: ReadonlyArray<string>) => string
  readonly toFileUrl: (path: string) => Effect<URL, BadArgument>
  readonly toNamespacedPath: (path: string) => string
}

/**
 * @since 4.0.0
 */
export declare namespace Path {
  /**
   * @since 4.0.0
   * @category model
   */
  export interface Parsed {
    readonly root: string
    readonly dir: string
    readonly base: string
    readonly ext: string
    readonly name: string
  }
}

/**
 * @since 4.0.0
 * @category tag
 */
export const Path: Context.Tag<Path, Path> = Context.GenericTag("effect/Path")
