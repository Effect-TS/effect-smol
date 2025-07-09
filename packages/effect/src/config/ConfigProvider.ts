/**
 * @since 4.0.0
 */
import * as Arr from "../Array.js"
import * as Effect from "../Effect.js"
import { constant, dual } from "../Function.js"
import { toStringUnknown } from "../Inspectable.js"
import { PipeInspectableProto } from "../internal/core.js"
import * as Layer from "../Layer.js"
import type { Pipeable } from "../Pipeable.js"
import { hasProperty } from "../Predicate.js"
import * as ServiceMap from "../ServiceMap.js"
import * as String from "../String.js"
import { type ConfigError, filterMissingData, MissingData } from "./ConfigError.js"

/**
 * @since 4.0.0
 * @category Models
 */
export interface ConfigProvider extends Pipeable {
  readonly currentPath: ReadonlyArray<string>
  readonly formatPath: (path: ReadonlyArray<string>) => string
  readonly append: (path: string) => ConfigProvider
  readonly setPath: (path: ReadonlyArray<string>) => ConfigProvider
  readonly withValue: (value: string) => ConfigProvider

  readonly load: Effect.Effect<string, ConfigError>
  readonly loadFromPath: (path: ReadonlyArray<string>) => Effect.Effect<string, ConfigError>

  readonly listCandidates: Effect.Effect<Array<Candidate>, ConfigError>
  readonly listCandidatesFromPath: (path: ReadonlyArray<string>) => Effect.Effect<Array<Candidate>, ConfigError>
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface Candidate {
  readonly key: string
  readonly provider: ConfigProvider
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
  readonly listCandidates?: (path: ReadonlyArray<string>) => Effect.Effect<Array<Candidate>, ConfigError>
  readonly formatPath?: (path: ReadonlyArray<string>) => string
}): ConfigProvider =>
  makeProto({
    currentPath: [],
    loadFromPath: options.load,
    listCandidatesFromPath: options.listCandidates ?? defaultLoadEntries,
    formatPath: options.formatPath ?? defaultFormatPath
  })

const defaultLoadEntries = constant(Effect.succeed([]))
const defaultFormatPath = (path: ReadonlyArray<string>): string => path.join(".")

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer = (self: ConfigProvider): Layer.Layer<never> => Layer.succeed(ConfigProvider, self)

const makeProto = (options: {
  readonly currentPath: ReadonlyArray<string>
  readonly loadFromPath: (path: ReadonlyArray<string>) => Effect.Effect<string, ConfigError>
  readonly listCandidatesFromPath: (path: ReadonlyArray<string>) => Effect.Effect<Array<Candidate>, ConfigError>
  readonly formatPath: (path: ReadonlyArray<string>) => string
  readonly append?: (path: string) => ConfigProvider
}): ConfigProvider => {
  const self = Object.create(Proto)
  self.currentPath = options.currentPath
  self.loadFromPath = options.loadFromPath
  self.listCandidatesFromPath = options.listCandidatesFromPath
  self.formatPath = options.formatPath
  if (options.append) {
    self.append = options.append
  }
  return self
}

const Proto = {
  ...PipeInspectableProto,
  toJSON(this: ConfigProvider) {
    return {
      _id: "ConfigProvider",
      currentPath: this.currentPath
    }
  },
  setPath(this: ConfigProvider, path: ReadonlyArray<string>): ConfigProvider {
    return makeProto({
      ...this,
      currentPath: path
    })
  },
  append(this: ConfigProvider, path: string): ConfigProvider {
    return this.setPath([...this.currentPath, path])
  },
  withValue(this: ConfigProvider, value: string): ConfigProvider {
    return makeProto({
      ...this,
      loadFromPath: (path) => path === this.currentPath ? Effect.succeed(value) : this.loadFromPath(path)
    })
  },
  get load(): Effect.Effect<string, ConfigError> {
    return (this as any).loadFromPath((this as any).currentPath)
  },
  get listCandidates(): Effect.Effect<Array<Candidate>, ConfigError> {
    return (this as any).listCandidatesFromPath((this as any).currentPath)
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
  return make({
    formatPath,
    load: Effect.fnUntraced(function*(path) {
      const envKey = formatPath(path)
      const value = env[envKey]
      if (typeof value !== "string") {
        return yield* Effect.fail(new MissingData({ path, fullPath: envKey }))
      }
      return value
    }),
    listCandidates(this: ConfigProvider, path) {
      return Effect.sync(() => {
        const prefix = path.join(delimiter)
        const pathPartial = path.slice()
        const lastSegment = pathPartial.pop()
        const children = Arr.empty<Candidate>()
        const seen = new Set<string>()
        for (const key of Object.keys(env)) {
          if (!key.startsWith(prefix)) continue
          const value = env[key]
          if (typeof value !== "string") continue
          const withoutPrefix = key.slice(prefix.length)
          const match = withoutPrefix.match(envChildRegex)
          if (!match) continue
          const childPath = lastSegment + match[0]
          const childKey = match[1] ?? match[2]
          if (seen.has(childKey)) continue
          children.push({
            key: childKey,
            provider: this.setPath([...pathPartial, childPath])
          })
          seen.add(childKey)
        }
        return children
      })
    }
  })
}

const envChildRegex = /^\[([a-z0-9]+)\]|^_([a-z0-9]+)/i

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
    load: Effect.fnUntraced(function*(path) {
      const value = valueAtPath(path)
      return value === undefined || typeof value === "object"
        ? yield* new MissingData({ path, fullPath: path.join(".") })
        : toStringUnknown(value)
    }),
    listCandidates(this: ConfigProvider, path) {
      return Effect.sync(() => {
        const value = valueAtPath(path)
        if (!value || typeof value !== "object") {
          return []
        } else if (Array.isArray(value)) {
          return value.map((_, index): Candidate => {
            const key = index.toString()
            return {
              key,
              provider: this.setPath([...path, key])
            }
          })
        }
        return Object.keys(value).map((key): Candidate => ({
          key,
          provider: this.setPath([...path, key])
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
    currentPath: self.currentPath.map(f),
    append(this: ConfigProvider, path: string) {
      return this.setPath([...this.currentPath, f(path)])
    }
  }))

/**
 * @since 4.0.0
 * @category Combinators
 */
export const constantCase: (self: ConfigProvider) => ConfigProvider = mapPath(String.constantCase)

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
    currentPath: [prefix, ...self.currentPath]
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
    load: (path) =>
      Effect.catchIf(
        self.loadFromPath(self.currentPath.concat(path)),
        filterMissingData,
        () => that.loadFromPath(that.currentPath.concat(path))
      ),
    listCandidates: (path) =>
      Effect.catchIf(
        self.listCandidatesFromPath(self.currentPath.concat(path)),
        filterMissingData,
        () => that.listCandidatesFromPath(that.currentPath.concat(path))
      )
  }))
