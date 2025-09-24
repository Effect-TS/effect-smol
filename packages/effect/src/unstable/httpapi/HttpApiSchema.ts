/**
 * @since 4.0.0
 */
import type { YieldableError } from "../../Cause.ts"
import * as Iterable from "../../collections/Iterable.ts"
import type { Brand } from "../../data/Brand.ts"
import * as Predicate from "../../data/Predicate.ts"
import { constant, constVoid, dual, type LazyArg } from "../../Function.ts"
import type * as FileSystem from "../../platform/FileSystem.ts"
import * as Annotations from "../../schema/Annotations.ts"
import * as AST from "../../schema/AST.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Transformation from "../../schema/Transformation.ts"
import type { Mutable } from "../../types/Types.ts"
import type * as Multipart_ from "../http/Multipart.ts"

declare module "../../schema/Annotations.ts" {
  interface Annotations {
    readonly httpApiEncoding?: Encoding | undefined
    readonly httpApiIsEmpty?: true | undefined
    readonly httpApiMultipart?: Multipart_.withLimits.Options | undefined
    readonly httpApiMultipartStream?: Multipart_.withLimits.Options | undefined
    readonly httpApiStatus?: number | undefined
  }
}

function isEncoding(u: unknown): u is Encoding {
  return Predicate.isObject(u) // TODO: Add more checks?
}

function isMultipartWithLimitsOptions(u: unknown): u is Multipart_.withLimits.Options {
  return Predicate.isObject(u) // TODO: Add more checks?
}

/** @internal */
export const getHttpApiIsEmpty = Annotations.getAt("httpApiIsEmpty", Predicate.isBoolean)
const getHttpApiEncoding = Annotations.getAt("httpApiEncoding", isEncoding)
/** @internal */
export const getHttpApiMultipart = Annotations.getAt("httpApiMultipart", isMultipartWithLimitsOptions)
/** @internal */
export const getHttpApiMultipartStream = Annotations.getAt("httpApiMultipartStream", isMultipartWithLimitsOptions)
const getHttpApiStatus = Annotations.getAt("httpApiStatus", Predicate.isNumber)

/** @internal */
export function isVoidEncoded(ast: AST.AST): boolean {
  ast = AST.encodedAST(ast)
  switch (ast._tag) {
    case "VoidKeyword":
      return true
    case "Suspend":
      return isVoidEncoded(ast.thunk())
    default:
      return false
  }
}

/**
 * @since 4.0.0
 * @category reflection
 */
export const getStatusSuccess = (self: AST.AST): number => getHttpApiStatus(self) ?? (isVoidEncoded(self) ? 204 : 200)

/**
 * @since 4.0.0
 * @category reflection
 */
export const getStatusError = (self: AST.AST): number => getHttpApiStatus(self) ?? 500

function isHttpApiAnnotationKey(key: string): boolean {
  return key.startsWith("httpApi")
}

/**
 * @since 4.0.0
 * @category reflection
 */
export const getHttpApiAnnotations = (self: Annotations.Annotations | undefined): Annotations.Annotations => {
  const out: Mutable<Annotations.Annotations> = {}
  if (!self) return out

  for (const [key, value] of Object.entries(self)) {
    if (isHttpApiAnnotationKey(key) && value !== undefined) {
      out[key] = value
    }
  }
  return out
}

/**
 * @since 4.0.0
 */
export const UnionUnifyAST = (self: AST.AST, that: AST.AST): AST.AST => {
  const asts = new Set<AST.AST>([...extractUnionTypes(self), ...extractUnionTypes(that)])
  if (asts.size === 1) {
    return Iterable.headUnsafe(asts)
  }
  return new AST.UnionType(
    Array.from(asts),
    "anyOf",
    {
      ...(AST.isUnionType(self) ? self.annotations : {}),
      ...(AST.isUnionType(that) ? that.annotations : {})
    }
  )
}

const extractUnionTypes = (ast: AST.AST): ReadonlyArray<AST.AST> => {
  const out: Array<AST.AST> = []
  process(ast)
  return out

  function process(ast: AST.AST): void {
    if (AST.isUnionType(ast) && shouldExtractUnion(ast)) {
      for (const type of ast.types) {
        process(type)
      }
    } else {
      out.push(ast)
    }
  }
}

function shouldExtractUnion(ast: AST.UnionType): boolean {
  if (ast.encoding) return false
  if (
    ast.types.some((ast) => {
      const annotations = Annotations.get(ast)
      return annotations && Object.keys(annotations).some(isHttpApiAnnotationKey)
    })
  ) {
    return true
  }
  return Annotations.get(ast) === undefined
}

/**
 * @since 4.0.0
 */
export const UnionUnify = <
  A extends Schema.Top,
  B extends Schema.Top
>(self: A, that: B): Schema.Top => Schema.make(UnionUnifyAST(self.ast, that.ast))

