/**
 * This module exposes path operations from the Deno Standard Library.
 * @module
 *
 * @example
 * ```ts
 * import { Path } from "effect";
 * import { DenoPath, DenoRuntime } from "@effect/platform-deno";
 * import { assertEquals } from "@std/assert";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   // Access the Path service
 *   const path = yield* Path.Path;
 *
 *   // Join parts of a path to create a complete file path
 *   const extension = path.extname("file.txt");
 *
 *   assertEquals(extension, ".txt");
 * });
 *
 * DenoRuntime.runMain(program.pipe(Effect.provide(DenoPath.layer)));
 * ```
 *
 * @since 1.0.0
 */

import * as DenoPath from "@std/path"
import * as DenoPathPosix from "@std/path/posix"
import * as DenoPathWin from "@std/path/windows"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as PlatformError from "effect/PlatformError"

const fromFileUrl = (url: URL): Effect.Effect<string, PlatformError.BadArgument> =>
  Effect.try({
    try: () => DenoPath.fromFileUrl(url),
    catch: (cause) =>
      new PlatformError.BadArgument({
        module: "Path",
        method: "fromFileUrl",
        cause
      })
  })

const toFileUrl = (path: string): Effect.Effect<URL, PlatformError.BadArgument> =>
  Effect.try({
    try: (): URL => DenoPath.toFileUrl(path),
    catch: (cause): PlatformError.BadArgument =>
      new PlatformError.BadArgument({
        module: "Path",
        method: "toFileUrl",
        cause
      })
  })

/**
 * A {@linkplain Layer.Layer | layer} that provides POSIX path operations.
 *
 * @since 1.0.0
 * @category layer
 */
export const layerPosix: Layer.Layer<Path.Path> = Layer.succeed(Path.Path)({
  [Path.TypeId]: Path.TypeId,
  ...DenoPathPosix,
  sep: DenoPathPosix.SEPARATOR,
  fromFileUrl,
  toFileUrl
})

/**
 * A {@linkplain Layer.Layer | layer} that provides Windows path operations.
 *
 * @since 1.0.0
 * @category layer
 */
export const layerWin32: Layer.Layer<Path.Path> = Layer.succeed(
  Path.Path
)(
  Path.Path.of({
    [Path.TypeId]: Path.TypeId,
    ...DenoPathWin,
    sep: DenoPathWin.SEPARATOR,
    fromFileUrl,
    toFileUrl
  })
)

/**
 * A {@linkplain Layer.Layer | layer} that provides OS-agnostic path operations.
 *
 * @since 1.0.0
 * @category layer
 */
export const layer: Layer.Layer<Path.Path> = Layer.succeed(
  Path.Path
)(
  Path.Path.of({
    [Path.TypeId]: Path.TypeId,
    ...DenoPath,
    sep: DenoPath.SEPARATOR,
    fromFileUrl,
    toFileUrl
  })
)
