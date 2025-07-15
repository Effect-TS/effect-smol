/**
 * @since 1.0.0
 */
import type * as Effect from "effect/Effect"
import type { FileSystem } from "effect/platform/FileSystem"
import type { Path } from "effect/platform/Path"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as Multipart from "effect/unstable/http/Multipart"
import * as BunStream from "./BunStream.js"

/**
 * @since 1.0.0
 * @category Constructors
 */
export const stream = (source: Request): Stream.Stream<Multipart.Part, Multipart.MultipartError> =>
  BunStream.fromReadableStream({
    evaluate: () => source.body!,
    onError: (cause) => new Multipart.MultipartError({ reason: "InternalError", cause })
  }).pipe(
    Stream.pipeThroughChannel(Multipart.makeChannel(Object.fromEntries(source.headers)))
  )

/**
 * @since 1.0.0
 * @category Constructors
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
