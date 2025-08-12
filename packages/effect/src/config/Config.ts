/**
 * @since 4.0.0
 */
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Effect from "../Effect.ts"
import { dual } from "../Function.ts"
import type { Pipeable } from "../interfaces/Pipeable.ts"
import { PipeInspectableProto, YieldableProto } from "../internal/core.ts"
import * as LogLevel_ from "../logging/LogLevel.ts"
import * as AST from "../schema/AST.ts"
import * as Check from "../schema/Check.ts"
import * as Getter from "../schema/Getter.ts"
import * as Issue from "../schema/Issue.ts"
import * as Schema from "../schema/Schema.ts"
import * as Serializer from "../schema/Serializer.ts"
import * as ToParser from "../schema/ToParser.ts"
import * as Transformation from "../schema/Transformation.ts"
import * as Duration_ from "../time/Duration.ts"
import type { Path, SourceError } from "./ConfigProvider.ts"
import * as ConfigProvider from "./ConfigProvider.ts"

/**
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/config/Config"

/**
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
 * @since 4.0.0
 * @category Guards
 */
export const isConfig = (u: unknown): u is Config<unknown> => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category Models
 */
export type ConfigError = SourceError | Schema.SchemaError

/**
 * @since 4.0.0
 */
export interface Config<out T> extends Pipeable, Effect.Yieldable<Config<T>, T, ConfigError> {
  readonly [TypeId]: TypeId
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
 * import { Config } from "effect/config"
 *
 * interface Options { key: string }
 *
 * const makeConfig = (config: Config.Wrap<Options>): Config.Config<Options> => Config.unwrap(config)
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
) => Effect.Effect<Serializer.StringLeafJson, SourceError> = Effect.fnUntraced(function*(
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
      const out: Record<string, Serializer.StringLeafJson> = {}
      for (const key of stat.keys) {
        const child = yield* dump(provider, [...path, key])
        if (child !== undefined) out[key] = child
      }
      return out
    }
    case "array": {
      // If the array has no children but has a co-located value, surface that value.
      if (stat.length === 0 && stat.value !== undefined) return stat.value
      const out: Array<Serializer.StringLeafJson> = []
      for (let i = 0; i < stat.length; i++) {
        const child = yield* dump(provider, [...path, i])
        if (child !== undefined) out.push(child)
      }
      return out
    }
  }
})

function ensureArray(value: string): Array<string> {
  return value === "" ? [] : [value]
}

const go: (
  ast: AST.AST,
  provider: ConfigProvider.ConfigProvider,
  path: Path
) => Effect.Effect<Serializer.StringLeafJson, Schema.SchemaError | SourceError> = Effect.fnUntraced(
  function*(ast, provider, path) {
    switch (ast._tag) {
      case "TypeLiteral": {
        const out: Record<string, Serializer.StringLeafJson> = {}
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
          if (Predicate.isString(out)) return ensureArray(out)
          return out
        }
        const stat = yield* provider.load(path)
        if (stat && stat._tag === "leaf") return ensureArray(stat.value)
        const out: Array<Serializer.StringLeafJson> = []
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
  const serializer = Serializer.stringLeafJson(codec)
  const decodeUnknownEffect = Schema.decodeUnknownEffect(serializer)
  const serializerEncodedAST = AST.encodedAST(serializer.ast)
  const defaultPath = Predicate.isString(path) ? [path] : path ?? []
  return make((provider) => go(serializerEncodedAST, provider, defaultPath).pipe(Effect.flatMap(decodeUnknownEffect)))
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
export const Duration = Schema.String.pipe(Schema.decodeTo(Schema.Duration, {
  decode: Getter.mapOrFail((value) => {
    const od = Duration_.decodeUnknown(value)
    if (Option.isSome(od)) {
      return Effect.succeed(od.value)
    }
    return Effect.fail(new Issue.InvalidValue(Option.some(value)))
  }),
  encode: Getter.forbidden("Encoding Duration is not supported")
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
 * import { Effect } from "effect"
 * import { Config, ConfigProvider } from "effect/config"
 * import { Schema } from "effect/schema"
 *
 * const schema = Config.Record(Schema.String, Schema.String)
 * const config = Config.schema(schema, "OTEL_RESOURCE_ATTRIBUTES")
 *
 * const provider = ConfigProvider.fromEnv({
 *   env: {
 *     OTEL_RESOURCE_ATTRIBUTES: "service.name=my-service,service.version=1.0.0,custom.attribute=value"
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
export const Record = <K extends Schema.Record.Key, V extends Schema.Top>(key: K, value: V) => {
  const record = Schema.Record(key, value)
  const recordString = RecordFromKeyValue.pipe(
    Schema.decodeTo(record)
  )
  return Schema.Union([record, recordString])
}

const RecordFromKeyValue = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Record(Schema.String, Schema.String),
    Transformation.splitKeyValue()
  )
)
