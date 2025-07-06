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
import * as Chunk from "./Chunk.js"
import * as Effect from "./Effect.js"
import { dual } from "./Function.js"
import type { Inspectable } from "./Inspectable.js"
import { format, NodeInspectSymbol, toJSON } from "./Inspectable.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as TxRef from "./TxRef.js"
import type { NoInfer } from "./Types.js"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: TypeId = "~effect/TxChunk"

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = "~effect/TxChunk"

/**
 * TxChunk is a transactional chunk data structure that provides Software Transactional Memory (STM)
 * semantics for chunk operations.
 *
 * Accessed values are tracked by the transaction in order to detect conflicts and to track changes.
 * A transaction will retry whenever a conflict is detected or whenever the transaction explicitly
 * calls `Effect.retryTransaction` and any of the accessed TxChunk values change.
 *
 * @since 4.0.0
 * @category Models
 */
export interface TxChunk<in out A> extends Inspectable, Pipeable {
  readonly [TypeId]: TypeId
  readonly ref: TxRef.TxRef<Chunk.Chunk<A>>
}

const TxChunkProto = {
  [NodeInspectSymbol](this: TxChunk<unknown>) {
    return this.toJSON()
  },
  toJSON(this: TxChunk<unknown>) {
    return {
      _id: "TxChunk",
      ref: toJSON((this as any).ref)
    }
  },
  toString(this: TxChunk<unknown>) {
    return format(this.toJSON())
  },
  pipe(this: TxChunk<unknown>) {
    return pipeArguments(this, arguments)
  }
}

/**
 * Creates a new `TxChunk` with the specified initial chunk.
 *
 * @since 4.0.0
 * @category Constructors
 * @example
 * ```ts
 * import { Chunk, Effect, TxChunk } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create a TxChunk with initial values
 *   const initialChunk = Chunk.fromIterable([1, 2, 3])
 *   const txChunk = yield* TxChunk.make(initialChunk)
 *
 *   // Use within a transaction
 *   const result = yield* Effect.transaction(TxChunk.get(txChunk))
 *   console.log(Chunk.toReadonlyArray(result)) // [1, 2, 3]
 * })
 * ```
 */
export const make = <A>(initial: Chunk.Chunk<A>): Effect.Effect<TxChunk<A>> =>
  Effect.map(TxRef.make(initial), (ref) => unsafeMake(ref))

/**
 * Creates a new empty `TxChunk`.
 *
 * @since 4.0.0
 * @category Constructors
 * @example
 * ```ts
 * import { Effect, TxChunk } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create an empty TxChunk
 *   const txChunk = yield* TxChunk.empty<number>()
 *
 *   // Check if it's empty
 *   const isEmpty = yield* Effect.transaction(TxChunk.isEmpty(txChunk))
 *   console.log(isEmpty) // true
 *
 *   // Add elements
 *   yield* Effect.transaction(TxChunk.append(txChunk, 42))
 *
 *   const isStillEmpty = yield* Effect.transaction(TxChunk.isEmpty(txChunk))
 *   console.log(isStillEmpty) // false
 * })
 * ```
 */
export const empty = <A = never>(): Effect.Effect<TxChunk<A>> =>
  Effect.map(TxRef.make(Chunk.empty<A>()), (ref) => unsafeMake(ref))

/**
 * Creates a new `TxChunk` from an iterable.
 *
 * @since 4.0.0
 * @category Constructors
 * @example
 * ```ts
 * import { Chunk, Effect, TxChunk } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // Create TxChunk from array
 *   const txChunk = yield* TxChunk.fromIterable([1, 2, 3, 4, 5])
 *
 *   // Read the contents
 *   const chunk = yield* Effect.transaction(TxChunk.get(txChunk))
 *   console.log(Chunk.toReadonlyArray(chunk)) // [1, 2, 3, 4, 5]
 *
 *   // Modify within transaction
 *   yield* Effect.transaction(
 *     Effect.gen(function* () {
 *       yield* TxChunk.append(txChunk, 6)
 *       yield* TxChunk.prepend(txChunk, 0)
 *     })
 *   )
 *
 *   const updated = yield* Effect.transaction(TxChunk.get(txChunk))
 *   console.log(Chunk.toReadonlyArray(updated)) // [0, 1, 2, 3, 4, 5, 6]
 * })
 * ```
 */
export const fromIterable = <A>(iterable: Iterable<A>): Effect.Effect<TxChunk<A>> =>
  Effect.map(TxRef.make(Chunk.fromIterable(iterable)), (ref) => unsafeMake(ref))

