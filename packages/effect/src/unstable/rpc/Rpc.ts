/**
 * @since 4.0.0
 */
import * as Predicate from "../../data/Predicate.ts"
import type * as Struct from "../../data/Struct.ts"
import type { Effect } from "../../Effect.ts"
import type { Exit as Exit_ } from "../../Exit.ts"
import { type Pipeable, pipeArguments } from "../../interfaces/Pipeable.ts"
import * as PrimaryKey from "../../interfaces/PrimaryKey.ts"
import type * as Queue from "../../Queue.ts"
import * as Schema from "../../schema/Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { Stream } from "../../stream/Stream.ts"
import type { Headers } from "../http/Headers.ts"
import type * as RpcMiddleware from "./RpcMiddleware.ts"
import * as RpcSchema from "./RpcSchema.ts"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/rpc/Rpc"

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = "~effect/rpc/Rpc"

/**
 * @since 4.0.0
 * @category guards
 */
export const isRpc = (u: unknown): u is Rpc<any, any, any> => Predicate.hasProperty(u, TypeId)

/**
 * Represents an API endpoint. An API endpoint is mapped to a single route on
 * the underlying `HttpRouter`.
 *
 * @since 4.0.0
 * @category models
 */
export interface Rpc<
  in out Tag extends string,
  out Payload extends Schema.Top = Schema.Void,
  out Success extends Schema.Top = Schema.Void,
  out Error extends Schema.Top = Schema.Never,
  out Middleware extends RpcMiddleware.AnyKey = never
> extends Pipeable {
  new(_: never): {}

  readonly [TypeId]: TypeId
  readonly _tag: Tag
  readonly key: string
  readonly payloadSchema: Payload
  readonly successSchema: Success
  readonly errorSchema: Error
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly middlewares: ReadonlySet<Middleware>

  /**
   * Set the schema for the success response of the rpc.
   */
  setSuccess<S extends Schema.Top>(schema: S): Rpc<
    Tag,
    Payload,
    S,
    Error,
    Middleware
  >

  /**
   * Set the schema for the error response of the rpc.
   */
  setError<E extends Schema.Top>(schema: E): Rpc<
    Tag,
    Payload,
    Success,
    E,
    Middleware
  >

  /**
   * Set the schema for the payload of the rpc.
   */
  setPayload<P extends Schema.Top | Schema.Struct.Fields>(
    schema: P
  ): Rpc<
    Tag,
    P extends Schema.Struct.Fields ? Schema.Struct<P> : P,
    Success,
    Error,
    Middleware
  >

  /**
   * Add an `RpcMiddleware` to this procedure.
   */
  middleware<M extends RpcMiddleware.AnyKey>(middleware: M): Rpc<
    Tag,
    Payload,
    Success,
    Error,
    Middleware | M
  >

  /**
   * Set the schema for the error response of the rpc.
   */
  prefix<const Prefix extends string>(prefix: Prefix): Rpc<
    `${Prefix}${Tag}`,
    Payload,
    Success,
    Error,
    Middleware
  >

  /**
   * Add an annotation on the rpc.
   */
  annotate<I, S>(
    tag: ServiceMap.Key<I, S>,
    value: S
  ): Rpc<Tag, Payload, Success, Error, Middleware>

  /**
   * Merge the annotations of the rpc with the provided annotations.
   */
  annotateMerge<I>(
    annotations: ServiceMap.ServiceMap<I>
  ): Rpc<Tag, Payload, Success, Error, Middleware>
}

/**
 * Represents an implemented rpc.
 *
 * @since 4.0.0
 * @category models
 */
