/**
 * @since 4.0.0
 */
import { constVoid, type LazyArg } from "../../Function.ts"
import * as Schema from "../../Schema.ts"
import * as AST from "../../SchemaAST.ts"
import * as Transformation from "../../SchemaTransformation.ts"
import type * as Multipart_ from "../http/Multipart.ts"

declare module "../../Schema.ts" {
  namespace Annotations {
    interface Augment {
      readonly httpApiStatus?: number | undefined
      /** @internal */
      readonly httpApiEncoding?: Encoding | undefined
    }
  }
}

/**
 * @since 4.0.0
 */
export type Encoding = RequestEncoding | ResponseEncoding

/**
 * Encodings for request bodies
 *
 * @since 4.0.0
 */
export type RequestEncoding =
  | {
    readonly _tag: "Multipart"
    readonly mode: "buffered" | "stream"
    readonly contentType: string
    readonly limits?: Multipart_.withLimits.Options | undefined
  }
  | {
    readonly _tag: "Json" | "UrlParams" | "Uint8Array" | "Text"
    readonly contentType: string
  }

/**
 * Encodings for response bodies
 *
 * @since 4.0.0
 */
export type ResponseEncoding = {
  readonly _tag: "Json" | "UrlParams" | "Uint8Array" | "Text"
  readonly contentType: string
}

/**
 * @category status
 * @since 4.0.0
 */
export function status(code: number) {
  return <S extends Schema.Top>(self: S): S["~rebuild.out"] => {
    return self.annotate({ httpApiStatus: code })
  }
}

/**
 * @since 4.0.0
 */
export interface asNoContent<S extends Schema.Top> extends Schema.decodeTo<Schema.toType<S>, Schema.Void> {}

/**
 * @category No Content
 * @since 4.0.0
 */
export function asNoContent<S extends Schema.Top>(options: {
  readonly decode: LazyArg<S["Type"]>
}) {
  return (self: S): asNoContent<S> => {
    return Schema.Void.pipe(
      Schema.decodeTo(
        Schema.toType(self),
        Transformation.transform({
          decode: options.decode,
          encode: constVoid
        })
      )
    )
  }
}

/**
 * @category No Content
 * @since 4.0.0
 */
export const Empty = (code: number): Schema.Void => Schema.Void.pipe(status(code))

/**
 * @since 4.0.0
 */
export interface NoContent extends Schema.Void {}

/**
 * @since 4.0.0
 * @category No Content
 */
export const NoContent: NoContent = Empty(204)

/**
 * @since 4.0.0
 */
export interface Created extends Schema.Void {}

/**
 * @category No Content
 * @since 4.0.0
 */
export const Created: Created = Empty(201)

/**
 * @since 4.0.0
 */
export interface Accepted extends Schema.Void {}

/**
 * @category No Content
 * @since 4.0.0
 */
export const Accepted: Accepted = Empty(202)

/**
 * @category multipart
 * @since 4.0.0
 */
export const MultipartTypeId = "~effect/httpapi/HttpApiSchema/Multipart"

/**
 * @category multipart
 * @since 4.0.0
 */
export type MultipartTypeId = typeof MultipartTypeId

/**
 * @since 4.0.0
 */
export interface asMultipart<S extends Schema.Top> extends Schema.brand<S["~rebuild.out"], MultipartTypeId> {}

/**
 * @category multipart
 * @since 4.0.0
 */
export function asMultipart(options?: Multipart_.withLimits.Options) {
  return <S extends Schema.Top>(self: S): asMultipart<S> =>
    self.pipe(Schema.brand(MultipartTypeId)).annotate({
      httpApiEncoding: {
        _tag: "Multipart",
        mode: "buffered",
        contentType: defaultContentType("Multipart"),
        limits: options
      }
    })
}

/**
 * @category multipart
 * @since 4.0.0
 */
export const MultipartStreamTypeId = "~effect/httpapi/HttpApiSchema/MultipartStream"

/**
 * @category multipart
 * @since 4.0.0
 */
export type MultipartStreamTypeId = typeof MultipartStreamTypeId

/**
 * @category multipart
 * @since 4.0.0
 */
export interface asMultipartStream<S extends Schema.Top>
  extends Schema.brand<S["~rebuild.out"], MultipartStreamTypeId>
{}

/**
 * @category multipart
 * @since 4.0.0
 */
export function asMultipartStream(options?: Multipart_.withLimits.Options) {
  return <S extends Schema.Top>(self: S): asMultipartStream<S> =>
    self.pipe(Schema.brand(MultipartStreamTypeId)).annotate({
      httpApiEncoding: {
        _tag: "Multipart",
        mode: "stream",
        contentType: defaultContentType("Multipart"),
        limits: options
      }
    })
}

