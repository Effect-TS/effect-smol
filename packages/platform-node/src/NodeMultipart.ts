/**
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"
import * as Inspectable from "effect/Inspectable"
import type * as FileSystem from "effect/platform/FileSystem"
import type * as Path from "effect/platform/Path"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as Multipart from "effect/unstable/http/Multipart"
import * as MP from "effect/unstable/http/Multipasta/Node"
import * as NFS from "node:fs"
import type { IncomingHttpHeaders } from "node:http"
import type { Readable } from "node:stream"
import * as NodeStreamP from "node:stream/promises"
import * as NodeStream from "./NodeStream.ts"

/**
 * @since 1.0.0
 * @category constructors
 */
export const stream = (
  source: Readable,
  headers: IncomingHttpHeaders
): Stream.Stream<Multipart.Part, Multipart.MultipartError> =>
  Multipart.makeConfig(headers as any).pipe(
    Effect.map((config) =>
      NodeStream.fromReadable<MP.Part, Multipart.MultipartError>({
        evaluate() {
          const parser = MP.make(config)
          source.pipe(parser)
          return parser as any
        },
        onError: (error) => convertError(error as any)
      })
    ),
    Stream.unwrap,
    Stream.map(convertPart)
  )

/**
 * @since 1.0.0
 * @category constructors
 */
export const persisted = (
  source: Readable,
  headers: IncomingHttpHeaders
): Effect.Effect<
  Multipart.Persisted,
  Multipart.MultipartError,
  Scope.Scope | FileSystem.FileSystem | Path.Path
> =>
  Multipart.toPersisted(stream(source, headers), (path, file) =>
    Effect.tryPromise({
      try: (signal) => NodeStreamP.pipeline((file as FileImpl).file, NFS.createWriteStream(path), { signal }),
      catch: (cause) => new Multipart.MultipartError({ reason: "InternalError", cause })
    }))

/**
 * @since 1.0.0
 */
export const fileToReadable = (file: Multipart.File): Readable => (file as FileImpl).file

// -----------------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------------

const convertPart = (part: MP.Part): Multipart.Part =>
  part._tag === "Field" ? new FieldImpl(part.info, part.value) : new FileImpl(part)

abstract class PartBase extends Inspectable.Class {
  readonly [Multipart.TypeId]: Multipart.TypeId
  constructor() {
    super()
    this[Multipart.TypeId] = Multipart.TypeId
  }
}

class FieldImpl extends PartBase implements Multipart.Field {
  readonly _tag = "Field"
  readonly key: string
  readonly contentType: string
  readonly value: string

  constructor(
    info: MP.PartInfo,
    value: Uint8Array
  ) {
    super()
    this.key = info.name
    this.contentType = info.contentType
    this.value = MP.decodeField(info, value)
  }

  toJSON(): unknown {
    return {
      _id: "@effect/platform/Multipart/Part",
      _tag: "Field",
      key: this.key,
      value: this.value,
      contentType: this.contentType
    }
  }
}

class FileImpl extends PartBase implements Multipart.File {
  readonly _tag = "File"
  readonly key: string
  readonly name: string
  readonly contentType: string
  readonly content: Stream.Stream<Uint8Array, Multipart.MultipartError>
  readonly contentEffect: Effect.Effect<Uint8Array, Multipart.MultipartError>

  constructor(readonly file: MP.FileStream) {
    super()
    this.key = file.info.name
    this.name = file.filename ?? file.info.name
    this.contentType = file.info.contentType
    this.content = NodeStream.fromReadable({
      evaluate: () => file,
      onError: (cause) => new Multipart.MultipartError({ reason: "InternalError", cause })
    })
    this.contentEffect = NodeStream.toUint8Array(() => file, {
      onError: (cause) => new Multipart.MultipartError({ reason: "InternalError", cause })
    })
  }

  toJSON(): unknown {
    return {
      _id: "@effect/platform/Multipart/Part",
      _tag: "File",
      key: this.key,
      name: this.name,
      contentType: this.contentType
    }
  }
}

function convertError(cause: MP.MultipartError): Multipart.MultipartError {
  switch (cause._tag) {
    case "ReachedLimit": {
      switch (cause.limit) {
        case "MaxParts": {
          return new Multipart.MultipartError({ reason: "TooManyParts", cause })
        }
        case "MaxFieldSize": {
          return new Multipart.MultipartError({ reason: "FieldTooLarge", cause })
        }
        case "MaxPartSize": {
          return new Multipart.MultipartError({ reason: "FileTooLarge", cause })
        }
        case "MaxTotalSize": {
          return new Multipart.MultipartError({ reason: "BodyTooLarge", cause })
        }
      }
    }
    default: {
      return new Multipart.MultipartError({ reason: "Parse", cause })
    }
  }
}
