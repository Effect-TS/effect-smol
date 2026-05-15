/**
 * @since 4.0.0
 */
import type * as Cause from "../../Cause.ts"
import * as Context from "../../Context.ts"
import type { Deferred } from "../../Deferred.ts"
import type { Effect } from "../../Effect.ts"
import type { Exit as Exit_ } from "../../Exit.ts"
import * as Option from "../../Option.ts"
import { type Pipeable, pipeArguments } from "../../Pipeable.ts"
import * as Predicate from "../../Predicate.ts"
import * as PrimaryKey from "../../PrimaryKey.ts"
import type * as Queue from "../../Queue.ts"
import * as Schema from "../../Schema.ts"
import type { Stream } from "../../Stream.ts"
import type * as Struct from "../../Struct.ts"
import type { NoInfer } from "../../Types.ts"
import type { Headers } from "../http/Headers.ts"
import type { RequestId } from "./RpcMessage.ts"
import type * as RpcMiddleware from "./RpcMiddleware.ts"
import * as RpcSchema from "./RpcSchema.ts"

const TypeId = "~effect/rpc/Rpc"

/**
 * @category guards
 * @since 4.0.0
 */
export const isRpc = (u: unknown): u is Rpc<any, any, any> => Predicate.hasProperty(u, TypeId)

/**
 * @category models
 * @since 4.0.0
 */
export interface DefectSchema extends Schema.Top {
  readonly Type: unknown
  make(input: null, options?: Schema.MakeOptions): unknown
  make(input: undefined, options?: Schema.MakeOptions): unknown
  make(input: {}, options?: Schema.MakeOptions): unknown
  readonly DecodingServices: never
  readonly EncodingServices: never
}

/**
 * Represents an API endpoint. An API endpoint is mapped to a single route on
 * the underlying `HttpRouter`.
 *
 * @category models
 * @since 4.0.0
 */
export interface Rpc<
  in out Tag extends string,
  out Payload extends Schema.Top = Schema.Void,
  out Success extends Schema.Top = Schema.Void,
  out Error extends Schema.Top = Schema.Never,
  out Middleware extends RpcMiddleware.AnyService = never,
  out Requires = never
> extends Pipeable {
  new(_: never): {}

  readonly [TypeId]: typeof TypeId
  readonly _tag: Tag
  readonly key: string
  readonly payloadSchema: Payload
  readonly successSchema: Success
  readonly errorSchema: Error
  readonly defectSchema: Schema.Top
  readonly annotations: Context.Context<never>
  readonly middlewares: ReadonlySet<Middleware>
  readonly "~requires": Requires

  /**
   * Set the schema for the success response of the rpc.
   */
  setSuccess<S extends Schema.Top>(schema: S): Rpc<
    Tag,
    Payload,
    S,
    Error,
    Middleware,
    Requires
  >

  /**
   * Set the schema for the error response of the rpc.
   */
  setError<E extends Schema.Top>(schema: E): Rpc<
    Tag,
    Payload,
    Success,
    E,
    Middleware,
    Requires
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
    Middleware,
    Requires
  >

  /**
   * Add an `RpcMiddleware` to this procedure.
   */
  middleware<M extends RpcMiddleware.AnyService>(middleware: M): Rpc<
    Tag,
    Payload,
    Success,
    Error,
    Middleware | M,
    RpcMiddleware.ApplyServices<M["Identifier"], Requires>
  >

  /**
   * Set the schema for the error response of the rpc.
   */
  prefix<const Prefix extends string>(prefix: Prefix): Rpc<
    `${Prefix}${Tag}`,
    Payload,
    Success,
    Error,
    Middleware,
    Requires
  >

  /**
   * Add an annotation on the rpc.
   */
  annotate<I, S>(
    tag: Context.Key<I, S>,
    value: NoInfer<S>
  ): Rpc<Tag, Payload, Success, Error, Middleware, Requires>

  /**
   * Merge the annotations of the rpc with the provided annotations.
   */
  annotateMerge<I>(
    annotations: Context.Context<I>
  ): Rpc<Tag, Payload, Success, Error, Middleware, Requires>
}

/**
 * @category models
 * @since 4.0.0
 */
