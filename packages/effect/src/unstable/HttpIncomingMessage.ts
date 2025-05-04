/**
 * @since 4.0.0
 */
import * as Context from "../Context.js"
import * as Effect from "../Effect.js"
import * as FileSystem from "../FileSystem.js"
import { dual } from "../Function.js"
import * as Inspectable from "../Inspectable.js"
import * as Option from "../Option.js"
import type * as Schema from "../Schema.js"
import type { ParseOptions } from "../SchemaAST.js"
import type * as SchemaIssue from "../SchemaIssue.js"
import * as SchemaValidator from "../SchemaValidator.js"
import type * as Stream from "../Stream.js"
import type * as Headers from "./Headers.js"
import type * as UrlParams from "./UrlParams.js"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: unique symbol = Symbol.for("effect/HttpIncomingMessage")

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 4.0.0
 * @category models
 */
export interface HttpIncomingMessage<E> extends Inspectable.Inspectable {
  readonly [TypeId]: TypeId
  readonly headers: Headers.Headers
  readonly remoteAddress: Option.Option<string>
  readonly json: Effect.Effect<unknown, E>
  readonly text: Effect.Effect<string, E>
  readonly urlParamsBody: Effect.Effect<UrlParams.UrlParams, E>
  readonly arrayBuffer: Effect.Effect<ArrayBuffer, E>
  readonly stream: Stream.Stream<Uint8Array, E>
}

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaBodyJson = <S extends Schema.Schema<any>>(schema: S, options?: ParseOptions | undefined) => {
  const decode = SchemaValidator.decodeUnknown(schema)
  return <E>(
    self: HttpIncomingMessage<E>
  ): Effect.Effect<S["Type"], E | SchemaIssue.Issue, S["DecodingContext"] | S["IntrinsicContext"]> =>
    Effect.flatMap(self.json, (_) => decode(_, options))
}

// /**
//  * @since 4.0.0
//  * @category schema
//  */
// export const schemaBodyUrlParams = <
//   A,
//   I extends Readonly<Record<string, string | ReadonlyArray<string> | undefined>>,
//   R
// >(
//   schema: Schema.Schema<A, I, R>,
//   options?: ParseOptions | undefined
// ) => {
//   const decode = UrlParams.schemaStruct(schema, options)
//   return <E>(self: HttpIncomingMessage<E>): Effect.Effect<A, E | ParseResult.ParseError, R> =>
//     Effect.flatMap(self.urlParamsBody, decode)
// }

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaHeaders = <A, I extends Readonly<Record<string, string | undefined>>, RD, RE, RI>(
  schema: Schema.Codec<A, I, RD, RE, RI>,
  options?: ParseOptions | undefined
) => {
  const decode = SchemaValidator.decodeUnknown(schema)
  return <E>(self: HttpIncomingMessage<E>): Effect.Effect<A, SchemaIssue.Issue, RD | RI> =>
    decode(self.headers, options)
}

/**
 * @since 4.0.0
 * @category References
 */
export class MaxBodySize extends Context.Reference("effect/HttpIncomingMessage/MaxBodySize", {
  defaultValue: () => Option.none<FileSystem.Size>()
}) {}

/**
 * @since 4.0.0
 * @category fiber refs
 */
export const withMaxBodySize = dual<
  (size: Option.Option<FileSystem.SizeInput>) => <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>,
  <A, E, R>(effect: Effect.Effect<A, E, R>, size: Option.Option<FileSystem.SizeInput>) => Effect.Effect<A, E, R>
>(2, (effect, size) => Effect.provideService(effect, MaxBodySize, Option.map(size, FileSystem.Size)))

/**
 * @since 4.0.0
 */
export const inspect = <E>(self: HttpIncomingMessage<E>, that: object): object => {
  const contentType = self.headers["content-type"] ?? ""
  let body: unknown
  if (contentType.includes("application/json")) {
    try {
      body = Effect.runSync(self.json)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      //
    }
  } else if (contentType.includes("text/") || contentType.includes("urlencoded")) {
    try {
      body = Effect.runSync(self.text)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      //
    }
  }
  const obj: any = {
    ...that,
    headers: Inspectable.redact(self.headers),
    remoteAddress: self.remoteAddress.toJSON()
  }
  if (body !== undefined) {
    obj.body = body
  }
  return obj
}
