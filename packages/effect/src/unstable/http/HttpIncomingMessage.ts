/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Inspectable from "../../Inspectable.ts"
import * as Option from "../../Option.ts"
import type * as FileSystem from "../../platform/FileSystem.ts"
import { hasProperty } from "../../Predicate.ts"
import type { ParseOptions } from "../../schema/AST.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Serializer from "../../schema/Serializer.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Stream from "../../Stream.ts"
import type * as Headers from "./Headers.ts"
import * as UrlParams from "./UrlParams.ts"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/http/HttpIncomingMessage"

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = "~effect/http/HttpIncomingMessage"

/**
 * @since 4.0.0
 * @category Guards
 */
export const isHttpIncomingMessage = (u: unknown): u is HttpIncomingMessage => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category models
 */
export interface HttpIncomingMessage<E = unknown> extends Inspectable.Inspectable {
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
  const decode = Schema.decodeEffect(Serializer.json(schema).annotate({ options }))
  return <E>(
    self: HttpIncomingMessage<E>
  ): Effect.Effect<S["Type"], E | Schema.SchemaError, S["DecodingServices"]> => Effect.flatMap(self.json, decode)
}

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaBodyUrlParams = <
  A,
  I extends Readonly<Record<string, string | ReadonlyArray<string> | undefined>>,
  RD,
  RE
>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
) => {
  const decode = UrlParams.schemaRecord.pipe(
    Schema.decodeTo(schema),
    Schema.annotate({ options }),
    Schema.decodeEffect
  )
  return <E>(self: HttpIncomingMessage<E>): Effect.Effect<A, E | Schema.SchemaError, RD> =>
    Effect.flatMap(self.urlParamsBody, decode)
}

/**
 * @since 4.0.0
 * @category schema
 */
export const schemaHeaders = <A, I extends Readonly<Record<string, string | undefined>>, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  options?: ParseOptions | undefined
) => {
  const decode = Schema.decodeUnknownEffect(schema)
  return <E>(self: HttpIncomingMessage<E>): Effect.Effect<A, Schema.SchemaError, RD> => decode(self.headers, options)
}

/**
 * @since 4.0.0
 * @category References
 */
export const MaxBodySize = ServiceMap.Reference<Option.Option<FileSystem.Size>>(
  "effect/http/HttpIncomingMessage/MaxBodySize",
  { defaultValue: Option.none }
)

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
