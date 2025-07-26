/**
 * @since 4.0.0
 */
import * as Cause from "../Cause.ts"
import * as Arr from "../collections/Array.ts"
import { hasProperty } from "../data/Predicate.ts"
import * as Effect from "../Effect.ts"
import { constant, dual, identity } from "../Function.ts"
import { toStringUnknown } from "../interfaces/Inspectable.ts"
import type { Pipeable } from "../interfaces/Pipeable.ts"
import { PipeInspectableProto } from "../internal/core.ts"
import * as Layer from "../Layer.ts"
import * as FileSystem from "../platform/FileSystem.ts"
import * as Path from "../platform/Path.ts"
import type { PlatformError } from "../platform/PlatformError.ts"
import * as Str from "../primitives/String.ts"
import type { Scope } from "../Scope.ts"
import * as ServiceMap from "../ServiceMap.ts"
import { type ConfigError, filterMissingDataOnly, MissingData, SourceError } from "./ConfigError.ts"

/**
 * @since 4.0.0
 * @category Models
 */
export interface ConfigProvider extends Pipeable {
  readonly load: (path: ReadonlyArray<string>) => Effect.Effect<string, ConfigError>
  readonly list: (path: ReadonlyArray<string>) => Effect.Effect<
    Array<{
      readonly key: string
      readonly provider: ConfigProvider
    }>,
    ConfigError
  >

  readonly path: ReadonlyArray<string>
  readonly setPath: (path: ReadonlyArray<string>, options?: {
    readonly content?: string | undefined
  }) => ConfigProvider
  readonly appendPath: (path: string) => ConfigProvider
  readonly formatPath: (path: ReadonlyArray<string>) => string
  readonly transformPath: (path: string) => string
}

/**
 * @since 4.0.0
 * @category References
 */
export const ConfigProvider: ServiceMap.Reference<ConfigProvider> = ServiceMap.Reference<ConfigProvider>(
  "effect/config/ConfigProvider",
  { defaultValue: () => fromEnv() }
)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = (options: {
  readonly load: (path: ReadonlyArray<string>) => Effect.Effect<string, ConfigError>
  readonly list?: (path: ReadonlyArray<string>) => Effect.Effect<
    Array<{
      readonly key: string
      readonly path: ReadonlyArray<string>
    }>,
    ConfigError
  >
  readonly formatPath?: (path: ReadonlyArray<string>) => string
  readonly transformPath?: (path: string) => string
}): ConfigProvider =>
  makeProto({
    load: options.load,
    list: options.list ?
      function(this: ConfigProvider, path) {
        return Effect.map(options.list!(path), (entries) =>
          entries.map(({ key, path }) => ({
            key,
            provider: this.setPath(path)
          })))
      } :
      defaultLoadEntries,
    formatPath: options.formatPath ?? defaultFormatPath,
    transformPath: options.transformPath ?? identity,
    path: []
  })

const defaultLoadEntries = constant(Effect.succeed([]))
const defaultFormatPath = (path: ReadonlyArray<string>): string => path.join(".")

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

const makeProto = (options: {
  readonly load: (path: ReadonlyArray<string>) => Effect.Effect<string, ConfigError>
  readonly list: (path: ReadonlyArray<string>) => Effect.Effect<
    Array<{
      readonly key: string
      readonly provider: ConfigProvider
    }>,
    ConfigError
  >
  readonly formatPath: (path: ReadonlyArray<string>) => string
  readonly transformPath: (path: string) => string
  readonly path: ReadonlyArray<string>
}): ConfigProvider => {
  const self = Object.create(Proto)
  self.load = options.load
  self.list = options.list
  self.path = options.path
  self.formatPath = options.formatPath
  self.transformPath = options.transformPath
  return self
}