function withEncoding<S extends Schema.Top>(self: S, options: {
  readonly _tag: "Json" | "UrlParams" | "Uint8Array" | "Text"
  readonly contentType?: string | undefined
}): S["~rebuild.out"] {
  return self.annotate({
    httpApiEncoding: {
      _tag: options._tag,
      contentType: options.contentType ?? defaultContentType(options._tag)
    }
  })
}

function defaultContentType(_tag: Encoding["_tag"]): string {
  switch (_tag) {
    case "Multipart":
      return "multipart/form-data"
    case "Json":
      return "application/json"
    case "UrlParams":
      return "application/x-www-form-urlencoded"
    case "Uint8Array":
      return "application/octet-stream"
    case "Text":
      return "text/plain"
  }
}

/**
 * @category encoding
 * @since 4.0.0
 */
export function asJson(options?: {
  readonly contentType?: string
}) {
  return <S extends Schema.Top>(self: S) => withEncoding(self, { _tag: "Json", ...options })
}

/**
 * @category encoding
 * @since 4.0.0
 */
export function asUrlParams(options?: {
  readonly contentType?: string
}) {
  return <S extends Schema.Top & { readonly Encoded: Record<string, string | undefined> }>(self: S) =>
    withEncoding(self, { _tag: "UrlParams", ...options })
}

/**
 * @category encoding
 * @since 4.0.0
 */
export function asText(options?: {
  readonly contentType?: string
}) {
  return <S extends Schema.Top & { readonly Encoded: string }>(self: S) =>
    withEncoding(self, { _tag: "Text", ...options })
}

/**
 * @category encoding
 * @since 4.0.0
 */
export function asUint8Array(options?: {
  readonly contentType?: string
}) {
  return <S extends Schema.Top & { readonly Encoded: Uint8Array }>(self: S) =>
    withEncoding(self, { _tag: "Uint8Array", ...options })
}

/** @internal */
export function forEach(schema: Schema.Top, f: (schema: Schema.Top) => void): void {
  if (isHttpApiContainer(schema)) {
    for (const member of schema.members) {
      f(member)
    }
  } else {
    f(schema)
  }
}

/** @internal */
export function getSchemas(schema: Schema.Top): Set<Schema.Top> {
  const schemas = new Set<Schema.Top>()
  forEach(schema, (schema) => schemas.add(schema))
  return schemas
}

const resolveHttpApiEncoding = AST.resolveAt<Encoding>("httpApiEncoding")

const resolveHttpApiStatus = AST.resolveAt<number>("httpApiStatus")

const resolveHttpApiIsContainer = AST.resolveAt<boolean>("httpApiIsContainer")

/** @internal */
export function isNoContent(ast: AST.AST): boolean {
  return AST.isVoid(AST.toEncoded(ast))
}

/** @internal */
export function isUndecodableNoContent(ast: AST.AST): boolean {
  return AST.isVoid(AST.toEncoded(ast)) && ast.encoding === undefined
}

const defaultJsonEncoding: Encoding = {
  _tag: "Json",
  contentType: "application/json"
}

function getEncoding(ast: AST.AST): Encoding {
  return resolveHttpApiEncoding(ast) ?? defaultJsonEncoding
}

/** @internal */
export function getRequestEncoding(ast: AST.AST): RequestEncoding {
  return getEncoding(ast)
}

/** @internal */
export function getResponseEncoding(ast: AST.AST): ResponseEncoding {
  const out = getEncoding(ast)
  if (out._tag === "Multipart") {
    throw new Error("Multipart is not supported in response")
  }
  return out
}

/** @internal */
export function getStatusSuccess(self: AST.AST): number {
  return resolveHttpApiStatus(self) ?? 200
}

/** @internal */
export function getStatusError(self: AST.AST): number {
  return resolveHttpApiStatus(self) ?? 500
}

/** @internal */
export function isHttpApiContainer(schema: Schema.Top): schema is Schema.Union<ReadonlyArray<Schema.Top>> {
  const ast = schema.ast
  return AST.isUnion(ast) && resolveHttpApiIsContainer(ast) === true
}

/** @internal */
export function makeHttpApiContainer(schemas: ReadonlyArray<Schema.Top>): Schema.Top {
  schemas = [...new Set(schemas)] // unique
  return schemas.length === 1 ? schemas[0] : Schema.Union(schemas).annotate({ httpApiIsContainer: true })
}
