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
} from "./Function.ts"

/**
 * @since 3.10.0
 */
export * as Arbitrary from "./Arbitrary.ts"

/**
 * This module provides utility functions for working with arrays in TypeScript.
 *
 * @since 2.0.0
 */
export * as Array from "./Array.ts"

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
export * as BigDecimal from "./BigDecimal.ts"

/**
 * This module provides utility functions and type class instances for working with the `bigint` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as BigInt from "./BigInt.ts"

/**
 * This module provides utility functions and type class instances for working with the `boolean` type in TypeScript.
 * It includes functions for basic boolean operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as Boolean from "./Boolean.ts"

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
export * as Brand from "./Brand.ts"

/**
 * @since 2.0.0
 */
export * as Cause from "./Cause.ts"

/**
 * @since 2.0.0
 */
export * as Channel from "./Channel.ts"

/**
 * @since 2.0.0
 */
export * as Chunk from "./Chunk.ts"

/**
 * @since 2.0.0
 */
export * as Clock from "./Clock.ts"

/**
 * @since 2.0.0
 */
export * as Console from "./Console.ts"

/**
 * This module provides a data structure called `Context` that can be used for dependency injection in effectful
 * programs. It is essentially a table mapping `Tag`s to their implementations (called `Service`s), and can be used to
 * manage dependencies in a type-safe way. The `Context` data structure is essentially a way of providing access to a set
 * of related services that can be passed around as a single unit. This module provides functions to create, modify, and
 * query the contents of a `Context`, as well as a number of utility types for working with tags and services.
 *
 * @since 2.0.0
 */
export * as Context from "./Context.ts"

/**
 * @since 2.0.0
 */
export * as Cron from "./Cron.ts"

/**
 * @since 2.0.0
 */
export * as Data from "./Data.ts"

/**
 * @since 3.6.0
 */
export * as DateTime from "./DateTime.ts"

/**
 * @since 2.0.0
 */
export * as Deferred from "./Deferred.ts"

/**
 * @since 2.0.0
 */
export * as Duration from "./Duration.ts"

/**
 * @since 2.0.0
 */
export * as Effect from "./Effect.ts"

/**
 * @since 2.0.0
 */
export * as Either from "./Either.ts"

/**
 * This module provides encoding & decoding functionality for:
 *
 * - base64 (RFC4648)
 * - base64 (URL)
 * - hex
 *
 * @since 2.0.0
 */
export * as Encoding from "./Encoding.ts"

/**
 * @since 2.0.0
 */
export * as Equal from "./Equal.ts"

/**
 * This module provides an implementation of the `Equivalence` type class, which defines a binary relation
 * that is reflexive, symmetric, and transitive. In other words, it defines a notion of equivalence between values of a certain type.
 * These properties are also known in mathematics as an "equivalence relation".
 *
 * @since 2.0.0
 */
export * as Equivalence from "./Equivalence.ts"

/**
 * @since 2.0.0
 */
export * as Exit from "./Exit.ts"

/**
 * @since 3.10.0
 */
export * as FastCheck from "./FastCheck.ts"

/**
 * @since 2.0.0
 */
export * as Fiber from "./Fiber.ts"

/**
 * @since 2.0.0
 */
export * as Function from "./Function.ts"

/**
 * @since 2.0.0
 */
export * as HKT from "./HKT.ts"

/**
 * @since 2.0.0
 */
export * as Hash from "./Hash.ts"

/**
 * @since 2.0.0
 */
export * as Inspectable from "./Inspectable.ts"

/**
 * This module provides utility functions for working with Iterables in TypeScript.
 *
 * @since 2.0.0
 */
export * as Iterable from "./Iterable.ts"

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
 * @since 3.14.0
 * @experimental
 */
export * as LayerMap from "./LayerMap.ts"

/**
 * @since 2.0.0
 */
export * as LogLevel from "./LogLevel.ts"

/**
 * @since 2.0.0
 */
export * as Logger from "./Logger.ts"

/**
 * @since 1.0.0
 */
export * as Match from "./Match.ts"

/**
 * @since 2.0.0
 */
export * as MutableHashMap from "./MutableHashMap.ts"

/**
 * @since 2.0.0
 */
export * as MutableHashSet from "./MutableHashSet.ts"

/**
 * @since 4.0.0
 */
