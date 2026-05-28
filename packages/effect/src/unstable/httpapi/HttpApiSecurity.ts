/**
 * Defines security scheme declarations for declarative HTTP APIs.
 *
 * Security schemes describe where credentials are read from and which credential
 * type is passed to security middleware. They are consumed by
 * `HttpApiMiddleware.Service`, `HttpApiBuilder`, generated clients, and OpenAPI
 * generation, but they do not authenticate requests by themselves.
 *
 * **Mental model**
 *
 * Create a scheme with {@link http}, {@link bearer}, {@link dpop},
 * {@link apiKey}, or {@link basic}, attach it to middleware, and let the HTTP
 * API builder decode the matching credential shape from each request. OpenAPI
 * generation emits the same declaration as `components.securitySchemes` plus
 * operation security requirements.
 *
 * **Common tasks**
 *
 * Use {@link http} for any HTTP authorization scheme whose parameter should be
 * exposed as a redacted value, {@link bearer} for `Authorization: Bearer ...`
 * tokens, {@link dpop} for `Authorization: DPoP ...` access tokens,
 * {@link basic} for HTTP Basic username/password credentials, and {@link apiKey}
 * for keys passed through headers, query parameters, or cookies. Use
 * {@link annotate} or {@link annotateMerge} to add documentation metadata for
 * generated OpenAPI descriptions.
 *
 * **Gotchas**
 *
 * Middleware must reject empty or invalid credentials. HTTP authorization
 * parameters and API-key values are delivered as `Redacted` values; Basic
 * credentials expose the username and redact the password. HTTP and Basic
 * schemes read the `Authorization` header and yield empty credentials when its
 * authentication scheme or token syntax does not match. API-key headers use
 * HTTP header name normalization, and API-key query or cookie names are
 * matched exactly. A DPoP scheme does not decode or validate the required
 * `DPoP` proof header. OpenAPI annotations do not change runtime decoding.
 *
 * **See also**
 *
 * `HttpApiMiddleware` for implementing security checks and `HttpApiBuilder` for
 * installing middleware and setting API-key cookies on responses.
 *
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
export type HttpApiSecurity = Http | ApiKey | Basic

/**
 * Helper types for HTTP API security schemes.
 *
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
 * HTTP authorization security scheme whose decoded credential is a redacted parameter.
 *
 * @category models
 * @since 4.0.0
 */
export interface Http<out Scheme extends string = string> extends HttpApiSecurity.Proto<Redacted> {
  readonly _tag: "Http"
  readonly scheme: Scheme
}

/**
 * Bearer token security scheme whose decoded credential is a redacted token.
 *
 * @category models
 * @since 4.0.0
 */
export interface Bearer extends Http<"bearer"> {
}

/**
 * DPoP-bound access-token security scheme whose decoded credential is a redacted token.
 *
 * @category models
 * @since 4.0.0
 */
export interface DPoP extends Http<"DPoP"> {
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
 * Creates an HTTP authorization security scheme.
 *
 * **When to use**
 *
 * Use to require an HTTP authorization parameter for a scheme not otherwise
 * represented by a convenience declaration.
 *
 * @see {@link bearer} for a Bearer token security scheme
 * @see {@link dpop} for a DPoP-bound access-token security scheme
 * @see {@link basic} for decoded HTTP Basic username/password credentials
 * @category constructors
 * @since 4.0.0
 */
export const http = <const Scheme extends string>(options: {
  readonly scheme: Scheme
}): Http<Scheme> =>
  Object.assign(Object.create(Proto), {
    _tag: "Http",
    scheme: options.scheme,
    annotations: Context.empty()
  })

/**
 * Creates a Bearer token security scheme.
 *
 * **When to use**
 *
 * Use to require `Authorization: Bearer ...` credentials for an HTTP API group
 * or endpoint.
 *
 * **Details**
 *
 * Use `HttpApiBuilder.middlewareSecurity` to implement API middleware for this
 * security scheme.
 *
 * @see {@link http} for any HTTP authorization security scheme
 * @see {@link dpop} for a DPoP-bound access-token security scheme
 * @see {@link apiKey} for an API-key security scheme
 * @see {@link basic} for an HTTP Basic security scheme
 * @category constructors
 * @since 4.0.0
 */
export const bearer: Bearer = http({ scheme: "bearer" })

/**
 * Creates a DPoP-bound access-token security scheme.
 *
 * **When to use**
 *
 * Use to require `Authorization: DPoP ...` credentials for an HTTP API group
 * or endpoint.
 *
 * **Gotchas**
 *
 * This scheme extracts only the access-token parameter. Validate the required
 * `DPoP` proof JWT header in middleware or request schemas.
 *
 * @see {@link http} for any HTTP authorization security scheme
 * @see {@link bearer} for a Bearer token security scheme
 * @see {@link apiKey} for an API-key security scheme
 * @category constructors
 * @since 4.0.0
 */
export const dpop: DPoP = http({ scheme: "DPoP" })

/**
 * Creates an API key security scheme.
 *
 * **When to use**
 *
 * Use to require API key credentials passed through a header, query parameter,
 * or cookie.
 *
 * **Details**
 *
 * Use `HttpApiBuilder.middlewareSecurity` to implement API middleware for this
 * security scheme.
 *
 * Use `HttpApiBuilder.securitySetCookie` to set the correct cookie in a
 * handler. By default, `in` is `"header"`.
 *
 * @see {@link http} for an HTTP authorization security scheme
 * @see {@link bearer} for a Bearer token security scheme
 * @see {@link dpop} for a DPoP-bound access-token security scheme
 * @see {@link basic} for an HTTP Basic security scheme
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
 * **When to use**
 *
 * Use to require HTTP Basic username/password credentials.
 *
 * **Details**
 *
 * Use `HttpApiBuilder.middlewareSecurity` to implement API middleware for this
 * security scheme.
 *
 * `basic` is specialized rather than an alias for {@link http}, because it
 * decodes the authorization parameter into `Credentials`.
 *
 * @see {@link http} for a redacted HTTP authorization parameter
 * @see {@link bearer} for a Bearer token security scheme
 * @see {@link dpop} for a DPoP-bound access-token security scheme
 * @see {@link apiKey} for an API-key security scheme
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
