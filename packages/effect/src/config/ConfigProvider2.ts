/**
 * @since 4.0.0
 */

import * as Data from "../data/Data.ts"
import * as Effect from "../Effect.ts"
import { dual } from "../Function.ts"
import type { Pipeable } from "../interfaces/Pipeable.ts"
import { PipeInspectableProto } from "../internal/core.ts"
import * as Layer from "../Layer.ts"
import * as FileSystem from "../platform/FileSystem.ts"
import * as Path_ from "../platform/Path.ts"
import type { PlatformError } from "../platform/PlatformError.ts"
import * as Str from "../primitives/String.ts"
import type { Scope } from "../Scope.ts"
import * as ServiceMap from "../ServiceMap.ts"

/**
 * @since 4.0.0
 */
export type StringLeafJson =
  | string
  | { readonly [k: string]: StringLeafJson }
  | ReadonlyArray<StringLeafJson>

/**
 * @since 4.0.0
 */
export type Path = ReadonlyArray<string | number>

/**
 * @since 4.0.0
 */
export type Node =
  // a terminal string value
  | { readonly _tag: "leaf"; readonly value: string }
  // an object; keys are unordered
  | { readonly _tag: "object"; readonly keys: ReadonlyArray<string> }
  // an array-like container; length is the number of elements
  | { readonly _tag: "array"; readonly length: number }

/**
 * @since 4.0.0
 */
export function leaf(value: string): Node {
  return { _tag: "leaf", value }
}

/**
 * @since 4.0.0
 */
export function object(keys: ReadonlyArray<string>): Node {
  return { _tag: "object", keys }
}

/**
 * @since 4.0.0
 */
export function array(length: number): Node {
  return { _tag: "array", length }
}

/**
 * @since 4.0.0
 */
export class GetError extends Data.TaggedError("GetError")<{
  readonly reason: string
  readonly cause?: unknown
}> {}

/**
 * @since 4.0.0
 * @category Models
 */
export interface ConfigProvider extends Pipeable {
  readonly get: (path: Path) => Effect.Effect<Node | undefined, GetError>
}

/**
 * @since 4.0.0
 * @category References
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
 * @since 4.0.0
 * @category Constructors
 */
export function make(get: (path: Path) => Effect.Effect<Node | undefined, GetError>): ConfigProvider {
  const self = Object.create(Proto)
  self.get = get
  return self
}

/**
 * @since 4.0.0
 * @category Combinators
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
 * @since 4.0.0
 * @category Combinators
 */
export const mapPath: {
  (f: (path: Path) => Path): (self: ConfigProvider) => ConfigProvider
  (self: ConfigProvider, f: (path: Path) => Path): ConfigProvider
} = dual(2, (self: ConfigProvider, f: (path: Path) => Path): ConfigProvider => make((path) => self.get(f(path))))

/**
 * @since 4.0.0
 * @category Combinators
 */
export const constantCase: (self: ConfigProvider) => ConfigProvider = mapPath((path) =>
  path.map((seg) => typeof seg === "number" ? seg : Str.constantCase(seg))
)

/**
 * @since 4.0.0
 * @category Layers
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
 * @since 4.0.0
 * @category Layers
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
  return make((path) => Effect.succeed(describeNode(resolvePath(root, path))))
}

function resolvePath(input: StringLeafJson, path: Path): StringLeafJson | undefined {
  let out: StringLeafJson = input

  for (const seg of path) {
    if (typeof out === "string") return undefined
    if (Array.isArray(out)) {
      if (typeof seg !== "number" || !Number.isInteger(seg) || seg < 0 || seg >= out.length) return undefined
    } else {
      if (typeof seg !== "string" || !Object.prototype.hasOwnProperty.call(out, seg)) return undefined
    }
    out = (out as any)[seg]
  }

  return out
}

function describeNode(value: StringLeafJson | undefined): Node | undefined {
  if (value === undefined) return undefined
  if (typeof value === "string") return leaf(value)
  if (Array.isArray(value)) return array(value.length)
  return object(Object.keys(value))
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
  if (typeof root === "string") return root
  if (typeof root === "number") return String(root)
  if (typeof root === "boolean") return String(root)
  if (Array.isArray(root)) return root.map(asStringLeafJson)

  if (typeof root === "object" && root !== null) {
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

type InlineParsed =
  | { readonly _tag: "leaf"; readonly value: string }
  | { readonly _tag: "arrayInline"; readonly items: ReadonlyArray<string> }
  | { readonly _tag: "objectInline"; readonly entries: Record<string, string> }

/**
 * @since 4.0.0
 */
export function makeInlineParser(options?: {
  readonly tokenSeparator?: string | undefined
  readonly keyValueSeparator?: string | undefined
}) {
  return (value: string): InlineParsed => {
    const tokenSeparator = options?.tokenSeparator ?? ","
    const keyValueSeparator = options?.keyValueSeparator ?? "="

    // split on commas to inspect tokens
    const raw = value.split(tokenSeparator)
    const tokens = raw.map((s) => s.trim())

    // Object inline if EVERY non-empty token contains exactly one '='
    const kvPairs = tokens
      .filter((t) => t.length > 0)
      .map((t) => {
        const first = t.indexOf(keyValueSeparator)
        const last = t.lastIndexOf(keyValueSeparator)
        // require a non-empty key (first > 0) and exactly one '=' (first === last)
        if (first > 0 && first === last) {
          const key = t.slice(0, first).trim()
          const val = t.slice(first + 1).trim() // may be empty -> ""
          return [key, val] as const
        }
        return null
      })

    const allAreKV = kvPairs.length > 0 && kvPairs.every((p) => p !== null)
    if (allAreKV) {
      const entries: Record<string, string> = {}
      for (const p of kvPairs as ReadonlyArray<readonly [string, string]>) {
        const [k, v] = p
        entries[k] = v
      }
      return { _tag: "objectInline", entries }
    }

    // Array inline if we saw at least one comma; keep empty items? (here: filter them out)
    if (raw.length > 1) {
      const items = tokens.filter((t) => t.length > 0)
      return { _tag: "arrayInline", items }
    }

    // Fallback: plain leaf
    return { _tag: "leaf", value }
  }
}

