/**
 * @since 1.0.0
 */
import * as NodeFileSystem from "@effect/platform-node-shared/NodeFileSystem"
import type * as Layer from "effect/Layer"
import type { FileSystem } from "effect/platform/FileSystem"

/**
 * @since 1.0.0
 * @category layer
 */
export const layer: Layer.Layer<FileSystem, never, never> = NodeFileSystem.layer
