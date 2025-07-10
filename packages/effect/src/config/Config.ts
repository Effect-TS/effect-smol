/**
 * @since 4.0.0
 */
import * as Arr from "../Array.js"
import type * as Brand from "../Brand.js"
import * as Cause from "../Cause.js"
import * as DateTime_ from "../DateTime.js"
import * as Duration_ from "../Duration.js"
import * as Effect from "../Effect.js"
import * as Exit from "../Exit.js"
import * as Filter from "../Filter.js"
import type { LazyArg } from "../Function.js"
import { constant, dual } from "../Function.js"
import { PipeInspectableProto, YieldableProto } from "../internal/core.js"
import * as LogLevel_ from "../LogLevel.js"
import type * as Option from "../Option.js"
import type { Pipeable } from "../Pipeable.js"
import { hasProperty } from "../Predicate.js"
import * as Redacted_ from "../Redacted.js"
import * as Str from "../String.js"
import type { NoInfer } from "../Types.js"
import { type ConfigError, filterMissingDataOnly, InvalidData, MissingData } from "./ConfigError.js"
import * as ConfigProvider from "./ConfigProvider.js"

/**
 * The type identifier for Config values.
 *
 * @example
 * ```ts
 * import { Config } from "effect/config"
 *
 * // Check if a value is a Config using the TypeId
 * const myConfig = Config.String("DB_HOST")
 * console.log(myConfig[Config.TypeId]) // "~effect/config/Config"
 * ```
 *
 * @example
 * ```ts
 * import { Config } from "effect/config"
 *
 * // Use with the isConfig guard function
 * const someValue: unknown = Config.String("PORT")
 * if (Config.isConfig(someValue)) {
 *   // TypeScript now knows someValue is a Config
 *   console.log(someValue[Config.TypeId]) // "~effect/config/Config"
 * }
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/config/Config"

/**
 * The type-level identifier for Config values.
 *
 * @example
 * ```ts
 * import { Config } from "effect/config"
 *
 * // The TypeId is used internally for type checking
 * const checkTypeId = (id: Config.TypeId) => {
 *   console.log(id) // "~effect/config/Config"
 * }
 * ```
 *
 * @example
 * ```ts
 * import { Config } from "effect/config"
 *
 * // Used in generic type constraints
 * const processConfig = <T extends { [Config.TypeId]: Config.TypeId }>(
 *   config: T
 * ) => {
 *   // TypeScript ensures config has the correct TypeId
 *   return config[Config.TypeId]
 * }
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = "~effect/config/Config"

/**
 * A type guard that checks if a value is a Config instance.
 *
 * This function is useful for runtime type checking to determine if an unknown value
 * is a Config before calling Config-specific methods or properties.
 *
 * @param u - The value to check
 * @returns `true` if the value is a Config instance, `false` otherwise
 *
 * @example
 * ```ts
 * import { Config } from "effect/config"
 *
 * // Check if a value is a Config instance
 * const stringConfig = Config.String("HOST")
 * const numberConfig = Config.Number("PORT")
 * const regularValue = "not a config"
 *
 * console.log(Config.isConfig(stringConfig)) // true
 * console.log(Config.isConfig(numberConfig)) // true
 * console.log(Config.isConfig(regularValue)) // false
 * ```
 *
 * @example
 * ```ts
 * import { Config } from "effect/config"
 *
 * // Use as a type guard in conditional logic
 * const processValue = (value: unknown) => {
 *   if (Config.isConfig(value)) {
 *     // TypeScript knows value is Config<unknown> here
 *     console.log("Found a Config instance")
 *     return value.asEffect()
 *   } else {
 *     console.log("Not a Config instance")
 *     return value
 *   }
 * }
 *
 * const config = Config.Boolean("DEBUG")
 * processValue(config) // "Found a Config instance"
 * processValue("hello") // "Not a Config instance"
 * ```
 *
 * @example
 * ```ts
 * import { Config } from "effect/config"
 *
 * // Filter Config instances from mixed arrays
 * const mixedValues = [
 *   Config.String("NAME"),
 *   "plain string",
 *   Config.Number("AGE"),
 *   42,
 *   Config.Boolean("ACTIVE")
 * ]
 *
 * const configInstances = mixedValues.filter(Config.isConfig)
 * console.log(configInstances.length) // 3
 * ```
 *
 * @since 4.0.0
 * @category Guards
 */
export const isConfig = (u: unknown): u is Config<unknown> => hasProperty(u, TypeId)

