/*
 * @since 4.0.0
 */
import * as Arr from "../Array.js"
import * as Cause from "../Cause.js"
import * as DateTime_ from "../DateTime.js"
import * as Duration_ from "../Duration.js"
import * as Effect from "../Effect.js"
import * as Exit from "../Exit.js"
import * as Filter from "../Filter.js"
import { constant, dual } from "../Function.js"
import { PipeInspectableProto, YieldableProto } from "../internal/core.js"
import * as LogLevel_ from "../LogLevel.js"
import * as Option from "../Option.js"
import type { Pipeable } from "../Pipeable.js"
import { hasProperty } from "../Predicate.js"
import type { NoInfer } from "../Types.js"
import { type ConfigError, filterMissingData, InvalidData } from "./ConfigError.js"
import { type ConfigProvider, CurrentConfigProvider } from "./ConfigProvider.js"

/**
 * @since 4.0.0
 * @category TypeId
 */
export const TypeId: TypeId = "~effect/config/Config"

/**
 * @since 4.0.0
 * @category TypeId
 */
export type TypeId = "~effect/config/Config"

/**
 * @since 4.0.0
 * @category Guards
 */
export const isConfig = (u: unknown): u is Config<unknown> => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category Models
 */
export interface Config<out A> extends Pipeable, Effect.Yieldable<A, ConfigError> {
  readonly [TypeId]: TypeId
  readonly parse: (provider: ConfigProvider) => Effect.Effect<A, ConfigError>
  [Symbol.iterator](): Effect.EffectIterator<Config<A>>
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const primitive = <A>(
  parse: (provider: ConfigProvider) => Effect.Effect<A, ConfigError>,
  name?: string | undefined
): Config<A> => {
  const self = Object.create(Proto)
  self.parse = name
    ? (provider: ConfigProvider) => parse(provider.append(name!))
    : parse
  return self
}

/**
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
  primitive((provider) =>
    Effect.flatMap(provider.load, (value) => {
      const result = options.filter(value)
      return result === Filter.absent ?
        Effect.fail(
          new InvalidData({
            path: provider.currentPath,
            description: options.onAbsent(value)
          })
        ) :
        Effect.succeed(result)
    }), options.name)

const Proto = {
  ...PipeInspectableProto,
  ...YieldableProto,
  [TypeId]: TypeId,
  asEffect(this: Config<unknown>) {
    return Effect.flatMap(CurrentConfigProvider.asEffect(), this.parse)
  },
  toJSON(this: Config<unknown>) {
    return {
      _id: "Config"
    }
  }
}

/**
 * @since 4.0.0
 * @category Primitives
 */
export const String = (name?: string): Config<string> => primitive((provider) => provider.load, name)

/**
 * @since 4.0.0
 * @category Primitives
 */
export const Number = (name?: string): Config<number> =>
  fromFilter({
    name,
    filter(value) {
      const number = globalThis.Number(value)
      return isNaN(number) ? Filter.absent : number
    },
    onAbsent: (value) => `Expected a number, but received: ${value}`
  })

/**
 * @since 4.0.0
 * @category Primitives
 */
export const Integer = (name?: string): Config<number> =>
  fromFilter({
    name,
    filter(value) {
      const number = globalThis.Number(value)
      return globalThis.Number.isInteger(number) ? number : Filter.absent
    },
    onAbsent: (value) => `Expected an integer, but received: ${value}`
  })

/**
 * @since 4.0.0
 * @category Models
 */
export type LiteralValue = string | number | boolean | null | bigint

/**
 * @since 4.0.0
 * @category Primitives
 */
export const Literal = <Literals extends ReadonlyArray<LiteralValue>>(...literals: Literals) =>
(
  name?: string,
  options?: {
    readonly description?: string | undefined
    readonly caseInsensitive?: boolean | undefined
  }
): Config<Literals[number]> => {
  const caseInsensitive = options?.caseInsensitive ?? false
  const map = new Map(
    literals.map((
      literal
    ) => [caseInsensitive ? globalThis.String(literal).toLowerCase() : globalThis.String(literal), literal])
  )
  const description = options?.description ?? `one of (${literals.map(globalThis.String).join(", ")})`
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
 * @since 4.0.0
 * @category Primitives
 */
export const DateTime = (name?: string): Config<DateTime_.Utc> =>
  fromFilter({
    name,
    filter(value) {
      const dateTime = DateTime_.make(value)
      return Option.isNone(dateTime) ? Filter.absent : dateTime.value
    },
    onAbsent: (value) => `Expected a DateTime string, but received: ${value}`
  })

/**
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
 * @since 4.0.0
 * @category Primitives
 */
export const LogLevel = (name?: string): Config<LogLevel_.LogLevel> =>
  Literal(...LogLevel_.all)(name, { caseInsensitive: true, description: "a log level" })

/**
 * @since 4.0.0
 * @category Primitives
 */
export const Duration = (name?: string): Config<Duration_.Duration> =>
  fromFilter({
    name,
    filter(value) {
      const o = Duration_.decodeUnknown(value)
      return Option.isNone(o) ? Filter.absent : o.value
    },
    onAbsent: (value) => `Expected a Duration string, but received: ${value}`
  })

/**
 * @since 4.0.0
 * @category Collections
 */
export const Array = <A>(config: Config<A>, name?: string, options?: {
  readonly seperator?: string | undefined
}): Config<ReadonlyArray<A>> => {
  const delimiter = options?.seperator ?? ","
  return primitive((provider) =>
    Effect.flatMap(provider.load, (value) => {
      const values = value.split(delimiter).map((v) => v.trim())
      return Effect.forEach(values, (v) => config.parse(provider.withValue(v)))
    }), name)
}

/**
 * Constructs a config that always succeeds with the provided value.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const succeed = <A>(value: A): Config<A> => primitive(constant(Effect.succeed(value)))

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
  primitive(Effect.fnUntraced(function*(provider) {
    const values = new globalThis.Array<A>(configs.length)
    const failures: Array<Cause.Failure<ConfigError>> = []
    for (let i = 0; i < configs.length; i++) {
      const result = yield* Effect.exit(configs[i].parse(provider))
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
} = dual(2, <A>(self: Config<A>, name: string): Config<A> => primitive(self.parse, name))

/**
 * @since 4.0.0
 * @category Combinators
 */
export const map: {
  <A, B>(f: (a: NoInfer<A>) => B | Effect.Effect<B, ConfigError>): (self: Config<A>) => Config<B>
  <A, B>(self: Config<A>, f: (a: NoInfer<A>) => B | Effect.Effect<B, ConfigError>): Config<B>
} = dual(
  2,
  <A, B>(self: Config<A>, f: (a: NoInfer<A>) => B | Effect.Effect<B, ConfigError>): Config<B> =>
    primitive((provider) => Effect.andThen(self.parse(provider), f) as any)
)

/**
 * @since 4.0.0
 * @category Combinators
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
    primitive((provider) =>
      Effect.flatMap(self.parse(provider), (value) => {
        const result = options.filter(value)
        const effect = Effect.isEffect(result) ? result : Effect.succeed(result)
        return Effect.flatMap(effect, (result) =>
          result === Filter.absent ?
            Effect.fail(
              new InvalidData({
                path: provider.currentPath,
                description: options.onAbsent(value)
              })
            ) :
            Effect.succeed(result))
      })
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
    primitive((provider) =>
      Effect.catchIf(
        self.parse(provider),
        filterMissingData,
        () => Effect.succeed(defaultValue)
      )
    )
)
