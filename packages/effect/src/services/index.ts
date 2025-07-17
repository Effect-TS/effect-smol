/**
 * @since 4.0.0
 */

/**
 * A `Layer<ROut, E, RIn>` describes how to build one or more services in your
 * application. Services can be injected into effects via
 * `Effect.provideService`. Effects can require services via `Effect.service`.
 *
 * Layer can be thought of as recipes for producing bundles of services, given
 * their dependencies (other services).
 *
 * Construction of services can be effectful and utilize resources that must be
 * acquired and safely released when the services are done being utilized.
 *
 * By default layers are shared, meaning that if the same layer is used twice
 * the layer will only be allocated a single time.
 *
 * Because of their excellent composition properties, layers are the idiomatic
 * way in Effect-TS to create services that depend on other services.
 *
 * @since 2.0.0
 */
export * as Layer from "./Layer.ts"

/**
 * This module provides a collection of reference implementations for commonly used
 * Effect runtime configuration values. These references allow you to access and
 * modify runtime behavior such as concurrency limits, scheduling policies,
 * tracing configuration, and logging settings.
 *
 * References are special service instances that can be dynamically updated
 * during runtime, making them ideal for configuration that may need to change
 * based on application state or external conditions.
 *
 * @since 4.0.0
 */
export * as References from "./References.ts"

/**
 * This module provides a data structure called `ServiceMap` that can be used for dependency injection in effectful
 * programs. It is essentially a table mapping `Keys`s to their implementations (called `Service`s), and can be used to
 * manage dependencies in a type-safe way. The `ServiceMap` data structure is essentially a way of providing access to a set
 * of related services that can be passed around as a single unit. This module provides functions to create, modify, and
 * query the contents of a `ServiceMap`, as well as a number of utility types for working with keys and services.
 *
 * @since 4.0.0
 */
export * as ServiceMap from "./ServiceMap.ts"
