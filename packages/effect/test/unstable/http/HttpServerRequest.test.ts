import { describe, it } from "@effect/vitest"
import { assertNone, assertSome } from "@effect/vitest/utils"
import * as Option from "effect/Option"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"

describe("HttpServerRequest", () => {
  it("remoteAddress defaults to none for web requests", () => {
    const request = HttpServerRequest.fromWeb(new Request("http://example.com"))
    assertNone(request.remoteAddress)
  })

  it("modify distinguishes missing and explicit none remoteAddress", () => {
    const request = HttpServerRequest.fromWeb(new Request("http://example.com"))
    const withRemoteAddress = request.modify({ remoteAddress: Option.some("127.0.0.1") })

    assertSome(withRemoteAddress.remoteAddress, "127.0.0.1")
    assertSome(withRemoteAddress.modify({}).remoteAddress, "127.0.0.1")
    assertNone(withRemoteAddress.modify({ remoteAddress: Option.none() }).remoteAddress)
  })
})
