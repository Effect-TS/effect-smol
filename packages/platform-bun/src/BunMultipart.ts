/**
 * @since 1.0.0
 */
import type * as Effect from "effect/Effect"
import type { FileSystem } from "effect/FileSystem"
import type { Path } from "effect/Path"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as Multipart from "effect/unstable/http/Multipart"
import * as BunStream from "./BunStream.ts"

/**
 * Parses a Bun `Request` body as multipart data and returns a stream of multipart parts.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const stream = (source: Request): Stream.Stream<Multipart.Part, Multipart.MultipartError> =>
  BunStream.fromReadableStream({
    evaluate: () => source.body ?? emptyReadbleStream,
    onError: (cause) => Multipart.MultipartError.fromReason("InternalError", cause)
  }).pipe(
    Stream.pipeThroughChannel(Multipart.makeChannel(Object.fromEntries(source.headers)))
  )

const emptyReadbleStream = new ReadableStream({
  start(controller) {
    controller.enqueue(new Uint8Array())
    controller.close()
  }
})

/**
 * Parses and persists multipart data from a Bun `Request`, requiring file-system, path, and scope services.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const persisted = (
  source: Request
): Effect.Effect<
  Multipart.Persisted,
  Multipart.MultipartError,
  | FileSystem
  | Path
  | Scope.Scope
> => Multipart.toPersisted(stream(source))
