/**
 * @since 4.0.0
 */
import * as Cache from "../../Cache.ts"
import * as Effect from "../../Effect.ts"
import { constant, identity } from "../../Function.ts"
import * as Schema from "../../schema/Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"

/**
 * @since 4.0.0
 * @category Service
 */
export class Redis extends ServiceMap.Service<Redis, {
  readonly send: <A = unknown>(command: string, ...args: ReadonlyArray<string>) => Effect.Effect<A, RedisError>

  readonly eval: <
    Config extends {
      readonly params: ReadonlyArray<unknown>
      readonly result: unknown
    }
  >(script: Script<Config>) => (...params: Config["params"]) => Effect.Effect<Config["result"], RedisError>
}>()("effect/persistence/Redis") {}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = Effect.fnUntraced(function*(
  options: {
    readonly send: <A = unknown>(command: string, ...args: ReadonlyArray<string>) => Effect.Effect<A, RedisError>
  }
) {
  const scriptCache = yield* Cache.make({
    lookup: (script: Script<any>) => options.send<string>("SCRIPT", "LOAD", script.lua),
    capacity: Number.POSITIVE_INFINITY
  })

  const eval_ = <
    Config extends {
      readonly params: ReadonlyArray<unknown>
      readonly result: unknown
    }
  >(
    script: Script<Config>
  ) =>
  (...params: Config["params"]): Effect.Effect<Config["result"], RedisError> =>
    Effect.flatMap(Cache.get(scriptCache, script), (sha) =>
      options.send<Config["result"]>(
        "EVALSHA",
        sha,
        script.numberOfKeys(...params).toString(),
        ...script.params(...params).map((param) => String(param))
      ))

  return identity<Redis["Service"]>({
    send: options.send,
    eval: eval_
  })
})

type ErrorTypeId = "~@effect/platform-bun/BunRedis/RedisError"
const ErrorTypeId: ErrorTypeId = "~@effect/platform-bun/BunRedis/RedisError"

/**
 * @since 4.0.0
 * @category Errors
 */
export class RedisError extends Schema.ErrorClass<RedisError>(ErrorTypeId)({
  _tag: Schema.tag("RedisError"),
  cause: Schema.Defect
}) {
  /**
   * @since 4.0.0
   */
  readonly [ErrorTypeId]: ErrorTypeId = ErrorTypeId
}

type ScriptTypeId = "~@effect/platform-bun/BunRedis/Script"
const ScriptTypeId: ScriptTypeId = "~@effect/platform-bun/BunRedis/Script"

/**
 * @since 4.0.0
 * @category Scripting
 */
export interface Script<
  Config extends {
    readonly params: ReadonlyArray<unknown>
    readonly result: unknown
  }
> {
  readonly [ScriptTypeId]: {
    readonly params: Config["params"]
    readonly result: Config["result"]
  }
  readonly lua: string
  readonly params: (...params: Config["params"]) => ReadonlyArray<unknown>
  readonly numberOfKeys: (...params: Config["params"]) => number
}

const variance = {
  Params: (_: never) => _
}

/**
 * @since 4.0.0
 * @category Scripting
 */
export const script: {
  <A>(): <Params extends ReadonlyArray<any>>(
    f: (...params: Params) => ReadonlyArray<unknown>,
    options: {
      readonly lua: string
      readonly numberOfKeys: number | ((...params: Params) => number)
    }
  ) => Script<{
    params: Params
    result: A
  }>
  <Params extends ReadonlyArray<any>>(
    f: (...params: Params) => ReadonlyArray<unknown>,
    options: {
      readonly lua: string
      readonly numberOfKeys: number | ((...params: Params) => number)
    }
  ): Script<{
    params: Params
    result: void
  }>
} = function() {
  if (arguments.length === 0) {
    return scriptImpl
  }
  return scriptImpl(arguments[0], arguments[1]) as any
}

const scriptImpl = <Params extends ReadonlyArray<any>>(
  f: (...params: Params) => ReadonlyArray<unknown>,
  options: {
    readonly lua: string
    readonly numberOfKeys: number | ((...params: Params) => number)
  }
): Script<{
  params: Params
  result: any
}> => ({
  ...options,
  [ScriptTypeId]: variance as any,
  params: f,
  numberOfKeys: typeof options.numberOfKeys === "number" ? constant(options.numberOfKeys) : options.numberOfKeys
})
