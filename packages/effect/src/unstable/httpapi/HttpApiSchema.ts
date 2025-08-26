/**
 * @since 4.0.0
 */
import type { YieldableError } from "../../Cause.ts"
import type { Brand } from "../../data/Brand.ts"
import type * as Option from "../../data/Option.ts"
import { constant, constVoid, dual, type LazyArg } from "../../Function.ts"
import type * as FileSystem from "../../platform/FileSystem.ts"
import type * as Annotations from "../../schema/Annotations.ts"
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
    readonly httpApiParam?: {
      readonly name: string
      readonly schema: Schema.Top
    } | undefined
    readonly httpApiStatus?: number | undefined
  }
}

/**
 * @since 4.0.0
 * @category reflection
 */
export const isVoid = (ast: AST.AST): boolean => {
  ast = AST.encodedAST(ast)
  switch (ast._tag) {
    case "VoidKeyword": {
      return true
    }
    case "Suspend": {
      return isVoid(ast.thunk())
    }
    default: {
      return false
    }
  }
}

/**
 * @since 4.0.0
 * @category reflection
 */
export const getStatusSuccess = (self: AST.AST): number => self.annotations?.httpApiStatus ?? (isVoid(self) ? 204 : 200)

/**
 * @since 4.0.0
 * @category reflection
 */
export const getStatusError = (self: AST.AST): number => self.annotations?.httpApiStatus ?? 500

/**
 * @since 4.0.0
 * @category reflection
 */
export const getHttpApiAnnotations = (self: Annotations.Annotations | undefined): Annotations.Annotations => {
  const out: Mutable<Annotations.Annotations> = {}
  if (!self) return out

  for (const [key, value] of Object.entries(self)) {
    if (key.startsWith("httpApi")) {
      out[key] = value
    }
  }
  return out
}

/**
 * @since 4.0.0
 * @category reflection
 */
export const extractUnionTypes = (ast: AST.AST): ReadonlyArray<AST.AST> => {
  function process(ast: AST.AST): void {
    if (AST.isUnionType(ast)) {
      for (const type of ast.types) {
        process(type)
      }
    } else {
      out.push(ast)
    }
  }
  const out: Array<AST.AST> = []
  process(ast)
  return out
}

/**
 * @since 4.0.0
 */
export const UnionUnifyAST = (self: AST.AST, that: AST.AST): AST.AST =>
  new AST.UnionType(
    Array.from(new Set<AST.AST>([...extractUnionTypes(self), ...extractUnionTypes(that)])),
    "anyOf"
  )

/**
 * @since 4.0.0
 */
export const UnionUnify = <
  A extends Schema.Top,
  B extends Schema.Top
>(self: A, that: B): Schema.Union<[A, B]> => Schema.make(UnionUnifyAST(self.ast, that.ast)) as any

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
    S["~rebuild.out"],
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~effect/httpapi/HttpApiSchema/Param": {
    readonly name: Name
    readonly schema: S
  }
}

/**
 * @since 4.0.0
 * @category path params
 */
export const param: {
  <Name extends string>(
    name: Name
  ): <S extends Schema.Codec<any, string, any, any>>(
    schema: S
  ) => Param<Name, S>
  <Name extends string, S extends Schema.Codec<any, string, any, any>>(
    name: Name,
    schema: S
  ): Param<Name, S>
} = function(name: string) {
  if (arguments.length === 1) {
    return (schema: Schema.Top) =>
      schema.annotate({
        httpApiParam: { name, schema }
      })
  }
  return arguments[1].annotate({
    httpApiParam: { name, schema: arguments[1] }
  })
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
export type MultipartId = "~effect/httpapi/HttpApiSchema/MultipartId"

/**
 * @since 4.0.0
 * @category multipart
 */
export interface Multipart<S extends Schema.Top> extends
  Schema.Bottom<
    S["Type"] & Brand<MultipartId>,
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    S["~rebuild.out"],
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{}

/**
 * @since 4.0.0
 * @category multipart
 */
export const Multipart = <S extends Schema.Top>(self: S, options?: {
  readonly maxParts?: Option.Option<number> | undefined
  readonly maxFieldSize?: FileSystem.SizeInput | undefined
  readonly maxFileSize?: Option.Option<FileSystem.SizeInput> | undefined
  readonly maxTotalSize?: Option.Option<FileSystem.SizeInput> | undefined
  readonly fieldMimeTypes?: ReadonlyArray<string> | undefined
}): Multipart<S> =>
  self.annotate({
    httpApiMultipart: options ?? {}
  }) as Multipart<S>

/**
 * @since 4.0.0
 * @category multipart
 */
export type MultipartStreamId = "~effect/httpapi/HttpApiSchema/MultipartStreamId"

/**
 * @since 4.0.0
 * @category multipart
 */
export interface MultipartStream<S extends Schema.Top> extends
  Schema.Bottom<
    S["Type"] & Brand<MultipartStreamId>,
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    S["~rebuild.out"],
    S["~annotate.in"],
    S["~type.make.in"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{}

/**
 * @since 4.0.0
 * @category multipart
 */
export const MultipartStream = <S extends Schema.Top>(self: S, options?: {
  readonly maxParts?: Option.Option<number> | undefined
  readonly maxFieldSize?: FileSystem.SizeInput | undefined
  readonly maxFileSize?: Option.Option<FileSystem.SizeInput> | undefined
  readonly maxTotalSize?: Option.Option<FileSystem.SizeInput> | undefined
  readonly fieldMimeTypes?: ReadonlyArray<string> | undefined
}): MultipartStream<S> =>
  self.annotate({
    httpApiMultipartStream: options ?? {}
  }) as MultipartStream<S>

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
  <A extends Schema.Top, Kind extends Encoding["kind"]>(
    options: {
      readonly kind: Kind
      readonly contentType?: string | undefined
    } & Encoding.Validate<A, Kind>
  ): (self: A) => A["~rebuild.out"]
  <A extends Schema.Top, Kind extends Encoding["kind"]>(
    self: A,
    options: {
      readonly kind: Kind
      readonly contentType?: string | undefined
    } & Encoding.Validate<A, Kind>
  ): A["~rebuild.out"]
} = dual(2, <A extends Schema.Top>(self: A, options: {
  readonly kind: Encoding["kind"]
  readonly contentType?: string | undefined
}): A["~rebuild.out"] =>
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
export const getEncoding = (ast: AST.AST, fallback = encodingJson): Encoding =>
  ast.annotations?.httpApiEncoding ?? fallback

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
}): Schema.instanceOf<Uint8Array<ArrayBuffer>> =>
  withEncoding(Schema.instanceOf(globalThis.Uint8Array), { kind: "Uint8Array", ...options })

const astCache = new WeakMap<AST.AST, Schema.Top>()

/**
 * @since 4.0.0
 */
export const deunionize = (
  schemas: Set<Schema.Top>,
  schema: Schema.Top
): void => {
  if (astCache.has(schema.ast)) {
    schemas.add(astCache.get(schema.ast)!)
    return
  }
  const ast = schema.ast
  if (ast._tag === "UnionType") {
    for (const astType of ast.types) {
      if (astCache.has(astType)) {
        schemas.add(astCache.get(astType)!)
        continue
      }
      const memberSchema = Schema.make(astType).annotate({
        ...ast.annotations,
        ...astType.annotations
      })
      astCache.set(astType, memberSchema)
      schemas.add(memberSchema)
    }
  } else {
    astCache.set(ast, schema)
    schemas.add(schema)
  }
}

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
    EmptyErrorClass<Self, Tag>,
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
          identifier: options.tag,
          title: options.tag
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
