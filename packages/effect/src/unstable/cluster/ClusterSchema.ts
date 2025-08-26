/**
 * @since 4.0.0
 */
import { constFalse, constTrue } from "../../Function.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { EntityId } from "./EntityId.ts"

/**
 * @since 4.0.0
 * @category Annotations
 */
export const Persisted = ServiceMap.Reference<boolean>("effect/cluster/ClusterSchema/Persisted", {
  defaultValue: constFalse
})

/**
 * @since 4.0.0
 * @category Annotations
 */
export const Uninterruptible = ServiceMap.Reference<boolean>("effect/cluster/ClusterSchema/Uninterruptible", {
  defaultValue: constFalse
})

/**
 * @since 4.0.0
 * @category Annotations
 */
export const ShardGroup = ServiceMap.Reference<(entityId: EntityId) => string>(
  "effect/cluster/ClusterSchema/ShardGroup",
  { defaultValue: () => (_) => "default" }
)

/**
 * @since 4.0.0
 * @category Annotations
 */
export const ClientTracingEnabled = ServiceMap.Reference<boolean>("effect/cluster/ClusterSchema/ClientTracingEnabled", {
  defaultValue: constTrue
})
