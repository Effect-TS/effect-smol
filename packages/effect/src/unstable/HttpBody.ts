/**
 * @since 4.0.0
 */
import * as Data from "../Data.js"
import * as Effect from "../Effect.js"
import * as FileSystem from "../FileSystem.js"
import * as Inspectable from "../Inspectable.js"
import type * as PlatformError from "../PlatformError.js"
import * as Predicate from "../Predicate.js"
import * as Schema from "../Schema.js"
import type { ParseOptions } from "../SchemaAST.js"
import type { Issue } from "../SchemaIssue.js"
import * as SchemaSerializer from "../SchemaSerializer.js"
import type * as Stream_ from "../Stream.js"
import * as UrlParams from "./UrlParams.js"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: unique symbol = Symbol.for("effect/HttpBody")

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 4.0.0
 * @category refinements
 */
export const isHttpBody = (u: unknown): u is HttpBody => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category models
 */
export type HttpBody = Empty | Raw | Uint8Array | FormData | Stream

/**
 * @since 4.0.0
 */
export declare namespace HttpBody {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Proto extends Inspectable.Inspectable {
    readonly [TypeId]: TypeId
    readonly _tag: string
    readonly contentType?: string | undefined
    readonly contentLength?: number | undefined
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface FileLike {
    readonly name: string
    readonly lastModified: number
    readonly size: number
    readonly stream: () => unknown
    readonly type: string
  }
}

/**
 * @since 4.0.0
 * @category type ids
 */
export const ErrorTypeId: unique symbol = Symbol.for("effect/HttpBody/HttpBodyError")

/**
 * @since 4.0.0
 * @category type ids
 */
export type ErrorTypeId = typeof ErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export class HttpBodyError extends Data.TaggedError("HttpBodyError")<{
  readonly reason: ErrorReason
  readonly cause?: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [ErrorTypeId]: ErrorTypeId = ErrorTypeId
}

/**
 * @since 4.0.0
 * @category errors
 */
export type ErrorReason = {
  readonly _tag: "JsonError"
} | {
  readonly _tag: "SchemaError"
  readonly issue: Issue
}

abstract class Proto implements HttpBody.Proto {
  readonly [TypeId]: TypeId
  abstract readonly _tag: string
  constructor() {
    this[TypeId] = TypeId
  }
  abstract toJSON(): unknown
  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }
  toString(): string {
    return Inspectable.format(this)
  }
}

/**
 * @since 4.0.0
 * @category models
 */
