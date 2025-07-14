/**
 * @since 2.0.0
 */

export {
  /**
   * @since 2.0.0
   */
  absurd,
  /**
   * @since 2.0.0
   */
  flow,
  /**
   * @since 2.0.0
   */
  hole,
  /**
   * @since 2.0.0
   */
  identity,
  /**
   * @since 2.0.0
   */
  pipe,
  /**
   * @since 2.0.0
   */
  unsafeCoerce
} from "./Function.js"

/**
 * This module provides utility functions for working with arrays in TypeScript.
 *
 * @since 2.0.0
 */
export * as Array from "./Array.js"

/**
 * This module provides utility functions and type class instances for working with the `BigDecimal` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for `Equivalence` and `Order`.
 *
 * A `BigDecimal` allows storing any real number to arbitrary precision; which avoids common floating point errors
 * (such as 0.1 + 0.2 ≠ 0.3) at the cost of complexity.
 *
 * Internally, `BigDecimal` uses a `BigInt` object, paired with a 64-bit integer which determines the position of the
 * decimal point. Therefore, the precision *is not* actually arbitrary, but limited to 2<sup>63</sup> decimal places.
 *
 * It is not recommended to convert a floating point number to a decimal directly, as the floating point representation
 * may be unexpected.
 *
 * @since 2.0.0
 */
export * as BigDecimal from "./BigDecimal.js"

/**
 * This module provides utility functions and type class instances for working with the `bigint` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as BigInt from "./BigInt.js"

/**
 * This module provides utility functions and type class instances for working with the `boolean` type in TypeScript.
 * It includes functions for basic boolean operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as Boolean from "./Boolean.js"

/**
 * This module provides types and utility functions to create and work with branded types,
 * which are TypeScript types with an added type tag to prevent accidental usage of a value in the wrong context.
 *
 * The `refined` and `nominal` functions are both used to create branded types in TypeScript.
 * The main difference between them is that `refined` allows for validation of the data, while `nominal` does not.
 *
 * The `nominal` function is used to create a new branded type that has the same underlying type as the input, but with a different name.
 * This is useful when you want to distinguish between two values of the same type that have different meanings.
 * The `nominal` function does not perform any validation of the input data.
 *
 * On the other hand, the `refined` function is used to create a new branded type that has the same underlying type as the input,
 * but with a different name, and it also allows for validation of the input data.
 * The `refined` function takes a predicate that is used to validate the input data.
 * If the input data fails the validation, a `BrandErrors` is returned, which provides information about the specific validation failure.
 *
 * @since 2.0.0
 */
export * as Brand from "./Brand.js"

/**
 * This module provides utilities for working with `Cause`, a data type that represents
 * the different ways an `Effect` can fail. It includes structured error handling with
 * typed errors, defects, and interruptions.
 *
 * A `Cause` can represent:
 * - **Fail**: A typed, expected error that can be handled
 * - **Die**: An unrecoverable defect (like a programming error)
 * - **Interrupt**: A fiber interruption
 *
 * @example
 * ```ts
 * import { Cause, Effect } from "effect"
 *
 * // Creating different types of causes
 * const failCause = Cause.fail("Something went wrong")
 * const dieCause = Cause.die(new Error("Unexpected error"))
 * const interruptCause = Cause.interrupt(123)
 *
 * // Working with effects that can fail
 * const program = Effect.fail("user error").pipe(
 *   Effect.catchCause((cause) => {
 *     if (Cause.hasFail(cause)) {
 *       const error = Cause.filterError(cause)
 *       console.log("Expected error:", error)
 *     }
 *     return Effect.succeed("handled")
 *   })
 * )
 *
 * // Analyzing failure types
 * const analyzeCause = (cause: Cause.Cause<string>) => {
 *   if (Cause.hasFail(cause)) return "Has user error"
 *   if (Cause.hasDie(cause)) return "Has defect"
 *   if (Cause.hasInterrupt(cause)) return "Was interrupted"
 *   return "Unknown cause"
 * }
 * ```
 *
 * @since 2.0.0
 */
export * as Cause from "./Cause.js"

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
 * import { Channel, Effect } from "effect"
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
 * import { Channel, Effect } from "effect"
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
export * as Channel from "./Channel.js"

/**
 * The `Chunk` module provides an immutable, high-performance sequence data structure
 * optimized for functional programming patterns. A `Chunk` is a persistent data structure
 * that supports efficient append, prepend, and concatenation operations.
 *
 * ## What is a Chunk?
 *
 * A `Chunk<A>` is an immutable sequence of elements of type `A` that provides:
 * - **O(1) append and prepend operations**
 * - **Efficient concatenation** through tree-like structure
 * - **Memory efficiency** with structural sharing
 * - **Rich API** with functional programming operations
 * - **Type safety** with full TypeScript integration
 *
 * ## Key Features
 *
 * - **Immutable**: All operations return new chunks without modifying the original
 * - **Efficient**: Optimized data structure with logarithmic complexity for most operations
 * - **Functional**: Rich set of transformation and combination operators
 * - **Lazy evaluation**: Many operations are deferred until needed
 * - **Interoperable**: Easy conversion to/from arrays and other collections
 *
 * ## Performance Characteristics
 *
 * - **Append/Prepend**: O(1) amortized
 * - **Random Access**: O(log n)
 * - **Concatenation**: O(log min(m, n))
 * - **Iteration**: O(n)
 * - **Memory**: Structural sharing minimizes allocation
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 *
 * // Creating chunks
 * const chunk1 = Chunk.fromIterable([1, 2, 3])
 * const chunk2 = Chunk.fromIterable([4, 5, 6])
 * const empty = Chunk.empty<number>()
 *
 * // Combining chunks
 * const combined = Chunk.appendAll(chunk1, chunk2)
 * console.log(Chunk.toReadonlyArray(combined)) // [1, 2, 3, 4, 5, 6]
 * ```
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 *
 * // Functional transformations
 * const numbers = Chunk.range(1, 5) // [1, 2, 3, 4, 5]
 * const doubled = Chunk.map(numbers, (n) => n * 2) // [2, 4, 6, 8, 10]
 * const evens = Chunk.filter(doubled, (n) => n % 4 === 0) // [4, 8]
 * const sum = Chunk.reduce(evens, 0, (acc, n) => acc + n) // 12
 * ```
 *
 * @example
 * ```ts
 * import { Chunk, Effect } from "effect"
 *
 * // Working with Effects
 * const processChunk = (chunk: Chunk.Chunk<number>) =>
 *   Effect.gen(function* () {
 *     const mapped = Chunk.map(chunk, (n) => n * 2)
 *     const filtered = Chunk.filter(mapped, (n) => n > 5)
 *     return Chunk.toReadonlyArray(filtered)
 *   })
 * ```
 *
 * @since 2.0.0
 */
export * as Chunk from "./Chunk.js"

