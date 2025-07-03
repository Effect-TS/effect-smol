/**
 * @since 1.0.0
 */
import * as Effect from "../../Effect.js"
import type * as Layer from "../../Layer.js"
import * as ServiceMap from "../../ServiceMap.js"
import * as Stream from "../../Stream.js"
import * as Headers from "./Headers.js"
import * as HttpClient from "./HttpClient.js"
import { RequestError } from "./HttpClientError.js"
import * as HttpClientResponse from "./HttpClientResponse.js"

/**
 * @since 1.0.0
 * @category tags
 */
export class Fetch extends ServiceMap.Reference("effect/http/FetchHttpClient/Fetch", {
  defaultValue: (): typeof globalThis.fetch => globalThis.fetch
}) {}

/**
 * @since 1.0.0
 * @category tags
 */
export class RequestInit
  extends ServiceMap.Key<RequestInit, globalThis.RequestInit>()("effect/http/FetchHttpClient/RequestInit")
{}

const fetch: HttpClient.HttpClient = HttpClient.make((request, url, signal, fiber) => {
  const fetch = fiber.getRef(Fetch)
  const options: globalThis.RequestInit = fiber.services.unsafeMap.get(RequestInit.key) ?? {}
  const headers = options.headers ? Headers.merge(Headers.fromInput(options.headers), request.headers) : request.headers
  const send = (body: BodyInit | undefined) =>
    Effect.map(
      Effect.tryPromise({
        try: () =>
          fetch(url, {
            ...options,
            method: request.method,
            headers,
            body,
            duplex: request.body._tag === "Stream" ? "half" : undefined,
            signal
          } as any),
        catch: (cause) =>
          new RequestError({
            request,
            reason: "Transport",
            cause
          })
      }),
      (response) => HttpClientResponse.fromWeb(request, response)
    )
  switch (request.body._tag) {
    case "Raw":
    case "Uint8Array":
      return send(request.body.body as any)
    case "FormData":
      return send(request.body.formData)
    case "Stream":
      return Effect.flatMap(Stream.toReadableStreamEffect(request.body.stream), send)
  }
  return send(undefined)
})

/**
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<HttpClient.HttpClient> = HttpClient.layerMergedServices(Effect.succeed(fetch))
