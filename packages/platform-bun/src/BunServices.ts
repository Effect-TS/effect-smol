/**
 * @since 1.0.0
 */
import * as Layer from "effect/Layer"
import type { FileSystem } from "effect/platform/FileSystem"
import type { Path } from "effect/platform/Path"
import type { Terminal } from "effect/platform/Terminal"
import * as BunFileSystem from "./BunFileSystem.ts"
import * as BunPath from "./BunPath.ts"
import * as BunTerminal from "./BunTerminal.ts"

/**
 * @since 1.0.0
 * @category models
 */
export type BunServices = FileSystem | Path | Terminal

/**
 * @since 1.0.0
 * @category layer
 */
export const layer: Layer.Layer<FileSystem | Path | Terminal> = Layer.mergeAll(
  BunFileSystem.layer,
  BunPath.layer,
  BunTerminal.layer
)