/**
 * The `Clock` module provides functionality for time-based operations in Effect applications.
 * It offers precise time measurements, scheduling capabilities, and controlled time management
 * for testing scenarios.
 *
 * The Clock service is a core component of the Effect runtime, providing:
 * - Current time access in milliseconds and nanoseconds
 * - Sleep operations for delaying execution
 * - Time-based scheduling primitives
 * - Testable time control through `TestClock`
 *
 * ## Key Features
 *
 * - **Precise timing**: Access to both millisecond and nanosecond precision
 * - **Sleep operations**: Non-blocking sleep with proper interruption handling
 * - **Service integration**: Seamless integration with Effect's dependency injection
 * - **Testable**: Mock time control for deterministic testing
 * - **Resource-safe**: Automatic cleanup of time-based resources
 *
 * @example
 * ```ts
 * import { Clock, Effect } from "effect"
 *
 * // Get current time in milliseconds
 * const getCurrentTime = Clock.currentTimeMillis
 *
 * // Sleep for 1 second
 * const sleep1Second = Effect.sleep("1 seconds")
 *
 * // Measure execution time
 * const measureTime = Effect.gen(function* () {
 *   const start = yield* Clock.currentTimeMillis
 *   yield* Effect.sleep("100 millis")
 *   const end = yield* Clock.currentTimeMillis
 *   return end - start
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Clock, Effect } from "effect"
 *
 * // Using Clock service directly
 * const program = Effect.gen(function* () {
 *   const clock = yield* Clock.Clock
 *   const currentTime = yield* clock.currentTimeMillis
 *   console.log(`Current time: ${currentTime}`)
 *
 *   // Sleep for 500ms
 *   yield* Effect.sleep("500 millis")
 *
 *   const afterSleep = yield* clock.currentTimeMillis
 *   console.log(`After sleep: ${afterSleep}`)
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Clock from "./Clock.js"

/**
 * The `Console` module provides a functional interface for console operations within
 * the Effect ecosystem. It offers type-safe logging, debugging, and console manipulation
 * capabilities with built-in support for testing and environment isolation.
 *
 * ## Key Features
 *
 * - **Type-safe logging**: All console operations return Effects for composability
 * - **Testable**: Mock console output for testing scenarios
 * - **Service-based**: Integrated with Effect's dependency injection system
 * - **Environment isolation**: Different console implementations per environment
 * - **Rich API**: Support for all standard console methods (log, error, debug, etc.)
 * - **Performance tracking**: Built-in timing and profiling capabilities
 *
 * ## Core Operations
 *
 * - **Basic logging**: `log`, `error`, `warn`, `info`, `debug`
 * - **Assertions**: `assert` for conditional logging
 * - **Grouping**: `group`, `groupCollapsed`, `groupEnd` for organized output
 * - **Timing**: `time`, `timeEnd`, `timeLog` for performance measurement
 * - **Data display**: `table`, `dir`, `dirxml` for structured data visualization
 * - **Utilities**: `clear`, `count`, `countReset`, `trace`
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * // Basic logging
 * const program = Effect.gen(function* () {
 *   yield* Console.log("Hello, World!")
 *   yield* Console.error("Something went wrong")
 *   yield* Console.warn("This is a warning")
 *   yield* Console.info("Information message")
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * // Grouped logging with timing
 * const debugProgram = Console.withGroup(
 *   Effect.gen(function* () {
 *     yield* Console.log("Step 1: Loading...")
 *     yield* Effect.sleep("100 millis")
 *
 *     yield* Console.log("Step 2: Processing...")
 *     yield* Effect.sleep("200 millis")
 *   }),
 *   { label: "Processing Data" }
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * // Data visualization and debugging
 * const dataProgram = Effect.gen(function* () {
 *   const users = [
 *     { id: 1, name: "Alice", age: 30 },
 *     { id: 2, name: "Bob", age: 25 }
 *   ]
 *
 *   yield* Console.table(users)
 *   yield* Console.dir(users[0], { depth: 2 })
 *   yield* Console.assert(users.length > 0, "Users array should not be empty")
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Console from "./Console.js"

/**
 * @since 2.0.0
 */
export * as Cron from "./Cron.js"

/**
 * This module provides utilities for creating data types with structural equality
 * semantics. Unlike regular JavaScript objects, `Data` types support value-based
 * equality comparison using the `Equal` module.
 *
 * The main benefits of using `Data` types are:
 * - **Structural equality**: Two `Data` objects are equal if their contents are equal
 * - **Immutability**: `Data` types are designed to be immutable
 * - **Type safety**: Constructors ensure type safety and consistency
 * - **Effect integration**: Error types work seamlessly with Effect's error handling
 *
 * @example
 * ```ts
 * import { Data, Equal } from "effect"
 *
 * // Basic struct usage
 * const person1 = Data.struct({ name: "Alice", age: 30 })
 * const person2 = Data.struct({ name: "Alice", age: 30 })
 *
 * console.log(Equal.equals(person1, person2)) // true
 * console.log(person1 === person2) // false (different references)
 *
 * // Regular objects don't have structural equality
 * const obj1 = { name: "Alice", age: 30 }
 * const obj2 = { name: "Alice", age: 30 }
 * console.log(Equal.equals(obj1, obj2)) // false
 *
 * // Tagged enums for discriminated unions
 * const { Success, Failure, $match } = Data.taggedEnum<
 *   | { _tag: "Success"; value: number }
 *   | { _tag: "Failure"; error: string }
 * >()
 *
 * const result1 = Success({ value: 42 })
 * const result2 = Failure({ error: "Not found" })
 *
 * // Pattern matching
 * const message = $match(result1, {
 *   Success: ({ value }) => `Got value: ${value}`,
 *   Failure: ({ error }) => `Error: ${error}`
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Data from "./Data.js"

/**
 * @since 3.6.0
 */
export * as DateTime from "./DateTime.js"

