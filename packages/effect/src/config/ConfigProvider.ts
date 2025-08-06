/**
 * @since 4.0.0
 */

import * as Data from "../data/Data.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Effect from "../Effect.ts"
import { dual, flow } from "../Function.ts"
import type { Pipeable } from "../interfaces/Pipeable.ts"
import { PipeInspectableProto } from "../internal/core.ts"
import * as Layer from "../Layer.ts"
import * as FileSystem from "../platform/FileSystem.ts"
import * as Path_ from "../platform/Path.ts"
import type { PlatformError } from "../platform/PlatformError.ts"
import * as Str from "../primitives/String.ts"
import type { StringLeafJson } from "../schema/Serializer.ts"
import type { Scope } from "../Scope.ts"
import * as ServiceMap from "../ServiceMap.ts"

/**
 * @since 4.0.0
 */
export type Path = ReadonlyArray<string | number>

/**
 * @since 4.0.0
 */
export type Stat =
  /** A terminal string value */
  | { readonly _tag: "leaf"; readonly value: string }
  /** An object; keys are unordered */
  | { readonly _tag: "object"; readonly keys: ReadonlySet<string> }
  /** An array-like container; length is the number of elements */
  | { readonly _tag: "array"; readonly length: number }

/**
 * @since 4.0.0
 */
export function leaf(value: string): Stat {
  return { _tag: "leaf", value }
}

/**
 * @since 4.0.0
 */
export function object(keys: ReadonlySet<string>): Stat {
  return { _tag: "object", keys }
}

/**
 * @since 4.0.0
 */
export function array(length: number): Stat {
  return { _tag: "array", length }
}

/**
 * @since 4.0.0
 */
export class SourceError extends Data.TaggedError("SourceError")<{
  readonly reason: string
  readonly cause?: unknown
}> {}

/**
 * @category Models
 * @since 4.0.0
 */
