/**
 * @since 1.0.0
 */
import type { FileSystem } from "effect/FileSystem"
import * as Layer from "effect/Layer"
import type { Path } from "effect/Path"
import type { Stdio } from "effect/Stdio"
import type { Terminal } from "effect/Terminal"
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import * as NodeChildProcessSpawner from "./NodeChildProcessSpawner.ts"
import * as NodeFileSystem from "./NodeFileSystem.ts"
import * as NodePath from "./NodePath.ts"
import * as NodeStdio from "./NodeStdio.ts"
import * as NodeTerminal from "./NodeTerminal.ts"

/**
 * @category models
 * @since 1.0.0
 */
export type NodeServices = ChildProcessSpawner | FileSystem | Path | Stdio | Terminal

/**
 * @category layer
 * @since 1.0.0
 */
export const layer: Layer.Layer<NodeServices> = Layer.provideMerge(
  NodeChildProcessSpawner.layer,
  Layer.mergeAll(
    NodeFileSystem.layer,
    NodePath.layer,
    NodeStdio.layer,
    NodeTerminal.layer
  )
)