export interface Handler<Tag extends string> {
  readonly _: unique symbol
  readonly tag: Tag
  readonly handler: (request: any, headers: Headers) => Effect<any, any> | Stream<any, any>
  readonly services: ServiceMap.ServiceMap<never>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Any extends Pipeable {
  readonly [TypeId]: TypeId
  readonly _tag: string
  readonly key: string
}

/**
 * @since 4.0.0
 * @category models
 */
export interface AnyWithProps {
  readonly [TypeId]: TypeId
  readonly _tag: string
  readonly key: string
  readonly payloadSchema: Schema.Top
  readonly successSchema: Schema.Top
  readonly errorSchema: Schema.Top
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly middlewares: ReadonlySet<RpcMiddleware.AnyKeyWithProps>
}

/**
 * @since 4.0.0
 * @category models
 */
export type Tag<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? _Tag
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Success<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? _Success["Type"]
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type SuccessEncoded<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? _Success["Encoded"]
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type SuccessExit<R> = Success<R> extends infer T ? T extends Stream<infer _A, infer _E, infer _Env> ? void : T
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type SuccessExitEncoded<R> = SuccessEncoded<R> extends infer T ?
  T extends Stream<infer _A, infer _E, infer _Env> ? void : T
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type SuccessChunk<R> = Success<R> extends Stream<infer _A, infer _E, infer _Env> ? _A : never

/**
 * @since 4.0.0
 * @category models
 */
export type SuccessChunkEncoded<R> = SuccessEncoded<R> extends Stream<infer _A, infer _E, infer _Env> ? _A : never

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorSchema<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? _Error | _Middleware["error"]
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Error<R> = Schema.Schema.Type<ErrorSchema<R>>

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorEncoded<R> = ErrorSchema<R>["Encoded"]
/**
 * @since 4.0.0
 * @category models
 */
export type ErrorExit<R> = Success<R> extends Stream<infer _A, infer _E, infer _Env> ? _E | Error<R> : Error<R>

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorExitEncoded<R> = SuccessEncoded<R> extends Stream<infer _A, infer _E, infer _Env>
  ? _E | ErrorEncoded<R>
  : ErrorEncoded<R>

/**
 * @since 4.0.0
 * @category models
 */
export type Exit<R> = Exit_<SuccessExit<R>, ErrorExit<R>>

/**
 * @since 4.0.0
 * @category models
 */
export type ExitEncoded<R, Defect = unknown> = Schema.ExitEncoded<SuccessExitEncoded<R>, ErrorExitEncoded<R>, Defect>

/**
 * @since 4.0.0
 * @category models
 */
export type PayloadConstructor<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? _Payload["~type.make.in"]
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Payload<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? _Payload["Type"]
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type ServicesServer<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ?
    | _Payload["DecodingServices"]
    | _Success["EncodingServices"]
    | _Error["EncodingServices"]
    | _Middleware["error"]["EncodingServices"]
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type ServicesClient<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ?
    | _Payload["EncodingServices"]
    | _Success["DecodingServices"]
    | _Error["DecodingServices"]
    | _Middleware["error"]["DecodingServices"]
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Middleware<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? ServiceMap.Key.Identifier<_Middleware>
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type MiddlewareClient<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ?
  _Middleware extends { readonly requiredForClient: true }
    ? RpcMiddleware.ForClient<ServiceMap.Key.Identifier<_Middleware>>
  : never
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type AddError<R extends Any, Error extends Schema.Top> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? Rpc<
    _Tag,
    _Payload,
    _Success,
    _Error | Error,
    _Middleware
  > :
  never

/**
 * @since 4.0.0
 * @category models
 */
export type AddMiddleware<R extends Any, Middleware extends RpcMiddleware.AnyKey> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? Rpc<
    _Tag,
    _Payload,
    _Success,
    _Error,
    _Middleware | Middleware
  > :
  never

/**
 * @since 4.0.0
 * @category models
 */
export type ToHandler<R extends Any> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? Handler<_Tag> :
  never

/**
 * @since 4.0.0
 * @category models
 */
export type ToHandlerFn<Current extends Any, R = any> = (
  payload: Payload<Current>,
  options: {
    readonly clientId: number
    readonly headers: Headers
  }
) => ResultFrom<Current, R> | Fork<ResultFrom<Current, R>>

/**
 * @since 4.0.0
 * @category models
 */
export type IsStream<R extends Any, Tag extends string> = R extends
  Rpc<Tag, infer _Payload, RpcSchema.Stream<infer _A, infer _E>, infer _Error, infer _Middleware> ? true : never

/**
 * @since 4.0.0
 * @category models
 */
export type ExtractTag<R extends Any, Tag extends string> = R extends
  Rpc<Tag, infer _Payload, infer _Success, infer _Error, infer _Middleware> ? R : never

/**
 * @since 4.0.0
 * @category models
 */
export type ExtractProvides<R extends Any, Tag extends string> = R extends
  Rpc<Tag, infer _Payload, infer _Success, infer _Error, infer _Middleware> ? RpcMiddleware.Provides<_Middleware> :
  never

/**
 * @since 4.0.0
 * @category models
 */
export type ExcludeProvides<Env, R extends Any, Tag extends string> = Exclude<
  Env,
  ExtractProvides<R, Tag>
>

/**
 * @since 4.0.0
 * @category models
 */
export type ResultFrom<R extends Any, Services> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? [_Success] extends [RpcSchema.Stream<infer _SA, infer _SE>] ?
      | Stream<
        _SA["Type"],
        _SE["Type"] | _Error["Type"],
        Services
      >
      | Effect<
        Queue.Dequeue<_SA["Type"], _SE["Type"] | _Error["Type"] | Queue.Done>,
        _SE["Type"] | Schema.Schema.Type<_Error>,
        Services
      > :
  Effect<
    _Success["Type"],
    _Error["Type"],
    Services
  > :
  never

/**
 * @since 4.0.0
 * @category models
 */
export type Prefixed<Rpcs extends Any, Prefix extends string> = Rpcs extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware
> ? Rpc<
    `${Prefix}${_Tag}`,
    _Payload,
    _Success,
    _Error,
    _Middleware
  >
  : never

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
  },
  setSuccess(
    this: AnyWithProps,
    successSchema: Schema.Top
  ) {
    return makeProto({
      _tag: this._tag,
      payloadSchema: this.payloadSchema,
      successSchema,
      errorSchema: this.errorSchema,
      annotations: this.annotations,
      middlewares: this.middlewares
    })
  },
  setError(this: AnyWithProps, errorSchema: Schema.Top) {
    return makeProto({
      _tag: this._tag,
      payloadSchema: this.payloadSchema,
      successSchema: this.successSchema,
      errorSchema,
      annotations: this.annotations,
      middlewares: this.middlewares
    })
  },
  setPayload(this: AnyWithProps, payloadSchema: Schema.Struct<any> | Schema.Struct.Fields) {
    return makeProto({
      _tag: this._tag,
      payloadSchema: Schema.isSchema(payloadSchema) ? payloadSchema as any : Schema.Struct(payloadSchema as any),
      successSchema: this.successSchema,
      errorSchema: this.errorSchema,
      annotations: this.annotations,
      middlewares: this.middlewares
    })
  },
  middleware(this: AnyWithProps, middleware: RpcMiddleware.AnyKey) {
    return makeProto({
      _tag: this._tag,
      payloadSchema: this.payloadSchema,
      successSchema: this.successSchema,
      errorSchema: this.errorSchema,
      annotations: this.annotations,
      middlewares: new Set([...this.middlewares, middleware])
    })
  },
  prefix(this: AnyWithProps, prefix: string) {
    return makeProto({
      _tag: `${prefix}${this._tag}`,
      payloadSchema: this.payloadSchema,
      successSchema: this.successSchema,
      errorSchema: this.errorSchema,
      annotations: this.annotations,
      middlewares: this.middlewares
    })
  },
  annotate(this: AnyWithProps, tag: ServiceMap.Key<any, any>, value: any) {
    return makeProto({
      _tag: this._tag,
      payloadSchema: this.payloadSchema,
      successSchema: this.successSchema,
      errorSchema: this.errorSchema,
      middlewares: this.middlewares,
      annotations: ServiceMap.add(this.annotations, tag, value)
    })
  },
  annotateMerge(this: AnyWithProps, context: ServiceMap.ServiceMap<any>) {
    return makeProto({
      _tag: this._tag,
      payloadSchema: this.payloadSchema,
      successSchema: this.successSchema,
      errorSchema: this.errorSchema,
      middlewares: this.middlewares,
      annotations: ServiceMap.merge(this.annotations, context)
    })
  }
}

