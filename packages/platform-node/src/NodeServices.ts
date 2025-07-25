/**
 * @since 1.0.0
 */
import * as Layer from "effect/Layer"
import type { FileSystem } from "effect/platform/FileSystem"
import type { Path } from "effect/platform/Path"
import * as NodeFileSystem from "./NodeFileSystem.ts"
import * as NodePath from "./NodePath.ts"

/**
 * @since 1.0.0
 * @category layer
 */
export const layer: Layer.Layer<FileSystem | Path> = Layer.mergeAll(
  NodeFileSystem.layer,
  NodePath.layer
)
