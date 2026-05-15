/**
 * @since 1.0.0
 */
import * as NodeStdio from "@effect/platform-node-shared/NodeStdio"
import type * as Layer from "effect/Layer"
import type { Stdio } from "effect/Stdio"

/**
 * @category layer
 * @since 1.0.0
 */
export const layer: Layer.Layer<Stdio> = NodeStdio.layer
