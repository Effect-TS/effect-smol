/**
 * @since 4.0.0
 */
import * as Context from "../../Context.ts"
import { dual } from "../../Function.ts"
import { type Pipeable, pipeArguments } from "../../Pipeable.ts"
import type { Redacted } from "../../Redacted.ts"
import type { Covariant } from "../../Types.ts"

const TypeId = "~effect/httpapi/HttpApiSecurity"

/**
 * @category models
 * @since 4.0.0
 */
export type HttpApiSecurity = Bearer | ApiKey | Basic

/**
 * @category models
 * @since 4.0.0
 */
export declare namespace HttpApiSecurity {
  /**
   * @category models
   * @since 4.0.0
   */
  export interface Proto<out A> extends Pipeable {
    readonly [TypeId]: {
      readonly _A: Covariant<A>
    }
    readonly annotations: Context.Context<never>
  }

  /**
   * @category models
   * @since 4.0.0
   */
  export type Type<A extends HttpApiSecurity> = A extends Proto<infer Out> ? Out : never
}

/**
 * @category models
 * @since 4.0.0
 */
export interface Bearer extends HttpApiSecurity.Proto<Redacted> {
  readonly _tag: "Bearer"
}

/**
 * @category models
 * @since 4.0.0
 */
export interface ApiKey extends HttpApiSecurity.Proto<Redacted> {
  readonly _tag: "ApiKey"
  readonly in: "header" | "query" | "cookie"
  readonly key: string
}

/**
 * @category models
 * @since 4.0.0
 */
export interface Basic extends HttpApiSecurity.Proto<Credentials> {
  readonly _tag: "Basic"
}

/**
 * @category models
 * @since 4.0.0
 */
export interface Credentials {
  readonly username: string
  readonly password: Redacted
}

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * Create an Bearer token security scheme.
 *
 * You can implement some api middleware for this security scheme using
 * `HttpApiBuilder.middlewareSecurity`.
 *
 * @category constructors
 * @since 4.0.0
 */
export const bearer: Bearer = Object.assign(Object.create(Proto), {
  _tag: "Bearer",
  annotations: Context.empty()
})

/**
 * Create an API key security scheme.
 *
 * You can implement some api middleware for this security scheme using
 * `HttpApiBuilder.middlewareSecurity`.
 *
 * To set the correct cookie in a handler, you can use
 * `HttpApiBuilder.securitySetCookie`.
 *
 * The default value for `in` is "header".
 *
 * @category constructors
 * @since 4.0.0
 */
export const apiKey = (options: {
  readonly key: string
  readonly in?: "header" | "query" | "cookie" | undefined
}): ApiKey =>
  Object.assign(Object.create(Proto), {
    _tag: "ApiKey",
    key: options.key,
    in: options.in ?? "header",
    annotations: Context.empty()
  })

/**
 * @category constructors
 * @since 4.0.0
 */
export const basic: Basic = Object.assign(Object.create(Proto), {
  _tag: "Basic",
  annotations: Context.empty()
})

/**
 * @category annotations
 * @since 4.0.0
 */
export const annotateMerge: {
  <I>(annotations: Context.Context<I>): <A extends HttpApiSecurity>(self: A) => A
  <A extends HttpApiSecurity, I>(self: A, annotations: Context.Context<I>): A
} = dual(
  2,
  <A extends HttpApiSecurity, I>(self: A, annotations: Context.Context<I>): A =>
    Object.assign(Object.create(Proto), {
      ...self,
      annotations: Context.merge(self.annotations, annotations)
    })
)

/**
 * @category annotations
 * @since 4.0.0
 */
export const annotate: {
  <I, S>(service: Context.Key<I, S>, value: S): <A extends HttpApiSecurity>(self: A) => A
  <A extends HttpApiSecurity, I, S>(self: A, service: Context.Key<I, S>, value: S): A
} = dual(
  3,
  <A extends HttpApiSecurity, I, S>(self: A, service: Context.Key<I, S>, value: S): A =>
    Object.assign(Object.create(Proto), {
      ...self,
      annotations: Context.add(self.annotations, service, value)
    })
)