/**
 * Represents a configuration value that can be parsed from a ConfigProvider.
 *
 * Config is a functional configuration library that provides type-safe configuration
 * parsing with automatic validation and error handling. It supports reading from
 * environment variables, configuration files, and other sources.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Basic usage - creating and using a string config
 * const databaseHost = Config.String("DB_HOST")
 *
 * // Using config with ConfigProvider
 * const program = Effect.gen(function* () {
 *   const host = yield* databaseHost
 *   console.log(`Database host: ${host}`)
 * })
 *
 * // Run with environment provider
 * const provider = ConfigProvider.fromEnv({ environment: { DB_HOST: "localhost" } })
 * Effect.runSync(Effect.provide(program, ConfigProvider.layer(provider)))
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Using asEffect() method for direct execution
 * const portConfig = Config.Number("PORT")
 *
 * const program = Effect.gen(function* () {
 *   const port = yield* portConfig.asEffect()
 *   console.log(`Server port: ${port}`)
 * })
 *
 * // Run with environment
 * const provider = ConfigProvider.fromEnv({ environment: { PORT: "3000" } })
 * Effect.runSync(Effect.provide(program, ConfigProvider.layer(provider)))
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Complex configuration with multiple values
 * const appConfig = Config.all({
 *   host: Config.String("HOST"),
 *   port: Config.Number("PORT"),
 *   debug: Config.Boolean("DEBUG"),
 *   timeout: Config.Duration("TIMEOUT")
 * })
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* appConfig
 *   console.log("Application config:", config)
 *   // { host: "localhost", port: 3000, debug: true, timeout: Duration }
 * })
 *
 * const provider = ConfigProvider.fromEnv({
 *   environment: {
 *     HOST: "localhost",
 *     PORT: "3000",
 *     DEBUG: "true",
 *     TIMEOUT: "30 seconds"
 *   }
 * })
 * Effect.runSync(Effect.provide(program, ConfigProvider.layer(provider)))
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Using Config with error handling
 * const apiConfig = Config.all({
 *   url: Config.Url("API_URL"),
 *   key: Config.String("API_KEY")
 * })
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* apiConfig.asEffect()
 *   console.log("API config:", config)
 * })
 *
 * // Configuration errors will be thrown as ConfigError
 * const provider = ConfigProvider.fromEnv({ environment: {} })
 * Effect.runSync(Effect.provide(program, ConfigProvider.layer(provider)))
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Using Config with default values and transformations
 * const serverConfig = Config.all({
 *   host: Config.String("HOST").pipe(Config.withDefault("localhost")),
 *   port: Config.Number("PORT").pipe(Config.withDefault(8080)),
 *   ssl: Config.Boolean("SSL").pipe(Config.withDefault(false))
 * })
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* serverConfig
 *   console.log(`Server: ${config.ssl ? 'https' : 'http'}://${config.host}:${config.port}`)
 * })
 *
 * // Will use defaults for missing values
 * const provider = ConfigProvider.fromEnv({ environment: { HOST: "api.example.com" } })
 * Effect.runSync(Effect.provide(program, ConfigProvider.layer(provider)))
 * // Output: "Server: http://api.example.com:8080"
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export interface Config<out A> extends Pipeable, Effect.Yieldable<A, ConfigError> {
  readonly [TypeId]: TypeId
  readonly parse: (context: ConfigProvider.Context) => Effect.Effect<A, ConfigError>
  [Symbol.iterator](): Effect.EffectIterator<Config<A>>
}

/**
 * Constructs a low-level Config from a parsing function.
 *
 * This is the primitive constructor used internally by other Config constructors
 * to create custom configuration parsers. It provides direct access to the
 * configuration context and allows for fine-grained control over parsing behavior.
 *
 * @param parse - A function that takes a ConfigProvider.Context and returns an Effect
 * @param name - Optional name for the configuration key (for path-based parsing)
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider, ConfigError } from "effect/config"
 *
 * // Create a custom config that parses a positive number
 * const positiveNumber = Config.primitive((ctx) =>
 *   Effect.flatMap(ctx.load, (value) => {
 *     const num = Number(value)
 *     if (isNaN(num)) {
 *       return Effect.fail(new ConfigError.InvalidData({
 *         path: ctx.currentPath,
 *         description: `Expected a number, but received: ${value}`
 *       }))
 *     }
 *     if (num <= 0) {
 *       return Effect.fail(new ConfigError.InvalidData({
 *         path: ctx.currentPath,
 *         description: `Expected a positive number, but received: ${num}`
 *       }))
 *     }
 *     return Effect.succeed(num)
 *   })
 * )
 *
 * // Usage
 * const program = Effect.gen(function*() {
 *   const result = yield* positiveNumber
 *   console.log(`Parsed positive number: ${result}`)
 * }).pipe(
 *   Effect.provide(ConfigProvider.layer(
 *     ConfigProvider.fromEnv({ environment: { "": "42" } })
 *   ))
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigError, ConfigProvider } from "effect/config"
 *
 * // Create a named config that parses a URL with validation
 * const apiUrlConfig = Config.primitive("API_URL", (ctx) =>
 *   Effect.flatMap(ctx.load, (value) => {
 *     try {
 *       const url = new URL(value)
 *       if (!url.protocol.startsWith("http")) {
 *         return Effect.fail(new ConfigError.InvalidData({
 *           path: ctx.currentPath,
 *           description: `Expected HTTP/HTTPS URL, but received: ${value}`
 *         }))
 *       }
 *       return Effect.succeed(url)
 *     } catch (error) {
 *       return Effect.fail(new ConfigError.InvalidData({
 *         path: ctx.currentPath,
 *         description: `Invalid URL format: ${value}`
 *       }))
 *     }
 *   })
 * )
 *
 * // Usage
 * const program = Effect.gen(function*() {
 *   const url = yield* apiUrlConfig
 *   console.log(`API URL: ${url.href}`)
 * }).pipe(
 *   Effect.provide(ConfigProvider.layer(
 *     ConfigProvider.fromEnv({
 *       environment: { API_URL: "https://api.example.com" }
 *     })
 *   ))
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigError, ConfigProvider } from "effect/config"
 *
 * // Create a config that parses JSON with error handling
 * const jsonConfig = Config.primitive("JSON_CONFIG", (ctx) =>
 *   Effect.flatMap(ctx.load, (value) => {
 *     try {
 *       const parsed = JSON.parse(value)
 *       return Effect.succeed(parsed)
 *     } catch (error) {
 *       return Effect.fail(new ConfigError.InvalidData({
 *         path: ctx.currentPath,
 *         description: `Invalid JSON: ${String(error)}`
 *       }))
 *     }
 *   })
 * )
 *
 * // Usage with structured data
 * const program = Effect.gen(function*() {
 *   const config = yield* jsonConfig
 *   console.log(`Server: ${config.host}:${config.port}`)
 * }).pipe(
 *   Effect.provide(ConfigProvider.layer(
 *     ConfigProvider.fromEnv({
 *       environment: { JSON_CONFIG: '{"host": "localhost", "port": 8080}' }
 *     })
 *   ))
 * )
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const primitive: {
  <A>(parse: (context: ConfigProvider.Context) => Effect.Effect<A, ConfigError>): Config<A>
  <A>(name: string | undefined, parse: (context: ConfigProvider.Context) => Effect.Effect<A, ConfigError>): Config<A>
} = function<A>(): Config<A> {
  const self = Object.create(Proto)
  self.parse = typeof arguments[0] === "function"
    ? arguments[0]
    : arguments[0] === undefined
    ? arguments[1]
    : (ctx: ConfigProvider.Context) => arguments[1](ctx.appendPath(arguments[0]!))
  return self
}

/**
 * Constructs a config from a filter function that validates and transforms string input.
 *
 * This is a foundational constructor for creating custom config types. It takes a filter
 * function that attempts to parse a string value into the desired type, returning either
 * the parsed value or `Filter.absent` to indicate validation failure.
 *
 * @param options - Configuration options for the filter-based config
 * @param options.name - Optional configuration key name for nested access
 * @param options.filter - Filter function that transforms string to A or Filter.absent
 * @param options.onAbsent - Function that generates error message when filter returns absent
 * @returns A config that validates input using the provided filter
 *
 * @example
 * ```ts
 * import { Effect, Filter } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Create a custom email validation config
 * const emailConfig = Config.fromFilter({
 *   name: "USER_EMAIL",
 *   filter: (value: string) => {
 *     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
 *     return emailRegex.test(value) ? value : Filter.absent
 *   },
 *   onAbsent: (value) => `Expected a valid email address, but received: ${value}`
 * })
 *
 * // Use the config
 * const provider = ConfigProvider.fromEnv({
 *   environment: { USER_EMAIL: "user@example.com" }
 * })
 * const result = Effect.runSync(Effect.provide(emailConfig.asEffect(), ConfigProvider.layer(provider)))
 * // result: "user@example.com"
 * ```
 *
 * @example
 * ```ts
 * import { Effect, Filter } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Create a custom enum-like config using fromFilter
 * type LogLevel = "debug" | "info" | "warn" | "error"
 * const logLevelConfig = Config.fromFilter<LogLevel>({
 *   name: "LOG_LEVEL",
 *   filter: (value: string) => {
 *     const levels: LogLevel[] = ["debug", "info", "warn", "error"]
 *     return levels.includes(value as LogLevel) ? value as LogLevel : Filter.absent
 *   },
 *   onAbsent: (value) => `Expected one of: debug, info, warn, error, but received: ${value}`
 * })
 *
 * // Valid usage
 * const provider = ConfigProvider.fromEnv({ environment: { LOG_LEVEL: "info" } })
 * const result = Effect.runSync(Effect.provide(logLevelConfig.asEffect(), ConfigProvider.layer(provider)))
 * // result: "info"
 * ```
 *
 * @example
 * ```ts
 * import { Effect, Filter } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Create a config that parses comma-separated values into an array
 * const csvConfig = Config.fromFilter<string[]>({
 *   name: "CSV_VALUES",
 *   filter: (value: string) => {
 *     const trimmed = value.trim()
 *     return trimmed.length > 0 ? trimmed.split(",").map(s => s.trim()) : Filter.absent
 *   },
 *   onAbsent: (value) => `Expected a non-empty comma-separated list, but received: ${value}`
 * })
 *
 * // Parse CSV values
 * const provider = ConfigProvider.fromEnv({ environment: { CSV_VALUES: "apple,banana,cherry" } })
 * const result = Effect.runSync(Effect.provide(csvConfig.asEffect(), ConfigProvider.layer(provider)))
 * // result: ["apple", "banana", "cherry"]
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const fromFilter = <A>(
  options: {
    readonly name?: string | undefined
    readonly filter: Filter.Filter<string, A>
    readonly onAbsent: (value: string) => string
  }
): Config<A> =>
  primitive(options.name, (ctx) =>
    Effect.flatMap(ctx.load, (value) => {
      const result = options.filter(value)
      return result === Filter.absent ?
        Effect.fail(
          new InvalidData({
            path: ctx.currentPath,
            description: options.onAbsent(value)
          })
        ) :
        Effect.succeed(result)
    }))

const Proto = {
  ...PipeInspectableProto,
  ...YieldableProto,
  [TypeId]: TypeId,
  asEffect(this: Config<unknown>) {
    return Effect.flatMap(ConfigProvider.ConfigProvider.asEffect(), (_) => this.parse(_.context()))
  },
  toJSON(this: Config<unknown>) {
    return {
      _id: "Config"
    }
  }
}
const String_ = (name?: string): Config<string> => primitive(name, (ctx) => ctx.load)

export {
  /**
   * Constructs a config that reads a string value from the environment.
   *
   * This is the most basic primitive config that reads a raw string value from the
   * configuration source. It does not perform any validation or transformation on the value.
   *
   * @param name - The name of the configuration property to read. If not provided,
   * the config will read from the root context.
   * @returns A config that will produce a string value when parsed.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import { Config } from "effect/config"
   *
   * // Create a string config with a name
   * const dbHost = Config.String("DB_HOST")
   *
   * // Create a string config without a name (for generic use)
   * const genericString = Config.String()
   *
   * // Use the config to read from environment
   * const program = Effect.gen(function*() {
   *   const host = yield* dbHost
   *   console.log(`Database host: ${host}`)
   * })
   * ```
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import { Config } from "effect/config"
   *
   * // Combine with other config operations
   * const appName = Config.String("APP_NAME").pipe(
   *   Config.withDefault("MyApp")
   * )
   *
   * // Use with branded types
   * const userId = Config.String("USER_ID").pipe(
   *   Config.map(value => value.trim())
   * )
   * ```
   *
   * @since 4.0.0
   * @category Primitives
   */
  String_ as String
}

