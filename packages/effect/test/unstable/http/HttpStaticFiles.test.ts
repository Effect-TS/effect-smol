import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodePathLayer from "@effect/platform-node/NodePath"
import { afterAll, beforeAll, describe, test } from "@effect/vitest"
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, Layer, PlatformError } from "effect"
import { HttpPlatform, HttpRouter, HttpServerResponse, HttpStaticFiles } from "effect/unstable/http"
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import * as NodePath from "node:path"

let root = ""

const toPlatformError = (method: string, path: string, cause: unknown) => {
  const error = typeof cause === "object" && cause !== null ?
    cause as { code?: string; message?: string; syscall?: string }
    : undefined

  return PlatformError.systemError({
    _tag: error?.code === "ENOENT" ? "NotFound" : "Unknown",
    module: "FileSystem",
    method,
    description: error?.message,
    syscall: error?.syscall,
    pathOrDescriptor: path,
    cause
  })
}

const httpPlatform = HttpPlatform.HttpPlatform.of({
  fileResponse: (path, options) =>
    Effect.tryPromise({
      try: async () => {
        const [buffer, info] = await Promise.all([readFile(path), stat(path)])
        const offset = Number(options?.offset ?? 0)
        const end = options?.bytesToRead === undefined ? undefined : offset + Number(options.bytesToRead)
        const body = end === undefined ? buffer.subarray(offset) : buffer.subarray(offset, end)
        return HttpServerResponse.raw(body, {
          status: options?.status,
          statusText: options?.statusText,
          headers: {
            ETag: `"${Math.floor(info.mtimeMs)}-${info.size}"`,
            "Last-Modified": info.mtime.toUTCString()
          }
        })
      },
      catch: (cause) => toPlatformError("fileResponse", path, cause)
    }),
  fileWebResponse: () => Effect.die("not implemented")
})

const staticFilesLayer = Layer.mergeAll(
  NodePathLayer.layer,
  NodeFileSystem.layer,
  Layer.succeed(HttpPlatform.HttpPlatform, httpPlatform)
)

const makeHandler = (options: Omit<HttpStaticFiles.Options, "root"> = {}) =>
  HttpRouter.toWebHandler(
    HttpStaticFiles.layer({
      root,
      ...options
    }).pipe(Layer.provideMerge(staticFilesLayer)),
    { disableLogger: true }
  )