export interface ConfigProvider extends Pipeable {
  /**
   * Returns the node found at `path`, or `undefined` if it does not exist.
   * Fails with `SourceError` when the underlying source cannot be read.
   */
  readonly get: (path: Path) => Effect.Effect<Stat | undefined, SourceError>

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
 * @category References
 * @since 4.0.0
 */
export const ConfigProvider: ServiceMap.Reference<ConfigProvider> = ServiceMap.Reference<ConfigProvider>(
  "effect/config/ConfigProvider",
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
  get: (path: Path) => Effect.Effect<Stat | undefined, SourceError>,
  mapInput?: (path: Path) => Path,
  prefix?: Path
): ConfigProvider {
  const self = Object.create(Proto)
  self.get = get
  self.mapInput = mapInput
  self.prefix = prefix
  return self
}

/**
 * @since 4.0.0
 */
export const run: {
  (path: Path): (self: ConfigProvider) => Effect.Effect<Stat | undefined, SourceError>
  (self: ConfigProvider, path: Path): Effect.Effect<Stat | undefined, SourceError>
} = dual(
  2,
  (self: ConfigProvider, path: Path): Effect.Effect<Stat | undefined, SourceError> => {
    if (self.mapInput) path = self.mapInput(path)
    if (self.prefix) path = [...self.prefix, ...path]
    return self.get(path)
  }
)

/**
 * @category Combinators
 * @since 4.0.0
 */
export const orElse: {
  (that: ConfigProvider): (self: ConfigProvider) => ConfigProvider
  (self: ConfigProvider, that: ConfigProvider): ConfigProvider
} = dual(
  2,
  (self: ConfigProvider, that: ConfigProvider): ConfigProvider =>
    make((path) => Effect.flatMap(self.get(path), (stat) => stat ? Effect.succeed(stat) : that.get(path)))
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
  path.map((seg) => Predicate.isNumber(seg) ? seg : Str.constantCase(seg))
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
    const path = Predicate.isString(prefix) ? [prefix] : prefix
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

// -----------------------------------------------------------------------------
// fromStringLeafJson
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export function fromStringLeafJson(root: StringLeafJson): ConfigProvider {
  return make((path) => Effect.succeed(describeStat(resolvePath(root, path))))
}

function resolvePath(input: StringLeafJson, path: Path): StringLeafJson | undefined {
  let out: StringLeafJson = input

  for (const seg of path) {
    if (Predicate.isString(out)) return undefined
    if (Array.isArray(out)) {
      if (!Predicate.isNumber(seg) || !Number.isInteger(seg) || seg < 0 || seg >= out.length) {
        return undefined
      }
    } else {
      if (!Predicate.isString(seg) || !Object.prototype.hasOwnProperty.call(out, seg)) {
        return undefined
      }
    }
    out = (out as any)[seg]
  }

  return out
}

function describeStat(value: StringLeafJson | undefined): Stat | undefined {
  if (value === undefined) return undefined
  if (Predicate.isString(value)) return leaf(value)
  if (Array.isArray(value)) return array(value.length)
  return object(new Set(Object.keys(value)))
}

// -----------------------------------------------------------------------------
// fromJson
// -----------------------------------------------------------------------------

/**
 * Create a ConfigProvider that reads values from a JSON object.
 *
 * @since 4.0.0
 */
export function fromJson(root: unknown): ConfigProvider {
  return fromStringLeafJson(asStringLeafJson(root))
}

function asStringLeafJson(root: unknown): StringLeafJson {
  if (root === null || root === undefined) return ""
  if (Predicate.isString(root)) return root
  if (Predicate.isNumber(root)) return String(root)
  if (Predicate.isBoolean(root)) return String(root)
  if (Array.isArray(root)) return root.map(asStringLeafJson)

  if (Predicate.isObject(root)) {
    const result: Record<string, StringLeafJson> = {}
    for (const [key, value] of Object.entries(root)) {
      result[key] = asStringLeafJson(value)
    }
    return result
  }

  // Fallback for any other type
  return String(root)
}

// -----------------------------------------------------------------------------
// fromEnv
// -----------------------------------------------------------------------------

// Internal trie node used during decoding.
type TrieNode = {
  leafValue?: string // R2: leaf value (string) if this node is a leaf
  typeSentinel?: "A" | "O" // R7: __TYPE sentinel for empty array/object
  children?: Record<string, TrieNode> // R2: children keyed by segment (plain object)
}

// fetch or create a child node by segment (plain object).
function getOrCreateChild(parent: TrieNode, segment: string): TrieNode {
  parent.children ??= {}
  return (parent.children[segment] ??= {})
}

// Numeric index per R4/R5 (array indices; no leading zeros except "0").
const NUMERIC_INDEX = /^(0|[1-9][0-9]*)$/

function appendDebugSegment(path: string, segment: string | number): string {
  return path === "" ? String(segment) : `${path}__${segment}`
}

function materialize(node: TrieNode, debugPath: string): StringLeafJson {
  // R3: leaf vs container exclusivity
  if (node.leafValue !== undefined && node.children) {
    throw new Error(`Invalid environment: node "${debugPath}" is both leaf and container`)
  }

  // R7: __TYPE sentinel represents an empty container; it must not coexist with leaf/children (R3)
  if (node.typeSentinel) {
    if (node.leafValue !== undefined || node.children) {
      throw new Error(
        `Invalid environment: node "${debugPath}" has __TYPE and also leaf/children`
      )
    }
    return node.typeSentinel === "A" ? [] : {}
  }

  // Container with children: decide object vs array (R4), then enforce density if array (R5)
  if (node.children && Object.keys(node.children).length > 0) {
    const children = node.children
    const childNames = Object.keys(children)
    const allNumeric = childNames.every((s) => NUMERIC_INDEX.test(s)) // R4

    if (allNumeric) {
      // Array (R4) and must be dense (R5)
      const indices = childNames.map((s) => parseInt(s, 10))
      const max = Math.max(...indices)
      if (indices.length !== max + 1) {
        throw new Error(
          `Invalid environment: array at "${debugPath}" is not dense (expected indices 0..${max})`
        )
      }
      const out: Array<StringLeafJson> = []
      for (let i = 0; i <= max; i++) {
        const key = String(i)
        if (!Object.prototype.hasOwnProperty.call(children, key)) {
          throw new Error(`Invalid environment: missing index ${i} at "${debugPath}"`)
        }
        out[i] = materialize(children[key]!, appendDebugSegment(debugPath, i))
      }
      return out
    } else {
      // Object (R4, R6)
      const obj: Record<string, StringLeafJson> = {}
      for (const seg of childNames) obj[seg] = materialize(children[seg]!, appendDebugSegment(debugPath, seg))
      return obj
    }
  }

  // Leaf only (R2)
  if (node.leafValue !== undefined) {
    return node.leafValue
  }

  // Dangling empty node (should not occur with well-formed inputs)
  throw new Error(`Invalid environment: dangling empty node at "${debugPath}"`)
}

/** @internal */
export function decode(env: Record<string, string>): StringLeafJson {
  const root: TrieNode = {}

  for (const [name, value] of Object.entries(env)) {
    const endsWithType = name.endsWith("__TYPE") // R7
    const baseName = endsWithType ? name.slice(0, -6) : name

    // R1: path segmentation (no empty segments like "a____b")
    const segments = baseName === "" ? [] : baseName.split("__")
    if (segments.some((s) => s.length === 0)) {
      throw new Error(`Invalid environment: empty segment in variable name "${name}"`)
    }

    let node = root
    for (const seg of segments) {
      node = getOrCreateChild(node, seg)
    }

    if (endsWithType) {
      const kind = value.trim().toUpperCase()
      if (kind !== "A" && kind !== "O") {
        throw new Error(`Invalid environment: "${name}" must be "A" or "O"`)
      }
      if (node.typeSentinel && node.typeSentinel !== kind) {
        throw new Error(`Invalid environment: conflicting __TYPE at "${name}"`)
      }
      node.typeSentinel = kind
    } else {
      if (node.leafValue !== undefined && node.leafValue !== value) {
        throw new Error(`Invalid environment: duplicate leaf with different values at "${name}"`)
      }
      node.leafValue = value
    }
  }

  // R8: empty environment
  if (
    root.leafValue === undefined &&
    root.typeSentinel === undefined &&
    (!root.children || Object.keys(root.children).length === 0)
  ) {
    return {}
  }

  // Materialize (R3–R6)
  return materialize(root, "")
}

/**
 * Create a ConfigProvider that reads values from environment variables.
 *
 * @since 4.0.0
 */
export function fromEnv(options?: {
  readonly env?: Record<string, string> | undefined
}): ConfigProvider {
  // Merge env sources (Node / Deno / Vite-like) unless an explicit env is passed.
  const env = options?.env ?? {
    ...globalThis?.process?.env,
    ...(import.meta as any)?.env
  }

  try {
    return fromStringLeafJson(decode(env))
  } catch (e: any) {
    return make(() => Effect.fail(new SourceError({ reason: e.message })))
  }
}

// -----------------------------------------------------------------------------
// fromDotEnv
// -----------------------------------------------------------------------------

/**
 * A ConfigProvider that parses a `.env` file.
 *
 * Default parser:
 *
 * - structural arrays/objects (on)
 * - inline containers (off)
 * - variable expansion (off)
 *
 * Based on
 * - https://github.com/motdotla/dotenv
 * - https://github.com/motdotla/dotenv-expand
 *
 * @see {@link dotEnv} for a ConfigProvider that loads a `.env` file.
 *
 * @since 4.0.0
 * @category Dotenv
 */
export function fromDotEnv(lines: string, options?: {
  readonly expandVariables?: boolean | undefined
}): ConfigProvider {
  let environment = parseDotEnv(lines)
  if (options?.expandVariables) {
    environment = dotEnvExpand(environment)
  }
  return fromEnv({ env: environment })
}

const DOT_ENV_LINE =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg

function parseDotEnv(lines: string): Record<string, string> {
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

// -----------------------------------------------------------------------------
// dotEnv
// -----------------------------------------------------------------------------

/**
 * A ConfigProvider that loads configuration from a `.env` file.
 *
 * @see {@link fromDotEnv} for a ConfigProvider that parses a `.env` file.
 *
 * @since 4.0.0
 * @category Dotenv
 */
export const dotEnv: (options?: {
  readonly path?: string | undefined
  readonly expandVariables?: boolean | undefined
}) => Effect.Effect<ConfigProvider, PlatformError, FileSystem.FileSystem> = Effect.fnUntraced(
  function*(options) {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(options?.path ?? ".env")
    return fromEnv({ env: parseDotEnv(content) })
  }
)

// -----------------------------------------------------------------------------
// fileTree
// -----------------------------------------------------------------------------

/**
 * Creates a ConfigProvider from a file tree structure.
 *
 * Resolution rules:
 * - Regular file  -> `{ _tag: "leaf", value }` where `value` is the file text, trimmed.
 * - Directory     -> `{ _tag: "object", keys }` collecting immediate child names (order unspecified).
 * - Not found     -> `undefined`.
 * - Other I/O     -> `SourceError`.
 *
 * @since 4.0.0
 * @category File Tree
 */
export const fileTree: (options?: {
  readonly rootDirectory?: string | undefined
}) => Effect.Effect<
  ConfigProvider,
  never,
  Path_.Path | FileSystem.FileSystem
> = Effect.fnUntraced(function*(options) {
  const path_ = yield* Path_.Path
  const fs = yield* FileSystem.FileSystem
  const rootDirectory = options?.rootDirectory ?? "/"

  return make((path) => {
    const fullPath = path_.join(rootDirectory, ...path.map(String))

    // Try reading as a *file*
    const asFile = fs.readFileString(fullPath).pipe(
      Effect.map((content) => leaf(String(content).trim()))
    )

    // If not a file, try reading as a *directory*
    const asDirectory = fs.readDirectory(fullPath).pipe(
      Effect.map((entries: ReadonlyArray<any>) => {
        // Support both string paths and DirEntry-like objects
        const keys = entries.map((e) => Predicate.isString(e) ? path_.basename(e) : String(e?.name ?? ""))
        return object(new Set(keys))
      })
    )

    return asFile.pipe(
      Effect.catch(() => asDirectory),
      Effect.mapError((cause: PlatformError) =>
        new SourceError({
          reason: `Failed to read file at ${path_.join(rootDirectory, ...path.map(String))}`,
          cause
        })
      )
    )
  })
})
