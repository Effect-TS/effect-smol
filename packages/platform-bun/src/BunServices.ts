/**
 * @since 1.0.0
 */
import type { FileSystem } from "effect/platform/FileSystem"
import type { Path } from "effect/platform/Path"
import * as Layer from "effect/services/Layer"
import * as NodeFileSystem from "./BunFileSystem.ts"
import * as NodePath from "./BunPath.ts"

/**
 * @since 1.0.0
 * @category layer
 */
export const layer: Layer.Layer<FileSystem | Path> = Layer.mergeAll(
  NodeFileSystem.layer,
  NodePath.layer
)