/**
 * This module provides utilities for working with `Deferred`, a powerful concurrency
 * primitive that represents an asynchronous variable that can be set exactly once.
 * Multiple fibers can await the same `Deferred` and will all be notified when it
 * completes.
 *
 * A `Deferred<A, E>` can be:
 * - **Completed successfully** with a value of type `A`
 * - **Failed** with an error of type `E`
 * - **Interrupted** if the fiber setting it is interrupted
 *
 * Key characteristics:
 * - **Single assignment**: Can only be completed once
 * - **Multiple waiters**: Many fibers can await the same `Deferred`
 * - **Fiber-safe**: Thread-safe operations across concurrent fibers
 * - **Composable**: Works seamlessly with other Effect operations
 *
 * @example
 * ```ts
 * import { Deferred, Effect, Fiber } from "effect"
 *
 * // Basic usage: coordinate between fibers
 * const program = Effect.gen(function* () {
 *   const deferred = yield* Deferred.make<string, never>()
 *
 *   // Fiber 1: waits for the value
 *   const waiter = yield* Effect.fork(
 *     Effect.gen(function* () {
 *       const value = yield* Deferred.await(deferred)
 *       console.log("Received:", value)
 *       return value
 *     })
 *   )
 *
 *   // Fiber 2: sets the value after a delay
 *   const setter = yield* Effect.fork(
 *     Effect.gen(function* () {
 *       yield* Effect.sleep("1 second")
 *       yield* Deferred.succeed(deferred, "Hello from setter!")
 *     })
 *   )
 *
 *   // Wait for both fibers
 *   yield* Fiber.join(waiter)
 *   yield* Fiber.join(setter)
 * })
 *
 * // Producer-consumer pattern
 * const producerConsumer = Effect.gen(function* () {
 *   const buffer = yield* Deferred.make<number[], never>()
 *
 *   const producer = Effect.gen(function* () {
 *     const data = [1, 2, 3, 4, 5]
 *     yield* Deferred.succeed(buffer, data)
 *   })
 *
 *   const consumer = Effect.gen(function* () {
 *     const data = yield* Deferred.await(buffer)
 *     return data.reduce((sum, n) => sum + n, 0)
 *   })
 *
 *   const [, result] = yield* Effect.all([producer, consumer])
 *   return result // 15
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Deferred from "./Deferred.js"

/**
 * This module provides utilities for working with durations of time. A `Duration`
 * is an immutable data type that represents a span of time with high precision,
 * supporting operations from nanoseconds to weeks.
 *
 * Durations support:
 * - **High precision**: Nanosecond-level accuracy using BigInt
 * - **Multiple formats**: Numbers (millis), BigInt (nanos), tuples, strings
 * - **Arithmetic operations**: Add, subtract, multiply, divide
 * - **Comparisons**: Equal, less than, greater than
 * - **Conversions**: Between different time units
 * - **Human-readable formatting**: Pretty printing and parsing
 *
 * @example
 * ```ts
 * import { Duration, Effect } from "effect"
 *
 * // Creating durations
 * const oneSecond = Duration.seconds(1)
 * const fiveMinutes = Duration.minutes(5)
 * const oneHour = Duration.decode("1 hour")
 * const precise = Duration.nanos(BigInt(123456789))
 *
 * // Arithmetic operations
 * const total = Duration.sum(Duration.sum(oneSecond, fiveMinutes), oneHour)
 * const double = Duration.times(oneSecond, 2)
 * const half = Duration.divide(oneSecond, 2)
 *
 * // Comparisons
 * const isLonger = Duration.greaterThan(fiveMinutes, oneSecond) // true
 * const isEqual = Duration.equals(oneSecond, Duration.millis(1000)) // true
 *
 * // Converting and formatting
 * console.log(Duration.toMillis(oneSecond)) // 1000
 * console.log(Duration.format(fiveMinutes)) // "5m"
 *
 * // Using with Effects
 * const program = Effect.gen(function* () {
 *   console.log("Starting...")
 *   yield* Effect.sleep(Duration.seconds(2))
 *   console.log("Done!")
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Duration from "./Duration.js"

/**
 * The `Effect` module is the core of the Effect library, providing a powerful and expressive
 * way to model and compose asynchronous, concurrent, and effectful computations.
 *
 * An `Effect<A, E, R>` represents a computation that:
 * - May succeed with a value of type `A`
 * - May fail with an error of type `E`
 * - Requires a context/environment of type `R`
 *
 * Effects are lazy and immutable - they describe computations that can be executed later.
 * This allows for powerful composition, error handling, resource management, and concurrency
 * patterns.
 *
 * ## Key Features
 *
 * - **Type-safe error handling**: Errors are tracked in the type system
 * - **Resource management**: Automatic cleanup with scoped resources
 * - **Structured concurrency**: Safe parallel and concurrent execution
 * - **Composable**: Effects can be combined using operators like `flatMap`, `map`, `zip`
 * - **Testable**: Built-in support for testing with controlled environments
 * - **Interruptible**: Effects can be safely interrupted and cancelled
 *
 * @example
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * // Creating a simple effect
 * const hello = Effect.succeed("Hello, World!")
 *
 * // Composing effects
 * const program = Effect.gen(function* () {
 *   const message = yield* hello
 *   yield* Console.log(message)
 *   return message.length
 * })
 *
 * // Running the effect
 * Effect.runPromise(program).then(console.log) // 13
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Effect that may fail
 * const divide = (a: number, b: number) =>
 *   b === 0
 *     ? Effect.fail(new Error("Division by zero"))
 *     : Effect.succeed(a / b)
 *
 * // Error handling
 * const program = Effect.gen(function* () {
 *   const result = yield* divide(10, 2)
 *   console.log("Result:", result) // Result: 5
 *   return result
 * })
 *
 * // Handle errors
 * const safeProgram = program.pipe(
 *   Effect.match({
 *     onFailure: (error) => -1,
 *     onSuccess: (value) => value
 *   })
 * )
 * ```
 *
 * @since 2.0.0
 */
export * as Effect from "./Effect.js"

/**
 * This module provides encoding & decoding functionality for:
 *
 * - base64 (RFC4648)
 * - base64 (URL)
 * - hex
 *
 * @since 2.0.0
 */
export * as Encoding from "./Encoding.js"

/**
 * This module provides functionality for defining and working with equality between values.
 * It includes the `Equal` interface for types that can determine equality with other values
 * of the same type, and utilities for comparing values.
 *
 * @since 2.0.0
 */
export * as Equal from "./Equal.js"

/**
 * This module provides utilities for working with equivalence relations - binary relations that are
 * reflexive, symmetric, and transitive. Equivalence relations define when two values of the same type
 * should be considered equivalent, which is fundamental for comparing, deduplicating, and organizing data.
 *
 * An equivalence relation must satisfy three properties:
 * - **Reflexive**: Every value is equivalent to itself
 * - **Symmetric**: If `a` is equivalent to `b`, then `b` is equivalent to `a`
 * - **Transitive**: If `a` is equivalent to `b` and `b` is equivalent to `c`, then `a` is equivalent to `c`
 *
 * @example
 * ```ts
 * import { Equivalence, Array } from "effect"
 *
 * // Case-insensitive string equivalence
 * const caseInsensitive = Equivalence.make<string>((a, b) =>
 *   a.toLowerCase() === b.toLowerCase()
 * )
 *
 * // Use with array deduplication
 * const strings = ["Hello", "world", "HELLO", "World"]
 * const deduplicated = Array.dedupeWith(strings, caseInsensitive)
 * console.log(deduplicated) // ["Hello", "world"]
 *
 * // Product type equivalence
 * interface Person {
 *   name: string
 *   age: number
 * }
 *
 * const personEquivalence = Equivalence.struct({
 *   name: caseInsensitive,
 *   age: Equivalence.number
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Equivalence from "./Equivalence.js"

/**
 * The `Exit` type represents the result of running an Effect computation.
 * An `Exit<A, E>` can either be:
 * - `Success`: Contains a value of type `A`
 * - `Failure`: Contains a `Cause<E>` describing why the effect failed
 *
 * `Exit` is used internally by the Effect runtime and can be useful for
 * handling the results of Effect computations in a more explicit way.
 *
 * @since 2.0.0
 */
export * as Exit from "./Exit.js"

/**
 * This module provides a re-export of the fast-check library for property-based testing.
 * Fast-check is a property-based testing framework that generates random test cases
 * to validate that properties hold true for a wide range of inputs.
 *
 * Property-based testing is a testing methodology where you specify properties that
 * should hold true for your functions, and the framework generates many random test
 * cases to try to find counterexamples.
 *
 * @since 3.10.0
 */
export * as FastCheck from "./FastCheck.js"

