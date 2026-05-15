/**
 * @since 1.0.0
 */
import * as NodePath from "@effect/platform-node-shared/NodePath"
import type * as Layer from "effect/Layer"
import type { Path } from "effect/Path"

/**
 * @category layer
 * @since 1.0.0
 */
export const layer: Layer.Layer<Path> = NodePath.layer

/**
 * @category layer
 * @since 1.0.0
 */
export const layerPosix: Layer.Layer<Path> = NodePath.layerPosix

/**
 * @category layer
 * @since 1.0.0
 */
export const layerWin32: Layer.Layer<Path> = NodePath.layerWin32
