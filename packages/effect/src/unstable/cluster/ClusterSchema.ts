/**
 * @since 4.0.0
 */
import { constFalse, constTrue, identity } from "../../Function.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Rpc from "../rpc/Rpc.ts"
import type { EntityId } from "./EntityId.ts"
import type { Request } from "./Envelope.ts"

/**
 * @since 4.0.0
 * @category Annotations
 */
export const Persisted = ServiceMap.Reference<boolean>("effect/cluster/ClusterSchema/Persisted", {
  defaultValue: constFalse
})

/**
 * Whether to wrap the request with a storage transaction, so sql queries are
 * committed atomically.
 *
 * @since 4.0.0
 * @category Annotations
 */
export const WithTransaction = ServiceMap.Reference<boolean>(
  "effect/cluster/ClusterSchema/WithTransaction",
  { defaultValue: constFalse }
)

/**
 * @since 4.0.0
 * @category Annotations
 */
export const Uninterruptible = ServiceMap.Reference<boolean | "client" | "server">(
  "effect/cluster/ClusterSchema/Uninterruptible",
  { defaultValue: constFalse }
)

/**
 * @since 4.0.0
 * @category Annotations
 */
export const isUninterruptibleForServer = (context: ServiceMap.ServiceMap<never>): boolean => {
  const value = ServiceMap.get(context, Uninterruptible)
  return value === true || value === "server"
}

/**
 * @since 4.0.0
 * @category Annotations
 */
export const isUninterruptibleForClient = (context: ServiceMap.ServiceMap<never>): boolean => {
  const value = ServiceMap.get(context, Uninterruptible)
  return value === true || value === "client"
}

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

/**
 * Dynamically transform the request annotations based on the request.
 * This only applies to the requests handled by the Entity, not the client.
 *
 * @since 4.0.0
 * @category Annotations
 */
export const Dynamic = ServiceMap.Reference<
  (annotations: ServiceMap.ServiceMap<never>, request: Request<Rpc.AnyWithProps>) => ServiceMap.ServiceMap<never>
>(
  "effect/cluster/ClusterSchema/Dynamic",
  { defaultValue: () => identity }
)