/**
 * This module provides utilities for working with `Fiber`, the fundamental unit of
 * concurrency in Effect. Fibers are lightweight, user-space threads that allow
 * multiple Effects to run concurrently with structured concurrency guarantees.
 *
 * Key characteristics of Fibers:
 * - **Lightweight**: Much lighter than OS threads, you can create millions
 * - **Structured concurrency**: Parent fibers manage child fiber lifecycles
 * - **Cancellation safety**: Proper resource cleanup when interrupted
 * - **Cooperative**: Fibers yield control at effect boundaries
 * - **Traceable**: Each fiber has an ID for debugging and monitoring
 *
 * Common patterns:
 * - **Fork and join**: Start concurrent work and wait for results
 * - **Race conditions**: Run multiple effects, take the first to complete
 * - **Supervision**: Monitor and restart failed fibers
 * - **Resource management**: Ensure proper cleanup on interruption
 *
 * @example
 * ```ts
 * import { Effect, Fiber, Console } from "effect"
 *
 * // Basic fiber operations
 * const basicExample = Effect.gen(function* () {
 *   // Fork an effect to run concurrently
 *   const fiber = yield* Effect.fork(
 *     Effect.gen(function* () {
 *       yield* Effect.sleep("2 seconds")
 *       yield* Console.log("Background task completed")
 *       return "background result"
 *     })
 *   )
 *
 *   // Do other work while the fiber runs
 *   yield* Console.log("Doing other work...")
 *   yield* Effect.sleep("1 second")
 *
 *   // Wait for the fiber to complete
 *   const result = yield* Fiber.join(fiber)
 *   yield* Console.log(`Fiber result: ${result}`)
 * })
 *
 * // Joining multiple fibers
 * const joinExample = Effect.gen(function* () {
 *   const task1 = Effect.delay(Effect.succeed("task1"), "1 second")
 *   const task2 = Effect.delay(Effect.succeed("task2"), "2 seconds")
 *
 *   // Start both effects as fibers
 *   const fiber1 = yield* Effect.fork(task1)
 *   const fiber2 = yield* Effect.fork(task2)
 *
 *   // Wait for both to complete
 *   const result1 = yield* Fiber.join(fiber1)
 *   const result2 = yield* Fiber.join(fiber2)
 *   return [result1, result2] // ["task1", "task2"]
 * })
 *
 * // Parallel execution with structured concurrency
 * const parallelExample = Effect.gen(function* () {
 *   const tasks = [1, 2, 3, 4, 5].map(n =>
 *     Effect.gen(function* () {
 *       yield* Effect.sleep(`${n * 100} millis`)
 *       return n * n
 *     })
 *   )
 *
 *   // Run all tasks in parallel, wait for all to complete
 *   const results = yield* Effect.all(tasks, { concurrency: "unbounded" })
 *   return results // [1, 4, 9, 16, 25]
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Fiber from "./Fiber.js"

/**
 * @since 2.0.0
 */
export * as FiberHandle from "./FiberHandle.js"

/**
 * @since 2.0.0
 */
export * as FiberMap from "./FiberMap.js"

/**
 * @since 2.0.0
 */
export * as FiberSet from "./FiberSet.js"

/**
 * @since 4.0.0
 */
export * as Filter from "./Filter.js"

/**
 * @since 2.0.0
 */
export * as Function from "./Function.js"

/**
 * @since 4.0.0
 */
export * as Graph from "./Graph.js"

/**
 * This module provides utilities for hashing values in TypeScript.
 *
 * Hashing is the process of converting data into a fixed-size numeric value,
 * typically used for data structures like hash tables, equality comparisons,
 * and efficient data storage.
 *
 * @since 2.0.0
 */
export * as Hash from "./Hash.js"

/**
 * @since 2.0.0
 */
export * as HashMap from "./HashMap.js"

/**
 * @since 2.0.0
 */
export * as HashSet from "./HashSet.js"

/**
 * This module provides utilities for Higher-Kinded Types (HKT) in TypeScript.
 *
 * Higher-Kinded Types are types that take other types as parameters, similar to how
 * functions take values as parameters. They enable generic programming over type
 * constructors, allowing you to write code that works with any container type
 * (like Array, Option, Effect, etc.) in a uniform way.
 *
 * The HKT system in Effect uses TypeLambdas to encode type-level functions that
 * can represent complex type relationships with multiple type parameters, including
 * contravariant, covariant, and invariant positions.
 *
 * @example
 * ```ts
 * import { HKT } from "effect"
 *
 * // Define a TypeLambda for Array
 * interface ArrayTypeLambda extends HKT.TypeLambda {
 *   readonly type: Array<this["Target"]>
 * }
 *
 * // Use Kind to get the concrete type
 * type MyArray = HKT.Kind<ArrayTypeLambda, never, never, never, string>
 * // MyArray is Array<string>
 *
 * // Define a TypeClass that works with any HKT
 * interface Functor<F extends HKT.TypeLambda> extends HKT.TypeClass<F> {
 *   map<A, B>(fa: HKT.Kind<F, never, never, never, A>, f: (a: A) => B): HKT.Kind<F, never, never, never, B>
 * }
 * ```
 *
 * @since 2.0.0
 */
export * as HKT from "./HKT.js"

/**
 * This module provides utilities for making values inspectable and debuggable in TypeScript.
 *
 * The Inspectable interface provides a standard way to implement custom string representations
 * for objects, making them easier to debug and inspect. It includes support for JSON
 * serialization, Node.js inspection, and safe circular reference handling.
 *
 * The module also includes redaction capabilities for sensitive data, allowing objects
 * to provide different representations based on the current execution context.
 *
 * @example
 * ```ts
 * import { Inspectable } from "effect"
 *
 * class User extends Inspectable.Class {
 *   constructor(
 *     public readonly name: string,
 *     public readonly email: string
 *   ) {
 *     super()
 *   }
 *
 *   toJSON() {
 *     return {
 *       _tag: "User",
 *       name: this.name,
 *       email: this.email
 *     }
 *   }
 * }
 *
 * const user = new User("Alice", "alice@example.com")
 * console.log(user.toString()) // Pretty printed JSON
 * console.log(Inspectable.format(user)) // Same as toString()
 * ```
 *
 * @since 2.0.0
 */
export * as Inspectable from "./Inspectable.js"

/**
 * This module provides utility functions for working with Iterables in TypeScript.
 *
 * Iterables are objects that implement the iterator protocol, allowing them to be
 * consumed with `for...of` loops, spread syntax, and other iteration constructs.
 * This module provides a comprehensive set of functions for creating, transforming,
 * and working with iterables in a functional programming style.
 *
 * Unlike arrays, iterables can be lazy and potentially infinite, making them suitable
 * for stream processing and memory-efficient data manipulation. All functions in this
 * module preserve the lazy nature of iterables where possible.
 *
 * @example
 * ```ts
 * import { Iterable, Option } from "effect"
 *
 * // Create iterables
 * const numbers = Iterable.range(1, 5)
 * const doubled = Iterable.map(numbers, x => x * 2)
 * const filtered = Iterable.filter(doubled, x => x > 5)
 *
 * console.log(Array.from(filtered)) // [6, 8, 10]
 *
 * // Infinite iterables
 * const fibonacci = Iterable.unfold([0, 1], ([a, b]) => Option.some([a, [b, a + b]]))
 * const first10 = Iterable.take(fibonacci, 10)
 * console.log(Array.from(first10)) // [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
 * ```
 *
 * @since 2.0.0
 */
export * as Iterable from "./Iterable.js"

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
export * as Layer from "./Layer.js"

/**
 * @since 3.14.0
 * @experimental
 */
export * as LayerMap from "./LayerMap.js"