export class Empty extends Proto {
  readonly _tag = "Empty"
  toJSON(): unknown {
    return {
      _id: "effect/HttpBody",
      _tag: "Empty"
    }
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const empty: Empty = new Empty()

/**
 * @since 4.0.0
 * @category models
 */
export class Raw extends Proto {
  readonly _tag = "Raw"
  constructor(
    readonly body: unknown,
    readonly contentType: string | undefined,
    readonly contentLength: number | undefined
  ) {
    super()
  }
  toJSON(): unknown {
    return {
      _id: "effect/HttpBody",
      _tag: "Raw",
      body: this.body,
      contentType: this.contentType,
      contentLength: this.contentLength
    }
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const raw = (
  body: unknown,
  options?: {
    readonly contentType?: string | undefined
    readonly contentLength?: number | undefined
  } | undefined
): Raw => new Raw(body, options?.contentType, options?.contentLength)

/**
 * @since 4.0.0
 * @category models
 */
export class Uint8Array extends Proto {
  readonly _tag = "Uint8Array"
  constructor(
    readonly body: globalThis.Uint8Array,
    readonly contentType: string,
    readonly contentLength: number
  ) {
    super()
  }
  toJSON(): unknown {
    const toString = this.contentType.startsWith("text/") || this.contentType.endsWith("json")
    return {
      _id: "effect/HttpBody",
      _tag: "Uint8Array",
      body: toString ? new TextDecoder().decode(this.body) : `Uint8Array(${this.body.length})`,
      contentType: this.contentType,
      contentLength: this.contentLength
    }
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const uint8Array = (body: globalThis.Uint8Array, contentType?: string): Uint8Array =>
  new Uint8Array(body, contentType ?? "application/octet-stream", body.length)

const encoder = new TextEncoder()

/**
 * @since 4.0.0
 * @category constructors
 */
export const text = (body: string, contentType?: string): Uint8Array =>
  uint8Array(encoder.encode(body), contentType ?? "text/plain")

/**
 * @since 4.0.0
 * @category constructors
 */
export const unsafeJson = (body: unknown): Uint8Array => text(JSON.stringify(body), "application/json")

/**
 * @since 4.0.0
 * @category constructors
 */
export const json = (body: unknown): Effect.Effect<Uint8Array, HttpBodyError> =>
  Effect.try({
    try: () => text(JSON.stringify(body), "application/json"),
    catch: (cause) => new HttpBodyError({ reason: { _tag: "JsonError" }, cause })
  })

/**
 * @since 4.0.0
 * @category constructors
 */
export const jsonSchema = <S extends Schema.Schema<any>>(
  schema: S,
  options?: ParseOptions | undefined
) => {
  const encode = Schema.encodeUnknownEffect(SchemaSerializer.json(schema))
  return (body: S["Type"]): Effect.Effect<Uint8Array, HttpBodyError, S["EncodingContext"]> =>
    encode(body, options).pipe(
      Effect.mapError(({ issue }) => new HttpBodyError({ reason: { _tag: "SchemaError", issue }, cause: issue })),
      Effect.flatMap((body) => json(body))
    )
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const urlParams = (urlParams: UrlParams.UrlParams): Uint8Array =>
  text(UrlParams.toString(urlParams), "application/x-www-form-urlencoded")

/**
 * @since 4.0.0
 * @category models
 */
export class FormData extends Proto {
  readonly _tag = "FormData"
  readonly contentType = undefined
  readonly contentLength = undefined
  constructor(readonly formData: globalThis.FormData) {
    super()
  }
  toJSON(): unknown {
    return {
      _id: "effect/HttpBody",
      _tag: "FormData",
      formData: this.formData
    }
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const formData = (body: globalThis.FormData): FormData => new FormData(body)

/**
 * @since 4.0.0
 * @category models
 */
export class Stream extends Proto {
  readonly _tag = "Stream"
  constructor(
    readonly stream: Stream_.Stream<globalThis.Uint8Array, unknown>,
    readonly contentType: string,
    readonly contentLength: number | undefined
  ) {
    super()
  }
  toJSON(): unknown {
    return {
      _id: "effect/HttpBody",
      _tag: "Stream",
      contentType: this.contentType,
      contentLength: this.contentLength
    }
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const stream = (
  body: Stream_.Stream<globalThis.Uint8Array, unknown>,
  contentType?: string,
  contentLength?: number
): Stream => new Stream(body, contentType ?? "application/octet-stream", contentLength)

/**
 * @since 4.0.0
 * @category constructors
 */
export const file = (
  path: string,
  options?: FileSystem.StreamOptions & { readonly contentType?: string }
): Effect.Effect<Stream, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.flatMap(
    FileSystem.FileSystem.asEffect(),
    (fs) =>
      Effect.map(fs.stat(path), (info) =>
        stream(
          fs.stream(path, options),
          options?.contentType,
          Number(info.size)
        ))
  )

/**
 * @since 4.0.0
 * @category constructors
 */
export const fileFromInfo = (
  path: string,
  info: FileSystem.File.Info,
  options?: FileSystem.StreamOptions & { readonly contentType?: string }
): Effect.Effect<Stream, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.map(
    FileSystem.FileSystem.asEffect(),
    (fs) =>
      stream(
        fs.stream(path, options),
        options?.contentType,
        Number(info.size)
      )
  )
