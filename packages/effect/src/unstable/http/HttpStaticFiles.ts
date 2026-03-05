/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as FileSystem from "../../FileSystem.ts"
import * as Layer from "../../Layer.ts"
import * as Path from "../../Path.ts"
import type { PlatformError } from "../../PlatformError.ts"
import * as HttpPlatform from "./HttpPlatform.ts"
import * as HttpRouter from "./HttpRouter.ts"
import * as HttpServerError from "./HttpServerError.ts"
import * as HttpServerRequest from "./HttpServerRequest.ts"
import * as HttpServerResponse from "./HttpServerResponse.ts"

/**
 * @since 4.0.0
 * @category models
 */
export interface Options {
  readonly root: string
  readonly index?: string | undefined
  readonly spa?: boolean | undefined
  readonly cacheControl?: string | undefined
  readonly mimeTypes?: Record<string, string> | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface LayerOptions extends Options {
  readonly prefix?: string | undefined
}

const defaultMimeTypes: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  yaml: "text/yaml; charset=utf-8",
  yml: "text/yaml; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml; charset=utf-8",
  ico: "image/x-icon",
  webp: "image/webp",
  avif: "image/avif",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "audio/ogg",
  wav: "audio/wav",
  flac: "audio/flac",
  aac: "audio/aac",
  pdf: "application/pdf",
  zip: "application/zip",
  gz: "application/gzip",
  wasm: "application/wasm",
  map: "application/json",
  webmanifest: "application/manifest+json"
}

const stripQueryString = (url: string): string => {
  const queryIndex = url.indexOf("?")
  return queryIndex === -1 ? url : url.slice(0, queryIndex)
}

const resolveMimeType = (path: Path.Path, filePath: string, mimeTypes: Record<string, string>): string => {
  const extension = path.extname(filePath).toLowerCase()
  if (extension.length <= 1) {
    return "application/octet-stream"
  }
  return mimeTypes[extension.slice(1)] ?? "application/octet-stream"
}

const parseInteger = (value: string): number | undefined => {
  if (!/^\d+$/.test(value)) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

const parseRange = (
  header: string,
  fileSize: number
):
  | { readonly start: number; readonly end: number }
  | "unsatisfiable"
  | undefined =>
{
  const value = header.trim()
  if (!value.toLowerCase().startsWith("bytes=")) {
    return undefined
  }
  const rangeValue = value.slice(6).trim()
  if (rangeValue.length === 0 || rangeValue.includes(",")) {
    return undefined
  }
  const separatorIndex = rangeValue.indexOf("-")
  if (separatorIndex === -1) {
    return undefined
  }
  const startPart = rangeValue.slice(0, separatorIndex).trim()
  const endPart = rangeValue.slice(separatorIndex + 1).trim()
  if (startPart === "" && endPart === "") {
    return undefined
  }
  if (startPart === "") {
    const suffixLength = parseInteger(endPart)
    if (suffixLength === undefined) {
      return undefined
    }
    if (suffixLength === 0 || fileSize === 0) {
      return "unsatisfiable"
    }
    return {
      start: Math.max(fileSize - suffixLength, 0),
      end: fileSize - 1
    }
  }
  const start = parseInteger(startPart)
  if (start === undefined) {
    return undefined
  }
  if (endPart === "") {
    if (start >= fileSize) {
      return "unsatisfiable"
    }
    return {
      start,
      end: fileSize - 1
    }
  }
  const end = parseInteger(endPart)
  if (end === undefined) {
    return undefined
  }
  if (start > end || start >= fileSize) {
    return "unsatisfiable"
  }
  return {
    start,
    end: Math.min(end, fileSize - 1)
  }
}

const resolveFilePath = (path: Path.Path, root: string, url: string): string | undefined => {
  const urlPath = stripQueryString(url)
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(urlPath)
  } catch {
    return undefined
  }
  if (decodedPath.includes("\u0000")) {
    return undefined
  }
  const normalizedPath = path.normalize(decodedPath.startsWith("/") ? decodedPath.slice(1) : decodedPath)
  if (normalizedPath === ".." || normalizedPath.startsWith(`..${path.sep}`)) {
    return undefined
  }
  const resolvedPath = path.join(root, normalizedPath)
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  if (resolvedPath !== root && !resolvedPath.startsWith(rootPrefix)) {
    return undefined
  }
  return resolvedPath
}

const toRouteNotFound = (request: HttpServerRequest.HttpServerRequest) => new HttpServerError.RouteNotFound({ request })

const handlePlatformError = <A>(
  request: HttpServerRequest.HttpServerRequest,
  self: Effect.Effect<A, PlatformError>
): Effect.Effect<A, HttpServerError.RouteNotFound> =>
  self.pipe(
    Effect.catchIf(
      (error): error is PlatformError => error.reason._tag === "NotFound",
      () => Effect.fail(toRouteNotFound(request))
    ),
    Effect.orDie
  )

const acceptsHtml = (accept: string | undefined): boolean =>
  accept !== undefined && accept.toLowerCase().includes("text/html")

