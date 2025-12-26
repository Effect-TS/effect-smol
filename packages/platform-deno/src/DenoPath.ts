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
import { Effect, Layer } from "effect"
import { Path, TypeId } from "effect/Path"
import { BadArgument } from "effect/PlatformError"

const fromFileUrl = (url: URL): Effect.Effect<string, BadArgument> =>
  Effect.try({
    try: () => DenoPath.fromFileUrl(url),
    catch: (cause) =>
      new BadArgument({
        module: "Path",
        method: "fromFileUrl",
        cause
      })
  })

const toFileUrl = (path: string): Effect.Effect<URL, BadArgument> =>
  Effect.try({
    try: (): URL => DenoPath.toFileUrl(path),
    catch: (cause): BadArgument =>
      new BadArgument({
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
export const layerPosix: Layer.Layer<Path> = Layer.succeed(Path)({
  [TypeId]: TypeId,
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
export const layerWin32: Layer.Layer<Path> = Layer.succeed(
  Path
)(
  Path.of({
    [TypeId]: TypeId,
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
export const layer: Layer.Layer<Path> = Layer.succeed(
  Path
)(
  Path.of({
    [TypeId]: TypeId,
    ...DenoPath,
    sep: DenoPath.SEPARATOR,
    fromFileUrl,
    toFileUrl
  })
)
