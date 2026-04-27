/**
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"
import * as Inspectable from "effect/Inspectable"
import * as Option from "effect/Option"
import type * as Schema from "effect/Schema"
import type * as Stream from "effect/Stream"
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
  readonly remoteAddressOverride?: Option.Option<string> | undefined

  constructor(
    source: Http.IncomingMessage,
    onError: (error: unknown) => E,
    remoteAddressOverride?: Option.Option<string>
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
    return this.remoteAddressOverride ?? Option.fromNullishOr(this.source.socket.remoteAddress)
  }

  private bytesEffect: Effect.Effect<Uint8Array, E> | undefined
  private get bytes(): Effect.Effect<Uint8Array, E> {
    if (this.bytesEffect) {
      return this.bytesEffect
    }
    this.bytesEffect = Effect.runSync(Effect.cached(
      Effect.flatMap(
        IncomingMessage.MaxBodySize.asEffect(),
        (maxBodySize) =>
          NodeStream.toUint8Array(() => this.source, {
            onError: this.onError,
            maxBytes: maxBodySize
          })
      )
    ))
    return this.bytesEffect
  }

  get text(): Effect.Effect<string, E> {
    return Effect.map(this.bytes, (bytes) => textDecoder.decode(bytes))
  }

  get textUnsafe(): string {
    return Effect.runSync(this.text)
  }

  get json(): Effect.Effect<Schema.Json, E> {
    return Effect.flatMap(this.text, (text) =>
      Effect.try({
        try: () => text === "" ? null : JSON.parse(text),
        catch: this.onError
      }))
  }

  get jsonUnsafe(): Schema.Json {
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
    return Effect.map(this.bytes, (bytes) => bytes.slice().buffer)
  }
}

const textDecoder = new TextDecoder()
