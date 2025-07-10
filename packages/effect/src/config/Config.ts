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
import type { LazyArg } from "../Function.js"
import { constant, dual } from "../Function.js"
import { PipeInspectableProto, YieldableProto } from "../internal/core.js"
import * as LogLevel_ from "../LogLevel.js"
import type * as Option from "../Option.js"
import type { Pipeable } from "../Pipeable.js"
import { hasProperty } from "../Predicate.js"
import * as Redacted_ from "../Redacted.js"
import type { NoInfer } from "../Types.js"
import { type ConfigError, filterMissingDataOnly, InvalidData, MissingData } from "./ConfigError.js"
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
   * @since 4.0.0
   * @category Primitives
   */
  String_ as String
}

/**
 * @since 4.0.0
 * @category Primitives
 */
export const StringNonEmpty = (
  nameOrOptions?: string | {
    readonly name?: string | undefined
    readonly trim?: boolean | undefined
  }
): Config<string> => {
  const name = typeof nameOrOptions === "string" ? nameOrOptions : nameOrOptions?.name
  const options = typeof nameOrOptions !== "string" ? nameOrOptions : { trim: false }
  return primitive(name, (ctx) =>
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
    }))
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
   * @since 4.0.0
   * @category Primitives
   */
  Number_ as Number
}

/**
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
   * @since 4.0.0
   * @category Primitives
   */
  BigInt_ as BigInt
}

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
    ) => [caseInsensitive ? String(literal).toLowerCase() : String(literal), literal])
  )
  const description = options?.description ?? `one of (${options.literals.map(String).join(", ")})`
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
    literals: LogLevel_.values,
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

const Array_ = <A = string>(name: string, config: Config<A>, options?: {
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
export const Record = <A = string>(name: string, config: Config<A>, options?: {
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
                path: ctx.lastChildPath,
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
