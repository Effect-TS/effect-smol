/**
 * @since 4.0.0
 */
import { hasProperty } from "../../data/Predicate.ts"
import type { Simplify } from "../../data/Struct.ts"
import type * as Effect from "../../Effect.ts"
import * as Schema from "../../schema/Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { unhandled } from "../../types/Types.ts"
import type * as HttpRouter from "../http/HttpRouter.ts"
import type { HttpServerResponse } from "../http/HttpServerResponse.ts"
import type * as HttpApiEndpoint from "./HttpApiEndpoint.ts"
import type * as HttpApiGroup from "./HttpApiGroup.ts"
import type * as HttpApiSecurity from "./HttpApiSecurity.ts"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/httpapi/HttpApiMiddleware"

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = "~effect/httpapi/HttpApiMiddleware"

/**
 * @since 4.0.0
 * @category type ids
 */
export const SecurityTypeId: SecurityTypeId = "~effect/httpapi/HttpApiMiddleware/Security"

/**
 * @since 4.0.0
 * @category type ids
 */
export type SecurityTypeId = "~effect/httpapi/HttpApiMiddleware/Security"

/**
 * @since 4.0.0
 * @category guards
 */
export const isSecurity = (u: AnyKey): u is AnyKeySecurity => hasProperty(u, SecurityTypeId)

/**
 * @since 4.0.0
 * @category models
 */
export type HttpApiMiddleware<Provides, E extends Schema.Top, Requires> = (
  httpEffect: Effect.Effect<HttpServerResponse, unhandled, Provides>,
  options: {
    readonly endpoint: HttpApiEndpoint.AnyWithProps
    readonly group: HttpApiGroup.AnyWithProps
  }
) => Effect.Effect<HttpServerResponse, unhandled | E["Type"], Requires | HttpRouter.Provided>

/**
 * @since 4.0.0
 * @category models
 */
export type HttpApiMiddlewareSecurity<
  Security extends Record<string, HttpApiSecurity.HttpApiSecurity>,
  Provides,
  E extends Schema.Top,
  Requires
> = {
  readonly [K in keyof Security]: (
    httpEffect: Effect.Effect<HttpServerResponse, unhandled, Provides>,
    options: {
      readonly credential: HttpApiSecurity.HttpApiSecurity.Type<Security[K]>
      readonly endpoint: HttpApiEndpoint.AnyWithProps
      readonly group: HttpApiGroup.AnyWithProps
    }
  ) => Effect.Effect<HttpServerResponse, unhandled | E["Type"], Requires | HttpRouter.Provided>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface AnyKey extends ServiceMap.Key<any, any> {
  readonly [TypeId]: TypeId
  readonly provides: any
  readonly error: Schema.Top
}

/**
 * @since 4.0.0
 * @category models
 */
export interface AnyKeySecurity extends AnyKey {
  readonly [SecurityTypeId]: SecurityTypeId
  readonly security: Record<string, HttpApiSecurity.HttpApiSecurity>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface AnyId {
  readonly [TypeId]: {
    readonly provides: any
  }
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
 * @category Schemas
 */
export type KeyClass<
  Self,
  Id extends string,
  Config extends {
    requires: any
    provides: any
    error: Schema.Top
    security: Record<string, HttpApiSecurity.HttpApiSecurity>
  },
  Service =
    ([keyof Config["security"]] extends [never] ?
      HttpApiMiddleware<Config["provides"], Config["error"], Config["requires"]>
      : Simplify<
        HttpApiMiddlewareSecurity<Config["security"], Config["provides"], Config["error"], Config["requires"]>
      >)
> =
  & ServiceMap.Key<Self, Service>
  & {
    new(_: never): ServiceMap.KeyClass.Shape<Id, Service> & {
      readonly [TypeId]: {
        readonly error: Config["error"]
        readonly requires: Config["requires"]
        readonly provides: Config["provides"]
      }
    }
    readonly [TypeId]: TypeId
    readonly error: Config["error"]
  }
  & ([keyof Config["security"]] extends [never] ? {} : {
    readonly [SecurityTypeId]: SecurityTypeId
    readonly security: Config["security"]
  })

/**
 * @since 4.0.0
 * @category Schemas
 */
export const Key = <
  Self,
  Config extends {
    requires?: any
    provides?: any
  } = { requires: never; provides: never }
>(): <
  const Id extends string,
  Error extends Schema.Top = Schema.Never,
  const Security extends Record<string, HttpApiSecurity.HttpApiSecurity> = {}
>(
  id: Id,
  options?: {
    readonly error?: Error | undefined
    readonly security?: Security | undefined
  } | undefined
) => KeyClass<Self, Id, {
  requires: "requires" extends keyof Config ? Config["requires"] : never
  provides: "provides" extends keyof Config ? Config["provides"] : never
  error: Error
  security: Security
}> =>
(
  id: string,
  options?: {
    readonly security?: Record<string, HttpApiSecurity.HttpApiSecurity> | undefined
    readonly error?: Schema.Top | undefined
  } | undefined
) => {
  const Err = globalThis.Error as any
  const limit = Err.stackTraceLimit
  Err.stackTraceLimit = 2
  const creationError = new Err()
  Err.stackTraceLimit = limit

  class Key extends ServiceMap.Key<Self, any>()(id) {}
  const self = Key as any
  Object.defineProperty(Key, "stack", {
    get() {
      return creationError.stack
    }
  })
  self[TypeId] = TypeId
  self.error = options?.error === undefined ? Schema.Never : options.error
  if (options?.security) {
    if (Object.keys(options.security).length === 0) {
      throw new Error("HttpApiMiddleware.Tag: security object must not be empty")
    }
    self[SecurityTypeId] = SecurityTypeId
    self.security = options.security
  }
  return self
}