/**
 * Creates an `HttpApp` that serves files from a directory.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as HttpStaticFiles from "effect/unstable/http/HttpStaticFiles"
 *
 * const program = Effect.gen(function*() {
 *   const app = yield* HttpStaticFiles.make({ root: "./public" })
 *   return app
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make: (options: Options) => Effect.Effect<
  Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    HttpServerError.RouteNotFound,
    HttpServerRequest.HttpServerRequest
  >,
  PlatformError,
  FileSystem.FileSystem | Path.Path | HttpPlatform.HttpPlatform
> = Effect.fnUntraced(function*(options) {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const platform = yield* HttpPlatform.HttpPlatform

  const resolvedRoot = path.resolve(options.root)
  const index = "index" in options ? options.index : "index.html"
  const spa = options.spa === true
  const cacheControl = options.cacheControl
  const mimeTypes = {
    ...defaultMimeTypes,
    ...options.mimeTypes
  }

  const serveFile: (
    request: HttpServerRequest.HttpServerRequest,
    filePath: string,
    fileSize?: number
  ) => Effect.Effect<HttpServerResponse.HttpServerResponse, HttpServerError.RouteNotFound> = Effect.fnUntraced(
    function*(request, filePath, fileSize) {
      const rangeHeader = request.headers["range"]
      const resolvedFileSize = rangeHeader === undefined
        ? fileSize
        : fileSize ?? Number((yield* handlePlatformError(request, fileSystem.stat(filePath))).size)
      const parsedRange = rangeHeader === undefined || resolvedFileSize === undefined
        ? undefined
        : parseRange(rangeHeader, resolvedFileSize)

      if (parsedRange === "unsatisfiable") {
        return HttpServerResponse.empty({
          status: 416,
          headers: {
            "Content-Range": `bytes */${resolvedFileSize!}`
          }
        })
      }

      const range = parsedRange

      const responseOptions = range === undefined
        ? undefined
        : {
          status: 206,
          offset: range.start,
          bytesToRead: range.end - range.start + 1
        }

      let response = yield* handlePlatformError(request, platform.fileResponse(filePath, responseOptions))

      response = HttpServerResponse.setHeaders(response, {
        "Content-Type": resolveMimeType(path, filePath, mimeTypes),
        "Accept-Ranges": "bytes"
      })

      if (range !== undefined && resolvedFileSize !== undefined) {
        response = HttpServerResponse.setHeader(
          response,
          "Content-Range",
          `bytes ${range.start}-${range.end}/${resolvedFileSize}`
        )
      }

      if (cacheControl !== undefined) {
        response = HttpServerResponse.setHeader(response, "Cache-Control", cacheControl)
      }

      return response
    }
  )

  return HttpServerRequest.HttpServerRequest.use((request) => {
    const resolvedPath = resolveFilePath(path, resolvedRoot, request.url)
    if (resolvedPath === undefined) {
      return Effect.fail(toRouteNotFound(request))
    }

    return handlePlatformError(request, fileSystem.stat(resolvedPath)).pipe(
      Effect.matchEffect({
        onFailure: (routeNotFound) =>
          spa && index !== undefined && path.extname(resolvedPath) === "" && acceptsHtml(request.headers["accept"])
            ? serveFile(request, path.join(resolvedRoot, index))
            : Effect.fail(routeNotFound),
        onSuccess: (info) => {
          if (info.type === "File") {
            return serveFile(request, resolvedPath, Number(info.size))
          }
          if (info.type === "Directory" && index !== undefined) {
            return serveFile(request, path.join(resolvedPath, index))
          }
          return Effect.fail(toRouteNotFound(request))
        }
      })
    )
  })
})

/**
 * Creates a layer that mounts static files on an `HttpRouter`.
 *
 * @example
 * ```ts
 * import { Layer } from "effect"
 * import * as HttpRouter from "effect/unstable/http/HttpRouter"
 * import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
 * import * as HttpStaticFiles from "effect/unstable/http/HttpStaticFiles"
 *
 * const ApiLayer = HttpRouter.add("GET", "/health", HttpServerResponse.text("ok"))
 *
 * const StaticFilesLayer = HttpStaticFiles.layer({
 *   root: "./public",
 *   prefix: "/static"
 * })
 *
 * const AppLayer = Layer.mergeAll(ApiLayer, StaticFilesLayer)
 * ```
 *
 * @since 4.0.0
 * @category layers
 */
export const layer = (
  options: LayerOptions
): Layer.Layer<
  never,
  PlatformError,
  HttpRouter.HttpRouter | FileSystem.FileSystem | Path.Path | HttpPlatform.HttpPlatform
> =>
  Layer.effectDiscard(Effect.gen(function*() {
    const router = yield* HttpRouter.HttpRouter
    const handler = (yield* make(options)).pipe(
      Effect.catchTag("RouteNotFound", () => Effect.succeed(HttpServerResponse.empty({ status: 404 })))
    )
    if (options.prefix !== undefined) {
      yield* router.prefixed(options.prefix).add("GET", "/*", handler)
      return
    }
    yield* router.add("GET", "/*", handler)
  }))
