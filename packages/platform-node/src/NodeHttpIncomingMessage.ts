/**
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"
import * as Inspectable from "effect/interfaces/Inspectable"
import type * as Stream from "effect/stream/Stream"
import * as Headers from "effect/unstable/http/Headers"
import * as IncomingMessage from "effect/unstable/http/HttpIncomingMessage"
import * as UrlParams from "effect/unstable/http/UrlParams"
import type * as Http from "node:http"
import * as NodeStream from "./NodeStream.ts"

/**
 * @since 1.0.0
 * @category Constructors
 */
export abstract class NodeHttpIncomingMessage<E> extends Inspectable.Class
  implements IncomingMessage.HttpIncomingMessage<E>
{
  /**
   * @since 1.0.0
   */
  readonly [IncomingMessage.TypeId]: typeof IncomingMessage.TypeId
  readonly source: Http.IncomingMessage
  readonly onError: (error: unknown) => E
  readonly remoteAddressOverride?: string | undefined

  constructor(
    source: Http.IncomingMessage,
    onError: (error: unknown) => E,
    remoteAddressOverride?: string
  ) {
    super()
    this[IncomingMessage.TypeId] = IncomingMessage.TypeId
    this.source = source
    this.onError = onError
    this.remoteAddressOverride = remoteAddressOverride
  }

  get headers() {
    return Headers.fromInput(this.source.headers as any)
  }

  get remoteAddress() {
    return this.remoteAddressOverride ?? this.source.socket.remoteAddress
  }

  private textEffect: Effect.Effect<string, E> | undefined
  get text(): Effect.Effect<string, E> {
    if (this.textEffect) {
      return this.textEffect
    }
    this.textEffect = Effect.runSync(Effect.cached(
      Effect.flatMap(
        IncomingMessage.MaxBodySize.asEffect(),
        (maxBodySize) =>
          NodeStream.toString(() => this.source, {
            onError: this.onError,
            maxBytes: maxBodySize
          })
      )
    ))
    return this.textEffect
  }

  get textUnsafe(): string {
    return Effect.runSync(this.text)
  }

  get json(): Effect.Effect<unknown, E> {
    return Effect.flatMap(this.text, (text) =>
      Effect.try({
        try: () => text === "" ? null : JSON.parse(text) as unknown,
        catch: this.onError
      }))
  }

  get jsonUnsafe(): unknown {
    return Effect.runSync(this.json)
  }

  get urlParamsBody(): Effect.Effect<UrlParams.UrlParams, E> {
    return Effect.flatMap(this.text, (_) =>
      Effect.try({
        try: () => UrlParams.fromInput(new URLSearchParams(_)),
        catch: this.onError
      }))
  }

  get stream(): Stream.Stream<Uint8Array, E> {
    return NodeStream.fromReadable({
      evaluate: () => this.source,
      onError: this.onError
    })
  }

  get arrayBuffer(): Effect.Effect<ArrayBuffer, E> {
    return Effect.withFiber((fiber) =>
      NodeStream.toArrayBuffer(() => this.source, {
        onError: this.onError,
        maxBytes: fiber.getRef(IncomingMessage.MaxBodySize)
      })
    )
  }
}