/**
 * Creates a new `TxChunk` with the specified TxRef.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const unsafeMake = <A>(ref: TxRef.TxRef<Chunk.Chunk<A>>): TxChunk<A> => {
  const txChunk = Object.create(TxChunkProto)
  txChunk[TypeId] = TypeId
  txChunk.ref = ref
  return txChunk
}

/**
 * Modifies the value of the `TxChunk` using the provided function.
 *
 * @since 4.0.0
 * @category Combinators
 * @example
 * ```ts
 * import { Chunk, Effect, TxChunk } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const txChunk = yield* TxChunk.fromIterable([1, 2, 3])
 *
 *   // Modify and return both old size and new chunk
 *   const oldSize = yield* Effect.transaction(
 *     TxChunk.modify(txChunk, (chunk) => [
 *       Chunk.size(chunk),                    // return value (old size)
 *       Chunk.append(chunk, 4)                // new value
 *     ])
 *   )
 *
 *   console.log(oldSize) // 3
 *
 *   const newChunk = yield* Effect.transaction(TxChunk.get(txChunk))
 *   console.log(Chunk.toReadonlyArray(newChunk)) // [1, 2, 3, 4]
 * })
 * ```
 */
export const modify: {
  <A, R>(f: (current: Chunk.Chunk<NoInfer<A>>) => [returnValue: R, newValue: Chunk.Chunk<A>]): (
    self: TxChunk<A>
  ) => Effect.Effect<R>
  <A, R>(
    self: TxChunk<A>,
    f: (current: Chunk.Chunk<A>) => [returnValue: R, newValue: Chunk.Chunk<A>]
  ): Effect.Effect<R>
} = dual(
  2,
  <A, R>(
    self: TxChunk<A>,
    f: (current: Chunk.Chunk<A>) => [returnValue: R, newValue: Chunk.Chunk<A>]
  ): Effect.Effect<R> => TxRef.modify(self.ref, f)
)

/**
 * Updates the value of the `TxChunk` using the provided function.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const update: {
  <A>(f: (current: Chunk.Chunk<NoInfer<A>>) => Chunk.Chunk<A>): (self: TxChunk<A>) => Effect.Effect<void>
  <A>(self: TxChunk<A>, f: (current: Chunk.Chunk<A>) => Chunk.Chunk<A>): Effect.Effect<void>
} = dual(
  2,
  <A>(self: TxChunk<A>, f: (current: Chunk.Chunk<A>) => Chunk.Chunk<A>): Effect.Effect<void> =>
    TxRef.update(self.ref, f)
)

/**
 * Reads the current chunk from the `TxChunk`.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const get = <A>(self: TxChunk<A>): Effect.Effect<Chunk.Chunk<A>> => TxRef.get(self.ref)

/**
 * Sets the value of the `TxChunk`.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const set: {
  <A>(chunk: Chunk.Chunk<A>): (self: TxChunk<A>) => Effect.Effect<void>
  <A>(self: TxChunk<A>, chunk: Chunk.Chunk<A>): Effect.Effect<void>
} = dual(2, <A>(self: TxChunk<A>, chunk: Chunk.Chunk<A>): Effect.Effect<void> => TxRef.set(self.ref, chunk))

/**
 * Appends an element to the end of the `TxChunk`.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const append: {
  <A>(element: A): (self: TxChunk<A>) => Effect.Effect<void>
  <A>(self: TxChunk<A>, element: A): Effect.Effect<void>
} = dual(
  2,
  <A>(self: TxChunk<A>, element: A): Effect.Effect<void> => update(self, (current) => Chunk.append(current, element))
)

/**
 * Prepends an element to the beginning of the `TxChunk`.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const prepend: {
  <A>(element: A): (self: TxChunk<A>) => Effect.Effect<void>
  <A>(self: TxChunk<A>, element: A): Effect.Effect<void>
} = dual(
  2,
  <A>(self: TxChunk<A>, element: A): Effect.Effect<void> => update(self, (current) => Chunk.prepend(current, element))
)

/**
 * Gets the size of the `TxChunk`.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const size = <A>(self: TxChunk<A>): Effect.Effect<number> =>
  modify(self, (current) => [Chunk.size(current), current])

/**
 * Checks if the `TxChunk` is empty.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const isEmpty = <A>(self: TxChunk<A>): Effect.Effect<boolean> =>
  modify(self, (current) => [Chunk.isEmpty(current), current])

/**
 * Checks if the `TxChunk` is non-empty.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const isNonEmpty = <A>(self: TxChunk<A>): Effect.Effect<boolean> =>
  modify(self, (current) => [Chunk.isNonEmpty(current), current])

/**
 * Takes the first `n` elements from the `TxChunk`.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const take: {
  (n: number): <A>(self: TxChunk<A>) => Effect.Effect<void>
  <A>(self: TxChunk<A>, n: number): Effect.Effect<void>
} = dual(2, <A>(self: TxChunk<A>, n: number): Effect.Effect<void> => update(self, (current) => Chunk.take(current, n)))

/**
 * Drops the first `n` elements from the `TxChunk`.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const drop: {
  (n: number): <A>(self: TxChunk<A>) => Effect.Effect<void>
  <A>(self: TxChunk<A>, n: number): Effect.Effect<void>
} = dual(2, <A>(self: TxChunk<A>, n: number): Effect.Effect<void> => update(self, (current) => Chunk.drop(current, n)))

/**
 * Takes a slice of the `TxChunk` from `start` to `end` (exclusive).
 *
 * @since 4.0.0
 * @category Combinators
 */