export class ServerClient {
  readonly id: number
  annotations: Context.Context<never>
  constructor(id: number) {
    this.id = id
    this.annotations = Context.empty()
  }
  annotate<I, S>(
    tag: Context.Key<I, S>,
    value: NoInfer<S>
  ): ServerClient {
    this.annotations = Context.add(this.annotations, tag, value)
    return this
  }
}

/**
 * Represents an implemented rpc.
 *
 * @category models
 * @since 4.0.0
 */
export interface Handler<Tag extends string> {
  readonly _: unique symbol
  readonly tag: Tag
  readonly handler: (request: any, options: {
    readonly client: ServerClient
    readonly requestId: RequestId
    readonly headers: Headers
    readonly rpc: Any
  }) => Effect<{} | Deferred<any, any>, any> | Stream<any, any>
  readonly context: Context.Context<never>
}

/**
 * @category models
 * @since 4.0.0
 */
export interface Any extends Pipeable {
  readonly [TypeId]: typeof TypeId
  readonly _tag: string
  readonly key: string
  readonly annotations: Context.Context<never>
}

/**
 * @category models
 * @since 4.0.0
 */
export interface AnyWithProps extends Pipeable {
  readonly [TypeId]: typeof TypeId
  readonly _tag: string
  readonly key: string
  readonly payloadSchema: Schema.Top
  readonly successSchema: Schema.Top
  readonly errorSchema: Schema.Top
  readonly defectSchema: Schema.Top
  readonly annotations: Context.Context<never>
  readonly middlewares: ReadonlySet<RpcMiddleware.AnyServiceWithProps>
  readonly "~requires": any
}

/**
 * @category models
 * @since 4.0.0
 */
export type Tag<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? _Tag
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type SuccessSchema<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? _Success
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type Success<R> = SuccessSchema<R>["Type"]

/**
 * @category models
 * @since 4.0.0
 */
export type SuccessEncoded<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? _Success["Encoded"]
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type SuccessExitSchema<R> = SuccessSchema<R> extends RpcSchema.Stream<infer _A, infer _E> ? _A : SuccessSchema<R>

/**
 * @category models
 * @since 4.0.0
 */
export type SuccessExit<R> = Success<R> extends infer T ? T extends Stream<infer _A, infer _E, infer _Env> ? void : T
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type SuccessChunk<R> = Success<R> extends Stream<infer _A, infer _E, infer _Env> ? _A : never

/**
 * @category models
 * @since 4.0.0
 */
export type ErrorSchema<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? _Error | _Middleware["error"]
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type Error<R> = Schema.Schema.Type<ErrorSchema<R>>

/**
 * @category models
 * @since 4.0.0
 */
export type ErrorExitSchema<R> = SuccessSchema<R> extends RpcSchema.Stream<infer _A, infer _E> ? _E | ErrorSchema<R>
  : ErrorSchema<R>

/**
 * @category models
 * @since 4.0.0
 */
export type ErrorExit<R> = Success<R> extends Stream<infer _A, infer _E, infer _Env> ? _E | Error<R> : Error<R>

/**
 * @category models
 * @since 4.0.0
 */
export type Exit<R> = Exit_<SuccessExit<R>, ErrorExit<R>>

/**
 * @category models
 * @since 4.0.0
 */
export type PayloadConstructor<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? _Payload["~type.make.in"]
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type Payload<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? _Payload["Type"]
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type Services<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ?
    | _Payload["DecodingServices"]
    | _Payload["EncodingServices"]
    | _Success["DecodingServices"]
    | _Success["EncodingServices"]
    | _Error["DecodingServices"]
    | _Error["EncodingServices"]
    | _Middleware["error"]["DecodingServices"]
    | _Middleware["error"]["EncodingServices"]
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type ServicesClient<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ?
    | _Payload["EncodingServices"]
    | _Success["DecodingServices"]
    | _Error["DecodingServices"]
    | _Middleware["error"]["DecodingServices"]
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type ServicesServer<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ?
    | _Payload["DecodingServices"]
    | _Success["EncodingServices"]
    | _Error["EncodingServices"]
    | _Middleware["error"]["EncodingServices"]
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type Middleware<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? Context.Service.Identifier<_Middleware>
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type MiddlewareClient<R> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? _Middleware extends { readonly requiredForClient: true } ? RpcMiddleware.ForClient<_Middleware["Identifier"]>
  : never
  : never

/**
 * @category models
 * @since 4.0.0
 */
