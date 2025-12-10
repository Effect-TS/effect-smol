/**
 * @since 1.0.0
 */
import * as Layer from "effect/Layer"
import type { FileSystem } from "effect/platform/FileSystem"
import type { Path } from "effect/platform/Path"
import type { Terminal } from "effect/platform/Terminal"
import type { ChildProcessExecutor } from "effect/unstable/process/ChildProcessExecutor"
import * as NodeChildProcessExecutor from "./NodeChildProcessExecutor.ts"
import * as NodeFileSystem from "./NodeFileSystem.ts"
import * as NodePath from "./NodePath.ts"
import * as NodeTerminal from "./NodeTerminal.ts"

/**
 * @since 1.0.0
 * @category models
 */
export type NodeServices = ChildProcessExecutor | FileSystem | Path | Terminal

/**
 * @since 1.0.0
 * @category layer
 */
export const layer: Layer.Layer<ChildProcessExecutor | FileSystem | Path | Terminal> = Layer.provideMerge(
  NodeChildProcessExecutor.layer,
  Layer.mergeAll(
    NodeFileSystem.layer,
    NodePath.layer,
    NodeTerminal.layer
  )
)