type Parser = {
  readonly splitKey: (key: string) => Array<string>
  readonly joinTokens: (tokens: ReadonlyArray<string>) => string
  readonly inlineParser: (value: string) => InlineParsed
}

/**
 * @since 4.0.0
 */
export const defaultParser: Parser = {
  splitKey: (key) => key.replace(/\]/g, "").split(/(?:__|\[)/),
  joinTokens: (tokens) => tokens.length === 0 ? "" : tokens[0] + tokens.slice(1).map((t) => `[${t}]`).join(""),
  inlineParser: makeInlineParser()
}

/**
 * Create a ConfigProvider that reads values from environment variables.
 *
 * @since 4.0.0
 */
export function fromEnv(options?: {
  readonly parser?: Parser | undefined
  readonly environment?: Record<string, string> | undefined
}): ConfigProvider {
  // Merge env sources (Node / Deno / Vite-like) unless an explicit env is passed.
  const env = options?.environment ?? {
    ...globalThis?.process?.env,
    ...(import.meta as any)?.env
  }

  const parser = options?.parser ?? defaultParser

  return make((path) => {
    if (!env) return Effect.succeed(undefined)

    const prefix = path.map(String)
    const prefixLen = prefix.length

    let exactValue: string | undefined
    const childTokens = new Set<string>()

    for (const fullKey of Object.keys(env)) {
      const val = env[fullKey]
      if (typeof val !== "string") continue

      const tokens = parser.splitKey(fullKey)

      // prefix match
      let matches = true
      for (let i = 0; i < prefixLen; i++) {
        if (tokens[i] !== prefix[i]) {
          matches = false
          break
        }
      }
      if (!matches) continue

      if (tokens.length === prefixLen) {
        exactValue = val
      } else {
        childTokens.add(tokens[prefixLen])
      }
    }

    // 1) No structural children -> inspect exact value via leafParser
    if (childTokens.size === 0) {
      if (exactValue === undefined) {
        // Child lookup of an inline container (parent fallback)
        if (prefixLen > 0) {
          const parentKey = prefix.slice(0, -1)
          const childToken = prefix[prefixLen - 1]!
          const parentExact = env[parser.joinTokens(parentKey)]
          if (typeof parentExact === "string") {
            const parsed = parser.inlineParser(parentExact)
            if (parsed._tag === "arrayInline") {
              const idx = Number(childToken)
              if (Number.isInteger(idx) && idx >= 0 && idx < parsed.items.length) {
                return Effect.succeed(leaf(parsed.items[idx]))
              }
            } else if (parsed._tag === "objectInline") {
              if (
                typeof childToken === "string" &&
                Object.prototype.hasOwnProperty.call(parsed.entries, childToken)
              ) {
                return Effect.succeed(leaf(parsed.entries[childToken]))
              }
            }
          }
        }
        return Effect.succeed(undefined)
      }

      // Exact value present at the prefix
      const parsed = parser.inlineParser(exactValue)
      switch (parsed._tag) {
        case "leaf":
          return Effect.succeed(leaf(parsed.value))
        case "arrayInline":
          return Effect.succeed(array(parsed.items.length))
        case "objectInline":
          return Effect.succeed(object(Object.keys(parsed.entries)))
      }
    }

    // 2) Structural children exist -> infer array vs object
    let allNumeric = true
    let maxIndex = -1
    for (const t of childTokens) {
      const n = Number(t)
      if (!Number.isInteger(n) || n < 0 || String(n) !== t) {
        allNumeric = false
        break
      }
      if (n > maxIndex) maxIndex = n
    }

    if (allNumeric) return Effect.succeed(array(maxIndex + 1))
    return Effect.succeed(object(Array.from(childTokens)))
  })
}

// -----------------------------------------------------------------------------
// fromDotEnv
// -----------------------------------------------------------------------------

const defaultDotEnvParser: Parser = {
  splitKey: defaultParser.splitKey,
  joinTokens: defaultParser.joinTokens,
  inlineParser: (value) => ({ _tag: "leaf", value })
}

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
  readonly parser?: Parser | undefined
  readonly expandVariables?: boolean | undefined
}): ConfigProvider {
  let environment = parseDotEnv(lines)
  const parser = options?.parser ?? defaultDotEnvParser
  if (options?.expandVariables) {
    environment = dotEnvExpand(environment)
  }
  return fromEnv({ environment, parser })
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
  readonly parser?: Parser | undefined
  readonly expandVariables?: boolean | undefined
}) => Effect.Effect<ConfigProvider, PlatformError, FileSystem.FileSystem> = Effect.fnUntraced(
  function*(options) {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(options?.path ?? ".env")
    return fromEnv({ environment: parseDotEnv(content) })
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
 * - Other I/O     -> `GetError`.
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

  const formatPath = (path: Path) => path_.join(rootDirectory, ...path.map(String))

  const mapError = (path: Path) => (cause: PlatformError) =>
    new GetError({
      reason: `Failed to read file at ${formatPath(path)}`,
      cause
    })

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
        const keys = entries.map((e) => typeof e === "string" ? path_.basename(e) : String(e?.name ?? ""))
        return object(keys)
      })
    )

    return asFile.pipe(Effect.catch(() => asDirectory), Effect.mapError(mapError(path)))
  })
})