export type AddError<R extends Any, Error extends Schema.Top> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? Rpc<
    _Tag,
    _Payload,
    _Success,
    _Error | Error,
    _Middleware,
    _Requires
  > :
  never

/**
 * @category models
 * @since 4.0.0
 */
export type AddMiddleware<R extends Any, Middleware extends RpcMiddleware.AnyService> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? Rpc<
    _Tag,
    _Payload,
    _Success,
    _Error,
    _Middleware | Middleware,
    RpcMiddleware.ApplyServices<Middleware["Identifier"], _Requires>
  > :
  never

/**
 * @category models
 * @since 4.0.0
 */
export type ToHandler<R extends Any> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? Handler<_Tag> :
  never

/**
 * @category models
 * @since 4.0.0
 */
export type ToHandlerFn<Current extends Any, R = any> = (
  payload: Payload<Current>,
  options: {
    readonly client: ServerClient
    readonly requestId: RequestId
    readonly headers: Headers
    readonly rpc: Current
  }
) => WrapperOr<ResultFrom<Current, R>>

/**
 * @category models
 * @since 4.0.0
 */
export type IsStream<R extends Any, Tag extends string> = R extends Rpc<
  Tag,
  infer _Payload,
  RpcSchema.Stream<infer _A, infer _E>,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? true :
  never

/**
 * @category models
 * @since 4.0.0
 */
export type ExtractTag<R extends Any, Tag extends string> = R extends Rpc<
  Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? R :
  never

/**
 * @category models
 * @since 4.0.0
 */
export type ExtractProvides<R extends Any, Tag extends string> = R extends Rpc<
  Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? RpcMiddleware.Provides<_Middleware["Identifier"]> :
  never

/**
 * @category models
 * @since 4.0.0
 */
export type ExtractRequires<R extends Any, Tag extends string> = R extends Rpc<
  Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? _Requires :
  never

/**
 * @category models
 * @since 4.0.0
 */
export type ExcludeProvides<Env, R extends Any, Tag extends string> = Exclude<
  Env,
  ExtractProvides<R, Tag>
>

/**
 * @category models
 * @since 4.0.0
 */
export type ResultFrom<R extends Any, Services> = R extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? [_Success] extends [RpcSchema.Stream<infer _SA, infer _SE>] ?
      | Stream<
        _SA["Type"],
        _SE["Type"] | _Error["Type"],
        Services
      >
      | Effect<
        Queue.Dequeue<_SA["Type"], _SE["Type"] | _Error["Type"] | Cause.Done>,
        _SE["Type"] | Schema.Schema.Type<_Error>,
        Services
      > :
  Effect<
    _Success["Type"] | Deferred<_Success["Type"], _Error["Type"]>,
    _Error["Type"],
    Services
  > :
  never

/**
 * @category models
 * @since 4.0.0
 */
export type Prefixed<Rpcs extends Any, Prefix extends string> = Rpcs extends Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ? Rpc<
    `${Prefix}${_Tag}`,
    _Payload,
    _Success,
    _Error,
    _Middleware,
    _Requires
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
      defectSchema: this.defectSchema,
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
      defectSchema: this.defectSchema,
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
      defectSchema: this.defectSchema,
      annotations: this.annotations,
      middlewares: this.middlewares
    })
  },
  middleware(this: AnyWithProps, middleware: RpcMiddleware.AnyService) {
    return makeProto({
      _tag: this._tag,
      payloadSchema: this.payloadSchema,
      successSchema: this.successSchema,
      errorSchema: this.errorSchema,
      defectSchema: this.defectSchema,
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
      defectSchema: this.defectSchema,
      annotations: this.annotations,
      middlewares: this.middlewares
    })
  },
  annotate(this: AnyWithProps, tag: Context.Key<any, any>, value: any) {
    return makeProto({
      _tag: this._tag,
      payloadSchema: this.payloadSchema,
      successSchema: this.successSchema,
      errorSchema: this.errorSchema,
      defectSchema: this.defectSchema,
      middlewares: this.middlewares,
      annotations: Context.add(this.annotations, tag, value)
    })
  },
  annotateMerge(this: AnyWithProps, context: Context.Context<any>) {
    return makeProto({
      _tag: this._tag,
      payloadSchema: this.payloadSchema,
      successSchema: this.successSchema,
      errorSchema: this.errorSchema,
      defectSchema: this.defectSchema,
      middlewares: this.middlewares,
      annotations: Context.merge(this.annotations, context)
    })
  }
}

