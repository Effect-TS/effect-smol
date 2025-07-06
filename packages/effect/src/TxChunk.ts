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
 */
export const make = <A>(initial: Chunk.Chunk<A>): Effect.Effect<TxChunk<A>> =>
  Effect.map(TxRef.make(initial), (ref) => unsafeMake(ref))

/**
 * Creates a new empty `TxChunk`.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const empty = <A = never>(): Effect.Effect<TxChunk<A>> =>
  Effect.map(TxRef.make(Chunk.empty<A>()), (ref) => unsafeMake(ref))

/**
 * Creates a new `TxChunk` from an iterable.
 *
 * @since 4.0.0
 * @category Constructors
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
 */
export const modify: {
  <A, R>(f: (current: NoInfer<Chunk.Chunk<A>>) => [returnValue: R, newValue: Chunk.Chunk<A>]): (
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
  <A>(f: (current: NoInfer<Chunk.Chunk<A>>) => Chunk.Chunk<A>): (self: TxChunk<A>) => Effect.Effect<void>
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
