/**
 * @since 4.0.0
 */
import type * as FileSystem from "../../FileSystem.ts"
import { constVoid, dual, type LazyArg } from "../../Function.ts"
import * as Schema from "../../Schema.ts"
import * as AST from "../../SchemaAST.ts"
import * as Transformation from "../../SchemaTransformation.ts"
import type * as Multipart_ from "../http/Multipart.ts"

declare module "../../Schema.ts" {
  namespace Annotations {
    interface Annotations {
      readonly httpApiStatus?: number | undefined
      readonly httpApiBody?: Body | undefined
    }
  }
}

/**
 * @since 4.0.0
 */
export type Body =
  | {
    readonly _tag: "Multipart"
    readonly mode: "buffered" | "stream"
    readonly contentType: "multipart/form-data"
    readonly limits?: Multipart_.withLimits.Options | undefined
  }
  | {
    readonly _tag: "HasBody"
    readonly encoding: Encoding
  }

/**
 * @since 4.0.0
 */
export interface asNoContent<S extends Schema.Top> extends Schema.decodeTo<Schema.toType<S>, Schema.Void> {}

/**
 * @since 4.0.0
 * @category No Content
 */
export const asNoContent: {
  <S extends Schema.Top>(options: {
    readonly decode: LazyArg<S["Type"]>
    readonly status?: number | undefined
  }): (self: S) => asNoContent<S>
  <S extends Schema.Top>(
    self: S,
    options: {
      readonly decode: LazyArg<S["Type"]>
      readonly status?: number | undefined
    }
  ): asNoContent<S>
} = dual(
  2,
  <S extends Schema.Top>(
    self: S,
    options: {
      readonly status: number
      readonly decode: LazyArg<S["Type"]>
    }
  ): asNoContent<S> => {
    const transformation = Transformation.transform({
      decode: options.decode,
      encode: constVoid
    })
    let out = Schema.Void.pipe(
      Schema.decodeTo(
        Schema.toType(self),
        transformation
      )
    )
    if (options.status !== undefined) {
      out = out.annotate({
        httpApiStatus: options.status
      })
    }
    return out
  }
)

/**
 * @since 4.0.0
 * @category No Content
 */
export const Empty = (status: number): Schema.Void =>
  Schema.Void.annotate({
    httpApiStatus: status
  })

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
 * @since 4.0.0
 * @category No Content
 */
export const Created: Created = Empty(201)

/**
 * @since 4.0.0
 */
export interface Accepted extends Schema.Void {}

/**
 * @since 4.0.0
 * @category No Content
 */
export const Accepted: Accepted = Empty(202)

/**
 * @since 4.0.0
 * @category multipart
 */
export const MultipartTypeId = "~effect/httpapi/HttpApiSchema/Multipart"

/**
 * @since 4.0.0
 * @category multipart
 */
export type MultipartTypeId = typeof MultipartTypeId

/**
 * @since 4.0.0
 */
export interface asMultipart<S extends Schema.Top> extends Schema.brand<S["~rebuild.out"], MultipartTypeId> {}

/**
 * @since 4.0.0
 * @category multipart
 */
export function asMultipart(options?: {
  readonly maxParts?: number | undefined
  readonly maxFieldSize?: FileSystem.SizeInput | undefined
  readonly maxFileSize?: FileSystem.SizeInput | undefined
  readonly maxTotalSize?: FileSystem.SizeInput | undefined
  readonly fieldMimeTypes?: ReadonlyArray<string> | undefined
}) {
  return <S extends Schema.Top>(self: S): asMultipart<S> =>
    self.pipe(Schema.brand(MultipartTypeId)).annotate({
      httpApiBody: {
        _tag: "Multipart",
        mode: "buffered",
        contentType: "multipart/form-data",
        limits: options
      }
    })
}

/**
 * @since 4.0.0
 * @category multipart
 */
export const MultipartStreamTypeId = "~effect/httpapi/HttpApiSchema/MultipartStream"

/**
 * @since 4.0.0
 * @category multipart
 */
export type MultipartStreamTypeId = typeof MultipartStreamTypeId

/**
 * @since 4.0.0
 * @category multipart
 */
export interface asMultipartStream<S extends Schema.Top>
  extends Schema.brand<S["~rebuild.out"], MultipartStreamTypeId>
{}

/**
 * @since 4.0.0
 * @category multipart
 */
export function asMultipartStream<S extends Schema.Top>(options?: {
  readonly maxParts?: number | undefined
  readonly maxFieldSize?: FileSystem.SizeInput | undefined
  readonly maxFileSize?: FileSystem.SizeInput | undefined
  readonly maxTotalSize?: FileSystem.SizeInput | undefined
  readonly fieldMimeTypes?: ReadonlyArray<string> | undefined
}) {
  return <S extends Schema.Top>(self: S): asMultipartStream<S> =>
    self.pipe(Schema.brand(MultipartStreamTypeId)).annotate({
      httpApiBody: {
        _tag: "Multipart",
        mode: "stream",
        contentType: "multipart/form-data",
        limits: options
      }
    })
}

/**
 * @since 4.0.0
 * @category encoding
 */
export interface Encoding {
  readonly _tag: "Json" | "UrlParams" | "Uint8Array" | "Text"
  readonly contentType: string
}

function withEncoding<S extends Schema.Top>(self: S, options: {
  readonly _tag: Encoding["_tag"]
  readonly contentType?: string | undefined
}): S["~rebuild.out"] {
  return self.annotate({
    httpApiBody: {
      _tag: "HasBody",
      encoding: {
        _tag: options._tag,
        contentType: options.contentType ?? defaultContentType(options._tag)
      }
    }
  })
}

function defaultContentType(_tag: Encoding["_tag"]) {
  switch (_tag) {
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
 * @since 4.0.0
 * @category encoding
 */
export function asJson(options?: {
  readonly contentType?: string
}) {
  return <S extends Schema.Top>(self: S) => withEncoding(self, { _tag: "Json", ...options })
}

/**
 * @since 4.0.0
 * @category encoding
 */
export function asUrlParams(options?: {
  readonly contentType?: string
}) {
  return <S extends Schema.Top & { readonly Encoded: Record<string, string | undefined> }>(self: S) =>
    withEncoding(self, { _tag: "UrlParams", ...options })
}

/**
 * @since 4.0.0
 * @category encoding
 */
export function asText(options?: {
  readonly contentType?: string
}) {
  return <S extends Schema.Top & { readonly Encoded: string }>(self: S) =>
    withEncoding(self, { _tag: "Text", ...options })
}

/**
 * @since 4.0.0
 * @category encoding
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

const resolveHttpApiBody = AST.resolveAt<Body>("httpApiBody")

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

const defaultJsonBody: Body = {
  _tag: "HasBody",
  encoding: defaultJsonEncoding
}

/** @internal */
export function getBody(ast: AST.AST): Body {
  return resolveHttpApiBody(ast) ?? defaultJsonBody
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