const makeProto = <
  const Tag extends string,
  Payload extends Schema.Top,
  Success extends Schema.Top,
  Error extends Schema.Top,
  Middleware extends RpcMiddleware.AnyService,
  Requires
>(options: {
  readonly _tag: Tag
  readonly payloadSchema: Payload
  readonly successSchema: Success
  readonly errorSchema: Error
  readonly defectSchema: Schema.Top
  readonly annotations: Context.Context<never>
  readonly middlewares: ReadonlySet<Middleware>
}): Rpc<Tag, Payload, Success, Error, Middleware, Requires> => {
  function Rpc() {}
  Object.setPrototypeOf(Rpc, Proto)
  Object.assign(Rpc, options)
  Rpc.key = `effect/rpc/Rpc/${options._tag}`
  return Rpc as any
}

/**
 * @category constructors
 * @since 4.0.0
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
  readonly defect?: DefectSchema
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
  const defectSchema = options?.defect ?? Schema.Defect
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
      RpcSchema.Stream(successSchema, errorSchema) :
      successSchema,
    errorSchema: options?.stream ? Schema.Never : errorSchema,
    defectSchema,
    annotations: Context.empty(),
    middlewares: new Set<never>()
  }) as any
}

/**
 * Create a custom Rpc constructor, that can transform the output schemas.
 *
 * ```typescript
 * import { Schema } from "effect"
 * import { Rpc } from "effect/unstable/rpc"
 *
 * // Create a custom Rpc wrapper definition by transforming the success and error
 * // schemas.
 * export interface RpcWithPagination extends Rpc.Custom {
 *   readonly out: Rpc.Custom.Out<
 *     Paginated<this["success"]>,
 *     this["error"]
 *   >
 * }
 *
 * // The type definition for the transformed success schema.
 * export interface Paginated<S extends Schema.Top> extends
 *   Schema.Struct<{
 *     readonly offset: Schema.Number
 *     readonly total: Schema.Number
 *     readonly results: Schema.$Array<S>
 *   }>
 * {}
 *
 * // You can then implement the schema transformation using `Rpc.custom`
 * export const makePaginated = Rpc.custom<RpcWithPagination>((schemas) => ({
 *   ...schemas,
 *   success: Schema.Struct({
 *     offset: Schema.Number,
 *     total: Schema.Number,
 *     results: Schema.Array(schemas.success)
 *   })
 * }))
 *
 * // You can then use the custom constructor in the same way `Rpc.make` is used.
 * export const listAllRpc = makePaginated("listAll", {
 *   success: Schema.String
 * })
 * ```
 *
 * @category Custom constructors
 * @since 4.0.0
 */
export const custom = <Def extends Custom>(
  f: (options: Custom.OutDefault) => (Def & Custom.OutDefault)["out"]
) =>
<
  const Tag extends string,
  Payload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
  Success extends Schema.Top = Schema.Void,
  Error extends Schema.Top = Schema.Never,
  const Stream extends boolean = false,
  Out extends Custom.OutDefault = Custom.Kind<Def, Success, Error>
>(tag: Tag, options?: {
  readonly payload?: Payload
  readonly success?: Success
  readonly error?: Error
  readonly defect?: DefectSchema
  readonly stream?: Stream
  readonly primaryKey?: [Payload] extends [Schema.Struct.Fields] ? ((
      payload: Payload extends Schema.Struct.Fields ? Struct.Simplify<Schema.Struct<Payload>["Type"]> : Payload["Type"]
    ) => string) :
    never
}): Rpc<
  Tag,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload> : Payload,
  Stream extends true ? RpcSchema.Stream<Out["success"], Out["error"]> : Out["success"],
  Stream extends true ? typeof Schema.Never : Out["error"]
> => {
  const success = options?.success ?? Schema.Void
  const error = options?.error ?? Schema.Never
  const defect = options?.defect ?? Schema.Defect
  const out = f({
    success,
    error,
    defect
  })
  return make(tag, {
    ...out,
    primaryKey: options?.primaryKey,
    payload: options?.payload,
    stream: options?.stream
  }) as any
}

/**
 * @category Custom constructors
 * @since 4.0.0
 */
export interface Custom {
  readonly out: Custom.OutDefault
  readonly success: Schema.Top
  readonly error: Schema.Top
  readonly defect: DefectSchema
}

