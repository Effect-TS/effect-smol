/**
 * @since 1.0.0
 */
import * as NodeFileSystem from "@effect/platform-node-shared/NodeFileSystem"
import type { FileSystem } from "effect/FileSystem"
import type * as Layer from "effect/Layer"

/**
 * Provides the `FileSystem` service backed by Node filesystem APIs.
 *
 * @category layer
 * @since 1.0.0
 */
export const layer: Layer.Layer<FileSystem> = NodeFileSystem.layer