export * as MutableList from "./MutableList.ts"

/**
 * @since 2.0.0
 */
export * as MutableRef from "./MutableRef.ts"

/**
 * @since 2.0.0
 */
export * as NonEmptyIterable from "./NonEmptyIterable.ts"

/**
 * This module provides utility functions and type class instances for working with the `number` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as Number from "./Number.ts"

/**
 * @since 2.0.0
 */
export * as Option from "./Option.ts"

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
export * as Order from "./Order.ts"

/**
 * @since 2.0.0
 */
export * as Ordering from "./Ordering.ts"

/**
 * @since 2.0.0
 */
export * as Pipeable from "./Pipeable.ts"

/**
 * @since 2.0.0
 */
export * as Predicate from "./Predicate.ts"

/**
 * @since 3.10.0
 */
export * as Pretty from "./Pretty.ts"

/**
 * @since 2.0.0
 */
export * as PrimaryKey from "./PrimaryKey.ts"

/**
 * @since 2.0.0
 */
export * as PubSub from "./PubSub.ts"

/**
 * @since 4.0.0
 */
export * as Pull from "./Pull.ts"

/**
 * @since 3.8.0
 */
export * as Queue from "./Queue.ts"

/**
 * @since 3.5.0
 */
export * as RcMap from "./RcMap.ts"

/**
 * @since 3.5.0
 */
export * as RcRef from "./RcRef.ts"

/**
 * This module provides utility functions for working with records in TypeScript.
 *
 * @since 2.0.0
 */
export * as Record from "./Record.ts"

/**
 * The Redacted module provides functionality for handling sensitive information
 * securely within your application. By using the `Redacted` data type, you can
 * ensure that sensitive values are not accidentally exposed in logs or error
 * messages.
 *
 * @since 3.3.0
 */
export * as Redacted from "./Redacted.ts"

/**
 * @since 2.0.0
 */
export * as Ref from "./Ref.ts"

/**
 * @since 4.0.0
 */
export * as References from "./References.ts"

/**
 * This module provides utility functions for working with RegExp in TypeScript.
 *
 * @since 2.0.0
 */
export * as RegExp from "./RegExp.ts"

/**
 * @since 2.0.0
 */
export * as Request from "./Request.ts"

/**
 * @since 2.0.0
 */
export * as RequestResolver from "./RequestResolver.ts"

/**
 * @since 4.0.0
 */
export * as Result from "./Result.ts"

/**
 * @since 2.0.0
 */
export * as Schedule from "./Schedule.ts"

/**
 * @since 2.0.0
 */
export * as Scheduler from "./Scheduler.ts"

/**
 * @since 3.10.0
 */
export * as Schema from "./Schema.ts"

/**
 * @since 3.10.0
 */
export * as SchemaAST from "./SchemaAST.ts"

/**
 * @since 3.10.0
 */
export * as SchemaResult from "./SchemaResult.ts"

/**
 * @since 2.0.0
 */
export * as Scope from "./Scope.ts"

/**
 * @since 2.0.0
 */
export * as Sink from "./Sink.ts"

/**
 * @since 2.0.0
 */
export * as Stream from "./Stream.ts"

/**
 * This module provides utility functions and type class instances for working with the `string` type in TypeScript.
 * It includes functions for basic string manipulation, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as String from "./String.ts"

/**
 * This module provides utility functions for working with structs in TypeScript.
 *
 * @since 2.0.0
 */
export * as Struct from "./Struct.ts"

/**
 * @since 2.0.0
 */
export * as Symbol from "./Symbol.ts"

/**
 * @since 2.0.0
 */
export * as TestClock from "./TestClock.ts"

/**
 * @since 4.0.0
 */
export * as TestConsole from "./TestConsole.ts"

/**
 * @since 2.0.0
 */
export * as Tracer from "./Tracer.ts"

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
export * as Trie from "./Trie.ts"

/**
 * This module provides utility functions for working with tuples in TypeScript.
 *
 * @since 2.0.0
 */
export * as Tuple from "./Tuple.ts"

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
 * A collection of types that are commonly used types.
 *
 * @since 2.0.0
 */
export * as Types from "./Types.ts"

/**
 * @since 2.0.0
 */
export * as Unify from "./Unify.ts"

/**
 * @since 2.0.0
 */
export * as Utils from "./Utils.ts"
