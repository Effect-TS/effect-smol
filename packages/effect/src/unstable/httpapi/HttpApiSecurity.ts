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
 * Union of security schemes supported by the HTTP API OpenAPI model.
 *
 * @category models
 * @since 4.0.0
 */
export type HttpApiSecurity = Bearer | ApiKey | Basic

/**
 * Helper types for HTTP API security schemes.
 *
 * @category models
 * @since 4.0.0
 */
export declare namespace HttpApiSecurity {
  /**
   * Common prototype for security schemes, carrying the credential type and OpenAPI annotations.
   *
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
   * Extracts the credential type produced by a security scheme.
   *
   * @category models
   * @since 4.0.0
   */
  export type Type<A extends HttpApiSecurity> = A extends Proto<infer Out> ? Out : never
}

/**
 * Bearer token security scheme whose decoded credential is a redacted token.
 *
 * @category models
 * @since 4.0.0
 */
export interface Bearer extends HttpApiSecurity.Proto<Redacted> {
  readonly _tag: "Bearer"
}

/**
 * API key security scheme identifying the key name and whether it is read from a header, query parameter, or cookie.
 *
 * @category models
 * @since 4.0.0
 */
export interface ApiKey extends HttpApiSecurity.Proto<Redacted> {
  readonly _tag: "ApiKey"
  readonly in: "header" | "query" | "cookie"
  readonly key: string
}

/**
 * HTTP Basic authentication security scheme whose decoded credential is `Credentials`.
 *
 * @category models
 * @since 4.0.0
 */
export interface Basic extends HttpApiSecurity.Proto<Credentials> {
  readonly _tag: "Basic"
}

/**
 * Decoded credentials for HTTP Basic authentication.
 *
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
 * Creates an HTTP Basic authentication security scheme.
 *
 * You can implement API middleware for this security scheme with
 * `HttpApiBuilder.middlewareSecurity`.
 *
 * @category constructors
 * @since 4.0.0
 */
export const basic: Basic = Object.assign(Object.create(Proto), {
  _tag: "Basic",
  annotations: Context.empty()
})

/**
 * Merges OpenAPI annotations into a security scheme.
 *
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
 * Adds an OpenAPI annotation value to a security scheme.
 *
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
