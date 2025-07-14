/**
 * @since 4.0.0
 */
import * as Arr from "../Array.js"
import * as Cause from "../Cause.js"
import * as Effect from "../Effect.js"
import { constant, dual, identity } from "../Function.js"
import { toStringUnknown } from "../Inspectable.js"
import { PipeInspectableProto } from "../internal/core.js"
import * as Layer from "../Layer.js"
import type { Pipeable } from "../Pipeable.js"
import * as FileSystem from "../platform/FileSystem.js"
import * as Path from "../platform/Path.js"
import type { PlatformError } from "../platform/PlatformError.js"
import { hasProperty } from "../Predicate.js"
import type { Scope } from "../Scope.js"
import * as ServiceMap from "../ServiceMap.js"
import * as Str from "../String.js"
import { type ConfigError, filterMissingDataOnly, MissingData, SourceError } from "./ConfigError.js"

/**
 * @since 4.0.0
 * @category Models
 */
export interface ConfigProvider extends Pipeable {
  readonly load: (path: ReadonlyArray<string>) => Effect.Effect<string, ConfigError>
  readonly listCandidates: (path: ReadonlyArray<string>) => Effect.Effect<
    Array<{
      readonly key: string
      readonly path: ReadonlyArray<string>
    }>,
    ConfigError
  >
  readonly formatPath: (path: ReadonlyArray<string>) => string
  readonly transformPath: (path: string) => string
  readonly prefix: ReadonlyArray<string>
  readonly context: () => Context
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface Context {
  readonly provider: ConfigProvider
  readonly load: Effect.Effect<string, ConfigError>
  readonly listCandidates: Effect.Effect<Array<Candidate>, ConfigError>

  readonly currentPath: ReadonlyArray<string>
  readonly appendPath: (path: string) => Context
  readonly setPath: (path: ReadonlyArray<string>) => Context

  readonly contentCache: Map<ReadonlyArray<string>, string>
  readonly withValue: (value: string) => Context

  lastChildContext?: Context | undefined
  readonly lastChildPath: ReadonlyArray<string>
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface Candidate {
  readonly key: string
  readonly context: Context
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
  readonly listCandidates?: (path: ReadonlyArray<string>) => Effect.Effect<
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
    listCandidates: options.listCandidates ?? defaultLoadEntries,
    formatPath: options.formatPath ?? defaultFormatPath,
    transformPath: options.transformPath ?? identity,
    prefix: emptyArr
  })

const emptyArr: Array<never> = []
const defaultLoadEntries = constant(Effect.succeed(emptyArr))
const defaultFormatPath = (path: ReadonlyArray<string>): string => path.join(".")

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer = <E = never, R = never>(
  self: ConfigProvider | Effect.Effect<ConfigProvider, E, R>
): Layer.Layer<never, E, Exclude<R, Scope>> =>
  Effect.isEffect(self) ? Layer.effect(ConfigProvider, self) : Layer.succeed(ConfigProvider, self)

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
  Layer.effect(
    ConfigProvider,
    Effect.gen(function*() {
      const current = yield* ConfigProvider
      const configProvider = Effect.isEffect(self) ? yield* self : self
      return options?.asPrimary ? orElse(configProvider, current) : orElse(current, configProvider)
    })
  )

const makeProto = (options: {
  readonly load: (path: ReadonlyArray<string>) => Effect.Effect<string, ConfigError>
  readonly listCandidates: (path: ReadonlyArray<string>) => Effect.Effect<
    Array<{
      readonly key: string
      readonly path: ReadonlyArray<string>
    }>,
    ConfigError
  >
  readonly formatPath: (path: ReadonlyArray<string>) => string
  readonly transformPath: (path: string) => string
  readonly prefix: ReadonlyArray<string>
  readonly context?: () => Context
}): ConfigProvider => {
  const self = Object.create(Proto)
  self.load = options.load
  self.listCandidates = options.listCandidates
  self.formatPath = options.formatPath
  self.transformPath = options.transformPath
  self.prefix = options.prefix
  if (options.context) {
    self.context = options.context
  }
  return self
}

const Proto = {
  ...PipeInspectableProto,
  toJSON(this: ConfigProvider) {
    return {
      _id: "ConfigProvider"
    }
  },
  context(this: ConfigProvider): Context {
    return makeContext({
      provider: this,
      currentPath: this.prefix
    })
  }
}

const makeContext = (options: {
  readonly provider: ConfigProvider
  readonly currentPath: ReadonlyArray<string>
  readonly contentCache?: Map<ReadonlyArray<string>, string>
}): Context => {
  const self = Object.create(ContextProto)
  self.contentCache = options.contentCache ?? new Map()
  self.provider = options.provider
  self.currentPath = options.currentPath
  return self
}

const ContextProto = {
  setPath(this: Context, path: ReadonlyArray<string>): Context {
    const next = makeContext({
      ...this,
      currentPath: path
    })
    this.lastChildContext = next
    return next
  },
  get lastChildPath(): ReadonlyArray<string> {
    return (this as any).lastChildContext?.currentPath ?? (this as any).currentPath
  },
  appendPath(this: Context, path: string): Context {
    return this.setPath([...this.currentPath, this.provider.transformPath(path)])
  },
  withValue(this: Context, value: string): Context {
    this.contentCache.set(this.currentPath, value)
    return this
  },
  get load(): Effect.Effect<string, ConfigError> {
    return Effect.suspend(() => {
      const self = this as any as Context
      if (self.contentCache.has(self.currentPath)) {
        return Effect.succeed(self.contentCache.get(self.currentPath)!)
      }
      return self.provider.load(self.currentPath)
    })
  },
  get listCandidates(): Effect.Effect<Array<Candidate>, ConfigError> {
    const self = this as any as Context
    return self.provider.listCandidates(self.currentPath).pipe(
      Effect.map(Arr.map(({ key, path }) => ({
        key,
        context: self.setPath(path)
      })))
    )
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
    listCandidates: (path) =>
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
    listCandidates(this: ConfigProvider, path) {
      return Effect.sync(() => {
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
    }
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
    prefix: self.prefix.map(f),
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
    prefix: [self.transformPath(prefix), ...self.prefix]
  }))

/**
 * @since 4.0.0
 * @category Combinators
 */
export const orElse: {
  (that: ConfigProvider): (self: ConfigProvider) => ConfigProvider
  (self: ConfigProvider, that: ConfigProvider): ConfigProvider
} = dual(2, (self: ConfigProvider, that: ConfigProvider): ConfigProvider =>
  make({
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
    listCandidates: (path) =>
      self.listCandidates(path).pipe(
        Effect.flatMap((values) => values.length > 0 ? Effect.succeed(values) : that.listCandidates(path))
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
    listCandidates: (path) =>
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
