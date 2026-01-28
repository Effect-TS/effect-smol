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
      readonly httpApiIsEmpty?: true | undefined
      readonly httpApiMultipart?: Multipart_.withLimits.Options | undefined
      readonly httpApiMultipartStream?: Multipart_.withLimits.Options | undefined
      readonly httpApiStatus?: number | undefined
    }
  }
}

/** @internal */
export const resolveHttpApiIsEmpty = AST.resolveAt<boolean>("httpApiIsEmpty")
/** @internal */
export const resolveHttpApiMultipart = AST.resolveAt<Multipart_.withLimits.Options>("httpApiMultipart")
/** @internal */
export const resolveHttpApiMultipartStream = AST.resolveAt<Multipart_.withLimits.Options>(
  "httpApiMultipartStream"
)
const resolveHttpApiStatus = AST.resolveAt<number>("httpApiStatus")
const resolveHttpApiEncoding = AST.resolveAt<Encoding>("httpApiEncoding")

/** @internal */
export function isVoidEncoded(ast: AST.AST): boolean {
  return AST.isVoid(AST.toEncoded(ast))
}

/** @internal */
export function getStatusSuccess(self: AST.AST): number {
  return resolveHttpApiStatus(self) ?? (isVoidEncoded(self) ? 204 : 200)
}

/** @internal */
export function getStatusError(self: AST.AST): number {
  return resolveHttpApiStatus(self) ?? 500
}

const resolveHttpApiIsContainer = AST.resolveAt<boolean>("httpApiIsContainer")

/** @internal */
export function isHttpApiContainer(ast: AST.AST): ast is AST.Union {
  return AST.isUnion(ast) && resolveHttpApiIsContainer(ast) === true
}

/** @internal */
export function makeHttpApiContainer(schemas: ReadonlyArray<Schema.Top>): Schema.Top {
  return Schema.make(makeHttpApiContainerAST(schemas.map((schema) => schema.ast)))
}

/** @internal */
export function makeHttpApiContainerAST(asts: ReadonlyArray<AST.AST>): AST.AST {
  asts = [...new Set(asts)] // unique
  return asts.length === 1 ? asts[0] : new AST.Union(asts, "anyOf", { httpApiIsContainer: true })
}

// TODO: add description
/**
 * @since 4.0.0
 * @category empty response
 */
export const Empty = (status: number): Schema.Void => Schema.Void.annotate({ httpApiStatus: status })

/**
 * @since 4.0.0
 * @category empty response
 */
export interface asEmpty<
  S extends Schema.Top
> extends Schema.decodeTo<Schema.toType<S>, Schema.Void> {}

/**
 * @since 4.0.0
 * @category empty response
 */
export const asEmpty: {
  <S extends Schema.Top>(options: {
    readonly status: number
    readonly decode: LazyArg<S["Type"]>
  }): (self: S) => asEmpty<S>
  <S extends Schema.Top>(
    self: S,
    options: {
      readonly status: number
      readonly decode: LazyArg<S["Type"]>
    }
  ): asEmpty<S>
} = dual(
  2,
  <S extends Schema.Top>(
    self: S,
    options: {
      readonly status: number
      readonly decode: LazyArg<S["Type"]>
    }
  ): asEmpty<S> =>
    Schema.Void.pipe(
      Schema.decodeTo(
        Schema.toType(self),
        Transformation.transform({
          decode: options.decode,
          encode: constVoid
        })
      )
    ).annotate({
      httpApiIsEmpty: true,
      httpApiStatus: options.status
    })
)

/**
 * @since 4.0.0
 * @category empty response
 */
export const NoContent = Empty(204)

/**
 * @since 4.0.0
 * @category empty response
 */
export const Created = Empty(201)

/**
 * @since 4.0.0
 * @category empty response
 */
export const Accepted = Empty(202)

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
    httpApiMultipart: options ?? {}
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
    httpApiMultipartStream: options ?? {}
  })

/**
 * @since 4.0.0
 * @category encoding
 */
export interface Encoding {
  readonly kind: "Json" | "UrlParams" | "Uint8Array" | "Text"
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
  export type Validate<A extends Schema.Top, Kind extends Encoding["kind"]> = Kind extends "Json" ? {}
    : Kind extends "UrlParams" ? [A["Encoded"]] extends [Readonly<Record<string, string | undefined>>] ? {}
      : `'UrlParams' kind can only be encoded to 'Record<string, string | undefined>'`
    : Kind extends "Uint8Array" ?
      [A["Encoded"]] extends [Uint8Array] ? {} : `'Uint8Array' kind can only be encoded to 'Uint8Array'`
    : Kind extends "Text" ? [A["Encoded"]] extends [string] ? {} : `'Text' kind can only be encoded to 'string'`
    : never
}

const defaultContentType = (kind: Encoding["kind"]) => {
  switch (kind) {
    case "Json": {
      return "application/json"
    }
    case "UrlParams": {
      return "application/x-www-form-urlencoded"
    }
    case "Uint8Array": {
      return "application/octet-stream"
    }
    case "Text": {
      return "text/plain"
    }
  }
}

/**
 * @since 4.0.0
 * @category encoding
 */
export const withEncoding: {
  <S extends Schema.Top, Kind extends Encoding["kind"]>(
    options: {
      readonly kind: Kind
      readonly contentType?: string | undefined
    } & Encoding.Validate<S, Kind>
  ): (self: S) => S["~rebuild.out"]
  <S extends Schema.Top, Kind extends Encoding["kind"]>(
    self: S,
    options: {
      readonly kind: Kind
      readonly contentType?: string | undefined
    } & Encoding.Validate<S, Kind>
  ): S["~rebuild.out"]
} = dual(2, <S extends Schema.Top>(self: S, options: {
  readonly kind: Encoding["kind"]
  readonly contentType?: string | undefined
}): S["~rebuild.out"] =>
  self.annotate({
    httpApiEncoding: {
      kind: options.kind,
      contentType: options.contentType ?? defaultContentType(options.kind)
    }
  }))

const encodingJson: Encoding = {
  kind: "Json",
  contentType: "application/json"
}

const encodingMultipart: Encoding = {
  kind: "Json",
  contentType: "multipart/form-data"
}

/** @internal */
export function getEncoding(ast: AST.AST): Encoding {
  if (resolveHttpApiMultipart(ast) !== undefined || resolveHttpApiMultipartStream(ast) !== undefined) {
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
}): Schema.String => withEncoding(Schema.String, { kind: "Text", ...options })

/**
 * @since 4.0.0
 * @category encoding
 */
export const Uint8Array = (options?: {
  readonly contentType?: string
}): Schema.Uint8Array => withEncoding(Schema.Uint8Array, { kind: "Uint8Array", ...options })

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
export function forEachMember(schema: Schema.Top, f: (member: Schema.Top) => void): void {
  const ast = schema.ast
  if (isHttpApiContainer(ast)) {
    for (const type of ast.types) {
      if (AST.isNever(type)) {
        continue
      }
      const memberSchema = Schema.make(type)
      f(memberSchema)
    }
  } else if (!AST.isNever(ast)) {
    f(schema)
  }
}
