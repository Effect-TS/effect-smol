/**
 * @since 4.0.0
 */
import type { Effect } from "./Effect.js"
import type { BadArgument } from "./PlatformError.js"
import * as ServiceMap from "./ServiceMap.js"

/**
 * @since 4.0.0
 * @category type ids
 * @example
 * ```ts
 * import { Path } from "effect"
 *
 * // Access the unique type identifier for Path
 * const typeId: Path.TypeId = Path.TypeId
 * console.log(typeId) // "~effect/Path"
 * ```
 */
export const TypeId: TypeId = "~effect/Path"

/**
 * @since 4.0.0
 * @category type ids
 * @example
 * ```ts
 * import { Path } from "effect"
 *
 * // Use the TypeId type for type-level operations
 * const isPathTypeId = (value: unknown): value is Path.TypeId =>
 *   typeof value === "string" && value === "~effect/Path"
 * ```
 */
export type TypeId = "~effect/Path"

/**
 * @since 4.0.0
 * @category model
 * @example
 * ```ts
 * import { Path, Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *
 *   // Use various path operations
 *   const joined = path.join("home", "user", "documents")
 *   const normalized = path.normalize("./path/../to/file.txt")
 *   const basename = path.basename("/path/to/file.txt")
 *   const dirname = path.dirname("/path/to/file.txt")
 *   const extname = path.extname("file.txt")
 *   const isAbs = path.isAbsolute("/absolute/path")
 *   const parsed = path.parse("/path/to/file.txt")
 *   const relative = path.relative("/from/path", "/to/path")
 *   const resolved = path.resolve("relative", "path")
 *
 *   console.log({
 *     joined,
 *     normalized,
 *     basename,
 *     dirname,
 *     extname,
 *     isAbs,
 *     parsed,
 *     relative,
 *     resolved
 *   })
 * })
 * ```
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
 * @category namespace
 * @example
 * ```ts
 * import { Path, Effect } from "effect"
 *
 * // Access types and utilities in the Path namespace
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *
 *   // Parse a path and get a Path.Parsed object
 *   const parsed = path.parse("/home/user/file.txt")
 *
 *   // The parsed object conforms to the Path.Parsed interface
 *   const exampleParsed = {
 *     root: "/",
 *     dir: "/home/user",
 *     base: "file.txt",
 *     ext: ".txt",
 *     name: "file"
 *   }
 *
 *   console.log(parsed, exampleParsed)
 * })
 * ```
 */
export declare namespace Path {
  /**
   * @since 4.0.0
   * @category model
   * @example
   * ```ts
   * import { Path, Effect } from "effect"
   *
   * const program = Effect.gen(function* () {
   *   const path = yield* Path.Path
   *
   *   // Parse a path into its components
   *   const parsed = path.parse("/home/user/documents/file.txt")
   *   console.log(parsed)
   *   // {
   *   //   root: "/",
   *   //   dir: "/home/user/documents",
   *   //   base: "file.txt",
   *   //   ext: ".txt",
   *   //   name: "file"
   *   // }
   *
   *   // Format a path from its components
   *   const formatted = path.format({
   *     dir: "/home/user",
   *     name: "newfile",
   *     ext: ".js"
   *   })
   *   console.log(formatted) // "/home/user/newfile.js"
   * })
   * ```
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
 * @example
 * ```ts
 * import { Path, Effect, Layer } from "effect"
 *
 * // Create a custom path implementation
 * const customPath: Path.Path = {
 *   [Path.TypeId]: Path.TypeId,
 *   sep: "/",
 *   basename: (path: string, suffix?: string) => {
 *     const base = path.split("/").pop() || ""
 *     return suffix && base.endsWith(suffix) ? base.slice(0, -suffix.length) : base
 *   },
 *   dirname: (path: string) => path.split("/").slice(0, -1).join("/") || "/",
 *   extname: (path: string) => {
 *     const match = path.match(/\.[^.]*$/)
 *     return match ? match[0] : ""
 *   },
 *   format: (pathObject) => {
 *     const dir = pathObject.dir || ""
 *     const name = pathObject.name || ""
 *     const ext = pathObject.ext || ""
 *     return dir ? `${dir}/${name}${ext}` : `${name}${ext}`
 *   },
 *   fromFileUrl: (url: URL) => Effect.succeed(url.pathname),
 *   isAbsolute: (path: string) => path.startsWith("/"),
 *   join: (...paths: ReadonlyArray<string>) => paths.join("/"),
 *   normalize: (path: string) => path.replace(/\/+/g, "/"),
 *   parse: (path: string) => ({
 *     root: path.startsWith("/") ? "/" : "",
 *     dir: path.split("/").slice(0, -1).join("/") || "/",
 *     base: path.split("/").pop() || "",
 *     ext: path.match(/\.[^.]*$/)?.[0] || "",
 *     name: path.split("/").pop()?.replace(/\.[^.]*$/, "") || ""
 *   }),
 *   relative: (from: string, to: string) => to.replace(from, ""),
 *   resolve: (...pathSegments: ReadonlyArray<string>) => pathSegments.join("/"),
 *   toFileUrl: (path: string) => Effect.succeed(new URL(`file://${path}`)),
 *   toNamespacedPath: (path: string) => path
 * }
 *
 * // Provide the path service
 * const customPathLayer = Layer.succeed(Path.Path, customPath)
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   const joined = path.join("home", "user", "file.txt")
 *   console.log(joined) // "home/user/file.txt"
 * })
 *
 * // Run with custom path implementation
 * const result = Effect.provide(program, customPathLayer)
 * ```
 */
export const Path: ServiceMap.Key<Path, Path> = ServiceMap.Key("effect/Path")
