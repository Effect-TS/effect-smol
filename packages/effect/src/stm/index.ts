/**
 * @since 4.0.0
 */

/**
 * TxChunk is a transactional chunk data structure that provides Software Transactional Memory (STM)
 * semantics for chunk operations. It uses a `TxRef<Chunk<A>>` internally to ensure all operations
 * are performed atomically within transactions.
 *
 * Accessed values are tracked by the transaction in order to detect conflicts and to track changes.
 * A transaction will retry whenever a conflict is detected or whenever the transaction explicitly
 * calls `Effect.retryTransaction` and any of the accessed TxChunk values change.
 *
 * @since 4.0.0
 */
export * as TxChunk from "./TxChunk.ts"

/**
 * @since 2.0.0
 */
export * as TxHashMap from "./TxHashMap.ts"

/**
 * @since 2.0.0
 */
export * as TxHashSet from "./TxHashSet.ts"

/**
 * TxQueue is a transactional queue data structure that provides Software Transactional Memory (STM)
 * semantics for queue operations. It uses TxRef for transactional state management and supports
 * multiple queue strategies: bounded, unbounded, dropping, and sliding.
 *
 * Accessed values are tracked by the transaction in order to detect conflicts and to track changes.
 * A transaction will retry whenever a conflict is detected or whenever the transaction explicitly
 * calls `Effect.retryTransaction` and any of the accessed TxQueue values change.
 *
 * @since 4.0.0
 */
export * as TxQueue from "./TxQueue.ts"

/**
 * TxRef is a transactional value, it can be read and modified within the body of a transaction.
 *
 * Accessed values are tracked by the transaction in order to detect conflicts and in order to
 * track changes, a transaction will retry whenever a conflict is detected or whenever the
 * transaction explicitely calls to `Effect.retryTransaction` and any of the accessed TxRef values
 * change.
 *
 * @since 4.0.0
 */
export * as TxRef from "./TxRef.ts"

/**
 * @since 4.0.0
 */
export * as TxSemaphore from "./TxSemaphore.ts"
