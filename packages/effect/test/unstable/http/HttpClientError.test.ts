import { assert, describe, it } from "@effect/vitest"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"

const makeRequest = () => HttpClientRequest.get("https://example.com/v1/users")
const makeResponse = (request: HttpClientRequest.HttpClientRequest) =>
  HttpClientResponse.fromWeb(request, new Response("nope", { status: 418 }))

describe("HttpClientError", () => {
  describe("reason messages", () => {
    it("TransportError message", () => {
      const request = makeRequest()
      const reason = new HttpClientError.TransportError({
        request,
        description: "connection reset"
      })

      assert.strictEqual(reason.message, "Transport: connection reset (GET https://example.com/v1/users)")
    })

    it("EncodeError message", () => {
      const request = makeRequest()
      const reason = new HttpClientError.EncodeError({ request })

      assert.strictEqual(reason.message, "Encode error (GET https://example.com/v1/users)")
    })

    it("InvalidUrlError message", () => {
      const request = makeRequest()
      const reason = new HttpClientError.InvalidUrlError({
        request,
        description: "base URL is invalid"
      })

      assert.strictEqual(reason.message, "InvalidUrl: base URL is invalid (GET https://example.com/v1/users)")
    })

    it("StatusCodeError message", () => {
      const request = makeRequest()
      const response = makeResponse(request)
      const reason = new HttpClientError.StatusCodeError({
        request,
        response,
        description: "unexpected status"
      })

      assert.strictEqual(reason.message, "StatusCode: unexpected status (418 GET https://example.com/v1/users)")
    })

    it("DecodeError message", () => {
      const request = makeRequest()
      const response = makeResponse(request)
      const reason = new HttpClientError.DecodeError({
        request,
        response,
        cause: new Error("invalid json")
      })

      assert.strictEqual(reason.message, "Decode error (418 GET https://example.com/v1/users)")
      assert.strictEqual(reason.cause instanceof Error, true)
    })

    it("EmptyBodyError message", () => {
      const request = makeRequest()
      const response = makeResponse(request)
      const reason = new HttpClientError.EmptyBodyError({
        request,
        response,
        description: "missing body"
      })

      assert.strictEqual(reason.message, "EmptyBody: missing body (418 GET https://example.com/v1/users)")
    })
  })

  describe("wrapper", () => {
    it("delegates message and metadata", () => {
      const request = makeRequest()
      const response = makeResponse(request)
      const reason = new HttpClientError.StatusCodeError({
        request,
        response,
        description: "unexpected status"
      })
      const error = new HttpClientError.HttpClientError({ reason })

      assert.strictEqual(error.message, reason.message)
      assert.strictEqual(error.request, request)
      assert.strictEqual(error.response, response)
    })

    it("copies cause from reason", () => {
      const request = makeRequest()
      const cause = new Error("boom")
      const error = new HttpClientError.HttpClientError({
        reason: new HttpClientError.TransportError({
          request,
          cause
        })
      })

      assert.strictEqual(error.cause, cause)
    })

    it("isHttpClientError matches wrapper only", () => {
      const request = makeRequest()
      const wrapper = new HttpClientError.HttpClientError({
        reason: new HttpClientError.TransportError({ request })
      })

      assert.isTrue(HttpClientError.isHttpClientError(wrapper))
      assert.isFalse(HttpClientError.isHttpClientError(new HttpClientError.TransportError({ request })))
      assert.isFalse(HttpClientError.isHttpClientError(new Error("regular error")))
      assert.isFalse(HttpClientError.isHttpClientError({ _tag: "HttpClientError" }))
    })
  })
})
