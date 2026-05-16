/**
 * @since 1.0.0
 */
import * as NodePath from "@effect/platform-node-shared/NodePath"
import type * as Layer from "effect/Layer"
import type { Path } from "effect/Path"

/**
 * Layer that provides the default `Path` service for Bun using the shared Node path implementation.
 *
 * @category layer
 * @since 1.0.0
 */
export const layer: Layer.Layer<Path> = NodePath.layer

/**
 * Layer that provides the POSIX `Path` service for Bun using the shared Node path implementation.
 *
 * @category layer
 * @since 1.0.0
 */
export const layerPosix: Layer.Layer<Path> = NodePath.layerPosix

/**
 * Layer that provides the Win32 `Path` service for Bun using the shared Node path implementation.
 *
 * @category layer
 * @since 1.0.0
 */
export const layerWin32: Layer.Layer<Path> = NodePath.layerWin32
