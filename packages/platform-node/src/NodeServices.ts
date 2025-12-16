/**
 * @since 1.0.0
 */
import type { FileSystem } from "effect/FileSystem"
import * as Layer from "effect/Layer"
import type { Path } from "effect/Path"
import type { Terminal } from "effect/Terminal"
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import * as NodeChildProcessSpawner from "./NodeChildProcessSpawner.ts"
import * as NodeFileSystem from "./NodeFileSystem.ts"
import * as NodePath from "./NodePath.ts"
import * as NodeTerminal from "./NodeTerminal.ts"

/**
 * @since 1.0.0
 * @category models
 */
export type NodeServices = ChildProcessSpawner | FileSystem | Path | Terminal

/**
 * @since 1.0.0
 * @category layer
 */
export const layer: Layer.Layer<ChildProcessSpawner | FileSystem | Path | Terminal> = Layer.provideMerge(
  NodeChildProcessSpawner.layer,
  Layer.mergeAll(
    NodeFileSystem.layer,
    NodePath.layer,
    NodeTerminal.layer
  )
)