export const slice: {
  (start: number, end: number): <A>(self: TxChunk<A>) => Effect.Effect<void>
  <A>(self: TxChunk<A>, start: number, end: number): Effect.Effect<void>
} = dual(
  3,
  <A>(self: TxChunk<A>, start: number, end: number): Effect.Effect<void> =>
    update(self, (current) => Chunk.take(Chunk.drop(current, start), end - start))
)

/**
 * Maps each element of the `TxChunk` using the provided function.
 * Note: This only works when the mapped type B is assignable to A.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const map: {
  <A>(f: (a: NoInfer<A>) => A): (self: TxChunk<A>) => Effect.Effect<void>
  <A>(self: TxChunk<A>, f: (a: A) => A): Effect.Effect<void>
} = dual(
  2,
  <A>(self: TxChunk<A>, f: (a: A) => A): Effect.Effect<void> => update(self, (current) => Chunk.map(current, f))
)

/**
 * Filters the `TxChunk` keeping only elements that satisfy the predicate.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const filter: {
  <A, B extends A>(refinement: (a: A) => a is B): (self: TxChunk<A>) => Effect.Effect<void>
  <A>(predicate: (a: A) => boolean): (self: TxChunk<A>) => Effect.Effect<void>
  <A, B extends A>(self: TxChunk<A>, refinement: (a: A) => a is B): Effect.Effect<void>
  <A>(self: TxChunk<A>, predicate: (a: A) => boolean): Effect.Effect<void>
} = dual(
  2,
  <A>(self: TxChunk<A>, predicate: (a: A) => boolean): Effect.Effect<void> =>
    update(self, (current) => Chunk.filter(current, predicate))
)

/**
 * Concatenates another chunk to the end of the `TxChunk`.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const appendAll: {
  <A>(other: Chunk.Chunk<A>): (self: TxChunk<A>) => Effect.Effect<void>
  <A>(self: TxChunk<A>, other: Chunk.Chunk<A>): Effect.Effect<void>
} = dual(
  2,
  <A>(self: TxChunk<A>, other: Chunk.Chunk<A>): Effect.Effect<void> =>
    update(self, (current) => Chunk.appendAll(current, other))
)

/**
 * Concatenates another chunk to the beginning of the `TxChunk`.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const prependAll: {
  <A>(other: Chunk.Chunk<A>): (self: TxChunk<A>) => Effect.Effect<void>
  <A>(self: TxChunk<A>, other: Chunk.Chunk<A>): Effect.Effect<void>
} = dual(
  2,
  <A>(self: TxChunk<A>, other: Chunk.Chunk<A>): Effect.Effect<void> =>
    update(self, (current) => Chunk.prependAll(current, other))
)

/**
 * Concatenates another `TxChunk` to the end of this `TxChunk`.
 *
 * @since 4.0.0
 * @category Combinators
 * @example
 * ```ts
 * import { Chunk, Effect, TxChunk } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const txChunk1 = yield* TxChunk.fromIterable([1, 2, 3])
 *   const txChunk2 = yield* TxChunk.fromIterable([4, 5, 6])
 *
 *   // Concatenate atomically within a transaction
 *   yield* Effect.transaction(TxChunk.concat(txChunk1, txChunk2))
 *
 *   const result = yield* Effect.transaction(TxChunk.get(txChunk1))
 *   console.log(Chunk.toReadonlyArray(result)) // [1, 2, 3, 4, 5, 6]
 *
 *   // Original txChunk2 is unchanged
 *   const original = yield* Effect.transaction(TxChunk.get(txChunk2))
 *   console.log(Chunk.toReadonlyArray(original)) // [4, 5, 6]
 * })
 * ```
 */
export const concat: {
  <A>(other: TxChunk<A>): (self: TxChunk<A>) => Effect.Effect<void>
  <A>(self: TxChunk<A>, other: TxChunk<A>): Effect.Effect<void>
} = dual(2, <A>(self: TxChunk<A>, other: TxChunk<A>): Effect.Effect<void> =>
  Effect.gen(function*() {
    const otherChunk = yield* get(other)
    yield* appendAll(self, otherChunk)
  }))
