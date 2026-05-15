/**
 * @since 1.0.0
 */
import * as NodeFileSystem from "@effect/platform-node-shared/NodeFileSystem"
import type { FileSystem } from "effect/FileSystem"
import type * as Layer from "effect/Layer"

/**
 * @category layer
 * @since 1.0.0
 */
export const layer: Layer.Layer<FileSystem, never, never> = NodeFileSystem.layer