/**
 * @since 4.0.0
 * @category path params
 */
export interface Param<Name extends string, S extends Schema.Top> extends
  Schema.Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    Param<Name, S>,
    S["~annotate.in"],
    S["~type.make.in"],
    S["Iso"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly name: Name
  readonly schema: S
}

class Param$<Name extends string, S extends Schema.Top> extends Schema.Make$<Param<Name, S>> implements Param<Name, S> {
  readonly name: Name
  readonly schema: S

  constructor(ast: S["ast"], name: Name, schema: S) {
    super(ast, (ast) => new Param$(ast, name, schema))
    this.name = name
    this.schema = schema
  }
}

/**
 * @since 4.0.0
 * @category path params
 */
export function param<Name extends string>(
  name: Name
): <S extends Schema.Top & { readonly "Encoded": string }>(schema: S) => Param<Name, S>
export function param<Name extends string, S extends Schema.Top & { readonly "Encoded": string }>(
  name: Name,
  schema: S
): Param<Name, S>
export function param(name: string): any {
  if (arguments.length === 1) {
    return (schema: Schema.Top) => new Param$(schema.ast, name, schema)
  }
  return new Param$(arguments[1].ast, name, arguments[1])
}

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
> extends Schema.decodeTo<Schema.typeCodec<S>, Schema.Void> {}

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
    Schema.Void.annotate(self.ast.annotations ?? {}).pipe(
      Schema.decodeTo(
        Schema.typeCodec(self),
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
export interface Created extends Schema.Void {
  readonly _: unique symbol
}

/**
 * @since 4.0.0
 * @category empty response
 */
export const Created: Created = Empty(201) as any

/**
 * @since 4.0.0
 * @category empty response
 */
export interface Accepted extends Schema.Void {
  readonly _: unique symbol
}

/**
 * @since 4.0.0
 * @category empty response
 */
export const Accepted: Accepted = Empty(202) as any

/**
 * @since 4.0.0
 * @category empty response
 */
export interface NoContent extends Schema.Void {
  readonly _: unique symbol
}

/**
 * @since 4.0.0
 * @category empty response
 */
export const NoContent: NoContent = Empty(204) as any

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
export interface Multipart<S extends Schema.Top>
  extends Schema.refine<S["Type"] & Brand<"~effect/httpapi/HttpApiSchema/Multipart">, S["~rebuild.out"]>
{}

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
  self.pipe(Schema.brand(MultipartTypeId, {
    httpApiMultipart: options ?? {}
  }))

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
export interface MultipartStream<S extends Schema.Top>
  extends Schema.refine<S["Type"] & Brand<"~effect/httpapi/HttpApiSchema/MultipartStream">, S["~rebuild.out"]>
{}

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
  self.pipe(Schema.brand(MultipartStreamTypeId, {
    httpApiMultipartStream: options ?? {}
  }))

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

const defaultContentType = (encoding: Encoding["kind"]) => {
  switch (encoding) {
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
    },
    ...(options.kind === "Uint8Array" ?
      {
        jsonSchema: {
          _tag: "Override",
          override: () => ({
            type: "string",
            format: "binary"
          })
        }
      } :
      undefined)
  }))

const encodingJson: Encoding = {
  kind: "Json",
  contentType: "application/json"
}

/**
 * @since 4.0.0
 * @category annotations
 */
export function getEncoding(ast: AST.AST, fallback = encodingJson): Encoding {
  return getHttpApiEncoding(ast) ?? fallback
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
 */
export const forEachMember = (
  schema: Schema.Top,
  f: (member: Schema.Top) => void
): void => {
  if (astCache.has(schema.ast)) {
    f(astCache.get(schema.ast)!)
    return
  }
  const ast = schema.ast
  if (AST.isUnionType(ast)) {
    let unionCache = unionCaches.get(ast)
    if (!unionCache) {
      unionCache = new WeakMap<AST.AST, Schema.Top>()
      unionCaches.set(ast, unionCache)
    }
    for (const astType of ast.types) {
      if (unionCache.has(astType)) {
        f(unionCache.get(astType)!)
        continue
      } else if (astType._tag === "NeverKeyword") {
        continue
      }
      const memberSchema = Schema.make(astType).annotate({
        ...getHttpApiAnnotations(ast.annotations),
        ...astType.annotations
      })
      unionCache.set(astType, memberSchema)
      f(memberSchema)
    }
  } else if (ast._tag !== "NeverKeyword") {
    astCache.set(ast, schema)
    f(schema)
  }
}

const astCache = new WeakMap<AST.AST, Schema.Top>()
const unionCaches = new WeakMap<AST.AST, WeakMap<AST.AST, Schema.Top>>()

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
    Annotations.Annotations
  >
{
  new(): { readonly _tag: Tag } & YieldableError
}

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
    constructor() {
      super({}, { disableValidation: true })
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
        Schema.declare((u) => u instanceof EmptyError, {
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
