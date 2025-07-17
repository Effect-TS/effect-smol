/**
 * @since 4.0.0
 */

/**
 * The `Channel` module provides a powerful abstraction for bi-directional communication
 * and streaming operations. A `Channel` is a nexus of I/O operations that supports both
 * reading and writing, forming the foundation for Effect's Stream and Sink abstractions.
 *
 * ## What is a Channel?
 *
 * A `Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>` represents:
 * - **OutElem**: The type of elements the channel outputs
 * - **OutErr**: The type of errors the channel can produce
 * - **OutDone**: The type of the final value when the channel completes
 * - **InElem**: The type of elements the channel reads
 * - **InErr**: The type of errors the channel can receive
 * - **InDone**: The type of the final value from upstream
 * - **Env**: The environment/context required by the channel
 *
 * ## Key Features
 *
 * - **Bi-directional**: Channels can both read and write
 * - **Composable**: Channels can be piped, sequenced, and concatenated
 * - **Resource-safe**: Automatic cleanup and resource management
 * - **Error-handling**: Built-in error propagation and handling
 * - **Concurrent**: Support for concurrent operations
 *
 * ## Composition Patterns
 *
 * 1. **Piping**: Connect channels where output of one becomes input of another
 * 2. **Sequencing**: Use the result of one channel to create another
 * 3. **Concatenating**: Combine multiple channels into a single channel
 *
 * @example
 * ```ts
 * import { Channel } from "effect/stream"
 * import { Effect } from "effect"
 *
 * // Simple channel that outputs numbers
 * const numberChannel = Channel.succeed(42)
 *
 * // Transform channel that doubles values
 * const doubleChannel = Channel.map(numberChannel, (n) => n * 2)
 *
 * // Running the channel would output: 84
 * ```
 *
 * @example
 * ```ts
 * import { Channel } from "effect/stream"
 * import { Effect } from "effect"
 *
 * // Channel from an array of values
 * const arrayChannel = Channel.fromArray([1, 2, 3, 4, 5])
 *
 * // Transform the channel by mapping over values
 * const transformedChannel = Channel.map(arrayChannel, (n) => n * 2)
 *
 * // This channel will output: 2, 4, 6, 8, 10
 * ```
 *
 * @since 2.0.0
 */
export * as Channel from "./Channel.ts"

/**
 * @since 4.0.0
 */
export * as Pull from "./Pull.ts"

/**
 * @since 2.0.0
 */
export * as Sink from "./Sink.ts"

/**
 * @since 2.0.0
 */
export * as Stream from "./Stream.ts"