const Number_ = (name?: string): Config<number> =>
  fromFilter({
    name,
    filter(value) {
      const number = Number(value)
      return isNaN(number) ? Filter.absent : number
    },
    onAbsent: (value) => `Expected a number, but received: ${value}`
  })
export {
  /**
   * Constructs a config that parses a number value from a string.
   *
   * @example
   * ```ts
   * import { Config } from "effect/config"
   *
   * // Parse a number from environment variable
   * const config = Config.Number("PORT")
   *
   * // Parses "8080" to 8080
   * // Environment: { PORT: "8080" }
   * ```
   *
   * @example
   * ```ts
   * import { Config } from "effect/config"
   *
   * // Parse numbers from array
   * const config = Config.Array("NUMBERS", Config.Number())
   *
   * // Parses "1,2,3" to [1, 2, 3]
   * // Environment: { NUMBERS: "1,2,3" }
   * ```
   *
   * @since 4.0.0
   * @category Primitives
   */
  Number_ as Number
}

/**
 * Constructs a config that parses integer values from environment variables.
 * Only accepts whole numbers (no decimals) and rejects non-numeric values.
 *
 * @example
 * ```ts
 * import { Config } from "effect/config"
 *
 * // Parse an integer from environment variable
 * const config = Config.Integer("PORT")
 *
 * // Parses "3000" to 3000
 * // Environment: { PORT: "3000" }
 * ```
 *
 * @example
 * ```ts
 * import { Config } from "effect/config"
 *
 * // Parse integers from array
 * const config = Config.Array("NUMBERS", Config.Integer())
 *
 * // Parses "1,2,3" to [1, 2, 3]
 * // Environment: { NUMBERS: "1,2,3" }
 * // Note: "1.5,2,3" would fail validation
 * ```
 *
 * @since 4.0.0
 * @category Primitives
 */
export const Integer = (name?: string): Config<number> =>
  fromFilter({
    name,
    filter(value) {
      const number = Number(value)
      return Number.isInteger(number) ? number : Filter.absent
    },
    onAbsent: (value) => `Expected an integer, but received: ${value}`
  })

/**
 * Constructs a config that parses a valid port number from a string.
 *
 * A valid port number is an integer between 0 and 65535 (inclusive).
 *
 * @example
 * ```ts
 * import { Config } from "effect/config"
 *
 * // Parse a port number from environment variable
 * const serverPort = Config.Port("SERVER_PORT")
 *
 * // Usage with default value
 * const port = Config.Port("PORT").pipe(
 *   Config.withDefault(3000)
 * )
 * ```
 *
 * @since 4.0.0
 * @category Primitives
 */
export const Port = (name?: string): Config<number> =>
  fromFilter({
    name,
    filter(value) {
      const number = Number(value)
      return Number.isInteger(number) && number >= 0 && number <= 65535 ? number : Filter.absent
    },
    onAbsent: (value) => `Expected a valid port number, but received: ${value}`
  })

const BigInt_ = (name?: string): Config<bigint> =>
  fromFilter({
    name,
    filter: Filter.try((s) => BigInt(s)),
    onAbsent: (value) => `Expected a bigint, but received: ${value}`
  })