describe("HttpStaticFiles", () => {
  beforeAll(async () => {
    root = await mkdtemp(NodePath.join(tmpdir(), "effect-http-static-files-"))

    await mkdir(NodePath.join(root, "docs"), { recursive: true })
    await mkdir(NodePath.join(root, "custom"), { recursive: true })

    await Promise.all([
      writeFile(NodePath.join(root, "index.html"), "<html><body>root index</body></html>"),
      writeFile(NodePath.join(root, "hello.txt"), "hello static file"),
      writeFile(NodePath.join(root, "docs", "index.html"), "<html><body>docs index</body></html>"),
      writeFile(NodePath.join(root, "custom", "home.html"), "<html><body>custom home</body></html>"),
      writeFile(NodePath.join(root, "range.txt"), "0123456789abcdefghijklmnopqrstuvwxyz"),
      writeFile(NodePath.join(root, "conditional.txt"), "initial conditional body"),
      writeFile(NodePath.join(root, "file.binx"), "binary-ish")
    ])
  })

  afterAll(async () => {
    if (root !== "") {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("serves files with expected content type and body", async () => {
    const { handler, dispose } = makeHandler()
    try {
      const response = await handler(new Request("http://localhost/hello.txt"))
      strictEqual(response.status, 200)
      strictEqual(response.headers.get("content-type"), "text/plain; charset=utf-8")
      strictEqual(await response.text(), "hello static file")
    } finally {
      await dispose()
    }
  })

  test("serves default index file for directory paths", async () => {
    const { handler, dispose } = makeHandler()
    try {
      const response = await handler(new Request("http://localhost/docs"))
      strictEqual(response.status, 200)
      strictEqual(response.headers.get("content-type"), "text/html; charset=utf-8")
      strictEqual(await response.text(), "<html><body>docs index</body></html>")
    } finally {
      await dispose()
    }
  })

  test("supports custom index file and disabled index fallback", async () => {
    const custom = makeHandler({ index: "home.html" })
    try {
      const customResponse = await custom.handler(new Request("http://localhost/custom"))
      strictEqual(customResponse.status, 200)
      strictEqual(await customResponse.text(), "<html><body>custom home</body></html>")
    } finally {
      await custom.dispose()
    }

    const disabled = makeHandler({ index: undefined })
    try {
      const disabledResponse = await disabled.handler(new Request("http://localhost/custom"))
      strictEqual(disabledResponse.status, 404)
    } finally {
      await disabled.dispose()
    }
  })

  test("returns 304 for If-None-Match exact, weak, and wildcard", async () => {
    const { handler, dispose } = makeHandler({ cacheControl: "public, max-age=60" })
    try {
      const warmup = await handler(new Request("http://localhost/conditional.txt"))
      const etag = warmup.headers.get("etag")
      strictEqual(etag === null, false)
      if (etag === null) {
        throw new Error("missing etag")
      }
      const weakComparable = etag.startsWith("W/") ? etag.slice(2) : `W/${etag}`

      const exact = await handler(
        new Request("http://localhost/conditional.txt", { headers: { "If-None-Match": etag } })
      )
      const weak = await handler(
        new Request("http://localhost/conditional.txt", { headers: { "If-None-Match": weakComparable } })
      )
      const any = await handler(new Request("http://localhost/conditional.txt", { headers: { "If-None-Match": "*" } }))

      deepStrictEqual([exact.status, weak.status, any.status], [304, 304, 304])
      strictEqual(exact.headers.get("etag"), etag)
      strictEqual(exact.headers.get("cache-control"), "public, max-age=60")
      strictEqual(exact.headers.get("content-type"), null)
      strictEqual(exact.headers.get("content-length"), null)
    } finally {
      await dispose()
    }
  })

  test("returns 304 for If-Modified-Since and 200 when file changed", async () => {
    const { handler, dispose } = makeHandler()
    try {
      const first = await handler(new Request("http://localhost/conditional.txt"))
      const lastModified = first.headers.get("last-modified")
      strictEqual(lastModified === null, false)
      if (lastModified === null) {
        throw new Error("missing last-modified")
      }

      const notModified = await handler(
        new Request("http://localhost/conditional.txt", {
          headers: {
            "If-Modified-Since": lastModified
          }
        })
      )
      strictEqual(notModified.status, 304)

      await writeFile(NodePath.join(root, "conditional.txt"), "updated conditional body")
      const updatedTime = new Date(Date.now() + 10_000)
      await utimes(NodePath.join(root, "conditional.txt"), updatedTime, updatedTime)

      const modified = await handler(
        new Request("http://localhost/conditional.txt", {
          headers: {
            "If-Modified-Since": lastModified
          }
        })
      )
      strictEqual(modified.status, 200)
      strictEqual(await modified.text(), "updated conditional body")
    } finally {
      await dispose()
    }
  })

  test("handles range requests for valid, invalid, and malformed headers", async () => {
    const { handler, dispose } = makeHandler()
    try {
      const first = await handler(new Request("http://localhost/range.txt", { headers: { Range: "bytes=0-10" } }))
      strictEqual(first.status, 206)
      strictEqual(first.headers.get("content-range"), "bytes 0-10/36")
      strictEqual(await first.text(), "0123456789a")

      const openEnded = await handler(new Request("http://localhost/range.txt", { headers: { Range: "bytes=5-" } }))
      strictEqual(openEnded.status, 206)
      strictEqual(openEnded.headers.get("content-range"), "bytes 5-35/36")
      strictEqual(await openEnded.text(), "56789abcdefghijklmnopqrstuvwxyz")

      const suffix = await handler(new Request("http://localhost/range.txt", { headers: { Range: "bytes=-10" } }))
      strictEqual(suffix.status, 206)
      strictEqual(suffix.headers.get("content-range"), "bytes 26-35/36")
      strictEqual(await suffix.text(), "qrstuvwxyz")

      const invalid = await handler(new Request("http://localhost/range.txt", { headers: { Range: "bytes=100-200" } }))
      strictEqual(invalid.status, 416)
      strictEqual(invalid.headers.get("content-range"), "bytes */36")

      const malformed = await handler(new Request("http://localhost/range.txt", { headers: { Range: "bytes=abc" } }))
      strictEqual(malformed.status, 200)
      strictEqual(await malformed.text(), "0123456789abcdefghijklmnopqrstuvwxyz")
    } finally {
      await dispose()
    }
  })

  test("handles SPA fallback for html accept and missing routes", async () => {
    const { handler, dispose } = makeHandler({ spa: true, index: "index.html" })
    try {
      const htmlFallback = await handler(
        new Request("http://localhost/missing", { headers: { accept: "text/html" } })
      )
      strictEqual(htmlFallback.status, 200)
      strictEqual(await htmlFallback.text(), "<html><body>root index</body></html>")

      const withExtension = await handler(
        new Request("http://localhost/missing.js", { headers: { accept: "text/html" } })
      )
      strictEqual(withExtension.status, 404)

      const withoutHtmlAccept = await handler(
        new Request("http://localhost/missing", { headers: { accept: "application/json" } })
      )
      strictEqual(withoutHtmlAccept.status, 404)
    } finally {
      await dispose()
    }
  })

  test("rejects directory traversal attempts", async () => {
    const { handler, dispose } = makeHandler()
    try {
      const plainTraversal = await handler(new Request("http://localhost/../../../etc/passwd"))
      const encodedTraversal = await handler(new Request("http://localhost/..%2F..%2Fetc%2Fpasswd"))

      deepStrictEqual([plainTraversal.status, encodedTraversal.status], [404, 404])
    } finally {
      await dispose()
    }
  })

  test("rejects null bytes and malformed uri encoding", async () => {
    const { handler, dispose } = makeHandler()
    try {
      const nullByte = await handler(new Request("http://localhost/null%00byte.txt"))
      const malformed = await handler(new Request("http://localhost/%E0%A4%A"))

      deepStrictEqual([nullByte.status, malformed.status], [404, 404])
    } finally {
      await dispose()
    }
  })

  test("applies custom mime types and cache-control", async () => {
    const { handler, dispose } = makeHandler({
      cacheControl: "public, max-age=120",
      mimeTypes: {
        txt: "application/x-custom-text"
      }
    })
    try {
      const response = await handler(new Request("http://localhost/hello.txt"))
      strictEqual(response.status, 200)
      strictEqual(response.headers.get("content-type"), "application/x-custom-text")
      strictEqual(response.headers.get("cache-control"), "public, max-age=120")
    } finally {
      await dispose()
    }
  })

  test("uses application/octet-stream for unknown extension and 404 for missing file", async () => {
    const { handler, dispose } = makeHandler()
    try {
      const unknown = await handler(new Request("http://localhost/file.binx"))
      strictEqual(unknown.status, 200)
      strictEqual(unknown.headers.get("content-type"), "application/octet-stream")

      const missing = await handler(new Request("http://localhost/does-not-exist.txt"))
      strictEqual(missing.status, 404)
    } finally {
      await dispose()
    }
  })
})