/**
 * @since 2.0.0
 *
 * The `Logger` module provides a robust and flexible logging system for Effect applications.
 * It offers structured logging, multiple output formats, and seamless integration with the
 * Effect runtime's tracing and context management.
 *
 * ## Key Features
 *
 * - **Structured Logging**: Built-in support for structured log messages with metadata
 * - **Multiple Formats**: JSON, LogFmt, Pretty, and custom formatting options
 * - **Context Integration**: Automatic capture of fiber context, spans, and annotations
 * - **Batching**: Efficient log aggregation and batch processing
 * - **File Output**: Direct file writing with configurable batch windows
 * - **Composable**: Transform and compose loggers using functional patterns
 *
 * ## Basic Usage
 *
 * ```ts
 * import { Effect, Logger } from "effect"
 *
 * // Basic logging
 * const program = Effect.gen(function* () {
 *   yield* Effect.log("Application started")
 *   yield* Effect.logInfo("Processing user request")
 *   yield* Effect.logWarning("Resource limit approaching")
 *   yield* Effect.logError("Database connection failed")
 * })
 *
 * // With structured data
 * const structuredLog = Effect.gen(function* () {
 *   yield* Effect.log("User action", { userId: 123, action: "login" })
 *   yield* Effect.logInfo("Request processed", { duration: 150, statusCode: 200 })
 * })
 * ```
 *
 * ## Custom Loggers
 *
 * ```ts
 * import { Effect, Logger, LogLevel } from "effect"
 *
 * // Create a custom logger
 * const customLogger = Logger.make((options) => {
 *   console.log(`[${options.logLevel}] ${options.message}`)
 * })
 *
 * // Use JSON format for production
 * const jsonLogger = Logger.consoleJson
 *
 * // Pretty format for development
 * const prettyLogger = Logger.consolePretty()
 *
 * const program = Effect.log("Hello World").pipe(
 *   Effect.provide(Logger.layer([jsonLogger]))
 * )
 * ```
 *
 * ## Multiple Loggers
 *
 * ```ts
 * import { Effect, Logger, Layer } from "effect"
 *
 * // Combine multiple loggers
 * const CombinedLoggerLive = Logger.layer([
 *   Logger.consoleJson,
 *   Logger.consolePretty()
 * ])
 *
 * const program = Effect.log("Application event").pipe(
 *   Effect.provide(CombinedLoggerLive)
 * )
 * ```
 *
 * ## Batched Logging
 *
 * ```ts
 * import { Effect, Logger, Duration } from "effect"
 *
 * const batchedLogger = Logger.batched(Logger.formatJson, {
 *   window: Duration.seconds(5),
 *   flush: (messages) => Effect.sync(() => {
 *     // Process batch of log messages
 *     console.log("Flushing", messages.length, "log entries")
 *   })
 * })
 *
 * const program = Effect.gen(function* () {
 *   const logger = yield* batchedLogger
 *   yield* Effect.provide(
 *     Effect.all([
 *       Effect.log("Event 1"),
 *       Effect.log("Event 2"),
 *       Effect.log("Event 3")
 *     ]),
 *     Logger.layer([logger])
 *   )
 * })
 * ```
 */
export * as Logger from "./Logger.js"

/**
 * @since 2.0.0
 *
 * The `LogLevel` module provides utilities for managing log levels in Effect applications.
 * It defines a hierarchy of log levels and provides functions for comparing and filtering logs
 * based on their severity.
 *
 * ## Log Level Hierarchy
 *
 * The log levels are ordered from most severe to least severe:
 *
 * 1. **All** - Special level that allows all messages
 * 2. **Fatal** - System is unusable, immediate attention required
 * 3. **Error** - Error conditions that should be investigated
 * 4. **Warn** - Warning conditions that may indicate problems
 * 5. **Info** - Informational messages about normal operation
 * 6. **Debug** - Debug information useful during development
 * 7. **Trace** - Very detailed trace information
 * 8. **None** - Special level that suppresses all messages
 *
 * ## Basic Usage
 *
 * ```ts
 * import { LogLevel, Effect } from "effect"
 *
 * // Basic log level usage
 * const program = Effect.gen(function* () {
 *   yield* Effect.logFatal("System is shutting down")
 *   yield* Effect.logError("Database connection failed")
 *   yield* Effect.logWarning("Memory usage is high")
 *   yield* Effect.logInfo("User logged in")
 *   yield* Effect.logDebug("Processing request")
 *   yield* Effect.logTrace("Variable value: xyz")
 * })
 * ```
 *
 * ## Level Comparison
 *
 * ```ts
 * import { LogLevel } from "effect"
 *
 * // Check if one level is more severe than another
 * console.log(LogLevel.greaterThan("Error", "Info")) // true
 * console.log(LogLevel.greaterThan("Debug", "Error")) // false
 *
 * // Check if level meets minimum threshold
 * console.log(LogLevel.greaterThanOrEqualTo("Info", "Debug")) // true
 * console.log(LogLevel.lessThan("Trace", "Info")) // true
 * ```
 *
 * ## Filtering by Level
 *
 * ```ts
 * import { LogLevel, Effect, Logger } from "effect"
 *
 * // Create a logger that only logs Error and above
 * const errorLogger = Logger.make((options) => {
 *   if (LogLevel.greaterThanOrEqualTo(options.logLevel, "Error")) {
 *     console.log(`[${options.logLevel}] ${options.message}`)
 *   }
 * })
 *
 * // Production logger - Info and above
 * const productionLogger = Logger.make((options) => {
 *   if (LogLevel.greaterThanOrEqualTo(options.logLevel, "Info")) {
 *     console.log(`${options.date.toISOString()} [${options.logLevel}] ${options.message}`)
 *   }
 * })
 *
 * // Development logger - Debug and above
 * const devLogger = Logger.make((options) => {
 *   if (LogLevel.greaterThanOrEqualTo(options.logLevel, "Debug")) {
 *     console.log(`[${options.logLevel}] ${options.message}`)
 *   }
 * })
 * ```
 *
 * ## Runtime Configuration
 *
 * ```ts
 * import { LogLevel, Effect, Logger, Config } from "effect"
 *
 * // Configure log level from environment
 * const logLevelConfig = Config.string("LOG_LEVEL").pipe(
 *   Config.withDefault("Info")
 * )
 *
 * const configurableLogger = Effect.gen(function* () {
 *   const minLevel = yield* logLevelConfig
 *
 *   return Logger.make((options) => {
 *     if (LogLevel.greaterThanOrEqualTo(options.logLevel, minLevel)) {
 *       console.log(`[${options.logLevel}] ${options.message}`)
 *     }
 *   })
 * })
 * ```
 */
export * as LogLevel from "./LogLevel.js"

/**
 * @since 2.0.0
 */
export * as ManagedRuntime from "./ManagedRuntime.js"

/**
 * The `effect/match` module provides a type-safe pattern matching system for
 * TypeScript. Inspired by functional programming, it simplifies conditional
 * logic by replacing verbose if/else or switch statements with a structured and
 * expressive API.
 *
 * This module supports matching against types, values, and discriminated unions
 * while enforcing exhaustiveness checking to ensure all cases are handled.
 *
 * Although pattern matching is not yet a native JavaScript feature,
 * `effect/match` offers a reliable implementation that is available today.
 *
 * **How Pattern Matching Works**
 *
 * Pattern matching follows a structured process:
 *
 * - **Creating a matcher**: Define a `Matcher` that operates on either a
 *   specific `Match.type` or `Match.value`.
 *
 * - **Defining patterns**: Use combinators such as `Match.when`, `Match.not`,
 *   and `Match.tag` to specify matching conditions.
 *
 * - **Completing the match**: Apply a finalizer such as `Match.exhaustive`,
 *   `Match.orElse`, or `Match.option` to determine how unmatched cases should
 *   be handled.
 *
 * @since 4.0.0
 */