export {
  /**
   * Constructs a config that parses BigInt values from environment variables.
   * The value is parsed from a string representation using the BigInt constructor.
   *
   * @example
   * ```ts
   * import { Config, ConfigProvider } from "effect/config"
   * import { Effect } from "effect"
   *
   * const config = Config.BigInt("MAX_SAFE_INTEGER")
   *
   * const provider = ConfigProvider.fromEnv({ environment: { MAX_SAFE_INTEGER: "9007199254740991" } })
   * const result = Effect.runSync(Effect.provide(
   *   config.asEffect(),
   *   ConfigProvider.layer(provider)
   * ))
   * console.log(result) // 9007199254740991n
   * ```
   *
   * @example
   * ```ts
   * import { Config, ConfigProvider } from "effect/config"
   * import { Effect } from "effect"
   *
   * // Using with very large numbers that exceed JavaScript's number precision
   * const config = Config.BigInt("LARGE_NUMBER")
   *
   * const provider = ConfigProvider.fromEnv({ environment: { LARGE_NUMBER: "123456789012345678901234567890" } })
   * const result = Effect.runSync(Effect.provide(
   *   config.asEffect(),
   *   ConfigProvider.layer(provider)
   * ))
   * console.log(result) // 123456789012345678901234567890n
   * ```
   *
   * @example
   * ```ts
   * import { Config, ConfigProvider } from "effect/config"
   * import { Effect } from "effect"
   *
   * // Using in arrays to parse multiple BigInt values
   * const config = Config.Array("CRYPTO_AMOUNTS", Config.BigInt())
   *
   * const provider = ConfigProvider.fromEnv({ environment: { CRYPTO_AMOUNTS: "1000000000000000000,2000000000000000000,3000000000000000000" } })
   * const result = Effect.runSync(Effect.provide(
   *   config.asEffect(),
   *   ConfigProvider.layer(provider)
   * ))
   * console.log(result) // [1000000000000000000n, 2000000000000000000n, 3000000000000000000n]
   * ```
   *
   * @since 4.0.0
   * @category Primitives
   */
  BigInt_ as BigInt
}

/**
 * Represents a literal value that can be used with the `Config.Literal` function.
 *
 * @since 4.0.0
 * @category Models
 */
export type LiteralValue = string | number | boolean | null | bigint

/**
 * Constructs a config that validates input against a predefined set of literal values.
 *
 * This function creates a configuration parser that accepts only specific literal values,
 * making it ideal for enums, feature flags, or any configuration that should be restricted
 * to a known set of options. The parser converts string representations to their
 * corresponding literal values with proper type safety.
 *
 * @param options - Configuration options for the literal validation
 * @param options.literals - Array of allowed literal values (strings, numbers, booleans, null, bigint)
 * @param options.name - Optional configuration key name for nested access
 * @param options.description - Optional custom description for error messages
 * @param options.caseInsensitive - Optional flag to enable case-insensitive matching (default: false)
 * @returns A config that validates input against the provided literal values
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config } from "effect/config"
 *
 * // Create a config for environment types
 * const envConfig = Config.Literal(
 *   "NODE_ENV",
 *   ["development", "production", "test"]
 * )
 *
 * // Use in Effect.gen to read configuration
 * const program = Effect.gen(function* () {
 *   const env = yield* envConfig
 *   console.log(`Environment: ${env}`)
 *   return env
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config } from "effect/config"
 *
 * // Create a config with mixed literal types
 * const statusConfig = Config.Literal(
 *   "STATUS",
 *   ["active", "inactive", true, false, 0, 1, null]
 * )
 *
 * // Use with different literal types
 * const program = Effect.gen(function* () {
 *   const status = yield* statusConfig
 *   // status can be "active", "inactive", true, false, 0, 1, or null
 *   console.log(`Status: ${status}`)
 *   return status
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config } from "effect/config"
 *
 * // Create a case-insensitive config
 * const logLevelConfig = Config.Literal(
 *   "LOG_LEVEL",
 *   ["Debug", "Info", "Warning", "Error"],
 *   { caseInsensitive: true }
 *  )
 *
 * // Case-insensitive matching will work
 * const program = Effect.gen(function* () {
 *   const logLevel = yield* logLevelConfig
 *   // "debug", "DEBUG", "Debug" all resolve to "Debug"
 *   console.log(`Log Level: ${logLevel}`)
 *   return logLevel
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config } from "effect/config"
 *
 * // Using with BigInt literals
 * const bigIntConfig = Config.Literal(
 *   "LARGE_VALUE",
 *   [BigInt(100), BigInt(200), BigInt(300)]
 * )
 *
 * // Parse BigInt values from strings
 * const program = Effect.gen(function* () {
 *   const value = yield* bigIntConfig
 *   console.log(`Large value: ${value}`)
 *   return value
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config } from "effect/config"
 *
 * // Using in arrays to validate all elements
 * const featureFlagsConfig = Config.Array(
 *   "FEATURES",
 *   Config.Literal(["auth", "analytics", "notifications"])
 * )
 *
 * // Parse comma-separated literal values
 * const program = Effect.gen(function* () {
 *   const features = yield* featureFlagsConfig
 *   console.log(`Enabled features: ${features.join(", ")}`)
 *   return features
 * })
 * ```
 *
 * @since 4.0.0
 * @category Primitives
 */
export const Literal: {
  <const Literals extends ReadonlyArray<LiteralValue>>(
    literals: Literals,
    options?: {
      readonly description?: string | undefined
      readonly caseInsensitive?: boolean | undefined
    }
  ): Config<Literals[number]>
  <const Literals extends ReadonlyArray<LiteralValue>>(
    name: string | undefined,
    literals: Literals,
    options?: {
      readonly description?: string | undefined
      readonly caseInsensitive?: boolean | undefined
    }
  ): Config<Literals[number]>
} = function<const Literals extends ReadonlyArray<LiteralValue>>(): Config<Literals[number]> {
  const nameFirst = Array.isArray(arguments[1])
  const name = nameFirst ? arguments[0] : undefined
  const literals: Literals = nameFirst ? arguments[1] : arguments[0]
  const options = nameFirst ? arguments[2] : arguments[1]
  const caseInsensitive = options?.caseInsensitive ?? false
  const map = new Map(
    literals.map((literal) => [caseInsensitive ? String(literal).toLowerCase() : String(literal), literal])
  )
  const description = options?.description ?? `one of (${literals.map(String).join(", ")})`
  return fromFilter({
    name,
    filter(value) {
      const key = caseInsensitive ? value.toLowerCase() : value
      const result = map.get(key)
      return result !== undefined ? result : Filter.absent
    },
    onAbsent: (value) => `Expected ${description}, but received: ${value}`
  })
}

const trueValues = new Set(["true", "1", "yes", "on"])
const falseValues = new Set(["false", "0", "no", "off"])

/**
 * Constructs a config that parses a boolean value from a string.
 *
 * The following values are accepted as `true` (case-insensitive):
 * - "true"
 * - "1"
 * - "yes"
 * - "on"
 *
 * The following values are accepted as `false` (case-insensitive):
 * - "false"
 * - "0"
 * - "no"
 * - "off"
 *
 * @example
 * ```ts
 * import { Config } from "effect/config"
 *
 * // Creating a boolean config
 * const debugConfig = Config.Boolean("DEBUG")
 *
 * // Usage with various truthy values
 * const config1 = Config.Boolean("ENABLED")  // accepts "true", "1", "yes", "on"
 * const config2 = Config.Boolean("DISABLED") // accepts "false", "0", "no", "off"
 *
 * // Combining with other configs
 * const appConfig = Config.all({
 *   debug: Config.Boolean("DEBUG"),
 *   port: Config.Integer("PORT")
 * })
 * ```
 *
 * @since 4.0.0
 * @category Primitives
 */