const Proto = {
  ...PipeInspectableProto,
  toJSON(this: ConfigProvider) {
    return {
      _id: "ConfigProvider",
      path: this.path
    }
  },
  setPath(this: ConfigProvider, path: ReadonlyArray<string>, options?: {
    readonly content?: string | undefined
  }): ConfigProvider {
    return makeProto({
      ...this,
      load: typeof options?.content === "string" ?
        ((path_) => {
          if (path.join(".") === path_.join(".")) {
            return Effect.succeed(options.content!)
          }
          return this.load(path_)
        }) :
        this.load,
      path
    })
  },
  appendPath(this: ConfigProvider, path: string): ConfigProvider {
    return this.setPath([...this.path, this.transformPath(path)])
  }
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const fromEnv = (options?: {
  readonly pathDelimiter?: string | undefined
  readonly environment?: Record<string, string | undefined> | undefined
}): ConfigProvider => {
  const env = options?.environment ?? {
    ...globalThis?.process?.env,
    ...(import.meta as any)?.env
  }
  const delimiter = options?.pathDelimiter ?? "_"
  const formatPath = (path: ReadonlyArray<string>): string => path.join(delimiter)
  const safeDelimiter = delimiter.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
  const envKeyRegex = new RegExp(`^\\[([a-z0-9]+)\\]|^${safeDelimiter}([a-z0-9]+)`, "i")
  return make({
    formatPath,
    load: (path) =>
      Effect.suspend(() => {
        const envKey = formatPath(path)
        const value = env[envKey]
        if (typeof value !== "string") {
          return Effect.fail(new MissingData({ path, fullPath: envKey }))
        }
        return Effect.succeed(value)
      }),
    list: (path) =>
      Effect.sync(() => {
        const prefix = path.join(delimiter)
        const pathPartial = path.slice()
        const lastSegment = pathPartial.pop()
        const children = Arr.empty<{
          readonly key: string
          readonly path: ReadonlyArray<string>
        }>()
        const seen = new Set<string>()
        for (const key of Object.keys(env)) {
          if (!key.startsWith(prefix)) continue
          const value = env[key]
          if (typeof value !== "string") continue
          const withoutPrefix = key.slice(prefix.length)
          const match = withoutPrefix.match(envKeyRegex)
          if (!match) continue
          const childPath = lastSegment + match[0]
          const childKey = match[1] ?? match[2]
          if (seen.has(childPath)) continue
          children.push({
            key: childKey,
            path: [...pathPartial, childPath]
          })
          seen.add(childPath)
        }
        return children
      })
  })
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const fromJson = (env: unknown): ConfigProvider => {
  const valueAtPath = (path: ReadonlyArray<string>): unknown => {
    let value = env
    for (const segment of path) {
      if (Array.isArray(value)) {
        const index = Number(segment)
        value = value[index]
      } else if (hasProperty(value, segment)) {
        value = value[segment]
      } else {
        return undefined
      }
    }
    return value
  }
  return make({
    load: (path) =>
      Effect.suspend(() => {
        const value = valueAtPath(path)
        return value === undefined || typeof value === "object"
          ? Effect.fail(new MissingData({ path, fullPath: path.join(".") }))
          : Effect.succeed(toStringUnknown(value))
      }),
    list: (path) =>
      Effect.sync(() => {
        const value = valueAtPath(path)
        if (!value || typeof value !== "object") {
          return []
        } else if (Array.isArray(value)) {
          return value.map((_, index) => {
            const key = index.toString()
            return {
              key,
              path: [...path, key]
            }
          })
        }
        return Object.keys(value).map((key) => ({
          key,
          path: [...path, key]
        }))
      })
  })
}

/**
 * @since 4.0.0
 * @category Combinators
 */
export const mapPath: {
  (f: (pathSegment: string) => string): (self: ConfigProvider) => ConfigProvider
  (self: ConfigProvider, f: (pathSegment: string) => string): ConfigProvider
} = dual(2, (self: ConfigProvider, f: (pathSegment: string) => string): ConfigProvider =>
  makeProto({
    ...self,
    path: self.path.map(f),
    transformPath: (p) => f(self.transformPath(p))
  }))

/**
 * @since 4.0.0
 * @category Combinators
 */
export const constantCase: (self: ConfigProvider) => ConfigProvider = mapPath(Str.constantCase)

/**
 * @since 4.0.0
 * @category Combinators
 */
export const nested: {
  (prefix: string): (self: ConfigProvider) => ConfigProvider
  (self: ConfigProvider, prefix: string): ConfigProvider
} = dual(2, (self: ConfigProvider, prefix: string): ConfigProvider =>
  makeProto({
    ...self,
    path: [prefix, ...self.path]
  }))

/**
 * @since 4.0.0
 * @category Combinators
 */
export const orElse: {
  (that: ConfigProvider): (self: ConfigProvider) => ConfigProvider
  (self: ConfigProvider, that: ConfigProvider): ConfigProvider
} = dual(2, (self: ConfigProvider, that: ConfigProvider): ConfigProvider =>
  makeProto({
    ...self,
    load: (path) =>
      Effect.catchCauseFilter(
        self.load(path),
        filterMissingDataOnly,
        (causeA) =>
          that.load(path).pipe(
            Effect.catchCause((causeB) => Effect.failCause(Cause.merge(causeA, causeB)))
          )
      ),
    list: (path) =>
      self.list(path).pipe(
        Effect.flatMap((values) => values.length > 0 ? Effect.succeed(values) : that.list(path))
      )
  }))

/**
 * A ConfigProvider that loads configuration from a `.env` file.
 *
 * Based on
 * - https://github.com/motdotla/dotenv
 * - https://github.com/motdotla/dotenv-expand
 *
 * @since 4.0.0
 * @category Dotenv
 */
export const dotEnv: (
  options?: {
    readonly path?: string | undefined
    readonly pathDelimiter?: string | undefined
  } | undefined
) => Effect.Effect<
  ConfigProvider,
  PlatformError,
  FileSystem.FileSystem
> = Effect.fnUntraced(function*(options) {
  const fs = yield* FileSystem.FileSystem
  const content = yield* fs.readFileString(options?.path ?? ".env")
  return fromEnv({
    environment: parseDotEnv(content),
    pathDelimiter: options?.pathDelimiter
  })
})

/**
 * Creates a ConfigProvider from a file tree structure.
 *
 * @since 1.0.0
 * @category File Tree
 */
export const fileTree: (options?: {
  readonly rootDirectory?: string | undefined
}) => Effect.Effect<
  ConfigProvider,
  never,
  Path.Path | FileSystem.FileSystem
> = Effect.fnUntraced(function*(options) {
  const path_ = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const rootDirectory = options?.rootDirectory ?? "/"

  const formatPath = (path: ReadonlyArray<string>): string => path_.join(rootDirectory, ...path)

  const mapError = (path: ReadonlyArray<string>) => (cause: PlatformError) =>
    cause._tag === "SystemError" && cause.reason === "NotFound" ?
      new MissingData({
        path,
        fullPath: formatPath(path),
        cause
      }) :
      new SourceError({
        path,
        description: `Failed to read file at ${formatPath(path)}`,
        cause
      })

  return make({
    formatPath,
    load: (path) =>
      fs.readFileString(path_.join(rootDirectory, ...path)).pipe(
        Effect.mapError(mapError(path)),
        Effect.map(Str.trim)
      ),
    list: (path) =>
      fs.readDirectory(formatPath(path)).pipe(
        Effect.mapError(mapError(path)),
        Effect.map(Arr.map((file) => ({
          key: path_.basename(file),
          path: [...path, path_.basename(file)]
        })))
      )
  })
})

// -----------------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------------

const DOT_ENV_LINE =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg

const parseDotEnv = (lines: string): Record<string, string> => {
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

  return dotEnvExpand(obj)
}

const dotEnvExpand = (parsed: Record<string, string>) => {
  const newParsed: Record<string, string> = {}

  for (const configKey in parsed) {
    // resolve escape sequences
    newParsed[configKey] = interpolate(parsed[configKey], parsed).replace(/\\\$/g, "$")
  }

  return newParsed
}

const interpolate = (envValue: string, parsed: Record<string, string>) => {
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

const searchLast = (str: string, rgx: RegExp) => {
  const matches = Array.from(str.matchAll(rgx))
  return matches.length > 0 ? matches.slice(-1)[0].index : -1
}
