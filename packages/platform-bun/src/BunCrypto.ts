/**
 * @since 1.0.0
 */
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto"
import type * as Crypto from "effect/Crypto"
import type * as Layer from "effect/Layer"

/**
 * @since 1.0.0
 * @category layer
 */
export const layer: Layer.Layer<Crypto.Crypto> = NodeCrypto.layer