export const Boolean = (name?: string): Config<boolean> =>
  fromFilter({
    name,
    filter(value) {
      const lowerValue = value.toLowerCase()
      return trueValues.has(lowerValue) ? true : falseValues.has(lowerValue) ? false : Filter.absent
    },
    onAbsent: (value) => `Expected a boolean, but received: ${value}`
  })

/**
 * Constructs a config that parses a DateTime string.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Simple DateTime config
 * const dateTimeConfig = Config.DateTime("TIMESTAMP")
 *
 * // Usage with ConfigProvider
 * const provider = ConfigProvider.fromEnv({ environment: { TIMESTAMP: "2023-01-01T00:00:00Z" } })
 * const result = Effect.runSync(Effect.provide(dateTimeConfig.asEffect(), ConfigProvider.layer(provider)))
 * // result is a DateTime.Utc instance
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // DateTime config without name (uses empty string as key)
 * const dateTimeConfig = Config.DateTime()
 *
 * // Usage with various DateTime formats
 * const provider1 = ConfigProvider.fromEnv({ environment: { "": "0" } })
 * const result1 = Effect.runSync(Effect.provide(dateTimeConfig.asEffect(), ConfigProvider.layer(provider1)))
 * // result1 is a DateTime.Utc instance
 *
 * const provider2 = ConfigProvider.fromEnv({ environment: { "": "2023-12-25T12:00:00.000Z" } })
 * const result2 = Effect.runSync(Effect.provide(dateTimeConfig.asEffect(), ConfigProvider.layer(provider2)))
 * // result2 is a DateTime.Utc instance
 * ```
 *
 * @since 4.0.0
 * @category Primitives
 */
export const DateTime = (name?: string): Config<DateTime_.Utc> =>
  fromFilter({
    name,
    filter: Filter.fromPredicateOption(DateTime_.make),
    onAbsent: (value) => `Expected a DateTime string, but received: ${value}`
  })

/**
 * Creates a configuration that parses a URL string into a URL object.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Create a config for a URL
 * const urlConfig = Config.Url("WEBSITE_URL")
 *
 * // Parse a valid URL from configuration
 * const provider = ConfigProvider.fromEnv({
 *   environment: {
 *     WEBSITE_URL: "https://effect.website/docs/introduction"
 *   }
 * })
 * const result = Effect.runSync(Effect.provide(urlConfig.asEffect(), ConfigProvider.layer(provider)))
 * // result is a URL object
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Create a config for a URL without a name
 * const urlConfig = Config.Url()
 *
 * // Usage with various URL formats
 * const provider1 = ConfigProvider.fromEnv({ environment: { "": "https://example.com/api" } })
 * const result1 = Effect.runSync(Effect.provide(urlConfig.asEffect(), ConfigProvider.layer(provider1)))
 * // result1 is a URL object
 *
 * const provider2 = ConfigProvider.fromEnv({ environment: { "": "https://api.github.com/repos" } })
 * const result2 = Effect.runSync(Effect.provide(urlConfig.asEffect(), ConfigProvider.layer(provider2)))
 * // result2 is a URL object
 * ```
 *
 * @since 4.0.0
 * @category Primitives
 */
export const Url = (name?: string): Config<URL> =>
  fromFilter({
    name,
    filter: Filter.try((s) => new URL(s)),
    onAbsent: (value) => `Expected a valid URL, but received: ${value}`
  })

/**
 * Constructs a config that parses log level values from environment variables.
 *
 * Accepts any of the standard log level values: "All", "Fatal", "Error", "Warn", "Info", "Debug", "Trace", "None".
 * The parsing is case-insensitive, so "debug", "Debug", and "DEBUG" are all valid.
 *
 * @param name - The name of the configuration property to read. If not provided,
 * the config will read from the root context.
 * @returns A config that will produce a LogLevel value when parsed.
 *
 * @example
 * ```ts
 * import { Effect, LogLevel } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Create a log level config
 * const logLevel = Config.LogLevel("LOG_LEVEL")
 *
 * // Parse from environment variable
 * const provider = ConfigProvider.fromEnv({ environment: { LOG_LEVEL: "Debug" } })
 * const result = Effect.runSync(Effect.provide(logLevel.asEffect(), ConfigProvider.layer(provider)))
 * // result is "Debug" as LogLevel.LogLevel
 * ```
 *
 * @example
 * ```ts
 * import { Effect, LogLevel } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Case-insensitive parsing
 * const logLevel = Config.LogLevel("LOG_LEVEL")
 *
 * // All of these are valid
 * const provider1 = ConfigProvider.fromEnv({ environment: { LOG_LEVEL: "error" } })
 * const provider2 = ConfigProvider.fromEnv({ environment: { LOG_LEVEL: "ERROR" } })
 * const provider3 = ConfigProvider.fromEnv({ environment: { LOG_LEVEL: "Error" } })
 *
 * // All produce "Error" as LogLevel.LogLevel
 * ```
 *
 * @example
 * ```ts
 * import { Effect, LogLevel } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Using with default values and validation
 * const logLevel = Config.LogLevel("LOG_LEVEL").pipe(
 *   Config.withDefault("Info" as LogLevel.LogLevel)
 * )
 *
 * // Valid log levels: "All", "Fatal", "Error", "Warn", "Info", "Debug", "Trace", "None"
 * // Case-insensitive: "debug", "Debug", "DEBUG" are all valid
 * ```
 *
 * @since 4.0.0
 * @category Primitives
 */
export const LogLevel = (name?: string): Config<LogLevel_.LogLevel> =>
  Literal(name, LogLevel_.values, {
    caseInsensitive: true,
    description: "a log level"
  })

/**
 * Creates a config for parsing duration values from strings.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * const program = Effect.gen(function* () {
 *   const timeout = yield* Config.Duration("TIMEOUT")
 *   console.log("Timeout duration:", timeout)
 *   return timeout
 * }).pipe(
 *   Effect.provide(ConfigProvider.layer(
 *     ConfigProvider.fromEnv({ environment: { TIMEOUT: "30 seconds" } })
 *   ))
 * )
 *
 * // Valid duration formats: "10 seconds", "5 minutes", "1 hour", "2 days"
 * // Invalid formats will cause a ConfigError.InvalidData
 * ```
 *
 * @since 4.0.0
 * @category Primitives
 */
export const Duration = (name?: string): Config<Duration_.Duration> =>
  fromFilter({
    name,
    filter: Filter.fromPredicateOption(Duration_.decodeUnknown),
    onAbsent: (value) => `Expected a Duration string, but received: ${value}`
  })

