/**
 * @since 4.0.0
 */
import * as Metric from "../../observability/Metric.ts"

/**
 * @since 4.0.0
 * @category metrics
 */
export const entities = Metric.gauge("effect_cluster_entities", { bigint: true })

/**
 * @since 4.0.0
 * @category metrics
 */
export const singletons = Metric.gauge("effect_cluster_singletons", { bigint: true })

/**
 * @since 4.0.0
 * @category metrics
 */
export const shards = Metric.gauge("effect_cluster_shards", { bigint: true })