export * as Match from "./Match.js"

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
 * import { Effect, Metric } from "effect"
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
 * import { Effect, Metric } from "effect"
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
 * import { Effect, Metric, Schedule } from "effect"
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
export * as Metric from "./Metric.js"

/**
 * @fileoverview
 * MutableHashMap is a high-performance, mutable hash map implementation designed for efficient key-value storage
 * with support for both structural and referential equality. It provides O(1) average-case performance for
 * basic operations and integrates seamlessly with Effect's Equal and Hash interfaces.
 *
 * The implementation uses a hybrid approach:
 * - Referential keys (without Equal implementation) are stored in a native Map
 * - Structural keys (with Equal implementation) are stored in hash buckets with collision handling
 *
 * Key Features:
 * - Mutable operations for performance-critical scenarios
 * - Supports both structural and referential equality
 * - Efficient collision handling through bucketing
 * - Iterable interface for easy traversal
 * - Memory-efficient storage with automatic bucket management
 *
 * Performance Characteristics:
 * - Get/Set/Has: O(1) average, O(n) worst case (hash collisions)
 * - Remove: O(1) average, O(n) worst case
 * - Clear: O(1)
 * - Size: O(1)
 * - Iteration: O(n)
 *
 * @since 2.0.0
 * @category data-structures
 */
export * as MutableHashMap from "./MutableHashMap.js"

/**
 * @fileoverview
 * MutableHashSet is a high-performance, mutable set implementation that provides efficient storage
 * and retrieval of unique values. Built on top of MutableHashMap, it inherits the same performance
 * characteristics and support for both structural and referential equality.
 *
 * The implementation uses a MutableHashMap internally where each value is stored as a key with a
 * boolean flag, providing O(1) average-case performance for all operations.
 *
 * Key Features:
 * - Mutable operations for performance-critical scenarios
 * - Supports both structural and referential equality
 * - Efficient duplicate detection and removal
 * - Iterable interface for easy traversal
 * - Memory-efficient storage with automatic deduplication
 * - Seamless integration with Effect's Equal and Hash interfaces
 *
 * Performance Characteristics:
 * - Add/Has/Remove: O(1) average, O(n) worst case (hash collisions)
 * - Clear: O(1)
 * - Size: O(1)
 * - Iteration: O(n)
 *
 * @since 2.0.0
 * @category data-structures
 */
export * as MutableHashSet from "./MutableHashSet.js"

/**
 * @fileoverview
 * MutableList is an efficient, mutable linked list implementation optimized for high-throughput
 * scenarios like logging, queuing, and streaming. It uses a bucket-based architecture where
 * elements are stored in arrays (buckets) linked together, providing optimal performance for
 * both append and prepend operations.
 *
 * The implementation uses a sophisticated bucket system:
 * - Each bucket contains an array of elements with an offset pointer
 * - Buckets can be marked as mutable or immutable for optimization
 * - Elements are taken from the head and added to the tail
 * - Memory is efficiently managed through bucket reuse and cleanup
 *
 * Key Features:
 * - Highly optimized for high-frequency append/prepend operations
 * - Memory efficient with automatic cleanup of consumed elements
 * - Support for bulk operations (appendAll, prependAll, takeN)
 * - Filtering and removal operations
 * - Zero-copy optimizations for certain scenarios
 *
 * Performance Characteristics:
 * - Append/Prepend: O(1) amortized
 * - Take/TakeN: O(1) per element taken
 * - Length: O(1)
 * - Clear: O(1)
 * - Filter: O(n)
 *
 * Ideal Use Cases:
 * - High-throughput logging systems
 * - Producer-consumer queues
 * - Streaming data buffers
 * - Real-time data processing pipelines
 *
 * @since 4.0.0
 * @category data-structures
 */
export * as MutableList from "./MutableList.js"

/**
 * @fileoverview
 * MutableRef provides a mutable reference container that allows safe mutation of values
 * in functional programming contexts. It serves as a bridge between functional and imperative
 * programming paradigms, offering atomic operations for state management.
 *
 * Unlike regular variables, MutableRef encapsulates mutable state and provides controlled
 * access through a standardized API. It supports atomic compare-and-set operations for
 * thread-safe updates and integrates seamlessly with Effect's ecosystem.
 *
 * Key Features:
 * - Mutable reference semantics with functional API
 * - Atomic compare-and-set operations for safe concurrent updates
 * - Specialized operations for numeric and boolean values
 * - Chainable operations that return the reference or the value
 * - Integration with Effect's Equal interface for value comparison
 *
 * Common Use Cases:
 * - State containers in functional applications
 * - Counters and accumulators
 * - Configuration that needs to be updated at runtime
 * - Caching and memoization scenarios
 * - Inter-module communication via shared references
 *
 * Performance Characteristics:
 * - Get/Set: O(1)
 * - Compare-and-set: O(1)
 * - All operations: O(1)
 *
 * @since 2.0.0
 * @category data-structures
 */
export * as MutableRef from "./MutableRef.js"