/**
 * Constructs a config that wraps sensitive configuration values in a `Redacted` type.
 *
 * This function creates a configuration that automatically wraps the parsed value in a `Redacted`
 * container to prevent accidental exposure of sensitive data like passwords, API keys, or tokens.
 * The wrapped value is hidden from inspection and logging by default.
 *
 * @param config - The underlying config to wrap (defaults to `Config.String()`)
 * @param options - Optional configuration with a label for the redacted value
 * @param name - The name of the configuration property when using the named overload
 * @returns A config that produces a `Redacted<A>` value when parsed
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Create a redacted string config
 * const apiKey = Config.Redacted("API_KEY")
 *
 * // Use the config to read a secret value
 * const provider = ConfigProvider.fromEnv({ environment: { API_KEY: "secret123" } })
 * const result = Effect.runSync(Effect.provide(apiKey.asEffect(), ConfigProvider.layer(provider)))
 * // result is Redacted<string> - the actual value is hidden
 * ```
 *
 * @example
 * ```ts
 * import { Effect, Redacted } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Create a redacted config without a name
 * const password = Config.Redacted()
 *
 * // Use with ConfigProvider
 * const provider = ConfigProvider.fromEnv({ environment: { "": "mypassword" } })
 * const result = Effect.runSync(Effect.provide(password.asEffect(), ConfigProvider.layer(provider)))
 *
 * // Extract the value when needed (use with caution!)
 * const actualPassword = Redacted.value(result)
 * console.log(actualPassword) // "mypassword"
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Wrap non-string configs like numbers
 * const secretPort = Config.Redacted("SECRET_PORT", Config.Integer())
 *
 * // Use with numeric values
 * const provider = ConfigProvider.fromEnv({ environment: { SECRET_PORT: "8080" } })
 * const result = Effect.runSync(Effect.provide(secretPort.asEffect(), ConfigProvider.layer(provider)))
 * // result is Redacted<number>
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Create a redacted config with a custom label
 * const dbPassword = Config.Redacted("DB_PASSWORD", Config.String(), { label: "database password" })
 *
 * // Use in application configuration
 * const appConfig = Config.all({
 *   host: Config.String("DB_HOST"),
 *   port: Config.Integer("DB_PORT"),
 *   password: Config.Redacted("DB_PASSWORD", Config.String(), { label: "database password" })
 * })
 *
 * const provider = ConfigProvider.fromEnv({
 *   environment: {
 *     DB_HOST: "localhost",
 *     DB_PORT: "5432",
 *     DB_PASSWORD: "supersecret"
 *   }
 * })
 * const result = Effect.runSync(Effect.provide(appConfig.asEffect(), ConfigProvider.layer(provider)))
 * // result.password is Redacted<string> with custom label
 * ```
 *
 * @since 4.0.0
 * @category Primitives
 */
export const Redacted: {
  <A = string>(config?: Config<A> | undefined, options?: {
    readonly label?: string | undefined
  }): Config<Redacted_.Redacted<A>>
  <A = string>(name: string, config?: Config<A> | undefined, options?: {
    readonly label?: string | undefined
  }): Config<Redacted_.Redacted<A>>
} = function<A>(): Config<Redacted_.Redacted<A>> {
  let config: Config<A>
  let name: string | undefined
  let options: { readonly label?: string | undefined } | undefined
  if (typeof arguments[0] === "string") {
    name = arguments[0]
    config = arguments[1] ?? String_() as Config<A>
    options = arguments[2]
  } else {
    config = arguments[0] ?? String_() as Config<A>
    options = arguments[1]
  }
  return primitive(name, (ctx) =>
    Effect.map(
      config.parse(ctx),
      (value) => Redacted_.make(value, options)
    ))
}

/**
 * Applies a brand constructor to a config, creating a config that validates
 * the parsed value against the brand's refinement rules.
 *
 * Brands provide compile-time type safety and runtime validation for primitive types.
 * This function combines config parsing with brand validation, ensuring that
 * configuration values meet specific criteria before being accepted.
 *
 * @param self - The base config to apply the brand to
 * @param constructor - The brand constructor that defines validation rules
 * @returns A new config that produces branded values when validation succeeds
 *
 * @example
 * ```ts
 * import { Brand, Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Define a branded string type for user IDs
 * type UserId = Brand.Branded<string, "UserId">
 * const UserId = Brand.refined<UserId>(
 *   (value) => value.length >= 3 && value.length <= 10,
 *   (value) => Brand.error(`UserId must be 3-10 characters, got: ${value}`)
 * )
 *
 * // Create a config that validates user IDs
 * const userIdConfig = Config.branded(Config.String("USER_ID"), UserId)
 *
 * // Usage with valid input
 * const program = Effect.gen(function*() {
 *   const provider = ConfigProvider.fromEnv({ environment: { USER_ID: "user123" } })
 *   const userId = yield* Effect.provide(userIdConfig.asEffect(), ConfigProvider.layer(provider))
 *   console.log(userId) // "user123" with UserId brand
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Brand, Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Define a branded number type for positive integers
 * type PositiveInt = Brand.Branded<number, "PositiveInt">
 * const PositiveInt = Brand.refined<PositiveInt>(
 *   (value) => Number.isInteger(value) && value > 0,
 *   (value) => Brand.error(`Expected positive integer, got: ${value}`)
 * )
 *
 * // Create a config for positive integers
 * const positiveIntConfig = Config.branded(Config.Number("COUNT"), PositiveInt)
 *
 * // Usage with curried form
 * const curriedConfig = Config.String("SCORE").pipe(
 *   Config.map(Number),
 *   Config.branded(PositiveInt)
 * )
 *
 * const program = Effect.gen(function*() {
 *   const provider = ConfigProvider.fromEnv({ environment: { COUNT: "42", SCORE: "100" } })
 *   const count = yield* Effect.provide(positiveIntConfig.asEffect(), ConfigProvider.layer(provider))
 *   const score = yield* Effect.provide(curriedConfig.asEffect(), ConfigProvider.layer(provider))
 *   console.log(`Count: ${count}, Score: ${score}`)
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Brand, Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Define a branded string type for email addresses
 * type Email = Brand.Branded<string, "Email">
 * const Email = Brand.refined<Email>(
 *   (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
 *   (value) => Brand.error(`Invalid email format: ${value}`)
 * )
 *
 * // Create a config for email addresses
 * const emailConfig = Config.branded(Config.String("EMAIL"), Email)
 *
 * // Usage in a larger config structure
 * const appConfig = Config.all({
 *   adminEmail: emailConfig,
 *   supportEmail: Config.branded(Config.String("SUPPORT_EMAIL"), Email)
 * })
 *
 * const program = Effect.gen(function*() {
 *   const provider = ConfigProvider.fromEnv({
 *     environment: {
 *       EMAIL: "admin@company.com",
 *       SUPPORT_EMAIL: "support@company.com"
 *     }
 *   })
 *   const config = yield* Effect.provide(appConfig.asEffect(), ConfigProvider.layer(provider))
 *   console.log(`Admin: ${config.adminEmail}, Support: ${config.supportEmail}`)
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Brand, Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 *
 * // Define a branded type for port numbers
 * type Port = Brand.Branded<number, "Port">
 * const Port = Brand.refined<Port>(
 *   (value) => Number.isInteger(value) && value >= 1 && value <= 65535,
 *   (value) => Brand.error(`Port must be between 1 and 65535, got: ${value}`)
 * )
 *
 * // Create a config with error handling
 * const portConfig = Config.branded(Config.Number("PORT"), Port)
 *
 * // Handle validation errors
 * const program = Effect.gen(function*() {
 *   const provider = ConfigProvider.fromEnv({ environment: { PORT: "99999" } })
 *   const result = yield* Effect.provide(portConfig.asEffect(), ConfigProvider.layer(provider))
 *     .pipe(Effect.exit)
 *
 *   if (result._tag === "Success") {
 *     console.log(`Valid port: ${result.value}`)
 *   } else {
 *     console.log(`Invalid port: ${result.cause}`)
 *   }
 * })
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const branded: {
  <A, B extends Brand.Branded<A, any>>(constructor: Brand.Brand.Constructor<B>): (self: Config<A>) => Config<B>
  <A, B extends Brand.Branded<A, any>>(self: Config<A>, constructor: Brand.Brand.Constructor<B>): Config<B>
} = dual(
  2,
  <A, B extends Brand.Branded<A, any>>(self: Config<A>, constructor: Brand.Brand.Constructor<B>): Config<B> =>
    map(self, (value, path) => {
      const result = constructor.result(value as any)
      if (result._tag === "Failure") {
        return new InvalidData({
          path,
          description: result.failure.map((e) => e.message).join(", ")
        }).asEffect()
      }
      return result.success
    })
)

const Array_ = <A>(name: string, config: Config<A>, options?: {
  readonly separator?: string | undefined
}): Config<Array<A>> => {
  config = config ?? String_() as Config<A>
  const delimiter = options?.separator ?? ","
  return primitive(
    name,
    Effect.fnUntraced(function*(ctx) {
      const loadCandidates = yield* ctx.load.pipe(
        Effect.map((value) =>
          value.split(delimiter).map((value, i): ConfigProvider.Candidate => ({
            key: i.toString(),
            context: ctx.setPath([...ctx.currentPath, i.toString()]).withValue(value)
          }))
        ),
        Effect.orElseSucceed(Arr.empty)
      )
      const candidates = (yield* ctx.listCandidates).filter(({ key }) => intRegex.test(key))
      const allEntries = [...loadCandidates, ...candidates]
      if (allEntries.length === 0) return []
      return yield* Effect.forEach(allEntries, ({ context }) => config.parse(context))
    })
  )
}
export {
  /**
   * Constructs a config that parses an array of values.
   *
   * @since 4.0.0
   * @category Collections
   */
  Array_ as Array
}