/**
 * @category Custom constructors
 * @since 4.0.0
 */
export declare namespace Custom {
  /**
   * @category Custom constructors
   * @since 4.0.0
   */
  export interface Out<
    Success extends Schema.Top,
    Error extends Schema.Top
  > {
    readonly success: Success
    readonly error: Error
    readonly defect: DefectSchema
  }

  /**
   * @category Custom constructors
   * @since 4.0.0
   */
  export type OutDefault = Out<Schema.Top, Schema.Top>

  /**
   * @category Custom constructors
   * @since 4.0.0
   */
  export type Kind<
    Def extends Custom,
    Success extends Schema.Top,
    Error extends Schema.Top
  > = (Def & {
    readonly success: Success
    readonly error: Error
  })["out"]
}

const exitSchemaCache = new WeakMap<Any, Schema.Exit<Schema.Top, Schema.Top, DefectSchema>>()

/**
 * @category constructors
 * @since 4.0.0
 */
export const exitSchema = <R extends Any>(
  self: R
): Schema.Exit<
  SuccessExitSchema<R>,
  ErrorExitSchema<R>,
  DefectSchema
> => {
  if (exitSchemaCache.has(self)) {
    return exitSchemaCache.get(self) as any
  }
  const rpc = self as any as AnyWithProps
  const failures = new Set<Schema.Top>([rpc.errorSchema])
  const streamSchemas = RpcSchema.getStreamSchemas(rpc.successSchema)
  if (Option.isSome(streamSchemas)) {
    failures.add(streamSchemas.value.error)
  }
  for (const middleware of rpc.middlewares) {
    failures.add(middleware.error)
  }
  const schema = Schema.Exit(
    Option.isSome(streamSchemas) ? Schema.Void : rpc.successSchema,
    Schema.Union([...failures]),
    rpc.defectSchema
  )
  exitSchemaCache.set(self, schema as any)
  return schema as any
}

const WrapperTypeId = "~effect/rpc/Rpc/Wrapper"

/**
 * @category Wrapper
 * @since 4.0.0
 */
export interface Wrapper<A> {
  readonly [WrapperTypeId]: typeof WrapperTypeId
  readonly value: A
  readonly fork: boolean
  readonly uninterruptible: boolean
}

/**
 * @category Wrapper
 * @since 4.0.0
 */
export type WrapperOr<A> = A | Wrapper<A>

/**
 * @category Wrapper
 * @since 4.0.0
 */
export const isWrapper = (u: object): u is Wrapper<any> => WrapperTypeId in u

/**
 * @category Wrapper
 * @since 4.0.0
 */
export const wrap = (options: {
  readonly fork?: boolean | undefined
  readonly uninterruptible?: boolean | undefined
}) =>
<A extends object>(value: A): Wrapper<A> =>
  isWrapper(value) ?
    {
      [WrapperTypeId]: WrapperTypeId,
      value: value.value,
      fork: options.fork ?? value.fork,
      uninterruptible: options.uninterruptible ?? value.uninterruptible
    } :
    {
      [WrapperTypeId]: WrapperTypeId,
      value,
      fork: options.fork ?? false,
      uninterruptible: options.uninterruptible ?? false
    }

/**
 * @category Wrapper
 * @since 4.0.0
 */
export const unwrap = <A extends object>(value: WrapperOr<A>): A => isWrapper(value) ? value.value : value

/**
 * @category Wrapper
 * @since 4.0.0
 */
export const wrapMap = <A extends object, B extends object>(self: WrapperOr<A>, f: (value: A) => B): WrapperOr<B> => {
  if (isWrapper(self)) {
    return wrap(self)(f(self.value))
  }
  return f(self)
}

/**
 * You can use `fork` to wrap a response Effect or Stream, to ensure that the
 * response is executed concurrently regardless of the RpcServer concurrency
 * setting.
 *
 * @category Wrapper
 * @since 4.0.0
 */
export const fork: <A extends object>(value: A) => Wrapper<A> = wrap({ fork: true })

/**
 * You can use `uninterruptible` to wrap a response Effect or Stream, to ensure that it is run in an uninterruptible region.
 *
 * @category Wrapper
 * @since 4.0.0
 */
export const uninterruptible: <A extends object>(value: A) => Wrapper<A> = wrap({ uninterruptible: true })
