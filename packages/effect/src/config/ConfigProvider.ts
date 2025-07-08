/**
 * @since 4.0.0
 */
import * as Effect from "../Effect.js"
import { constant, dual } from "../Function.js"
import { PipeInspectableProto } from "../internal/core.js"
import type { Pipeable } from "../Pipeable.js"
import * as ServiceMap from "../ServiceMap.js"
import * as String from "../String.js"
import { type ConfigError, filterMissingData, MissingData } from "./ConfigError.js"

/**
 * @since 4.0.0
 * @category Models
 */
export interface ConfigProvider extends Pipeable {
  readonly currentPath: ReadonlyArray<string>
  readonly append: (path: string) => ConfigProvider
  readonly withValue: (value: string) => ConfigProvider

  readonly load: Effect.Effect<string, ConfigError>
  readonly loadFromPath: (path: ReadonlyArray<string>) => Effect.Effect<string, ConfigError>
}

/**
 * @since 4.0.0
 * @category References
 */
export class CurrentConfigProvider extends ServiceMap.Reference("effect/config/ConfigProvider/CurrentConfigProvider", {
  defaultValue: (): ConfigProvider => fromEnv()
}) {}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = (load: (path: ReadonlyArray<string>) => Effect.Effect<string, ConfigError>): ConfigProvider =>
  makeProto({
    currentPath: [],
    loadFromPath: load
  })

const makeProto = (options: {
  readonly currentPath: ReadonlyArray<string>
  readonly loadFromPath: (path: ReadonlyArray<string>) => Effect.Effect<string, ConfigError>
  readonly append?: (path: string) => ConfigProvider
}): ConfigProvider => {
  const self = Object.create(Proto)
  self.currentPath = options.currentPath
  self.loadFromPath = options.loadFromPath
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
  append(this: ConfigProvider, path: string): ConfigProvider {
    return makeProto({
      ...this,
      currentPath: [...this.currentPath, path]
    })
  },
  withValue(this: ConfigProvider, value: string): ConfigProvider {
    return makeProto({
      ...this,
      loadFromPath: constant(Effect.succeed(value))
    })
  },
  get load(): Effect.Effect<string, ConfigError> {
    return (this as any).loadFromPath((this as any).currentPath)
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
    ...process.env,
    ...(import.meta as any).env
  }
  const delimiter = options?.pathDelimiter ?? "_"
  return make(Effect.fnUntraced(function*(path) {
    const envKey = path.join(delimiter)
    const value = env[envKey]
    if (typeof value !== "string") {
      return yield* Effect.fail(new MissingData({ path, fullPath: envKey }))
    }
    return value
  }))
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
    append: (path: string) => self.append(f(path))
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
  make((path) =>
    Effect.catchIf(
      self.loadFromPath(self.currentPath.concat(path)),
      filterMissingData,
      () => that.loadFromPath(that.currentPath.concat(path))
    )
  ))