/**
 * @since 2.0.0
 *
 * The `NonEmptyIterable` module provides types and utilities for working with iterables
 * that are guaranteed to contain at least one element. This provides compile-time
 * safety when working with collections that must not be empty.
 *
 * ## Key Features
 *
 * - **Type Safety**: Compile-time guarantee that the iterable contains at least one element
 * - **Iterator Protocol**: Fully compatible with JavaScript's built-in iteration protocol
 * - **Functional Operations**: Safe operations that preserve the non-empty property
 * - **Lightweight**: Minimal overhead with maximum type safety
 *
 * ## Why NonEmptyIterable?
 *
 * Many operations require non-empty collections to be meaningful:
 * - Finding the maximum or minimum value
 * - Getting the first or last element
 * - Reducing without an initial value
 * - Operations that would otherwise need runtime checks
 *
 * ## Basic Usage
 *
 * ```ts
 * import { NonEmptyIterable } from "effect"
 *
 * // NonEmptyIterable is a type that represents any iterable with at least one element
 * function processNonEmpty<A>(data: NonEmptyIterable.NonEmptyIterable<A>): A {
 *   // Safe to get the first element - guaranteed to exist
 *   const [first] = NonEmptyIterable.unprepend(data)
 *   return first
 * }
 *
 * // Using Array.make to create non-empty arrays
 * const numbers = Array.make(1, 2, 3, 4, 5) as unknown as NonEmptyIterable.NonEmptyIterable<number>
 * const firstNumber = processNonEmpty(numbers) // number
 *
 * // Regular arrays can be asserted as NonEmptyIterable when known to be non-empty
 * const values = [1, 2, 3] as unknown as NonEmptyIterable.NonEmptyIterable<number>
 * const firstValue = processNonEmpty(values) // number
 *
 * // Custom iterables that are guaranteed non-empty
 * function* generateNumbers(): NonEmptyIterable.NonEmptyIterable<number> {
 *   yield 1
 *   yield 2
 *   yield 3
 * }
 *
 * const firstGenerated = processNonEmpty(generateNumbers()) // number
 * ```
 *
 * ## Working with Different Iterable Types
 *
 * ```ts
 * import { NonEmptyIterable, Array, Chunk, pipe } from "effect"
 *
 * // Creating non-empty arrays
 * const nonEmptyArray = Array.make(1, 2, 3) as unknown as NonEmptyIterable.NonEmptyIterable<number>
 *
 * // Working with strings (assert as NonEmptyIterable when known to be non-empty)
 * const nonEmptyString = "hello" as unknown as NonEmptyIterable.NonEmptyIterable<string>
 * const [firstChar] = NonEmptyIterable.unprepend(nonEmptyString)
 * console.log(firstChar) // "h"
 *
 * // Working with Maps (assert when known to be non-empty)
 * const nonEmptyMap = new Map([
 *   ["key1", "value1"],
 *   ["key2", "value2"]
 * ]) as unknown as NonEmptyIterable.NonEmptyIterable<[string, string]>
 * const [firstEntry] = NonEmptyIterable.unprepend(nonEmptyMap)
 * console.log(firstEntry) // ["key1", "value1"]
 *
 * // Custom generator functions
 * function* fibonacci(): NonEmptyIterable.NonEmptyIterable<number> {
 *   let a = 1, b = 1
 *   yield a
 *   while (true) {
 *     yield b
 *     const next = a + b
 *     a = b
 *     b = next
 *   }
 * }
 *
 * const [firstFib, restFib] = NonEmptyIterable.unprepend(fibonacci() as unknown as NonEmptyIterable.NonEmptyIterable<number>)
 * console.log(firstFib) // 1
 * ```
 *
 * ## Integration with Effect Arrays
 *
 * ```ts
 * import { NonEmptyIterable, Array, Chunk, pipe } from "effect"
 *
 * // Many Array functions work with NonEmptyIterable
 * declare const nonEmptyData: NonEmptyIterable.NonEmptyIterable<number>
 *
 * const processData = pipe(
 *   nonEmptyData,
 *   Array.fromIterable,
 *   Array.map(x => x * 2),
 *   Array.filter(x => x > 5),
 *   // Result is a regular array since filtering might make it empty
 * )
 *
 * // Safe operations that preserve non-emptiness
 * const doubledData = pipe(
 *   nonEmptyData,
 *   Array.fromIterable,
 *   Array.map(x => x * 2)
 *   // This would still be non-empty if the source was non-empty
 * )
 * ```
 */
export * as NonEmptyIterable from "./NonEmptyIterable.js"

/**
 * This module provides utility functions and type class instances for working with the `number` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as Number from "./Number.js"

/**
 * @since 2.0.0
 */
export * as Option from "./Option.js"

/**
 * This module provides an implementation of the `Order` type class which is used to define a total ordering on some type `A`.
 * An order is defined by a relation `<=`, which obeys the following laws:
 *
 * - either `x <= y` or `y <= x` (totality)
 * - if `x <= y` and `y <= x`, then `x == y` (antisymmetry)
 * - if `x <= y` and `y <= z`, then `x <= z` (transitivity)
 *
 * The truth table for compare is defined as follows:
 *
 * | `x <= y` | `x >= y` | Ordering |                       |
 * | -------- | -------- | -------- | --------------------- |
 * | `true`   | `true`   | `0`      | corresponds to x == y |
 * | `true`   | `false`  | `< 0`    | corresponds to x < y  |
 * | `false`  | `true`   | `> 0`    | corresponds to x > y  |
 *
 * @since 2.0.0
 */
export * as Order from "./Order.js"

/**
 * @fileoverview
 * The Ordering module provides utilities for working with comparison results and ordering operations.
 * An Ordering represents the result of comparing two values, expressing whether the first value is
 * less than (-1), equal to (0), or greater than (1) the second value.
 *
 * This module is fundamental for building comparison functions, sorting algorithms, and implementing
 * ordered data structures. It provides composable operations for combining multiple comparison results
 * and pattern matching on ordering outcomes.
 *
 * Key Features:
 * - Type-safe representation of comparison results (-1, 0, 1)
 * - Composable operations for combining multiple orderings
 * - Pattern matching utilities for handling different ordering cases
 * - Ordering reversal and combination functions
 * - Integration with Effect's functional programming patterns
 *
 * Common Use Cases:
 * - Implementing custom comparison functions
 * - Building complex sorting criteria
 * - Combining multiple comparison results
 * - Creating ordered data structures
 * - Pattern matching on comparison outcomes
 *
 * @since 2.0.0
 * @category utilities
 */
export * as Ordering from "./Ordering.js"

/**
 * @since 2.0.0
 */
export * as Pipeable from "./Pipeable.js"

/**
 * @since 2.0.0
 */
export * as Predicate from "./Predicate.js"

/**
 * This module provides functionality for working with primary keys.
 * A `PrimaryKey` is a simple interface that represents a unique identifier
 * that can be converted to a string representation.
 *
 * Primary keys are useful for creating unique identifiers for objects,
 * database records, cache keys, or any scenario where you need a
 * string-based unique identifier.
 *
 * @since 2.0.0
 */
export * as PrimaryKey from "./PrimaryKey.js"

/**
 * This module provides utilities for working with publish-subscribe (PubSub) systems.
 *
 * A PubSub is an asynchronous message hub where publishers can publish messages and subscribers
 * can subscribe to receive those messages. PubSub supports various backpressure strategies,
 * message replay, and concurrent access from multiple producers and consumers.
 *
 * @example
 * ```ts
 * import { Effect, PubSub, Scope } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Publisher
 *   yield* PubSub.publish(pubsub, "Hello")
 *   yield* PubSub.publish(pubsub, "World")
 *
 *   // Subscriber
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *     const message1 = yield* PubSub.take(subscription)
 *     const message2 = yield* PubSub.take(subscription)
 *     console.log(message1, message2) // "Hello", "World"
 *   }))
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as PubSub from "./PubSub.js"

/**
 * @since 4.0.0
 */
export * as Pull from "./Pull.js"

/**
 * This module provides utilities for working with asynchronous queues that support various backpressure strategies.
 *
 * A Queue is a data structure that allows producers to add elements and consumers to take elements
 * in a thread-safe manner. The queue supports different strategies for handling backpressure when
 * the queue reaches capacity.
 *
 * @example
 * ```ts
 * import { Effect, Queue } from "effect"
 *
 * // Creating a bounded queue with capacity 10
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number>(10)
 *
 *   // Producer: add items to queue
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *   yield* Queue.offerAll(queue, [3, 4, 5])
 *
 *   // Consumer: take items from queue
 *   const item1 = yield* Queue.take(queue)
 *   const item2 = yield* Queue.take(queue)
 *   const remaining = yield* Queue.takeAll(queue)
 *
 *   console.log({ item1, item2, remaining }) // { item1: 1, item2: 2, remaining: [3, 4, 5] }
 *
 *   // Signal completion
 *   yield* Queue.end(queue)
 * })
 * ```
 *
 * @since 3.8.0
 */
export * as Queue from "./Queue.js"

/**
 * @since 3.5.0
 */
export * as RcMap from "./RcMap.js"

/**
 * @since 3.5.0
 */
export * as RcRef from "./RcRef.js"

/**
 * This module provides utility functions for working with records in TypeScript.
 *
 * @since 2.0.0
 */
export * as Record from "./Record.js"

