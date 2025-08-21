/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as Schema from "../../schema/Schema.ts"
import { Scope } from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { Mutable, unhandled } from "../../types/Types.ts"
import type { Headers } from "../http/Headers.ts"
import type * as Rpc from "./Rpc.ts"
import type { Request, RequestId } from "./RpcMessage.ts"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/rpc/RpcMiddleware"

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = "~effect/rpc/RpcMiddleware"

/**
 * @since 4.0.0
 * @category models
 */
export interface RpcMiddleware<Provides, E, Requires> {
  (
    effect: Effect.Effect<SuccessValue, E | unhandled, Provides>,
    options: {
      readonly clientId: number
      readonly requestId: RequestId
      readonly rpc: Rpc.AnyWithProps
      readonly payload: unknown
      readonly headers: Headers
    }
  ): Effect.Effect<SuccessValue, unhandled, Requires>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface SuccessValue {
  readonly _: unique symbol
}

/**
 * @since 4.0.0
 * @category models
 */
export interface RpcMiddlewareClient<R = never> {
  (
    effect: Effect.Effect<SuccessValue, unhandled>,
    options: {
      readonly rpc: Rpc.AnyWithProps
      readonly request: Request<Rpc.Any>
    }
  ): Effect.Effect<SuccessValue, unhandled, R>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface ForClient<Id> {
  readonly _: unique symbol
  readonly id: Id
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Any {
  (
    effect: Effect.Effect<SuccessValue, any, any>,
    options: {
      readonly clientId: number
      readonly requestId: RequestId
      readonly rpc: Rpc.AnyWithProps
      readonly payload: unknown
      readonly headers: Headers
    }
  ): Effect.Effect<SuccessValue, any, any>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface AnyId {
  readonly [TypeId]: {
    readonly provides: any
    readonly requires: any
    readonly error: Schema.Top
  }
}

/**
 * @since 4.0.0
 * @category models
 */
export interface KeyClass<
  Self,
  Name extends string,
  Provides,
  E extends Schema.Top,
  Requires
> extends ServiceMap.Key<Self, RpcMiddleware<Provides, E, Requires>> {
  new(_: never): ServiceMap.KeyClass.Shape<Name, RpcMiddleware<Provides, E, Requires>> & {
    readonly [TypeId]: {
      readonly error: E
      readonly provides: Provides
      readonly requires: Requires
    }
  }
  readonly [TypeId]: TypeId
  readonly error: E
  readonly requiredForClient: boolean
}

/**
 * @since 4.0.0
 * @category models
 */
export type Provides<A> = A extends { readonly [TypeId]: { readonly provides: infer P } } ? P : never

/**
 * @since 4.0.0
 * @category models
 */
export type Requires<A> = A extends { readonly [TypeId]: { readonly requires: infer R } } ? R : never

/**
 * @since 4.0.0
 * @category models
 */
export type ApplyServices<A extends AnyId, R> = Exclude<R, Provides<A>> | Requires<A>

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorSchema<A> = A extends { readonly [TypeId]: { readonly error: infer E } }
  ? E extends Schema.Top ? E : never
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Error<A> = ErrorSchema<A>["Type"]

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorServicesEncode<A> = ErrorSchema<A>["EncodingServices"]

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorServicesDecode<A> = ErrorSchema<A>["DecodingServices"]

/**
 * @since 4.0.0
 * @category models
 */
export interface AnyKey extends ServiceMap.Key<any, any> {
  readonly [TypeId]: TypeId
  readonly error: Schema.Top
  readonly requiredForClient: boolean
}

/**
 * @since 4.0.0
 * @category models
 */
export interface AnyKeyWithProps extends ServiceMap.Key<any, RpcMiddleware<any, any, any>> {
  readonly [TypeId]: TypeId
  readonly error: Schema.Top
  readonly requiredForClient: boolean
}

/**
 * @since 4.0.0
 * @category tags
 */
export const Tag = <
  Self,
  Config extends {
    requires?: any
    provides?: any
  } = { requires: never; provides: never }
>(): <
  const Name extends string,
  Error extends Schema.Top = Schema.Never,
  RequiredForClient extends boolean = false
>(
  id: Name,
  options?: {
    readonly error?: Error | undefined
    readonly requiredForClient: RequiredForClient | undefined
  } | undefined
) => KeyClass<
  Self,
  Name,
  "provides" extends keyof Config ? Config["provides"] : never,
  Error,
  "requires" extends keyof Config ? Config["requires"] : never
> =>
(
  id: string,
  options?: {
    readonly error?: Schema.Top | undefined
    readonly requiredForClient?: boolean | undefined
  }
) => {
  const Err = globalThis.Error as any
  const limit = Err.stackTraceLimit
  Err.stackTraceLimit = 2
  const creationError = new Err()
  Err.stackTraceLimit = limit

  function TagClass() {}
  const TagClass_ = TagClass as any as Mutable<AnyKey>
  Object.setPrototypeOf(TagClass, Object.getPrototypeOf(ServiceMap.Key<Self, any>(id)))
  TagClass.key = id
  Object.defineProperty(TagClass, "stack", {
    get() {
      return creationError.stack
    }
  })
  TagClass_[TypeId] = TypeId
  TagClass_.error = options?.error ?? Schema.Never
  TagClass_.requiredForClient = options?.requiredForClient ?? false
  return TagClass as any
}

/**
 * @since 4.0.0
 * @category client
 */
export const layerClient = <Id, S, R, EX = never, RX = never>(
  tag: ServiceMap.Key<Id, S>,
  service: RpcMiddlewareClient<R> | Effect.Effect<RpcMiddlewareClient<R>, EX, RX>
): Layer.Layer<ForClient<Id>, EX, R | Exclude<RX, Scope>> =>
  Layer.effectServices(Effect.gen(function*() {
    const services = (yield* Effect.services<R | Scope>()).pipe(
      ServiceMap.omit(Scope)
    ) as ServiceMap.ServiceMap<R>
    const middleware = Effect.isEffect(service) ? yield* service : service
    return ServiceMap.unsafeMake(
      new Map([[
        `${tag.key}/Client`,
        (effect: Effect.Effect<any, any>, options: any) =>
          Effect.updateServices(
            middleware(effect, options),
            (requestContext) => ServiceMap.merge(services, requestContext)
          )
      ]])
    )
  }))
