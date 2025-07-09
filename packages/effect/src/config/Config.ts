/*
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
import { constant, dual } from "../Function.js"
import { PipeInspectableProto, YieldableProto } from "../internal/core.js"
import * as LogLevel_ from "../LogLevel.js"
import type * as Option from "../Option.js"
import type { Pipeable } from "../Pipeable.js"
import { hasProperty } from "../Predicate.js"
import * as Redacted_ from "../Redacted.js"
import type { NoInfer } from "../Types.js"
import { type ConfigError, filterMissingData, InvalidData, MissingData } from "./ConfigError.js"
import * as ConfigProvider from "./ConfigProvider.js"

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
  readonly parse: (context: ConfigProvider.Context) => Effect.Effect<A, ConfigError>
  [Symbol.iterator](): Effect.EffectIterator<Config<A>>
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const primitive = <A>(
  parse: (context: ConfigProvider.Context) => Effect.Effect<A, ConfigError>,
  name?: string | undefined
): Config<A> => {
  const self = Object.create(Proto)
  self.parse = name
    ? (ctx: ConfigProvider.Context) => parse(ctx.appendPath(name!))
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
  primitive((ctx) =>
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
    }), options.name)

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

/**
 * @since 4.0.0
 * @category Primitives
 */
export const String = (name?: string): Config<string> => primitive((ctx) => ctx.load, name)

/**
 * @since 4.0.0
 * @category Primitives
 */
export const StringNonEmpty = (name?: string | undefined, options?: {
  readonly trim?: boolean | undefined
}): Config<string> =>
  primitive((ctx) =>
    Effect.flatMap(ctx.load, (value) => {
      if (options?.trim) {
        value = value.trim()
      }
      return value.length > 0 ? Effect.succeed(value) : Effect.fail(
        new MissingData({
          path: ctx.currentPath,
          fullPath: ctx.provider.formatPath(ctx.currentPath)
        })
      )
    }), name)

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
 * @category Primitives
 */
export const Port = (name?: string): Config<number> =>
  fromFilter({
    name,
    filter(value) {
      const number = globalThis.Number(value)
      return globalThis.Number.isInteger(number) && number >= 0 && number <= 65535 ? number : Filter.absent
    },
    onAbsent: (value) => `Expected a valid port number, but received: ${value}`
  })

/**
 * @since 4.0.0
 * @category Primitives
 */
export const BigInt = (name?: string): Config<bigint> =>
  fromFilter({
    name,
    filter: Filter.try((s) => globalThis.BigInt(s)),
    onAbsent: (value) => `Expected a bigint, but received: ${value}`
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
export const Literal = <const Literals extends ReadonlyArray<LiteralValue>>(
  options: {
    readonly literals: Literals
    readonly name?: string | undefined
    readonly description?: string | undefined
    readonly caseInsensitive?: boolean | undefined
  }
): Config<Literals[number]> => {
  const caseInsensitive = options?.caseInsensitive ?? false
  const map = new Map(
    options.literals.map((
      literal
    ) => [caseInsensitive ? globalThis.String(literal).toLowerCase() : globalThis.String(literal), literal])
  )
  const description = options?.description ?? `one of (${options.literals.map(globalThis.String).join(", ")})`
  return fromFilter({
    name: options.name,
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
    filter: Filter.fromPredicateOption(DateTime_.make),
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
  Literal({
    literals: LogLevel_.all,
    name,
    caseInsensitive: true,
    description: "a log level"
  })

/**
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
 * @since 4.0.0
 * @category Primitives
 */
export const Redacted = <A = string>(name?: string | undefined, options?: {
  readonly config?: Config<A> | undefined
  readonly label?: string | undefined
}): Config<Redacted_.Redacted<A>> => {
  const config = options?.config ?? String() as Config<A>
  return primitive(
    (ctx) =>
      Effect.map(
        config.parse(ctx),
        (value) => Redacted_.make(value, options)
      ),
    name
  )
}

/**
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

/**
 * @since 4.0.0
 * @category Collections
 */
export const Array = <A = string>(name: string, config: Config<A>, options?: {
  readonly separator?: string | undefined
}): Config<Array<A>> => {
  config = config ?? String() as Config<A>
  const delimiter = options?.separator ?? ","
  return primitive(
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
    }),
    name
  )
}

const intRegex = /^[0-9]+$/

/**
 * @since 4.0.0
 * @category Collections
 */
export const Record = <A = string>(name: string, config: Config<A>, options?: {
  readonly separator?: string | undefined
  readonly keyValueSeparator?: string | undefined
}): Config<Record<string, A>> => {
  const delimiter = options?.separator ?? ","
  const keyValueSeparator = options?.keyValueSeparator ?? "="
  return primitive(
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
    }),
    name
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
    const values = new globalThis.Array<A>(configs.length)
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
} = dual(2, <A>(self: Config<A>, name: string): Config<A> => primitive(self.parse, name))

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
  ): Config<B> => primitive((ctx) => Effect.andThen(self.parse(ctx), (v) => f(v, ctx.currentPath)) as any)
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
    primitive((ctx) =>
      Effect.flatMap(self.parse(ctx), (value) => {
        const result = options.filter(value)
        const effect = Effect.isEffect(result) ? result : Effect.succeed(result)
        return Effect.flatMap(effect, (result) =>
          result === Filter.absent ?
            Effect.fail(
              new InvalidData({
                path: ctx.currentPath,
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
        (e) => orElse(e).parse(ctx)
      )
    )
)

/**
 * @since 4.0.0
 * @category Fallbacks
 */
export const withFallback: {
  <const B>(defaultValue: B): <A>(self: Config<A>) => Config<A | B>
  <A, const B>(self: Config<A>, defaultValue: B): Config<A | B>
} = dual(
  2,
  <A, const B>(self: Config<A>, defaultValue: B): Config<A | B> =>
    primitive((ctx) =>
      Effect.catchIf(
        self.parse(ctx),
        filterMissingData,
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
    Effect.catchIf(
      Effect.asSome(self.parse(ctx)),
      filterMissingData,
      () => Effect.succeedNone
    )
  )

/**
 * @since 4.0.0
 * @category Fallbacks
 */
export const orUndefined: <A>(self: Config<A>) => Config<A | undefined> = withFallback(undefined)
