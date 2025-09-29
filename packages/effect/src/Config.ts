/**
 * @since 4.0.0
 */
import type { Path, SourceError } from "./ConfigProvider.ts"
import * as ConfigProvider from "./ConfigProvider.ts"
import * as Option from "./data/Option.ts"
import * as Predicate from "./data/Predicate.ts"
import * as Rec from "./data/Record.ts"
import * as Duration_ from "./Duration.ts"
import * as Effect from "./Effect.ts"
import { dual, type LazyArg } from "./Function.ts"
import type { Pipeable } from "./interfaces/Pipeable.ts"
import { PipeInspectableProto, YieldableProto } from "./internal/core.ts"
import * as LogLevel_ from "./LogLevel.ts"
import * as AST from "./schema/AST.ts"
import * as Check from "./schema/Check.ts"
import * as Getter from "./schema/Getter.ts"
import * as Issue from "./schema/Issue.ts"
import * as Schema from "./schema/Schema.ts"
import * as Serializer from "./schema/Serializer.ts"
import * as ToParser from "./schema/ToParser.ts"
import * as Transformation from "./schema/Transformation.ts"

const TypeId = "~effect/Config"

/**
 * A type guard that checks if a value is a Config instance.
 *
 * This function is useful for runtime type checking to determine if an unknown value
 * is a Config before calling Config-specific methods or properties.
 *
 * @since 4.0.0
 * @category Guards
 */
export const isConfig = (u: unknown): u is Config<unknown> => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category Models
 */
export class ConfigError {
  readonly _tag = "ConfigError"
  readonly name: string = "ConfigError"
  readonly cause: SourceError | Schema.SchemaError
  constructor(cause: SourceError | Schema.SchemaError) {
    this.cause = cause
  }
  get message() {
    return this.cause.toString()
  }
  toString() {
    return `ConfigError(${this.message})`
  }
}

/**
 * @since 4.0.0
 */
export interface Config<out T> extends Pipeable, Effect.Yieldable<Config<T>, T, ConfigError> {
  readonly [TypeId]: typeof TypeId
  readonly parse: (provider: ConfigProvider.ConfigProvider) => Effect.Effect<T, ConfigError>
}

const Proto = {
  ...PipeInspectableProto,
  ...YieldableProto,
  [TypeId]: TypeId,
  asEffect(this: Config<unknown>) {
    return Effect.flatMap(ConfigProvider.ConfigProvider.asEffect(), (provider) => this.parse(provider))
  },
  toJSON(this: Config<unknown>) {
    return {
      _id: "Config"
    }
  }
}

/**
 * Constructs a low-level Config from a parsing function.
 *
 * This is the primitive constructor used internally by other Config constructors
 * to create custom configuration parsers. It provides direct access to the
 * configuration provider and allows for fine-grained control over parsing behavior.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function make<T>(
  parse: (provider: ConfigProvider.ConfigProvider) => Effect.Effect<T, ConfigError>
): Config<T> {
  const self = Object.create(Proto)
  self.parse = parse
  return self
}

/**
 * Returns a config that maps the value of this config to a new value.
 *
 * @see {@link mapOrFail} for a version that may fail.
 *
 * @category Mapping
 * @since 4.0.0
 */
export const map: {
  <A, B>(f: (a: A) => B): (self: Config<A>) => Config<B>
  <A, B>(self: Config<A>, f: (a: A) => B): Config<B>
} = dual(2, <A, B>(self: Config<A>, f: (a: A) => B): Config<B> => {
  return make((provider) => Effect.map(self.parse(provider), f))
})

/**
 * Returns a config that maps the value of this config to a new value, possibly
 * failing.
 *
 * @see {@link map} for a version that does not fail.
 *
 * @category Mapping
 * @since 4.0.0
 */
export const mapOrFail: {
  <A, B>(f: (a: A) => Effect.Effect<B, ConfigError>): (self: Config<A>) => Config<B>
  <A, B>(self: Config<A>, f: (a: A) => Effect.Effect<B, ConfigError>): Config<B>
} = dual(2, <A, B>(self: Config<A>, f: (a: A) => Effect.Effect<B, ConfigError>): Config<B> => {
  return make((provider) => Effect.flatMap(self.parse(provider), f))
})

/**
 * Returns a config that falls back to the specified config if there is an error
 * reading from this config.
 *
 * @since 4.0.0
 */
