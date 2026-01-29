/**
 * @since 4.0.0
 */
import type { YieldableError } from "../../Cause.ts"
import type * as FileSystem from "../../FileSystem.ts"
import { constant, constVoid, dual, type LazyArg } from "../../Function.ts"
import * as Predicate from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import * as AST from "../../SchemaAST.ts"
import * as Transformation from "../../SchemaTransformation.ts"
import type * as Multipart_ from "../http/Multipart.ts"

declare module "../../Schema.ts" {
  namespace Annotations {
    interface Annotations {
      readonly httpApiEncoding?: Encoding | undefined
      readonly httpApiStatus?: number | undefined
      /** @internal */
      readonly httpApiMultipart?: {
        readonly mode: "buffered" | "stream"
        readonly limits?: Multipart_.withLimits.Options | undefined
      }
    }
  }
}

/** @internal */
export const resolveHttpApiMultipart = AST.resolveAt<{
  readonly mode: "buffered" | "stream"
  readonly limits?: Multipart_.withLimits.Options | undefined
}>("httpApiMultipart")
const resolveHttpApiStatus = AST.resolveAt<number>("httpApiStatus")
const resolveHttpApiEncoding = AST.resolveAt<Encoding>("httpApiEncoding")

/** @internal */
export function isEmptyEncoded(ast: AST.AST): boolean {
  return AST.isVoid(AST.toEncoded(ast))
}

/** @internal */
export function isEmpty(ast: AST.AST): boolean {
  return AST.isVoid(ast) && AST.toEncoded(ast) === ast
}

/** @internal */
export function getStatusSuccess(self: AST.AST): number {
  return resolveHttpApiStatus(self) ?? (isEmptyEncoded(self) ? 204 : 200)
}

/** @internal */
export function getStatusError(self: AST.AST): number {
  return resolveHttpApiStatus(self) ?? 500
}

const resolveHttpApiIsContainer = AST.resolveAt<boolean>("httpApiIsContainer")

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

// TODO: add description
/**
 * @since 4.0.0
 * @category empty response
 */
export const Empty = (status: number): Schema.Void => Schema.Void.annotate({ httpApiStatus: status })

/**
 * @since 4.0.0
 */
export interface asEmpty<S extends Schema.Top> extends Schema.decodeTo<S, Schema.Void> {}

/**
 * @since 4.0.0
 * @category empty response
 */
export const asEmpty: {
  <S extends Schema.Top>(options: {
    readonly status: number
    readonly decode: LazyArg<S["Encoded"]>
  }): (self: S) => asEmpty<S>
  <S extends Schema.Top>(
    self: S,
    options: {
      readonly status: number
      readonly decode: LazyArg<S["Encoded"]>
    }
  ): asEmpty<S>
} = dual(
  2,
  <S extends Schema.Top>(
    self: S,
    options: {
      readonly status: number
      readonly decode: LazyArg<S["Encoded"]>
    }
  ): asEmpty<S> =>
    Schema.Void.pipe(
      Schema.decodeTo(
        self,
        Transformation.transform({
          decode: options.decode,
          encode: constVoid
        })
      )
    ).annotate({
      httpApiStatus: options.status
    })
)

/**
 * @since 4.0.0
 */
export interface NoContent extends Schema.Void {}

/**
 * @since 4.0.0
 * @category empty response
 */
export const NoContent: NoContent = Empty(204)

/**
 * @since 4.0.0
 */
export interface Created extends Schema.Void {}

/**
 * @since 4.0.0
 * @category empty response
 */
export const Created: Created = Empty(201)

/**
 * @since 4.0.0
 */
export interface Accepted extends Schema.Void {}

/**
 * @since 4.0.0
 * @category empty response
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
 * @category multipart
 */
export interface Multipart<S extends Schema.Top> extends Schema.brand<S["~rebuild.out"], MultipartTypeId> {}

/**
 * @since 4.0.0
 * @category multipart
 */
export const Multipart = <S extends Schema.Top>(self: S, options?: {
  readonly maxParts?: number | undefined
  readonly maxFieldSize?: FileSystem.SizeInput | undefined
  readonly maxFileSize?: FileSystem.SizeInput | undefined
  readonly maxTotalSize?: FileSystem.SizeInput | undefined
  readonly fieldMimeTypes?: ReadonlyArray<string> | undefined
}): Multipart<S> =>
  self.pipe(Schema.brand(MultipartTypeId)).annotate({
    httpApiMultipart: {
      mode: "buffered",
      limits: options
    }
  })

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
export interface MultipartStream<S extends Schema.Top> extends Schema.brand<S["~rebuild.out"], MultipartStreamTypeId> {}

/**
 * @since 4.0.0
 * @category multipart
 */
export const MultipartStream = <S extends Schema.Top>(self: S, options?: {
  readonly maxParts?: number | undefined
  readonly maxFieldSize?: FileSystem.SizeInput | undefined
  readonly maxFileSize?: FileSystem.SizeInput | undefined
  readonly maxTotalSize?: FileSystem.SizeInput | undefined
  readonly fieldMimeTypes?: ReadonlyArray<string> | undefined
}): MultipartStream<S> =>
  self.pipe(Schema.brand(MultipartStreamTypeId)).annotate({
    httpApiMultipart: {
      mode: "stream",
      limits: options
    }
  })

