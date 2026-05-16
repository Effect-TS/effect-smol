/**
 * @since 1.0.0
 */
import * as NodePath from "@effect/platform-node-shared/NodePath"
import type * as Layer from "effect/Layer"
import type { Path } from "effect/Path"

/**
 * Provides the default Node `Path` service using the platform's `node:path`
 * implementation.
 *
 * @category layer
 * @since 1.0.0
 */
export const layer: Layer.Layer<Path> = NodePath.layer

/**
 * Provides the `Path` service using Node's POSIX path implementation,
 * regardless of the host platform.
 *
 * @category layer
 * @since 1.0.0
 */
export const layerPosix: Layer.Layer<Path> = NodePath.layerPosix

/**
 * Provides the `Path` service using Node's Windows path implementation,
 * regardless of the host platform.
 *
 * @category layer
 * @since 1.0.0
 */
export const layerWin32: Layer.Layer<Path> = NodePath.layerWin32
