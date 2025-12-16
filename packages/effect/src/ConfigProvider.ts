/**
 * @since 4.0.0
 */

import * as Data from "./Data.ts"
import * as Effect from "./Effect.ts"
import * as FileSystem from "./FileSystem.ts"
import { format } from "./Formatter.ts"
import { dual, flow } from "./Function.ts"
import { PipeInspectableProto } from "./internal/core.ts"
import * as Layer from "./Layer.ts"
import * as Path_ from "./Path.ts"
import type { Pipeable } from "./Pipeable.ts"
import type { PlatformError } from "./PlatformError.ts"
import * as Predicate from "./Predicate.ts"
import type { Scope } from "./Scope.ts"
import * as ServiceMap from "./ServiceMap.ts"
import * as Str from "./String.ts"

/**
 * @category Models
 * @since 4.0.0
 */
export type Node =
  /** A terminal string value */
  | {
    readonly _tag: "Value"
    readonly value: string
  }
  /** An object; keys are unordered */
  | {
    readonly _tag: "Record"
    readonly keys: ReadonlySet<string>
    readonly value: string | undefined
  }
  /** An array-like container; length is the number of elements */
  | {
    readonly _tag: "Array"
    readonly length: number
    readonly value: string | undefined
  }

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makeValue(value: string): Node {
  return { _tag: "Value", value }
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makeRecord(keys: ReadonlySet<string>, value?: string): Node {
  return { _tag: "Record", keys, value }
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makeArray(length: number, value?: string): Node {
  return { _tag: "Array", length, value }
}

/**
 * @category Models
 * @since 4.0.0
 */
export class SourceError extends Data.TaggedError("SourceError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * @category Models
 * @since 4.0.0
 */
export type Path = ReadonlyArray<string | number>

/**
 * @category Models
 * @since 4.0.0
 */
export interface ConfigProvider extends Pipeable {
  /**
   * Returns the node found at `path`, or `undefined` if it does not exist.
   * Fails with `SourceError` when the underlying source cannot be read.
   */
  readonly load: (path: Path) => Effect.Effect<Node | undefined, SourceError>

  /**
   * Raw access to the underlying source.
   */
  readonly get: (path: Path) => Effect.Effect<Node | undefined, SourceError>

  /**
   * Function to map the input path.
   */
  readonly mapInput: ((path: Path) => Path) | undefined

  /**
   * Prefix to add to the input path.
   */
  readonly prefix: Path | undefined
}

/**
 * @category Services
 * @since 4.0.0
 */
export const ConfigProvider: ServiceMap.Reference<ConfigProvider> = ServiceMap.Reference<ConfigProvider>(
  "effect/ConfigProvider",
  { defaultValue: () => fromEnv() }
)

const Proto = {
  ...PipeInspectableProto,
  toJSON(this: ConfigProvider) {
    return {
      _id: "ConfigProvider"
    }
  }
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make(
  get: (path: Path) => Effect.Effect<Node | undefined, SourceError>,
  mapInput?: (path: Path) => Path,
  prefix?: Path
): ConfigProvider {
  const self = Object.create(Proto)
  self.get = get
  self.mapInput = mapInput
  self.prefix = prefix
  self.load = (path: Path) => {
    if (mapInput) path = mapInput(path)
    if (prefix) path = [...prefix, ...path]
    return get(path)
  }
  return self
}

/**
 * Returns a config provider that falls back to the specified config provider if
 * the current config provider does not have a value (i.e. returns `undefined`)
 * for the requested path.
 *
 * @category Combinators
 * @since 4.0.0
 */
export const orElse: {
  (that: ConfigProvider): (self: ConfigProvider) => ConfigProvider
  (self: ConfigProvider, that: ConfigProvider): ConfigProvider
} = dual(
  2,
  (self: ConfigProvider, that: ConfigProvider): ConfigProvider =>
    make((path) => Effect.flatMap(self.get(path), (node) => node ? Effect.succeed(node) : that.get(path)))
)

/**
 * @category Combinators
 * @since 4.0.0
 */
export const mapInput: {
  (f: (path: Path) => Path): (self: ConfigProvider) => ConfigProvider
  (self: ConfigProvider, f: (path: Path) => Path): ConfigProvider
} = dual(
  2,
  (self: ConfigProvider, f: (path: Path) => Path): ConfigProvider => {
    return make(self.get, self.mapInput ? flow(self.mapInput, f) : f, self.prefix ? f(self.prefix) : undefined)
  }
)

/**
 * @since 4.0.0
 * @category Combinators
 */
export const constantCase: (self: ConfigProvider) => ConfigProvider = mapInput((path) =>
  path.map((seg) => typeof seg === "number" ? seg : Str.constantCase(seg))
)

/**
 * @category Combinators
 * @since 4.0.0
 */
export const nested: {
  (prefix: string | Path): (self: ConfigProvider) => ConfigProvider
  (self: ConfigProvider, prefix: string | Path): ConfigProvider
} = dual(
  2,
  (self: ConfigProvider, prefix: string | Path): ConfigProvider => {
    const path = typeof prefix === "string" ? [prefix] : prefix
    return make(self.get, self.mapInput, self.prefix ? [...self.prefix, ...path] : path)
  }
)

/**
 * @category Layers
 * @since 4.0.0
 */
export const layer = <E = never, R = never>(
  self: ConfigProvider | Effect.Effect<ConfigProvider, E, R>
): Layer.Layer<never, E, Exclude<R, Scope>> =>
  Effect.isEffect(self) ? Layer.effect(ConfigProvider)(self) : Layer.succeed(ConfigProvider)(self)

/**
 * Create a Layer that adds a fallback ConfigProvider, which will be used if the
 * current provider does not have a value for the requested path.
 *
 * If `asPrimary` is set to `true`, the new provider will be used as the
 * primary provider, meaning it will be used first when looking up values.
 *
 * @category Layers
 * @since 4.0.0
 */
export const layerAdd = <E = never, R = never>(
  self: ConfigProvider | Effect.Effect<ConfigProvider, E, R>,
  options?: {
    readonly asPrimary?: boolean | undefined
  } | undefined
): Layer.Layer<never, E, Exclude<R, Scope>> =>
  Layer.effect(ConfigProvider)(
    Effect.gen(function*() {
      const current = yield* ConfigProvider
      const configProvider = Effect.isEffect(self) ? yield* self : self
      return options?.asPrimary ? orElse(configProvider, current) : orElse(current, configProvider)
    })
  )

/**
 * Create a ConfigProvider that reads values from an `unknown` value, typically
 * a JSON object.
 *
 * @category ConfigProviders
 * @since 4.0.0
 */
export function fromUnknown(root: unknown): ConfigProvider {
  return make((path) => Effect.succeed(nodeAtJson(root, path)))
}

function nodeAtJson(root: unknown, path: Path): Node | undefined {
  let cur: unknown = root

  for (const seg of path) {
    if (cur === null || cur === undefined) return undefined

    if (Array.isArray(cur)) {
      if (typeof seg !== "number" || !Number.isInteger(seg) || seg < 0 || seg >= cur.length) return undefined
      cur = cur[seg]
      continue
    }

    if (Predicate.isObject(cur)) {
      if (typeof seg !== "string") return undefined
      if (!Object.hasOwn(cur, seg)) return undefined
      cur = cur[seg]
      continue
    }

    // cannot descend
    return undefined
  }

  return describeUnknown(cur)
}

function describeUnknown(u: unknown): Node | undefined {
  if (u === undefined || u === null) return undefined
  if (typeof u === "string") return makeValue(u)
  if (typeof u === "number" || typeof u === "boolean" || typeof u === "bigint") {
    return makeValue(String(u))
  }
  if (Array.isArray(u)) return makeArray(u.length)
  if (Predicate.isObject(u)) {
    return makeRecord(new Set(Object.keys(u)))
  }
  // unknown values
  return makeValue(format(u))
}

/**
 * Create a ConfigProvider that reads values from environment variables.
 *
 * The default environment is the global `process.env` and `import.meta.env`
 * (if available). You can override this by passing `{ env: ... }`.
 *
 * @category ConfigProviders
 * @since 4.0.0
 */
export function fromEnv(options?: { readonly env?: Record<string, string> | undefined }): ConfigProvider {
  const env = options?.env ?? {
    ...globalThis?.process?.env,
    ...(import.meta as any)?.env
  }

  const trie = buildEnvTrie(env)

  return make((path) => Effect.succeed(nodeAtEnv(trie, env, path)))
}

type EnvTrieNode = {
  value?: string
  children?: Record<string, EnvTrieNode>
}

function buildEnvTrie(env: Record<string, string | undefined>): EnvTrieNode {
  const root: EnvTrieNode = {}

  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) continue

    // Split on "_" and keep empty segments (no special handling for "__")
    const segments = name.split("_")

    let node = root
    for (const seg of segments) {
      node.children ??= {}
      node = node.children[seg] ??= {}
    }

    // co-located value at this node
    node.value = value
  }

  return root
}

const NUMERIC_INDEX = /^(0|[1-9][0-9]*)$/

function nodeAtEnv(trie: EnvTrieNode, env: Record<string, string | undefined>, path: Path): Node | undefined {
  const key = path.map(String).join("_")
  const leafValue = env[key]

  const trieNode = trieNodeAt(trie, path)
  const children = trieNode?.children ? Object.keys(trieNode.children) : []

  if (children.length === 0) {
    return leafValue === undefined ? undefined : makeValue(leafValue)
  }

  const allNumeric = children.every((k) => NUMERIC_INDEX.test(k))
  if (allNumeric) {
    const length = Math.max(...children.map((k) => parseInt(k, 10))) + 1
    return makeArray(length, leafValue)
  }

  return makeRecord(new Set(children), leafValue)
}

function trieNodeAt(root: EnvTrieNode, path: Path): EnvTrieNode | undefined {
  if (path.length === 0) return root

  // Convert path segments to strings and navigate through the trie
  let node: EnvTrieNode | undefined = root
  for (const seg of path) {
    node = node?.children?.[String(seg)]
    if (!node) return undefined
  }
  return node
}

/**
 * A ConfigProvider that parses the contents of a `.env` file.
 *
 * By default, variables are not expanded. You can enable variable expansion by
 * passing `{ expandVariables: true }`.
 *
 * Based on
 * - https://github.com/motdotla/dotenv
 * - https://github.com/motdotla/dotenv-expand
 *
 * @see {@link fromDotEnv} for a ConfigProvider that loads a `.env` file.
 *
 * @category ConfigProviders
 * @since 4.0.0
 */
export function fromDotEnvContents(lines: string, options?: {
  readonly expandVariables?: boolean | undefined
}): ConfigProvider {
  let env = parseDotEnvContents(lines)
  if (options?.expandVariables) {
    env = dotEnvExpand(env)
  }
  return fromEnv({ env })
}

const DOT_ENV_LINE =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg

function parseDotEnvContents(lines: string): Record<string, string> {
  const obj: Record<string, string> = {}

  // Convert line breaks to same format
  lines = lines.replace(/\r\n?/gm, "\n")

  let match: RegExpExecArray | null
  while ((match = DOT_ENV_LINE.exec(lines)) != null) {
    const key = match[1]

    // Default undefined or null to empty string
    let value = match[2] || ""

    // Remove whitespace
    value = value.trim()

    // Check if double quoted
    const maybeQuote = value[0]

    // Remove surrounding quotes
    value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2")

    // Expand newlines if double quoted
    if (maybeQuote === "\"") {
      value = value.replace(/\\n/g, "\n")
      value = value.replace(/\\r/g, "\r")
    }

    // Add to object
    obj[key] = value
  }

  return obj
}

function dotEnvExpand(parsed: Record<string, string>): Record<string, string> {
  const newParsed: Record<string, string> = {}

  for (const configKey in parsed) {
    // resolve escape sequences
    newParsed[configKey] = interpolate(parsed[configKey], parsed).replace(/\\\$/g, "$")
  }

  return newParsed
}

function interpolate(envValue: string, parsed: Record<string, string>): string {
  // find the last unescaped dollar sign in the
  // value so that we can evaluate it
  const lastUnescapedDollarSignIndex = searchLast(envValue, /(?!(?<=\\))\$/g)

  // If we couldn't match any unescaped dollar sign
  // let's return the string as is
  if (lastUnescapedDollarSignIndex === -1) return envValue

  // This is the right-most group of variables in the string
  const rightMostGroup = envValue.slice(lastUnescapedDollarSignIndex)

  /**
   * This finds the inner most variable/group divided
   * by variable name and default value (if present)
   * (
   *   (?!(?<=\\))\$        // only match dollar signs that are not escaped
   *   {?                   // optional opening curly brace
   *     ([\w]+)            // match the variable name
   *     (?::-([^}\\]*))?   // match an optional default value
   *   }?                   // optional closing curly brace
   * )
   */
  const matchGroup = /((?!(?<=\\))\${?([\w]+)(?::-([^}\\]*))?}?)/
  const match = rightMostGroup.match(matchGroup)

  if (match !== null) {
    const [_, group, variableName, defaultValue] = match

    return interpolate(
      envValue.replace(group, defaultValue || parsed[variableName] || ""),
      parsed
    )
  }

  return envValue
}

function searchLast(str: string, rgx: RegExp): number {
  const matches = Array.from(str.matchAll(rgx))
  return matches.length > 0 ? matches.slice(-1)[0].index : -1
}

/**
 * A ConfigProvider that loads configuration from a `.env` file.
 *
 * **Options**
 *
 * - `path`: The path to the `.env` file, defaults to `".env"`.
 *
 * @see {@link fromDotEnvContents} for a ConfigProvider that parses a `.env` file.
 *
 * @since 4.0.0
 */
export const fromDotEnv: (options?: {
  readonly path?: string | undefined
  readonly expandVariables?: boolean | undefined
}) => Effect.Effect<ConfigProvider, PlatformError, FileSystem.FileSystem> = Effect.fnUntraced(
  function*(options) {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(options?.path ?? ".env")
    return fromEnv({ env: parseDotEnvContents(content) })
  }
)

/**
 * Creates a ConfigProvider from a file tree structure.
 *
 * The default root path is `/`. You can change it by passing `{ rootPath: "..." }`.
 *
 * Resolution rules:
 * - Regular file  -> `{ _tag: "Value", value }` where `value` is the file text, trimmed.
 * - Directory     -> `{ _tag: "Record", keys }` collecting immediate child names (order unspecified).
 * - Not found     -> `undefined`.
 * - Other I/O     -> `SourceError`.
 *
 * @category ConfigProviders
 * @since 4.0.0
 */
export const fromDir: (options?: {
  readonly rootPath?: string | undefined
}) => Effect.Effect<
  ConfigProvider,
  never,
  Path_.Path | FileSystem.FileSystem
> = Effect.fnUntraced(function*(options) {
  const platformPath = yield* Path_.Path
  const fs = yield* FileSystem.FileSystem
  const rootPath = options?.rootPath ?? "/"

  return make((path) => {
    const fullPath = platformPath.join(rootPath, ...path.map(String))

    // Try reading as a *file*
    const asFile = fs.readFileString(fullPath).pipe(
      Effect.map((content) => makeValue(content.trim()))
    )

    // If not a file, try reading as a *directory*
    const asDirectory = fs.readDirectory(fullPath).pipe(
      Effect.map((entries: ReadonlyArray<any>) => {
        // Support both string paths and DirEntry-like objects
        const keys = entries.map((e) => typeof e === "string" ? platformPath.basename(e) : format(e?.name ?? ""))
        return makeRecord(new Set(keys))
      })
    )

    return asFile.pipe(
      Effect.catch(() => asDirectory),
      Effect.mapError((cause: PlatformError) =>
        new SourceError({
          message: `Failed to read file at ${platformPath.join(rootPath, ...path.map(String))}`,
          cause
        })
      )
    )
  })
})
