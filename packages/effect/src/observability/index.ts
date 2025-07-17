/**
 * @since 4.0.0
 */

/**
 * @since 2.0.0
 *
 * The `Metric` module provides a comprehensive system for collecting, aggregating, and observing
 * application metrics in Effect applications. It offers type-safe, concurrent metrics that can
 * be used to monitor performance, track business metrics, and gain insights into application behavior.
 *
 * ## Key Features
 *
 * - **Five Metric Types**: Counters, Gauges, Frequencies, Histograms, and Summaries
 * - **Type Safety**: Fully typed metrics with compile-time guarantees
 * - **Concurrency Safe**: Thread-safe metrics that work with Effect's concurrency model
 * - **Attributes**: Tag metrics with key-value attributes for filtering and grouping
 * - **Snapshots**: Take point-in-time snapshots of all metrics for reporting
 * - **Runtime Integration**: Automatic fiber runtime metrics collection
 *
 * ## Metric Types
 *
 * ### Counter
 * Tracks cumulative values that only increase or can be reset to zero.
 * Perfect for counting events, requests, errors, etc.
 *
 * ### Gauge
 * Represents a single numerical value that can go up or down.
 * Ideal for current resource usage, temperature, queue sizes, etc.
 *
 * ### Frequency
 * Counts occurrences of discrete string values.
 * Useful for tracking categorical data like HTTP status codes, user actions, etc.
 *
 * ### Histogram
 * Records observations in configurable buckets to analyze distribution.
 * Great for response times, request sizes, and other measured values.
 *
 * ### Summary
 * Calculates quantiles over a sliding time window.
 * Provides statistical insights into value distributions over time.
 *
 * ## Basic Usage
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Metric } from "effect/observability"
 *
 * // Create metrics
 * const requestCount = Metric.counter("http_requests_total", {
 *   description: "Total number of HTTP requests"
 * })
 *
 * const responseTime = Metric.histogram("http_response_time", {
 *   description: "HTTP response time in milliseconds",
 *   boundaries: Metric.linearBoundaries({ start: 0, width: 50, count: 20 })
 * })
 *
 * // Use metrics in your application
 * const handleRequest = Effect.gen(function* () {
 *   yield* Metric.update(requestCount, 1)
 *
 *   const startTime = yield* Effect.clockWith(clock => clock.currentTimeMillis)
 *
 *   // Process request...
 *   yield* Effect.sleep("100 millis")
 *
 *   const endTime = yield* Effect.clockWith(clock => clock.currentTimeMillis)
 *   yield* Metric.update(responseTime, endTime - startTime)
 * })
 * ```
 *
 * ## Attributes and Tagging
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Metric } from "effect/observability"
 *
 * const requestCount = Metric.counter("requests", {
 *   description: "Number of requests by endpoint and method"
 * })
 *
 * const program = Effect.gen(function* () {
 *   // Add attributes to metrics
 *   yield* Metric.update(
 *     Metric.withAttributes(requestCount, {
 *       endpoint: "/api/users",
 *       method: "GET"
 *     }),
 *     1
 *   )
 *
 *   // Or use withAttributes for compile-time attributes
 *   const taggedCounter = Metric.withAttributes(requestCount, {
 *     endpoint: "/api/posts",
 *     method: "POST"
 *   })
 *   yield* Metric.update(taggedCounter, 1)
 * })
 * ```
 *
 * ## Advanced Examples
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Metric } from "effect/observability"
 * import { Schedule } from "effect/scheduling"
 *
 * // Business metrics
 * const userSignups = Metric.counter("user_signups_total")
 * const activeUsers = Metric.gauge("active_users_current")
 * const featureUsage = Metric.frequency("feature_usage")
 *
 * // Performance metrics
 * const dbQueryTime = Metric.summary("db_query_duration", {
 *   maxAge: "5 minutes",
 *   maxSize: 1000,
 *   quantiles: [0.5, 0.9, 0.95, 0.99]
 * })
 *
 * const program = Effect.gen(function* () {
 *   // Track user signup
 *   yield* Metric.update(userSignups, 1)
 *
 *   // Update active user count
 *   yield* Metric.update(activeUsers, 1250)
 *
 *   // Record feature usage
 *   yield* Metric.update(featureUsage, "dashboard_view")
 *
 *   // Measure database query time
 *   yield* Effect.timed(performDatabaseQuery).pipe(
 *     Effect.tap(([duration]) => Metric.update(dbQueryTime, duration))
 *   )
 * })
 *
 * // Get metric snapshots
 * const getMetrics = Effect.gen(function* () {
 *   const snapshots = yield* Metric.snapshot
 *
 *   for (const metric of snapshots) {
 *     console.log(`${metric.id}: ${JSON.stringify(metric.state)}`)
 *   }
 * })
 * ```
 */
export * as Metric from "./Metric.ts"

/**
 * @since 2.0.0
 */
export * as Tracer from "./Tracer.ts"
