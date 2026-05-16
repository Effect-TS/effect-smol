/**
 * @since 4.0.0
 */
import * as Metric from "../../Metric.ts"

/**
 * Gauge tracking the number of active entity instances for each entity type on
 * the current runner.
 *
 * @category metrics
 * @since 4.0.0
 */
export const entities = Metric.gauge("effect_cluster_entities", { bigint: true })

/**
 * Gauge tracking the number of singleton processes currently running on the
 * current runner.
 *
 * @category metrics
 * @since 4.0.0
 */
export const singletons = Metric.gauge("effect_cluster_singletons", { bigint: true })

/**
 * Gauge tracking the number of registered cluster runners.
 *
 * @category metrics
 * @since 4.0.0
 */
export const runners = Metric.gauge("effect_cluster_runners", { bigint: true })

/**
 * Gauge tracking the number of cluster runners currently considered healthy.
 *
 * @category metrics
 * @since 4.0.0
 */
export const runnersHealthy = Metric.gauge("effect_cluster_runners_healthy", { bigint: true })

/**
 * Gauge tracking the number of shards currently acquired by the current runner.
 *
 * @category metrics
 * @since 4.0.0
 */
export const shards = Metric.gauge("effect_cluster_shards", { bigint: true })
