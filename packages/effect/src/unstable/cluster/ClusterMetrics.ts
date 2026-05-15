/**
 * @since 4.0.0
 */
import * as Metric from "../../Metric.ts"

/**
 * @category metrics
 * @since 4.0.0
 */
export const entities = Metric.gauge("effect_cluster_entities", { bigint: true })

/**
 * @category metrics
 * @since 4.0.0
 */
export const singletons = Metric.gauge("effect_cluster_singletons", { bigint: true })

/**
 * @category metrics
 * @since 4.0.0
 */
export const runners = Metric.gauge("effect_cluster_runners", { bigint: true })

/**
 * @category metrics
 * @since 4.0.0
 */
export const runnersHealthy = Metric.gauge("effect_cluster_runners_healthy", { bigint: true })

/**
 * @category metrics
 * @since 4.0.0
 */
export const shards = Metric.gauge("effect_cluster_shards", { bigint: true })