/**
 * The Redacted module provides functionality for handling sensitive information
 * securely within your application. By using the `Redacted` data type, you can
 * ensure that sensitive values are not accidentally exposed in logs or error
 * messages.
 *
 * @since 3.3.0
 */
export * as Redacted from "./Redacted.js"

/**
 * This module provides utilities for working with mutable references in a functional context.
 *
 * A Ref is a mutable reference that can be read, written, and atomically modified. Unlike plain
 * mutable variables, Refs are thread-safe and work seamlessly with Effect's concurrency model.
 * They provide atomic operations for safe state management in concurrent programs.
 *
 * @example
 * ```ts
 * import { Effect, Ref } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create a ref with initial value
 *   const counter = yield* Ref.make(0)
 *
 *   // Atomic operations
 *   yield* Ref.update(counter, n => n + 1)
 *   yield* Ref.update(counter, n => n * 2)
 *
 *   const value = yield* Ref.get(counter)
 *   console.log(value) // 2
 *
 *   // Atomic modify with return value
 *   const previous = yield* Ref.getAndSet(counter, 100)
 *   console.log(previous) // 2
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Ref from "./Ref.js"

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
export * as References from "./References.js"

/**
 * This module provides utility functions for working with RegExp in TypeScript.
 *
 * @since 2.0.0
 */
export * as RegExp from "./RegExp.js"

/**
 * The `Request` module provides a way to model requests to external data sources
 * in a functional and composable manner. Requests represent descriptions of
 * operations that can be batched, cached, and executed efficiently.
 *
 * A `Request<A, E, R>` represents a request that:
 * - Yields a value of type `A` on success
 * - Can fail with an error of type `E`
 * - Requires services of type `R`
 *
 * Requests are primarily used with RequestResolver to implement efficient
 * data fetching patterns, including automatic batching and caching.
 *
 * @since 2.0.0
 */
export * as Request from "./Request.js"

/**
 * @since 2.0.0
 */
export * as RequestResolver from "./RequestResolver.js"

/**
 * @since 4.0.0
 */
export * as Result from "./Result.js"

/**
 * This module provides utilities for running Effect programs and managing their execution lifecycle.
 *
 * The Runtime module contains functions for creating main program runners that handle process
 * teardown, error reporting, and exit code management. These utilities are particularly useful
 * for creating CLI applications and server processes that need to manage their lifecycle properly.
 *
 * @example
 * ```ts
 * import { Effect, Runtime, Fiber } from "effect"
 *
 * // Create a main runner for Node.js
 * const runMain = Runtime.makeRunMain((options) => {
 *   process.on('SIGINT', () => Effect.runFork(Fiber.interrupt(options.fiber)))
 *   process.on('SIGTERM', () => Effect.runFork(Fiber.interrupt(options.fiber)))
 *
 *   options.fiber.addObserver((exit) => {
 *     options.teardown(exit, (code) => process.exit(code))
 *   })
 * })
 *
 * // Use the runner
 * const program = Effect.log("Hello, World!")
 * runMain(program)
 * ```
 *
 * @since 4.0.0
 */
export * as Runtime from "./Runtime.js"

/**
 * This module provides utilities for creating and composing schedules for retrying operations,
 * repeating effects, and implementing various timing strategies.
 *
 * A Schedule is a function that takes an input and returns a decision whether to continue or halt,
 * along with a delay duration. Schedules can be combined, transformed, and used to implement
 * sophisticated retry and repetition logic.
 *
 * @example
 * ```ts
 * import { Effect, Schedule, Duration } from "effect"
 *
 * // Retry with exponential backoff
 * const retryPolicy = Schedule.exponential("100 millis", 2.0)
 *   .pipe(Schedule.compose(Schedule.recurs(3)))
 *
 * const program = Effect.gen(function*() {
 *   // This will retry up to 3 times with exponential backoff
 *   const result = yield* Effect.retry(
 *     Effect.fail("Network error"),
 *     retryPolicy
 *   )
 * })
 *
 * // Repeat on a fixed schedule
 * const heartbeat = Effect.log("heartbeat")
 *   .pipe(Effect.repeat(Schedule.spaced("30 seconds")))
 * ```
 *
 * @since 2.0.0
 */
export * as Schedule from "./Schedule.js"

/**
 * @since 2.0.0
 */
export * as Scheduler from "./Scheduler.js"

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
export * as Scope from "./Scope.js"

/**
 * This module provides a data structure called `ServiceMap` that can be used for dependency injection in effectful
 * programs. It is essentially a table mapping `Keys`s to their implementations (called `Service`s), and can be used to
 * manage dependencies in a type-safe way. The `ServiceMap` data structure is essentially a way of providing access to a set
 * of related services that can be passed around as a single unit. This module provides functions to create, modify, and
 * query the contents of a `ServiceMap`, as well as a number of utility types for working with keys and services.
 *
 * @since 4.0.0
 */
export * as ServiceMap from "./ServiceMap.js"

/**
 * @since 2.0.0
 */
export * as Sink from "./Sink.js"

/**
 * @since 2.0.0
 */
export * as Stream from "./Stream.js"

/**
 * This module provides utility functions and type class instances for working with the `string` type in TypeScript.
 * It includes functions for basic string manipulation, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as String from "./String.js"

/**
 * This module provides utility functions for working with structs in TypeScript.
 *
 * @since 2.0.0
 */
export * as Struct from "./Struct.js"

/**
 * @since 2.0.0
 */
export * as Symbol from "./Symbol.js"

/**
 * @since 2.0.0
 */
export * as TestClock from "./TestClock.js"

/**
 * @since 4.0.0
 */
export * as TestConsole from "./TestConsole.js"

/**
 * @since 2.0.0
 */
export * as Tracer from "./Tracer.js"

/**
 * A `Trie` is used for locating specific `string` keys from within a set.
 *
 * It works similar to `HashMap`, but with keys required to be `string`.
 * This constraint unlocks some performance optimizations and new methods to get string prefixes (e.g. `keysWithPrefix`, `longestPrefixOf`).
 *
 * Prefix search is also the main feature that makes a `Trie` more suited than `HashMap` for certain usecases.
 *
 * A `Trie` is often used to store a dictionary (list of words) that can be searched
 * in a manner that allows for efficient generation of completion lists
 * (e.g. predict the rest of a word a user is typing).
 *
 * A `Trie` has O(n) lookup time where `n` is the size of the key,
 * or even less than `n` on search misses.
 *
 * @since 2.0.0
 */
export * as Trie from "./Trie.js"

/**
 * This module provides utility functions for working with tuples in TypeScript.
 *
 * @since 2.0.0
 */
export * as Tuple from "./Tuple.js"

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
export * as TxChunk from "./TxChunk.js"

/**
 * @since 2.0.0
 */
export * as TxHashMap from "./TxHashMap.js"

/**
 * @since 2.0.0
 */
export * as TxHashSet from "./TxHashSet.js"

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
export * as TxQueue from "./TxQueue.js"

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
export * as TxRef from "./TxRef.js"

/**
 * @since 4.0.0
 */
export * as TxSemaphore from "./TxSemaphore.js"

/**
 * A collection of types that are commonly used types.
 *
 * @since 2.0.0
 */
export * as Types from "./Types.js"

/**
 * @since 2.0.0
 */
export * as Unify from "./Unify.js"

/**
 * @since 2.0.0
 */
export * as Utils from "./Utils.js"
