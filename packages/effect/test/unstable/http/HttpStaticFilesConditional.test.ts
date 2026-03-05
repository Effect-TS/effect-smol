import { describe, test } from "@effect/vitest"
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, FileSystem, Path, PlatformError } from "effect"
import { HttpEffect, HttpPlatform, HttpServerResponse, HttpStaticFiles } from "effect/unstable/http"

const root = "/root"
const filePath = `${root}/file.txt`
const fileBody = "hello static"
const lastModified = "Wed, 01 Jan 2025 00:00:00 GMT"

const notFoundError = (path: string) =>
  PlatformError.systemError({
    _tag: "NotFound",
    module: "FileSystem",
    method: "stat",
    description: "No such file or directory",
    pathOrDescriptor: path
  })

const fileInfo: FileSystem.File.Info = {
  type: "File",
  mtime: new Date(lastModified),
  atime: undefined,
  birthtime: undefined,
  dev: 0,
  ino: undefined,
  mode: 0,
  nlink: undefined,
  uid: undefined,
  gid: undefined,
  rdev: undefined,
  size: FileSystem.Size(fileBody.length),
  blksize: undefined,
  blocks: undefined
}

const makeHandler = async () => {
  const fileSystem = FileSystem.makeNoop({
    stat: (path) => path === filePath ? Effect.succeed(fileInfo) : Effect.fail(notFoundError(path))
  })

  const httpPlatform = HttpPlatform.HttpPlatform.of({
    fileResponse: (_path, options) =>
      Effect.succeed(HttpServerResponse.text(fileBody, {
        status: options?.status,
        headers: {
          ETag: "\"etag-value\"",
          "Last-Modified": lastModified
        }
      })),
    fileWebResponse: () => Effect.die("not implemented")
  })

  const app = await Effect.runPromise(
    HttpStaticFiles.make({
      root,
      cacheControl: "public, max-age=60"
    }).pipe(
      Effect.provide(Path.layer),
      Effect.provideService(FileSystem.FileSystem, fileSystem),
      Effect.provideService(HttpPlatform.HttpPlatform, httpPlatform)
    )
  )

  return HttpEffect.toWebHandler(app)
}

describe("HttpStaticFiles", () => {
  test("304 with If-None-Match exact, weak, and wildcard", async () => {
    const handler = await makeHandler()
    const warmupResponse = await handler(new Request("http://localhost/file.txt"))
    const etag = warmupResponse.headers.get("etag")
    strictEqual(etag, "\"etag-value\"")
    if (etag === null) {
      throw new Error("expected ETag header")
    }

    const exact = await handler(
      new Request("http://localhost/file.txt", {
        headers: {
          "If-None-Match": etag
        }
      })
    )
    const weak = await handler(
      new Request("http://localhost/file.txt", {
        headers: {
          "If-None-Match": `W/${etag}`
        }
      })
    )
    const list = await handler(
      new Request("http://localhost/file.txt", {
        headers: {
          "If-None-Match": `"other", W/${etag}`
        }
      })
    )
    const any = await handler(
      new Request("http://localhost/file.txt", {
        headers: {
          "If-None-Match": "*"
        }
      })
    )

    deepStrictEqual([exact.status, weak.status, list.status, any.status], [304, 304, 304, 304])
    strictEqual(exact.headers.get("etag"), "\"etag-value\"")
    strictEqual(exact.headers.get("cache-control"), "public, max-age=60")
    strictEqual(exact.headers.get("last-modified"), lastModified)
    strictEqual(exact.headers.get("content-type"), null)
    strictEqual(exact.headers.get("content-length"), null)
  })

  test("304 with If-Modified-Since and no If-None-Match", async () => {
    const handler = await makeHandler()

    const notModified = await handler(
      new Request("http://localhost/file.txt", {
        headers: {
          "If-Modified-Since": lastModified
        }
      })
    )
    const modified = await handler(
      new Request("http://localhost/file.txt", {
        headers: {
          "If-Modified-Since": "Tue, 31 Dec 2024 23:59:59 GMT"
        }
      })
    )
    const invalidDate = await handler(
      new Request("http://localhost/file.txt", {
        headers: {
          "If-Modified-Since": "not-a-date"
        }
      })
    )

    strictEqual(notModified.status, 304)
    strictEqual(modified.status, 200)
    strictEqual(invalidDate.status, 200)
  })

  test("If-None-Match takes precedence over If-Modified-Since", async () => {
    const handler = await makeHandler()

    const response = await handler(
      new Request("http://localhost/file.txt", {
        headers: {
          "If-None-Match": "\"different\"",
          "If-Modified-Since": "Thu, 02 Jan 2025 00:00:00 GMT"
        }
      })
    )

    strictEqual(response.status, 200)
  })

  test("matched If-None-Match takes precedence over Range", async () => {
    const handler = await makeHandler()

    const response = await handler(
      new Request("http://localhost/file.txt", {
        headers: {
          "If-None-Match": "\"etag-value\"",
          Range: "bytes=1000-1001"
        }
      })
    )

    strictEqual(response.status, 304)
    strictEqual(response.headers.get("etag"), "\"etag-value\"")
    strictEqual(response.headers.get("cache-control"), "public, max-age=60")
    strictEqual(response.headers.get("last-modified"), lastModified)
    strictEqual(response.headers.get("content-range"), null)
    strictEqual(response.headers.get("content-type"), null)
    strictEqual(response.headers.get("content-length"), null)
  })
})