/**
 * @since 4.0.0
 * @category encoding
 */
export interface Encoding {
  readonly _tag: "Json" | "FormUrlEncoded" | "Binary" | "Text"
  readonly contentType: string
}

/**
 * @since 4.0.0
 * @category encoding
 */
export declare namespace Encoding {
  /**
   * @since 4.0.0
   * @category encoding
   */
  export type Validate<A extends Schema.Top, Tag extends Encoding["_tag"]> = Tag extends "Json" ? {}
    : Tag extends "FormUrlEncoded" ? [A["Encoded"]] extends [Readonly<Record<string, string | undefined>>] ? {}
      : `'FormUrlEncoded' _tag can only be encoded to 'Record<string, string | undefined>'`
    : Tag extends "Binary" ?
      [A["Encoded"]] extends [Uint8Array] ? {} : `'Binary' _tag can only be encoded to 'Uint8Array'`
    : Tag extends "Text" ? [A["Encoded"]] extends [string] ? {} : `'Text' _tag can only be encoded to 'string'`
    : never
}

const defaultContentType = (_tag: Encoding["_tag"]) => {
  switch (_tag) {
    case "Json":
      return "application/json"
    case "FormUrlEncoded":
      return "application/x-www-form-urlencoded"
    case "Binary":
      return "application/octet-stream"
    case "Text":
      return "text/plain"
  }
}

/**
 * @since 4.0.0
 * @category encoding
 */
export const withEncoding: {
  <S extends Schema.Top, Tag extends Encoding["_tag"]>(
    options: {
      readonly _tag: Tag
      readonly contentType?: string | undefined
    } & Encoding.Validate<S, Tag>
  ): (self: S) => S["~rebuild.out"]
  <S extends Schema.Top, Tag extends Encoding["_tag"]>(
    self: S,
    options: {
      readonly _tag: Tag
      readonly contentType?: string | undefined
    } & Encoding.Validate<S, Tag>
  ): S["~rebuild.out"]
} = dual(2, <S extends Schema.Top>(self: S, options: {
  readonly _tag: Encoding["_tag"]
  readonly contentType?: string | undefined
}): S["~rebuild.out"] =>
  self.annotate({
    httpApiEncoding: {
      _tag: options._tag,
      contentType: options.contentType ?? defaultContentType(options._tag)
    }
  }))

const encodingJson: Encoding = {
  _tag: "Json",
  contentType: "application/json"
}

const encodingMultipart: Encoding = {
  _tag: "Json",
  contentType: "multipart/form-data"
}

/** @internal */
export function getEncoding(ast: AST.AST): Encoding {
  if (resolveHttpApiMultipart(ast) !== undefined) {
    return encodingMultipart
  }
  return resolveHttpApiEncoding(ast) ?? encodingJson
}

/**
 * @since 4.0.0
 * @category encoding
 */
export const Text = (options?: {
  readonly contentType?: string
}): Schema.String => withEncoding(Schema.String, { _tag: "Text", ...options })

/**
 * @since 4.0.0
 * @category encoding
 */
export const Binary = (options?: {
  readonly contentType?: string
}): Schema.Uint8Array => withEncoding(Schema.Uint8Array, { _tag: "Binary", ...options })

/**
 * @since 4.0.0
 * @category empty errors
 */
export interface EmptyErrorClass<Self, Tag> extends
  Schema.Bottom<
    Self,
    void,
    never,
    never,
    AST.Declaration,
    EmptyErrorClass<Self, Tag>, // TODO: Fix this
    readonly [] // TODO: Fix this
  >
{
  new(): { readonly _tag: Tag } & YieldableError
}

const EmptyErrorTypeId = "~effect/httpapi/HttpApiSchema/EmptyError"

/**
 * @since 4.0.0
 * @category empty errors
 */
export const EmptyError = <Self>() =>
<const Tag extends string>(options: {
  readonly tag: Tag
  readonly status: number
}): EmptyErrorClass<Self, Tag> => {
  class EmptyError extends Schema.ErrorClass<EmptyError>(`effect/httpapi/HttpApiSchema/EmptyError/${options.tag}`)({
    _tag: Schema.tag(options.tag)
  }, {
    id: options.tag
  }) {
    readonly [EmptyErrorTypeId]: typeof EmptyErrorTypeId
    constructor() {
      super({}, { disableValidation: true })
      this[EmptyErrorTypeId] = EmptyErrorTypeId
      this.name = options.tag
    }
  }
  let transform: Schema.Top | undefined
  Object.defineProperty(EmptyError, "ast", {
    get() {
      if (transform) {
        return transform.ast
      }
      const self = this as any
      const decoded = new self()
      decoded.stack = options.tag
      transform = asEmpty(
        Schema.declare((u: unknown) => Predicate.hasProperty(u, EmptyErrorTypeId), {
          identifier: options.tag
        }),
        {
          status: options.status,
          decode: constant(decoded)
        }
      )
      return transform.ast
    }
  })
  return EmptyError as any
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