export const orElse: {
  <A2>(that: (error: ConfigError) => Config<A2>): <A>(self: Config<A>) => Config<A2 | A>
  <A, A2>(self: Config<A>, that: (error: ConfigError) => Config<A2>): Config<A | A2>
} = dual(2, <A, A2>(self: Config<A>, that: (error: ConfigError) => Config<A2>): Config<A | A2> => {
  return make((provider) => Effect.catch(self.parse(provider), (error) => that(error).parse(provider)))
})

/**
 * Constructs a config from a tuple / iterable/ struct of configs.
 *
 * @since 4.0.0
 */
export function all<const Arg extends Iterable<Config<any>> | Record<string, Config<any>>>(
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
> {
  const configs: Array<Config<any>> | Record<string, Config<any>> = Array.isArray(arg)
    ? arg
    : Symbol.iterator in arg
    ? [...arg as any]
    : arg
  if (Array.isArray(configs)) {
    return make((provider) => Effect.all(configs.map((config) => config.parse(provider)))) as any
  } else {
    return make((provider) => Effect.all(Rec.map(configs, (config) => config.parse(provider)))) as any
  }
}

function isMissingDataOnly(issue: Issue.Issue): boolean {
  switch (issue._tag) {
    case "MissingKey":
      return true
    case "InvalidType":
      return Option.isSome(issue.actual) && issue.actual.value === undefined
    case "InvalidValue":
    case "OneOf":
      return issue.actual === undefined
    case "Encoding":
    case "Pointer":
    case "Filter":
      return isMissingDataOnly(issue.issue)
    case "UnexpectedKey":
      return false
    case "Forbidden":
      return false
    case "Composite":
    case "AnyOf":
      return issue.issues.every(isMissingDataOnly)
  }
}

/**
 * Provides a default value for a configuration when it fails to load due to
 * missing data.
 *
 * This function is useful for providing fallback values when configuration
 * sources are incomplete or missing. It only applies the default when the
 * configuration error is specifically a `SchemaError` caused by missing data -
 * other types of errors will still fail.
 *
 * @since 4.0.0
 */
export const withDefault: {
  <const A2>(defaultValue: LazyArg<A2>): <A>(self: Config<A>) => Config<A2 | A>
  <A, const A2>(self: Config<A>, defaultValue: LazyArg<A2>): Config<A | A2>
} = dual(2, <A, const A2>(self: Config<A>, defaultValue: LazyArg<A2>): Config<A | A2> => {
  return orElse(self, (err) => {
    if (err.cause instanceof Schema.SchemaError) {
      const issue = err.cause.issue
      if (isMissingDataOnly(issue)) {
        return succeed(defaultValue())
      }
    }
    return fail(err.cause)
  })
})

/**
 * Converts a configuration to an optional configuration that handles missing
 * data gracefully.
 *
 * When the configuration fails due to missing data, it returns `None`. When
 * successful, the value is wrapped in `Some`. Note that other types of errors
 * (validation, parsing, etc.) will still cause the configuration to fail.
 *
 * @since 4.0.0
 */
export const option = <A>(self: Config<A>): Config<Option.Option<A>> =>
  self.pipe(map(Option.some), withDefault(() => Option.none()))

/**
 * Wraps a nested structure, converting all primitives to a `Config`.
 *
 * `Config.Wrap<{ key: string }>` becomes `{ key: Config<string> }`
 *
 * To create the resulting config, use the `unwrap` constructor.
 *
 * @category Wrap
 * @since 4.0.0
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
 * **Example**
 *
 * ```ts
 * import { Config } from "effect"
 *
 * interface Options {
 *   key: string
 * }
 *
 * const makeConfig = (config: Config.Wrap<Options>): Config.Config<Options> =>
 *   Config.unwrap(config)
 * ```
 *
 * @category Wrap
 * @since 4.0.0
 */
export const unwrap = <T>(wrapped: Wrap<T>): Config<T> => {
  if (isConfig(wrapped)) return wrapped
  return make((provider) => {
    const entries = Object.entries(wrapped)
    const configs = entries.map(([key, config]) =>
      unwrap(config as any).parse(provider).pipe(Effect.map((value) => [key, value] as const))
    )
    return Effect.all(configs).pipe(Effect.map(Object.fromEntries))
  })
}

// -----------------------------------------------------------------------------
// schema
// -----------------------------------------------------------------------------

const dump: (
  provider: ConfigProvider.ConfigProvider,
  path: Path
) => Effect.Effect<Serializer.StringPojo, SourceError> = Effect.fnUntraced(function*(
  provider,
  path
) {
  const stat = yield* provider.load(path)
  if (stat === undefined) return undefined
  switch (stat._tag) {
    case "leaf":
      return stat.value
    case "object": {
      // If the object has no children but has a co-located value, surface that value.
      if (stat.keys.size === 0 && stat.value !== undefined) return stat.value
      const out: Record<string, Serializer.StringPojo> = {}
      for (const key of stat.keys) {
        const child = yield* dump(provider, [...path, key])
        if (child !== undefined) out[key] = child
      }
      return out
    }
    case "array": {
      // If the array has no children but has a co-located value, surface that value.
      if (stat.length === 0 && stat.value !== undefined) return stat.value
      const out: Array<Serializer.StringPojo> = []
      for (let i = 0; i < stat.length; i++) {
        const child = yield* dump(provider, [...path, i])
        if (child !== undefined) out.push(child)
      }
      return out
    }
  }
})

const go: (
  ast: AST.AST,
  provider: ConfigProvider.ConfigProvider,
  path: Path
) => Effect.Effect<Serializer.StringPojo, Schema.SchemaError | SourceError> = Effect.fnUntraced(
  function*(ast, provider, path) {
    switch (ast._tag) {
      case "TypeLiteral": {
        const out: Record<string, Serializer.StringPojo> = {}
        for (const ps of ast.propertySignatures) {
          const name = ps.name
          if (Predicate.isString(name)) {
            const value = yield* go(ps.type, provider, [...path, name])
            if (value !== undefined) out[name] = value
          }
        }
        if (ast.indexSignatures.length > 0) {
          const stat = yield* provider.load(path)
          if (stat && stat._tag === "object") {
            for (const is of ast.indexSignatures) {
              const matches = ToParser.refinement(is.parameter)
              for (const key of stat.keys) {
                if (!Object.prototype.hasOwnProperty.call(out, key) && matches(key)) {
                  const value = yield* go(is.type, provider, [...path, key])
                  if (value !== undefined) out[key] = value
                }
              }
            }
          }
        }
        return out
      }
      case "TupleType": {
        if (ast.rest.length > 0) {
          const out = yield* dump(provider, path)
          if (Predicate.isString(out)) return out
          return out
        }
        const stat = yield* provider.load(path)
        if (stat && stat._tag === "leaf") return stat.value
        const out: Array<Serializer.StringPojo> = []
        for (let i = 0; i < ast.elements.length; i++) {
          const value = yield* go(ast.elements[i], provider, [...path, i])
          if (value !== undefined) out.push(value)
        }
        return out
      }
      case "UnionType":
        // Let downstream decoding decide; dump can return a string, object, or array.
        return yield* dump(provider, path)
      case "Suspend":
        return yield* go(ast.thunk(), provider, path)
      default: {
        // Base primitives / string-like encoded nodes.
        const stat = yield* provider.load(path)
        if (stat === undefined) return undefined
        if (stat._tag === "leaf") return stat.value
        if (stat._tag === "object" && stat.value !== undefined) return stat.value
        if (stat._tag === "array" && stat.value !== undefined) return stat.value
        // Container without a co-located value cannot satisfy a scalar request.
        return undefined
      }
    }
  }
)

/**
 * @category Schema
 * @since 4.0.0
 */
export function schema<T, E>(codec: Schema.Codec<T, E>, path?: string | ConfigProvider.Path): Config<T> {
  const serializer = Serializer.ensureArray(Serializer.stringPojo(codec))
  const decodeUnknownEffect = ToParser.decodeUnknownEffect(serializer)
  const serializerEncodedAST = AST.encodedAST(serializer.ast)
  const defaultPath = Predicate.isString(path) ? [path] : path ?? []
  return make((provider) =>
    go(serializerEncodedAST, provider, defaultPath).pipe(
      Effect.mapErrorEager((cause) => new ConfigError(cause)),
      Effect.flatMapEager((stringPojo) =>
        decodeUnknownEffect(stringPojo).pipe(Effect.mapErrorEager((issue) =>
          new ConfigError(
            new Schema.SchemaError(defaultPath.length > 0 ? new Issue.Pointer(defaultPath, issue) : issue)
          )
        ))
      )
    )
  )
}

/**
 * A schema for strings that can be parsed as boolean values.
 *
 * Booleans can be encoded as `true`, `false`, `yes`, `no`, `on`, `off`, `1`, or `0`.
 *
 * @category Schema
 * @since 4.0.0
 */
export const Boolean = Schema.Literals(["true", "yes", "on", "1", "false", "no", "off", "0"]).pipe(
  Schema.decodeTo(
    Schema.Boolean,
    Transformation.transform({
      decode: (value) => value === "true" || value === "yes" || value === "on" || value === "1",
      encode: (value) => value ? "true" : "false"
    })
  )
)

/**
 * A schema for strings that can be parsed as duration values.
 *
 * Durations can be encoded as `DurationInput` values.
 *
 * @category Schema
 * @since 4.0.0
 */
export const Duration = Schema.String.annotate({
  description: "a string that will be parsed as a Duration"
}).pipe(Schema.decodeTo(Schema.Duration, {
  decode: Getter.transformOrFail((s) => {
    const d = Duration_.fromDurationInput(s as any)
    return d ? Effect.succeed(d) : Effect.fail(new Issue.InvalidValue(Option.some(s)))
  }),
  encode: Getter.forbidden(() => "Encoding Duration is not supported")
}))

/**
 * A schema for strings that can be parsed as port values.
 *
 * Ports can be encoded as integers between 1 and 65535.
 *
 * @category Schema
 * @since 4.0.0
 */
export const Port = Schema.Int.check(Check.between(1, 65535))

/**
 * A schema for strings that can be parsed as log level values.
 *
 * Log levels can be encoded as the string values of the `LogLevel` enum:
 *
 * - `"All"`
 * - `"Fatal"`
 * - `"Error"`
 * - `"Warn"`
 * - `"Info"`
 * - `"Debug"`
 * - `"Trace"`
 * - `"None"`
 *
 * @category Schema
 * @since 4.0.0
 */
export const LogLevel = Schema.Literals(LogLevel_.values)

/**
 * A schema for records of key-value pairs.
 *
 * Records can be encoded as strings of key-value pairs separated by commas.
 *
 * **Example**
 *
 * ```ts
 * import { Config, ConfigProvider, Effect } from "effect"
 * import { Schema } from "effect/schema"
 *
 * const schema = Config.Record(Schema.String, Schema.String)
 * const config = Config.schema(schema, "OTEL_RESOURCE_ATTRIBUTES")
 *
 * const provider = ConfigProvider.fromEnv({
 *   env: {
 *     OTEL_RESOURCE_ATTRIBUTES:
 *       "service.name=my-service,service.version=1.0.0,custom.attribute=value"
 *   }
 * })
 *
 * console.dir(Effect.runSync(config.parse(provider)))
 * // {
 * //   'service.name': 'my-service',
 * //   'service.version': '1.0.0',
 * //   'custom.attribute': 'value'
 * // }
 * ```
 *
 * @category Schemas
 * @since 4.0.0
 */
export const Record = <K extends Schema.Record.Key, V extends Schema.Top>(key: K, value: V, options?: {
  readonly separator?: string | undefined
  readonly keyValueSeparator?: string | undefined
}) => {
  const record = Schema.Record(key, value)
  const recordString = Schema.String.annotate({
    description: "a string that will be parsed as a record of key-value pairs"
  }).pipe(
    Schema.decodeTo(
      Schema.Record(Schema.String, Schema.String),
      Transformation.splitKeyValue(options)
    ),
    Schema.decodeTo(record)
  )

  return Schema.Union([record, recordString])
}

// -----------------------------------------------------------------------------
// constructors
// -----------------------------------------------------------------------------

/**
 * Creates a configuration that always fails with a given issue.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function fail(err: SourceError | Schema.SchemaError) {
  return make(() => Effect.fail(new ConfigError(err)))
}

/**
 * Creates a configuration that always succeeds with a given value.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function succeed<T>(value: T) {
  return make(() => Effect.succeed(value))
}

/**
 * Creates a configuration for string values.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function string(name?: string) {
  return schema(Schema.String, name)
}

/**
 * Creates a configuration for non-empty string values.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function nonEmptyString(name?: string) {
  return schema(Schema.NonEmptyString, name)
}

/**
 * Creates a configuration for number values.
 *
 * @see {@link finite} for a configuration that is guaranteed to be a finite number.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function number(name?: string) {
  return schema(Schema.Number, name)
}

/**
 * Creates a configuration for finite number values.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function finite(name?: string) {
  return schema(Schema.Finite, name)
}

/**
 * Creates a configuration for integer values.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function int(name?: string) {
  return schema(Schema.Int, name)
}

/**
 * Creates a configuration for literal values.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function literal<L extends AST.Literal>(literal: L, name?: string) {
  return schema(Schema.Literal(literal), name)
}

/**
 * Creates a configuration for boolean values.
 *
 * Booleans can be encoded as `true`, `false`, `yes`, `no`, `on`, `off`, `1`, or `0`.
 *
 * **Example**
 *
 * ```ts
 * import { Config, ConfigProvider, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const flag = yield* Config.boolean("FEATURE_FLAG")
 *   console.log(flag)
 * })
 *
 * const provider = ConfigProvider.fromEnv({
 *   env: {
 *     FEATURE_FLAG: "yes"
 *   }
 * })
 *
 * Effect.runSync(
 *   program.pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider))
 * )
 * // Output: true
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export function boolean(name?: string) {
  return schema(Boolean, name)
}

/**
 * Creates a configuration for duration values.
 *
 * Durations can be encoded as `DurationInput` values.
 *
 * **Example**
 *
 * ```ts
 * import { Config, ConfigProvider, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const duration = yield* Config.duration("DURATION")
 *   console.log(duration)
 * })
 *
 * const provider = ConfigProvider.fromEnv({
 *   env: {
 *     DURATION: "10 seconds"
 *   }
 * })
 *
 * Effect.runSync(
 *   program.pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider))
 * )
 * // Output: Duration { _tag: "millis", value: 10000 }
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export function duration(name?: string) {
  return schema(Duration, name)
}

/**
 * Creates a configuration for port values.
 *
 * Ports can be encoded as integers between 1 and 65535.
 *
 * **Example**
 *
 * ```ts
 * import { Config, ConfigProvider, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const port = yield* Config.port("PORT")
 *   console.log(port)
 * })
 *
 * const provider = ConfigProvider.fromEnv({
 *   env: {
 *     PORT: "8080"
 *   }
 * })
 *
 * Effect.runSync(
 *   program.pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider))
 * )
 * // Output: 8080
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export function port(name?: string) {
  return schema(Port, name)
}

/**
 * Creates a configuration for log level values.
 *
 * Log levels can be encoded as the string values of the `LogLevel` enum:
 *
 * - `"All"`
 * - `"Fatal"`
 * - `"Error"`
 * - `"Warn"`
 * - `"Info"`
 * - `"Debug"`
 * - `"Trace"`
 * - `"None"`
 *
 * **Example**
 *
 * ```ts
 * import { Config, ConfigProvider, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const logLevel = yield* Config.logLevel("LOG_LEVEL")
 *   console.log(logLevel)
 * })
 *
 * const provider = ConfigProvider.fromEnv({
 *   env: {
 *     LOG_LEVEL: "Info"
 *   }
 * })
 *
 * Effect.runSync(
 *   program.pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider))
 * )
 * // Output: "Info"
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export function logLevel(name?: string) {
  return schema(LogLevel, name)
}

/**
 * Creates a configuration for redacted string values.
 *
 * **Example**
 *
 * ```ts
 * import { Config, ConfigProvider, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const apiKey = yield* Config.redacted("API_KEY")
 *   console.log(apiKey)
 * })
 *
 * const provider = ConfigProvider.fromEnv({
 *   env: {
 *     API_KEY: "sk-1234567890abcdef"
 *   }
 * })
 *
 * Effect.runSync(
 *   program.pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider))
 * )
 * // Output: <redacted>
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export function redacted(name?: string) {
  return schema(Schema.Redacted(Schema.String), name)
}

/**
 * Creates a configuration for URL values.
 *
 * URLs can be encoded as strings that can be parsed by the `URL` constructor.
 *
 * **Example**
 *
 * ```ts
 * import { Config, ConfigProvider, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const url = yield* Config.url("URL")
 *   console.log(url)
 * })
 *
 * const provider = ConfigProvider.fromEnv({
 *   env: {
 *     URL: "https://example.com"
 *   }
 * })
 *
 * Effect.runSync(
 *   program.pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider))
 * )
 * // Output:
 * // URL {
 * //   href: 'https://example.com/',
 * //   origin: 'https://example.com',
 * //   protocol: 'https:',
 * //   username: '',
 * //   password: '',
 * //   host: 'example.com',
 * //   hostname: 'example.com',
 * //   port: '',
 * //   pathname: '/',
 * //   search: '',
 * //   searchParams: URLSearchParams {},
 * //   hash: ''
 * // }
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export function url(name?: string) {
  return schema(Schema.URL, name)
}

/**
 * Creates a configuration for date values.
 *
 * Dates can be encoded as strings that can be parsed by the `Date` constructor.
 * Invalid dates will fail with a `SchemaError`.
 *
 * @category Constructors
 * @since 4.0.0
 */
export function date(name?: string) {
  return schema(Schema.ValidDate, name)
}