const intRegex = /^[0-9]+$/

/**
 * Constructs a config that parses a record of key-value pairs.
 *
 * @since 4.0.0
 * @category Collections
 */
export const Record = <A>(name: string, config: Config<A>, options?: {
  readonly separator?: string | undefined
  readonly keyValueSeparator?: string | undefined
}): Config<Record<string, A>> => {
  const delimiter = options?.separator ?? ","
  const keyValueSeparator = options?.keyValueSeparator ?? "="
  return primitive(
    name,
    Effect.fnUntraced(function*(ctx) {
      const loadEntries = yield* ctx.load.pipe(
        Effect.map((value) =>
          value.split(delimiter).flatMap((pair): Array<ConfigProvider.Candidate> => {
            const parts = pair.split(keyValueSeparator, 2)
            if (parts.length !== 2) return []
            const key = parts[0].trim()
            const value = parts[1].trim()
            return [{
              key,
              context: ctx.setPath([...ctx.currentPath, key]).withValue(value)
            }]
          })
        ),
        Effect.orElseSucceed(Arr.empty)
      )
      const entries = yield* ctx.listCandidates
      const allEntries = [...loadEntries, ...entries]
      const out: Record<string, A> = {}
      if (allEntries.length === 0) return out
      for (const { context, key } of allEntries) {
        const parsedValue = yield* config.parse(context)
        out[key] = parsedValue
      }
      return out
    })
  )
}

/**
 * Constructs a config that always succeeds with the provided value.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const succeed = <A>(value: A): Config<A> => primitive(constant(Effect.succeed(value)))

/**
 * Constructs a config that succeeds with the result of evaluating the provided
 * function.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const sync = <A>(evaluate: LazyArg<A>): Config<A> => primitive(constant(Effect.sync(evaluate)))

/**
 * Constructs a config from a tuple / struct / arguments of configs.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const all = <const Arg extends Iterable<Config<any>> | Record<string, Config<any>>>(
  arg: Arg
): Config<
  [Arg] extends [ReadonlyArray<Config<any>>] ? {
      -readonly [K in keyof Arg]: [Arg[K]] extends [Config<infer A>] ? A : never
    }
    : [Arg] extends [Iterable<Config<infer A>>] ? Array<A>
    : [Arg] extends [Record<string, Config<any>>] ? {
        -readonly [K in keyof Arg]: [Arg[K]] extends [Config<infer A>] ? A : never
      }
    : never
> => {
  if (Symbol.iterator in arg) {
    return tuple(...arg as any) as any
  }
  const keys = Arr.empty<string>()
  const configs = Arr.empty<Config<any>>()
  for (const key of Object.keys(arg)) {
    keys.push(key)
    configs.push(arg[key] as any)
  }
  return map(tuple(...configs), (values) => {
    const result: Record<string, any> = {}
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = values[i]
    }
    return result
  }) as any
}

const tuple = <A>(...configs: ReadonlyArray<Config<A>>): Config<Array<A>> =>
  primitive(Effect.fnUntraced(function*(ctx) {
    const values = new Array<A>(configs.length)
    const failures: Array<Cause.Failure<ConfigError>> = []
    for (let i = 0; i < configs.length; i++) {
      const result = yield* Effect.exit(configs[i].parse(ctx))
      if (Exit.isSuccess(result)) {
        values[i] = result.value
      } else {
        // eslint-disable-next-line no-restricted-syntax
        failures.push(...result.cause.failures)
      }
    }
    if (failures.length > 0) {
      return yield* Effect.failCause(Cause.fromFailures(failures))
    }
    return values
  }))

/**
 * @since 4.0.0
 * @category Combinators
 */
export const nested: {
  (name: string): <A>(self: Config<A>) => Config<A>
  <A>(self: Config<A>, name: string): Config<A>
} = dual(2, <A>(self: Config<A>, name: string): Config<A> => primitive(name, self.parse))

/**
 * @since 4.0.0
 * @category Combinators
 */
