/**
 * @since 1.0.0
 */
import * as NodeFileSystem from "@effect/platform-node-shared/NodeFileSystem"
import type { FileSystem } from "effect/FileSystem"
import type * as Layer from "effect/Layer"

/**
 * Layer that provides the `FileSystem` service for Bun using the shared Node file-system implementation.
 *
 * @category layer
 * @since 1.0.0
 */
export const layer: Layer.Layer<FileSystem, never, never> = NodeFileSystem.layer
