/**
 * @since 4.0.0
 */

/**
 * @since 3.14.0
 */
export * as LayerMap from "./LayerMap.ts"

/**
 * @since 3.5.0
 */
export * as RcMap from "./RcMap.ts"

/**
 * @since 3.5.0
 */
export * as RcRef from "./RcRef.ts"

/**
 * The `Scope` module provides functionality for managing resource lifecycles
 * and cleanup operations in a functional and composable manner.
 *
 * A `Scope` represents a context where resources can be acquired and automatically
 * cleaned up when the scope is closed. This is essential for managing resources
 * like file handles, database connections, or any other resources that need
 * proper cleanup.
 *
 * Scopes support both sequential and parallel finalization strategies:
 * - Sequential: Finalizers run one after another in reverse order of registration
 * - Parallel: Finalizers run concurrently for better performance
 *
 * @since 2.0.0
 */
export * as Scope from "./Scope.ts"