const makeProto = <
  const Tag extends string,
  Payload extends Schema.Top,
  Success extends Schema.Top,
  Error extends Schema.Top,
  Middleware extends RpcMiddleware.AnyKey
>(options: {
  readonly _tag: Tag
  readonly payloadSchema: Payload
  readonly successSchema: Success
  readonly errorSchema: Error
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly middlewares: ReadonlySet<Middleware>
}): Rpc<Tag, Payload, Success, Error, Middleware> => {
  function Rpc() {}
  Object.setPrototypeOf(Rpc, Proto)
  Object.assign(Rpc, options)
  Rpc.key = `effect/rpc/Rpc/${options._tag}`
  return Rpc as any
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = <
  const Tag extends string,
  Payload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
  Success extends Schema.Top = Schema.Void,
  Error extends Schema.Top = Schema.Never,
  const Stream extends boolean = false
>(tag: Tag, options?: {
  readonly payload?: Payload
  readonly success?: Success
  readonly error?: Error
  readonly stream?: Stream
  readonly primaryKey?: [Payload] extends [Schema.Struct.Fields] ? ((
      payload: Payload extends Schema.Struct.Fields ? Struct.Simplify<Schema.Struct<Payload>["Type"]> : Payload["Type"]
    ) => string) :
    never
}): Rpc<
  Tag,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload> : Payload,
  Stream extends true ? RpcSchema.Stream<Success, Error> : Success,
  Stream extends true ? typeof Schema.Never : Error
> => {
  const successSchema = options?.success ?? Schema.Void
  const errorSchema = options?.error ?? Schema.Never
  let payloadSchema: any
  if (options?.primaryKey) {
    payloadSchema = class Payload extends Schema.Class<Payload>(`effect/rpc/Rpc/${tag}`)(options.payload as any) {
      [PrimaryKey.symbol](): string {
        return options.primaryKey!(this as any)
      }
    }
  } else {
    payloadSchema = Schema.isSchema(options?.payload)
      ? options?.payload as any
      : options?.payload
      ? Schema.Struct(options?.payload as any)
      : Schema.Void
  }
  return makeProto({
    _tag: tag,
    payloadSchema,
    successSchema: options?.stream ?
      RpcSchema.Stream({
        success: successSchema,
        error: errorSchema
      }) :
      successSchema,
    errorSchema: options?.stream ? Schema.Never : errorSchema,
    annotations: ServiceMap.empty(),
    middlewares: new Set<never>()
  }) as any
}

// TODO: Schema.Exit
// const exitSchemaCache = new WeakMap<Any, Schema.Schema<any>>()
//
// /**
//  * @since 4.0.0
//  * @category constructors
//  */
// export const exitSchema = <R extends Any>(
//   self: R
// ): Schema.Schema<Exit<R>, ExitEncoded<R>, Context<R>> => {
//   if (exitSchemaCache.has(self)) {
//     return exitSchemaCache.get(self) as any
//   }
//   const rpc = self as any as AnyWithProps
//   const failures = new Set<Schema.Top>([rpc.errorSchema])
//   const streamSchemas = RpcSchema.getStreamSchemas(rpc.successSchema.ast)
//   if (Option.isSome(streamSchemas)) {
//     failures.add(streamSchemas.value.failure)
//   }
//   for (const middleware of rpc.middlewares) {
//     failures.add(middleware.failure)
//   }
//   const schema = Schema.Exit({
//     success: Option.isSome(streamSchemas) ? Schema.Void : rpc.successSchema,
//     failure: Schema.Union(...failures),
//     defect: Schema.Defect
//   })
//   exitSchemaCache.set(self, schema)
//   return schema as any
// }

/**
 * @since 4.0.0
 * @category Fork
 */
export const ForkTypeId: ForkTypeId = "~effect/rpc/Rpc/Fork"

/**
 * @since 4.0.0
 * @category Fork
 */
export type ForkTypeId = "~effect/rpc/Rpc/Fork"

/**
 * @since 4.0.0
 * @category Fork
 */
export interface Fork<A> {
  readonly [ForkTypeId]: ForkTypeId
  readonly value: A
}

/**
 * You can use `fork` to wrap a response Effect or Stream, to ensure that the
 * response is executed concurrently regardless of the RpcServer concurrency
 * setting.
 *
 * @since 4.0.0
 * @category Fork
 */
export const fork = <A>(value: A): Fork<A> => ({ [ForkTypeId]: ForkTypeId, value })

/**
 * @since 4.0.0
 * @category Fork
 */
export const isFork = (u: object): u is Fork<any> => ForkTypeId in u
