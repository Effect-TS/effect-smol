import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { Effect, identity } from "effect"
import { Stream } from "effect/stream"
import { Unify } from "effect/types"
import * as Multipart from "effect/unstable/http/Multipart"

describe("Multipart", () => {
  it.effect("it parses", () =>
    Effect.gen(function*() {
      const data = new globalThis.FormData()
      data.append("foo", "bar")
      data.append("test", "ing")
      data.append("file", new globalThis.File(["A".repeat(1024 * 1024)], "foo.txt", { type: "text/plain" }))
      const response = new Response(data)

      const parts = yield* Stream.fromReadableStream({
        evaluate: () => response.body!,
        onError: identity
      }).pipe(
        Stream.pipeThroughChannel(Multipart.makeChannel(Object.fromEntries(response.headers))),
        Stream.mapEffect((part) => {
          return Unify.unify(
            part._tag === "File" ?
              Effect.zip(
                Effect.succeed(part.name),
                Stream.mkString(Stream.decodeText(part.content))
              ) :
              Effect.succeed([part.key, part.value] as const)
          )
        }),
        Stream.runCollect
      )

      deepStrictEqual(parts, [
        ["foo", "bar"],
        ["test", "ing"],
        ["foo.txt", "A".repeat(1024 * 1024)]
      ])
    }))
})
