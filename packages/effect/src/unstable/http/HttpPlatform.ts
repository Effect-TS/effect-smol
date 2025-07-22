/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import { identity } from "../../Function.ts"
import * as FileSystem from "../../platform/FileSystem.ts"
import type { PlatformError } from "../../platform/PlatformError.ts"
import * as Layer from "../../services/Layer.ts"
import * as ServiceMap from "../../services/ServiceMap.ts"
import * as Stream from "../../stream/Stream.ts"
import * as Etag from "./Etag.ts"
import * as Headers from "./Headers.ts"
import type * as Body from "./HttpBody.ts"
import * as Response from "./HttpServerResponse.ts"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/http/HttpPlatform"

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = "~effect/http/HttpPlatform"

/**
 * @since 4.0.0
 * @category tags
 */
export class HttpPlatform extends ServiceMap.Key<HttpPlatform, {
  readonly fileResponse: (
    path: string,
    options?: Response.Options.WithContent & FileSystem.StreamOptions
  ) => Effect.Effect<Response.HttpServerResponse, PlatformError>
  readonly fileWebResponse: (
    file: Body.HttpBody.FileLike,
    options?: Response.Options.WithContent & FileSystem.StreamOptions
  ) => Effect.Effect<Response.HttpServerResponse>
}>()("effect/http/HttpPlatform") {}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make: (impl: {
  readonly fileResponse: (
    path: string,
    status: number,
    statusText: string | undefined,
    headers: Headers.Headers,
    start: number,
    end: number | undefined,
    contentLength: number
  ) => Response.HttpServerResponse
  readonly fileWebResponse: (
    file: Body.HttpBody.FileLike,
    status: number,
    statusText: string | undefined,
    headers: Headers.Headers,
    options?: FileSystem.StreamOptions
  ) => Response.HttpServerResponse
}) => Effect.Effect<
  HttpPlatform["Service"],
  never,
  Etag.Generator | FileSystem.FileSystem
> = Effect.fnUntraced(function*(impl) {
  const fs = yield* FileSystem.FileSystem
  const etagGen = yield* Etag.Generator

  return HttpPlatform.of({
    fileResponse: Effect.fnUntraced(function*(path, options) {
      const info = yield* fs.stat(path)
      const etag = yield* etagGen.fromFileInfo(info)
      const start = Number(options?.offset ?? 0)
      const end = options?.bytesToRead !== undefined ? start + Number(options.bytesToRead) : undefined
      const headers = Headers.set(
        options?.headers ? Headers.fromInput(options.headers) : Headers.empty,
        "etag",
        Etag.toString(etag)
      )
      if (info.mtime._tag === "Some") {
        ;(headers as any)["last-modified"] = info.mtime.value.toUTCString()
      }
      const contentLength = end !== undefined ? end - start : Number(info.size) - start
      return impl.fileResponse(
        path,
        options?.status ?? 200,
        options?.statusText,
        headers,
        start,
        end,
        contentLength
      )
    }),
    fileWebResponse(file, options) {
      return Effect.map(etagGen.fromFileWeb(file), (etag) => {
        const headers = Headers.merge(
          options?.headers ? Headers.fromInput(options.headers) : Headers.empty,
          Headers.unsafeFromRecord({
            etag: Etag.toString(etag),
            "last-modified": new Date(file.lastModified).toUTCString()
          })
        )
        return impl.fileWebResponse(
          file,
          options?.status ?? 200,
          options?.statusText,
          headers,
          options
        )
      })
    }
  })
})

/**
 * @since 4.0.0
 * @category layers
 */
export const layer = Layer.effect(HttpPlatform)(
  Effect.flatMap(FileSystem.FileSystem.asEffect(), (fs) =>
    make({
      fileResponse(path, status, statusText, headers, start, end, contentLength) {
        return Response.stream(
          fs.stream(path, {
            offset: start,
            bytesToRead: end !== undefined ? end - start : undefined
          }),
          { contentLength, headers, status, statusText }
        )
      },
      fileWebResponse(file, status, statusText, headers, _options) {
        return Response.stream(
          Stream.fromReadableStream({
            evaluate: () => file.stream() as ReadableStream<Uint8Array>,
            onError: identity
          }),
          { headers, status, statusText }
        )
      }
    }))
).pipe(Layer.provide(Etag.layerWeak))