export const map: {
  <A, B>(
    f: (a: NoInfer<A>, path: ReadonlyArray<string>) => B | Effect.Effect<B, ConfigError>
  ): (self: Config<A>) => Config<B>
  <A, B>(
    self: Config<A>,
    f: (a: NoInfer<A>, path: ReadonlyArray<string>) => B | Effect.Effect<B, ConfigError>
  ): Config<B>
} = dual(
  2,
  <A, B>(
    self: Config<A>,
    f: (a: NoInfer<A>, path: ReadonlyArray<string>) => B | Effect.Effect<B, ConfigError>
  ): Config<B> => primitive((ctx) => Effect.andThen(self.parse(ctx), (v) => f(v, ctx.lastChildPath)) as any)
)

/**
 * @since 4.0.0
 * @category Filters
 */
export const filter: {
  <A, B>(options: {
    readonly filter: Filter.Filter<NoInfer<A>, B> | Filter.FilterEffect<NoInfer<A>, B, ConfigError>
    readonly onAbsent: (value: NoInfer<A>) => string
  }): (self: Config<A>) => Config<B>
  <A, B>(self: Config<A>, options: {
    readonly filter: Filter.Filter<NoInfer<A>, B> | Filter.FilterEffect<NoInfer<A>, B, ConfigError>
    readonly onAbsent: (value: NoInfer<A>) => string
  }): Config<B>
} = dual(
  2,
  <A, B>(self: Config<A>, options: {
    readonly filter: Filter.Filter<NoInfer<A>, B> | Filter.FilterEffect<NoInfer<A>, B, ConfigError>
    readonly onAbsent: (value: NoInfer<A>) => string
  }): Config<B> =>
    primitive((ctx) =>
      Effect.flatMap(self.parse(ctx), (value) => {
        const result = options.filter(value)
        const effect = Effect.isEffect(result) ? result : Effect.succeed(result)
        return Effect.flatMap(effect, (result) =>
          result === Filter.absent ?
            Effect.fail(
              new InvalidData({
                path: ctx.lastChildPath,
                description: options.onAbsent(value)
              })
            ) :
            Effect.succeed(result))
      })
    )
)

/**
 * Trims whitespace from the parsed string value.
 *
 * @since 4.0.0
 * @category Filters
 */
export const trimmed = (self: Config<string>): Config<string> => map(self, Str.trim)

/**
 * Ensures that the parsed value is not empty.
 *
 * @since 4.0.0
 * @category Filters
 */
export const nonEmpty = <A extends { readonly length: number } | { readonly size: number } | Record<string, any>>(
  self: Config<A>
): Config<A> =>
  primitive((ctx) =>
    Effect.flatMap(self.parse(ctx), (value: any) => {
      const nonEmpty = typeof value.length === "number" && value.length > 0 ||
        typeof value.size === "number" && value.size > 0 ||
        Object.keys(value).length > 0
      return nonEmpty ? Effect.succeed(value) : Effect.fail(
        new MissingData({
          path: ctx.lastChildPath,
          fullPath: ctx.provider.formatPath(ctx.lastChildPath)
        })
      )
    })
  )

/**
 * @since 4.0.0
 * @category Fallbacks
 */
export const orElseIf: {
  <E, B>(options: {
    readonly filter: Filter.Filter<ConfigError, E>
    readonly orElse: (e: E) => Config<B>
  }): <A>(self: Config<A>) => Config<A | B>
  <A, E, B>(self: Config<A>, options: {
    readonly filter: Filter.Filter<ConfigError, E>
    readonly orElse: (e: E) => Config<B>
  }): Config<A | B>
} = dual(2, <A, E, B>(self: Config<A>, options: {
  readonly filter: Filter.Filter<ConfigError, E>
  readonly orElse: (e: E) => Config<B>
}): Config<A | B> =>
  primitive((ctx) =>
    Effect.catchIf(
      self.parse(ctx),
      options.filter,
      (e) => options.orElse(e).parse(ctx)
    )
  ))

/**
 * @since 4.0.0
 * @category Fallbacks
 */
export const orElse: {
  <B>(orElse: (e: ConfigError) => Config<B>): <A>(self: Config<A>) => Config<A | B>
  <A, B>(self: Config<A>, orElse: (e: ConfigError) => Config<B>): Config<A | B>
} = dual(
  2,
  <A, B>(self: Config<A>, orElse: (e: ConfigError) => Config<B>): Config<A | B> =>
    primitive((ctx) =>
      Effect.catch(
        self.parse(ctx),
        (e) =>
          orElse(e).parse(ctx).pipe(
            Effect.catchCause((cause) =>
              Effect.failCause(Cause.merge(
                Cause.fail(e),
                cause
              ))
            )
          )
      )
    )
)

/**
 * @since 4.0.0
 * @category Fallbacks
 */
export const withDefault: {
  <const B>(defaultValue: B): <A>(self: Config<A>) => Config<A | B>
  <A, const B>(self: Config<A>, defaultValue: B): Config<A | B>
} = dual(
  2,
  <A, const B>(self: Config<A>, defaultValue: B): Config<A | B> =>
    primitive((ctx) =>
      Effect.catchCauseIf(
        self.parse(ctx),
        filterMissingDataOnly,
        () => Effect.succeed(defaultValue)
      )
    )
)

/**
 * @since 4.0.0
 * @category Fallbacks
 */
export const option = <A>(self: Config<A>): Config<Option.Option<A>> =>
  primitive((ctx) =>
    Effect.catchCauseIf(
      Effect.asSome(self.parse(ctx)),
      filterMissingDataOnly,
      () => Effect.succeedNone
    )
  )

/**
 * @since 4.0.0
 * @category Fallbacks
 */
export const orUndefined: <A>(self: Config<A>) => Config<A | undefined> = withDefault(undefined)

/**
 * Wraps a nested structure, converting all primitives to a `Config`.
 *
 * `Config.Wrap<{ key: string }>` becomes `{ key: Config<string> }`
 *
 * To create the resulting config, use the `unwrap` constructor.
 *
 * @since 4.0.0
 * @category Wrap
 */
export type Wrap<A> = [NonNullable<A>] extends [infer T] ? [IsPlainObject<T>] extends [true] ?
      | { readonly [K in keyof A]: Wrap<A[K]> }
      | Config<A>
  : Config<A>
  : Config<A>

type IsPlainObject<A> = [A] extends [Record<string, any>]
  ? [keyof A] extends [never] ? false : [keyof A] extends [string] ? true : false
  : false

/**
 * Constructs a config from some configuration wrapped with the `Wrap<A>` utility type.
 *
 * For example:
 *
 * ```
 * import { Config, unwrap } from "./Config"
 *
 * interface Options { key: string }
 *
 * const makeConfig = (config: Config.Wrap<Options>): Config<Options> => unwrap(config)
 * ```
 *
 * @since 4.0.0
 * @category Wrap
 */
export const unwrap = <A>(wrapped: Wrap<A>): Config<A> => {
  if (isConfig(wrapped)) {
    return wrapped
  }
  return all(Object.fromEntries(
    Object.entries(wrapped)
      .map(([k, a]) => [k, unwrap(a as any)])
  )) as any
}
