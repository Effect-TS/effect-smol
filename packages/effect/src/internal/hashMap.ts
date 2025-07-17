/**
 * @since 2.0.0
 */

import * as Option from "../data/Option.ts"
import { hasProperty } from "../data/Predicate.ts"
import { dual, pipe } from "../Function.ts"
import * as Equal_ from "../interfaces/Equal.ts"
import * as Hash from "../interfaces/Hash.ts"
import type { Inspectable } from "../interfaces/Inspectable.ts"
import { format, NodeInspectSymbol, toJSON } from "../interfaces/Inspectable.ts"
import type { Pipeable } from "../interfaces/Pipeable.ts"
import { pipeArguments } from "../interfaces/Pipeable.ts"
import type { NoInfer } from "../types/Types.ts"

/** @internal */
export const HashMapTypeId: "~effect/HashMap" = "~effect/HashMap" as const

/** @internal */
export type HashMapTypeId = typeof HashMapTypeId

/** @internal */
export interface HashMap<out Key, out Value> extends Iterable<[Key, Value]>, Equal_.Equal, Pipeable, Inspectable {
  readonly [HashMapTypeId]: HashMapTypeId
}

/** @internal */
export declare namespace HashMap {
  export type UpdateFn<V> = (option: Option.Option<V>) => Option.Option<V>
}

// HAMT Implementation

/** @internal */
const SHIFT = 5
/** @internal */
const BUCKET_SIZE = 1 << SHIFT // 32
/** @internal */
// const BITMAP_SIZE = 1 << SHIFT // 32
/** @internal */
const MIN_ARRAY_NODE = BUCKET_SIZE / 4 // 8
/** @internal */
const MAX_INDEX_NODE = BUCKET_SIZE / 2 // 16
/** @internal */
const BITMAP_INDEX_MASK = BUCKET_SIZE - 1 // 31

/** @internal */
const popcount = (n: number): number => {
  n = n - ((n >>> 1) & 0x55555555)
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333)
  return (((n + (n >>> 4)) & 0xF0F0F0F) * 0x1010101) >>> 24
}

/** @internal */
const mask = (hash: number, shift: number): number => (hash >>> shift) & BITMAP_INDEX_MASK

/** @internal */
const bitpos = (hash: number, shift: number): number => 1 << mask(hash, shift)

/** @internal */
const index = (bitmap: number, bit: number): number => popcount(bitmap & (bit - 1))

/** @internal */
abstract class Node<K, V> {
  abstract get size(): number
  abstract get(shift: number, hash: number, key: K): Option.Option<V>
  abstract has(shift: number, hash: number, key: K): boolean
  abstract set(shift: number, hash: number, key: K, value: V, added: { value: boolean }): Node<K, V>
  abstract remove(shift: number, hash: number, key: K, removed: { value: boolean }): Node<K, V> | undefined
  abstract iterator(): Iterator<[K, V]>
  abstract [Symbol.iterator](): Iterator<[K, V]>
}

/** @internal */
class EmptyNode<K, V> extends Node<K, V> {
  get size(): number {
    return 0
  }

  get(_shift: number, _hash: number, _key: K): Option.Option<V> {
    return Option.none()
  }

  has(_shift: number, _hash: number, _key: K): boolean {
    return false
  }

  set(_shift: number, hash: number, key: K, value: V, added: { value: boolean }): Node<K, V> {
    added.value = true
    return new LeafNode(hash, key, value)
  }

  remove(_shift: number, _hash: number, _key: K, _removed: { value: boolean }): Node<K, V> | undefined {
    return this
  }

  iterator(): Iterator<[K, V]> {
    return ([] as Array<[K, V]>)[Symbol.iterator]()
  }

  [Symbol.iterator](): Iterator<[K, V]> {
    return this.iterator()
  }
}

/** @internal */
class LeafNode<K, V> extends Node<K, V> {
  readonly hash: number
  readonly key: K
  readonly value: V
  constructor(
    hash: number,
    key: K,
    value: V
  ) {
    super()
    this.hash = hash
    this.key = key
    this.value = value
  }

  get size(): number {
    return 1
  }

  get(shift: number, hash: number, key: K): Option.Option<V> {
    if (this.hash === hash && Equal_.equals(this.key, key)) {
      return Option.some(this.value)
    }
    return Option.none()
  }

  has(shift: number, hash: number, key: K): boolean {
    return this.hash === hash && Equal_.equals(this.key, key)
  }

  set(shift: number, hash: number, key: K, value: V, added: { value: boolean }): Node<K, V> {
    if (this.hash === hash && Equal_.equals(this.key, key)) {
      if (Equal_.equals(this.value, value)) {
        return this
      }
      return new LeafNode(hash, key, value)
    }

    added.value = true

    if (this.hash === hash) {
      return new CollisionNode(hash, [this.key, this.value], [key, value])
    }

    const newBit = bitpos(hash, shift)
    const existingBit = bitpos(this.hash, shift)

    if (newBit === existingBit) {
      return new IndexedNode(
        newBit,
        [this.set(shift + SHIFT, hash, key, value, added)]
      )
    }

    const bitmap = newBit | existingBit
    const nodes: Array<Node<K, V>> = newBit < existingBit ?
      [new LeafNode(hash, key, value), this] :
      [this, new LeafNode(hash, key, value)]

    return new IndexedNode(bitmap, nodes)
  }

  remove(shift: number, hash: number, key: K, removed: { value: boolean }): Node<K, V> | undefined {
    if (this.hash === hash && Equal_.equals(this.key, key)) {
      removed.value = true
      return undefined
    }
    return this
  }

  iterator(): Iterator<[K, V]> {
    return [[this.key, this.value] as [K, V]][Symbol.iterator]()
  }

  [Symbol.iterator](): Iterator<[K, V]> {
    return this.iterator()
  }
}

/** @internal */
class CollisionNode<K, V> extends Node<K, V> {
  readonly entries: Array<[K, V]>
  readonly hash: number

  constructor(
    hash: number,
    ...entries: Array<[K, V]>
  ) {
    super()
    this.hash = hash
    this.entries = entries
  }

  get size(): number {
    return this.entries.length
  }

  get(shift: number, hash: number, key: K): Option.Option<V> {
    if (this.hash !== hash) {
      return Option.none()
    }

    for (const [k, v] of this.entries) {
      if (Equal_.equals(k, key)) {
        return Option.some(v)
      }
    }
    return Option.none()
  }

  has(shift: number, hash: number, key: K): boolean {
    if (this.hash !== hash) {
      return false
    }

    for (const [k] of this.entries) {
      if (Equal_.equals(k, key)) {
        return true
      }
    }
    return false
  }

  set(shift: number, hash: number, key: K, value: V, added: { value: boolean }): Node<K, V> {
    if (this.hash !== hash) {
      added.value = true
      const bit = bitpos(hash, shift)
      return new IndexedNode(bit, [new LeafNode(hash, key, value)])
    }

    const entries = [...this.entries]
    for (let i = 0; i < entries.length; i++) {
      if (Equal_.equals(entries[i][0], key)) {
        if (Equal_.equals(entries[i][1], value)) {
          return this
        }
        entries[i] = [key, value]
        return new CollisionNode(this.hash, ...entries)
      }
    }

    added.value = true
    return new CollisionNode(this.hash, ...entries, [key, value])
  }

  remove(shift: number, hash: number, key: K, removed: { value: boolean }): Node<K, V> | undefined {
    if (this.hash !== hash) {
      return this
    }

    const entries = this.entries.filter(([k]) => {
      if (Equal_.equals(k, key)) {
        removed.value = true
        return false
      }
      return true
    })

    if (entries.length === this.entries.length) {
      return this
    }

    if (entries.length === 1) {
      const [k, v] = entries[0]
      return new LeafNode(this.hash, k, v)
    }

    return new CollisionNode(this.hash, ...entries)
  }

  iterator(): Iterator<[K, V]> {
    return this.entries[Symbol.iterator]()
  }

  [Symbol.iterator](): Iterator<[K, V]> {
    return this.iterator()
  }
}

/** @internal */
class IndexedNode<K, V> extends Node<K, V> {
  private _size: number | undefined
  readonly bitmap: number
  readonly children: ReadonlyArray<Node<K, V>>

  constructor(
    bitmap: number,
    children: ReadonlyArray<Node<K, V>>
  ) {
    super()
    this.bitmap = bitmap
    this.children = children
  }

  get size(): number {
    if (this._size === undefined) {
      this._size = this.children.reduce((acc, child) => acc + child.size, 0)
    }
    return this._size
  }

  get(shift: number, hash: number, key: K): Option.Option<V> {
    const bit = bitpos(hash, shift)
    if ((this.bitmap & bit) === 0) {
      return Option.none()
    }
    const idx = index(this.bitmap, bit)
    return this.children[idx].get(shift + SHIFT, hash, key)
  }

  has(shift: number, hash: number, key: K): boolean {
    const bit = bitpos(hash, shift)
    if ((this.bitmap & bit) === 0) {
      return false
    }
    const idx = index(this.bitmap, bit)
    return this.children[idx].has(shift + SHIFT, hash, key)
  }

  set(shift: number, hash: number, key: K, value: V, added: { value: boolean }): Node<K, V> {
    const bit = bitpos(hash, shift)
    const idx = index(this.bitmap, bit)

    if ((this.bitmap & bit) !== 0) {
      const child = this.children[idx]
      const newChild = child.set(shift + SHIFT, hash, key, value, added)
      if (child === newChild) {
        return this
      }
      const newChildren = [...this.children]
      newChildren[idx] = newChild
      return new IndexedNode(this.bitmap, newChildren)
    } else {
      added.value = true
      const newChild = new LeafNode(hash, key, value)
      const newChildren = [...this.children]
      newChildren.splice(idx, 0, newChild)
      const newBitmap = this.bitmap | bit

      if (newChildren.length > MAX_INDEX_NODE) {
        return this.expand(newBitmap, newChildren, shift)
      }

      return new IndexedNode(newBitmap, newChildren)
    }
  }

  remove(shift: number, hash: number, key: K, removed: { value: boolean }): Node<K, V> | undefined {
    const bit = bitpos(hash, shift)
    if ((this.bitmap & bit) === 0) {
      return this
    }

    const idx = index(this.bitmap, bit)
    const child = this.children[idx]
    const newChild = child.remove(shift + SHIFT, hash, key, removed)

    if (!removed.value) {
      return this
    }

    if (newChild === undefined) {
      const newBitmap = this.bitmap ^ bit
      if (newBitmap === 0) {
        return undefined
      }

      if (this.children.length === 2) {
        const remaining = this.children[idx === 0 ? 1 : 0]
        if (remaining instanceof LeafNode) {
          return remaining
        }
      }

      const newChildren = [...this.children]
      newChildren.splice(idx, 1)
      return new IndexedNode(newBitmap, newChildren)
    }

    if (child === newChild) {
      return this
    }

    const newChildren = [...this.children]
    newChildren[idx] = newChild
    return new IndexedNode(this.bitmap, newChildren)
  }

  private expand(bitmap: number, children: ReadonlyArray<Node<K, V>>, _shift: number): ArrayNode<K, V> {
    const nodes: Array<Node<K, V> | undefined> = new globalThis.Array(BUCKET_SIZE)
    let j = 0
    for (let i = 0; i < BUCKET_SIZE; i++) {
      if ((bitmap & (1 << i)) !== 0) {
        nodes[i] = children[j++]
      }
    }
    return new ArrayNode(children.length, nodes)
  }

  iterator(): Iterator<[K, V]> {
    let childIndex = 0
    let currentIterator: Iterator<[K, V]> | undefined

    return {
      next: () => {
        while (childIndex < this.children.length) {
          if (!currentIterator) {
            currentIterator = this.children[childIndex].iterator()
          }

          const result = currentIterator.next()
          if (!result.done) {
            return result
          }

          currentIterator = undefined
          childIndex++
        }

        return { done: true, value: undefined }
      }
    }
  }

  [Symbol.iterator](): Iterator<[K, V]> {
    return this.iterator()
  }
}

/** @internal */
class ArrayNode<K, V> extends Node<K, V> {
  private _size: number | undefined
  readonly count: number
  readonly children: ReadonlyArray<Node<K, V> | undefined>

  constructor(
    count: number,
    children: ReadonlyArray<Node<K, V> | undefined>
  ) {
    super()
    this.count = count
    this.children = children
  }

  get size(): number {
    if (this._size === undefined) {
      this._size = this.children.reduce<number>((acc, child) => acc + (child?.size ?? 0), 0)
    }
    return this._size
  }

  get(shift: number, hash: number, key: K): Option.Option<V> {
    const idx = mask(hash, shift)
    const child = this.children[idx]
    return child ? child.get(shift + SHIFT, hash, key) : Option.none()
  }

  has(shift: number, hash: number, key: K): boolean {
    const idx = mask(hash, shift)
    const child = this.children[idx]
    return child ? child.has(shift + SHIFT, hash, key) : false
  }

  set(shift: number, hash: number, key: K, value: V, added: { value: boolean }): Node<K, V> {
    const idx = mask(hash, shift)
    const child = this.children[idx]

    if (child) {
      const newChild = child.set(shift + SHIFT, hash, key, value, added)
      if (child === newChild) {
        return this
      }
      const newChildren = [...this.children]
      newChildren[idx] = newChild
      return new ArrayNode(this.count, newChildren)
    } else {
      added.value = true
      const newChild = new LeafNode(hash, key, value)
      const newChildren = [...this.children]
      newChildren[idx] = newChild
      return new ArrayNode(this.count + 1, newChildren)
    }
  }

  remove(shift: number, hash: number, key: K, removed: { value: boolean }): Node<K, V> | undefined {
    const idx = mask(hash, shift)
    const child = this.children[idx]

    if (!child) {
      return this
    }

    const newChild = child.remove(shift + SHIFT, hash, key, removed)

    if (!removed.value) {
      return this
    }

    const newCount = this.count - (newChild ? 0 : 1)

    if (newCount < MIN_ARRAY_NODE) {
      return this.pack(newCount, idx, newChild)
    }

    if (child === newChild) {
      return this
    }

    const newChildren = [...this.children]
    newChildren[idx] = newChild
    return new ArrayNode(newCount, newChildren)
  }

  private pack(newCount: number, excludeIdx: number, newChild: Node<K, V> | undefined): IndexedNode<K, V> {
    const children: Array<Node<K, V>> = []
    let bitmap = 0
    let bit = 1

    for (let i = 0; i < this.children.length; i++) {
      const child = i === excludeIdx ? newChild : this.children[i]
      if (child) {
        children.push(child)
        bitmap |= bit
      }
      bit <<= 1
    }

    return new IndexedNode(bitmap, children)
  }

  iterator(): Iterator<[K, V]> {
    let childIndex = 0
    let currentIterator: Iterator<[K, V]> | undefined

    return {
      next: () => {
        while (childIndex < this.children.length) {
          const child = this.children[childIndex]
          if (!child) {
            childIndex++
            continue
          }

          if (!currentIterator) {
            currentIterator = child.iterator()
          }

          const result = currentIterator.next()
          if (!result.done) {
            return result
          }

          currentIterator = undefined
          childIndex++
        }

        return { done: true, value: undefined }
      }
    }
  }

  [Symbol.iterator](): Iterator<[K, V]> {
    return this.iterator()
  }
}

/** @internal */
class HashMapImpl<K, V> implements HashMap<K, V> {
  readonly [HashMapTypeId]: HashMapTypeId = HashMapTypeId
  readonly root: Node<K, V>
  private readonly _size: number

  constructor(
    root: Node<K, V>,
    _size: number
  ) {
    this.root = root
    this._size = _size
  }

  get size(): number {
    return this._size
  }

  [Symbol.iterator](): Iterator<[K, V]> {
    return this.root.iterator()
  }

  [Equal_.symbol](that: Equal_.Equal): boolean {
    if (isHashMap(that)) {
      const thatImpl = that as HashMapImpl<K, V>
      if (this.size !== thatImpl.size) {
        return false
      }
      for (const [key, value] of this) {
        const otherValue = pipe(that, get(key))
        if (Option.isNone(otherValue) || !Equal_.equals(value, otherValue.value)) {
          return false
        }
      }
      return true
    }
    return false
  }

  [Hash.symbol](): number {
    let hash = Hash.string("HashMap")
    for (const [key, value] of this) {
      hash = hash ^ (Hash.hash(key) + Hash.hash(value))
    }
    return hash
  }

  [NodeInspectSymbol](): unknown {
    return toJSON(this)
  }

  toJSON(): unknown {
    return {
      _id: "HashMap",
      values: Array.from(this).map(([k, v]) => [toJSON(k), toJSON(v)])
    }
  }

  toString(): string {
    return format(this)
  }

  pipe() {
    return pipeArguments(this, arguments)
  }
}

/** @internal */
const emptyNode = new EmptyNode<any, any>()

/** @internal */
export const isHashMap: {
  <K, V>(u: Iterable<readonly [K, V]>): u is HashMap<K, V>
  (u: unknown): u is HashMap<unknown, unknown>
} = (u: unknown): u is HashMap<unknown, unknown> => hasProperty(u, HashMapTypeId)

/** @internal */
export const empty = <K = never, V = never>(): HashMap<K, V> => new HashMapImpl(emptyNode, 0)

/** @internal */
export const make = <Entries extends ReadonlyArray<readonly [any, any]>>(
  ...entries: Entries
): HashMap<
  Entries[number] extends readonly [infer K, any] ? K : never,
  Entries[number] extends readonly [any, infer V] ? V : never
> => fromIterable(entries)

/** @internal */
export const fromIterable = <K, V>(entries: Iterable<readonly [K, V]>): HashMap<K, V> => {
  let root: Node<K, V> = emptyNode
  let size = 0
  const added = { value: false }

  for (const [key, value] of entries) {
    const hash = Hash.hash(key)
    added.value = false
    root = root.set(0, hash, key, value, added)
    if (added.value) {
      size++
    }
  }

  return new HashMapImpl(root, size)
}

/** @internal */
export const isEmpty = <K, V>(self: HashMap<K, V>): boolean => (self as HashMapImpl<K, V>).size === 0

/** @internal */
export const get = dual<
  <K1 extends K, K>(key: K1) => <V>(self: HashMap<K, V>) => Option.Option<V>,
  <K1 extends K, K, V>(self: HashMap<K, V>, key: K1) => Option.Option<V>
>(2, <K, V>(self: HashMap<K, V>, key: K): Option.Option<V> => {
  const impl = self as HashMapImpl<K, V>
  return impl.root.get(0, Hash.hash(key), key)
})

/** @internal */
export const getHash = dual<
  <K1 extends K, K>(key: K1, hash: number) => <V>(self: HashMap<K, V>) => Option.Option<V>,
  <K1 extends K, K, V>(self: HashMap<K, V>, key: K1, hash: number) => Option.Option<V>
>(3, <K, V>(self: HashMap<K, V>, key: K, hash: number): Option.Option<V> => {
  const impl = self as HashMapImpl<K, V>
  return impl.root.get(0, hash, key)
})

/** @internal */
export const unsafeGet = dual<
  <K1 extends K, K>(key: K1) => <V>(self: HashMap<K, V>) => V,
  <K1 extends K, K, V>(self: HashMap<K, V>, key: K1) => V
>(2, <K, V>(self: HashMap<K, V>, key: K): V => {
  const result = get(self, key)
  if (Option.isSome(result)) {
    return result.value
  }
  throw new Error("HashMap.unsafeGet: key not found")
})

/** @internal */
export const has = dual<
  <K1 extends K, K>(key: K1) => <V>(self: HashMap<K, V>) => boolean,
  <K1 extends K, K, V>(self: HashMap<K, V>, key: K1) => boolean
>(2, <K, V>(self: HashMap<K, V>, key: K): boolean => {
  const impl = self as HashMapImpl<K, V>
  return impl.root.has(0, Hash.hash(key), key)
})

/** @internal */
export const hasHash = dual<
  <K1 extends K, K>(key: K1, hash: number) => <V>(self: HashMap<K, V>) => boolean,
  <K1 extends K, K, V>(self: HashMap<K, V>, key: K1, hash: number) => boolean
>(3, <K, V>(self: HashMap<K, V>, key: K, hash: number): boolean => {
  const impl = self as HashMapImpl<K, V>
  return impl.root.has(0, hash, key)
})

/** @internal */
export const hasBy = dual<
  <K, V>(predicate: (value: NoInfer<V>, key: NoInfer<K>) => boolean) => (self: HashMap<K, V>) => boolean,
  <K, V>(self: HashMap<K, V>, predicate: (value: NoInfer<V>, key: NoInfer<K>) => boolean) => boolean
>(2, <K, V>(self: HashMap<K, V>, predicate: (value: V, key: K) => boolean): boolean => {
  for (const [key, value] of self) {
    if (predicate(value, key)) {
      return true
    }
  }
  return false
})

/** @internal */
export const set = dual<
  <K, V>(key: K, value: V) => (self: HashMap<K, V>) => HashMap<K, V>,
  <K, V>(self: HashMap<K, V>, key: K, value: V) => HashMap<K, V>
>(3, <K, V>(self: HashMap<K, V>, key: K, value: V): HashMap<K, V> => {
  const impl = self as HashMapImpl<K, V>
  const hash = Hash.hash(key)
  const added = { value: false }
  const newRoot = impl.root.set(0, hash, key, value, added)

  if (impl.root === newRoot) {
    return self
  }

  const newSize = impl.size + (added.value ? 1 : 0)
  return new HashMapImpl(newRoot, newSize)
})

/** @internal */
export const keys = <K, V>(self: HashMap<K, V>): IterableIterator<K> => {
  const iterator = self[Symbol.iterator]()
  return {
    [Symbol.iterator]() {
      return this
    },
    next() {
      const result = iterator.next()
      if (result.done) {
        return { done: true, value: undefined }
      }
      return { done: false, value: result.value[0] }
    }
  }
}

/** @internal */
export const values = <K, V>(self: HashMap<K, V>): IterableIterator<V> => {
  const iterator = self[Symbol.iterator]()
  return {
    [Symbol.iterator]() {
      return this
    },
    next() {
      const result = iterator.next()
      if (result.done) {
        return { done: true, value: undefined }
      }
      return { done: false, value: result.value[1] }
    }
  }
}

/** @internal */
export const entries = <K, V>(self: HashMap<K, V>): IterableIterator<[K, V]> => {
  const iterator = self[Symbol.iterator]()
  return {
    [Symbol.iterator]() {
      return this
    },
    next() {
      return iterator.next()
    }
  }
}

/** @internal */
export const size = <K, V>(self: HashMap<K, V>): number => (self as HashMapImpl<K, V>).size

/** @internal */
export const beginMutation = <K, V>(self: HashMap<K, V>): HashMap<K, V> => self

/** @internal */
export const endMutation = <K, V>(self: HashMap<K, V>): HashMap<K, V> => self

/** @internal */
export const mutate = dual<
  <K, V>(f: (self: HashMap<K, V>) => void) => (self: HashMap<K, V>) => HashMap<K, V>,
  <K, V>(self: HashMap<K, V>, f: (self: HashMap<K, V>) => void) => HashMap<K, V>
>(2, <K, V>(self: HashMap<K, V>, f: (self: HashMap<K, V>) => void): HashMap<K, V> => {
  const mutable = beginMutation(self)
  f(mutable)
  return endMutation(mutable)
})

/** @internal */
export const modifyAt = dual<
  <K, V>(key: K, f: HashMap.UpdateFn<V>) => (self: HashMap<K, V>) => HashMap<K, V>,
  <K, V>(self: HashMap<K, V>, key: K, f: HashMap.UpdateFn<V>) => HashMap<K, V>
>(3, <K, V>(self: HashMap<K, V>, key: K, f: HashMap.UpdateFn<V>): HashMap<K, V> => {
  const current = get(self, key)
  const updated = f(current)

  if (Option.isNone(updated)) {
    return has(self, key) ? remove(self, key) : self
  }

  return set(self, key, updated.value)
})

/** @internal */
export const modifyHash = dual<
  <K, V>(key: K, hash: number, f: HashMap.UpdateFn<V>) => (self: HashMap<K, V>) => HashMap<K, V>,
  <K, V>(self: HashMap<K, V>, key: K, hash: number, f: HashMap.UpdateFn<V>) => HashMap<K, V>
>(4, <K, V>(self: HashMap<K, V>, key: K, hash: number, f: HashMap.UpdateFn<V>): HashMap<K, V> => {
  const current = getHash(self, key, hash)
  const updated = f(current)

  if (Option.isNone(updated)) {
    return hasHash(self, key, hash) ? remove(self, key) : self
  }

  return set(self, key, updated.value)
})

/** @internal */
export const modify = dual<
  <K, V>(key: K, f: (v: V) => V) => (self: HashMap<K, V>) => HashMap<K, V>,
  <K, V>(self: HashMap<K, V>, key: K, f: (v: V) => V) => HashMap<K, V>
>(3, <K, V>(self: HashMap<K, V>, key: K, f: (v: V) => V): HashMap<K, V> => {
  return modifyAt(self, key, Option.map(f))
})

/** @internal */
export const union = dual<
  <K1, V1>(that: HashMap<K1, V1>) => <K0, V0>(self: HashMap<K0, V0>) => HashMap<K1 | K0, V1 | V0>,
  <K0, V0, K1, V1>(self: HashMap<K0, V0>, that: HashMap<K1, V1>) => HashMap<K0 | K1, V0 | V1>
>(2, <K0, V0, K1, V1>(self: HashMap<K0, V0>, that: HashMap<K1, V1>): HashMap<K0 | K1, V0 | V1> => {
  let result = self as HashMap<K0 | K1, V0 | V1>
  for (const [key, value] of that) {
    result = set(result, key, value)
  }
  return result
})

/** @internal */
export const remove = dual<
  <K>(key: K) => <V>(self: HashMap<K, V>) => HashMap<K, V>,
  <K, V>(self: HashMap<K, V>, key: K) => HashMap<K, V>
>(2, <K, V>(self: HashMap<K, V>, key: K): HashMap<K, V> => {
  const impl = self as HashMapImpl<K, V>
  const hash = Hash.hash(key)
  const removed = { value: false }
  const newRoot = impl.root.remove(0, hash, key, removed)

  if (!removed.value) {
    return self
  }

  if (newRoot === undefined) {
    return empty()
  }

  return new HashMapImpl(newRoot, impl.size - 1)
})

/** @internal */
export const removeMany = dual<
  <K>(keys: Iterable<K>) => <V>(self: HashMap<K, V>) => HashMap<K, V>,
  <K, V>(self: HashMap<K, V>, keys: Iterable<K>) => HashMap<K, V>
>(2, <K, V>(self: HashMap<K, V>, keys: Iterable<K>): HashMap<K, V> => {
  let result = self
  for (const key of keys) {
    result = remove(result, key)
  }
  return result
})

/** @internal */
export const setMany = dual<
  <K, V>(entries: Iterable<readonly [K, V]>) => (self: HashMap<K, V>) => HashMap<K, V>,
  <K, V>(self: HashMap<K, V>, entries: Iterable<readonly [K, V]>) => HashMap<K, V>
>(2, <K, V>(self: HashMap<K, V>, entries: Iterable<readonly [K, V]>): HashMap<K, V> => {
  let result = self
  for (const [key, value] of entries) {
    result = set(result, key, value)
  }
  return result
})

/** @internal */
export const map = dual<
  <A, V, K>(f: (value: V, key: K) => A) => (self: HashMap<K, V>) => HashMap<K, A>,
  <K, V, A>(self: HashMap<K, V>, f: (value: V, key: K) => A) => HashMap<K, A>
>(2, <K, V, A>(self: HashMap<K, V>, f: (value: V, key: K) => A): HashMap<K, A> => {
  let result = empty<K, A>()
  for (const [key, value] of self) {
    result = set(result, key, f(value, key))
  }
  return result
})

/** @internal */
export const flatMap = dual<
  <A, K, B>(f: (value: A, key: K) => HashMap<K, B>) => (self: HashMap<K, A>) => HashMap<K, B>,
  <K, A, B>(self: HashMap<K, A>, f: (value: A, key: K) => HashMap<K, B>) => HashMap<K, B>
>(2, <K, A, B>(self: HashMap<K, A>, f: (value: A, key: K) => HashMap<K, B>): HashMap<K, B> => {
  let result = empty<K, B>()
  for (const [key, value] of self) {
    result = union(result, f(value, key))
  }
  return result
})

/** @internal */
export const forEach = dual<
  <V, K>(f: (value: V, key: K) => void) => (self: HashMap<K, V>) => void,
  <V, K>(self: HashMap<K, V>, f: (value: V, key: K) => void) => void
>(2, <V, K>(self: HashMap<K, V>, f: (value: V, key: K) => void): void => {
  for (const [key, value] of self) {
    f(value, key)
  }
})

/** @internal */
export const reduce = dual<
  <Z, V, K>(zero: Z, f: (accumulator: Z, value: V, key: K) => Z) => (self: HashMap<K, V>) => Z,
  <K, V, Z>(self: HashMap<K, V>, zero: Z, f: (accumulator: Z, value: V, key: K) => Z) => Z
>(3, <K, V, Z>(self: HashMap<K, V>, zero: Z, f: (accumulator: Z, value: V, key: K) => Z): Z => {
  let result = zero
  for (const [key, value] of self) {
    result = f(result, value, key)
  }
  return result
})

/** @internal */
export const filter = dual<
  <K, A>(f: (a: NoInfer<A>, k: K) => boolean) => (self: HashMap<K, A>) => HashMap<K, A>,
  <K, A>(self: HashMap<K, A>, f: (a: A, k: K) => boolean) => HashMap<K, A>
>(2, <K, A>(self: HashMap<K, A>, f: (a: A, k: K) => boolean) => {
  let result = empty<K, A>()
  for (const [key, value] of self) {
    if (f(value, key)) {
      result = set(result, key, value)
    }
  }
  return result
})

/** @internal */
export const compact = <K, A>(self: HashMap<K, Option.Option<A>>): HashMap<K, A> => {
  let result = empty<K, A>()
  for (const [key, value] of self) {
    if (Option.isSome(value)) {
      result = set(result, key, value.value)
    }
  }
  return result
}

/** @internal */
export const filterMap = dual<
  <A, K, B>(f: (value: A, key: K) => Option.Option<B>) => (self: HashMap<K, A>) => HashMap<K, B>,
  <K, A, B>(self: HashMap<K, A>, f: (value: A, key: K) => Option.Option<B>) => HashMap<K, B>
>(2, <K, A, B>(self: HashMap<K, A>, f: (value: A, key: K) => Option.Option<B>): HashMap<K, B> => {
  let result = empty<K, B>()
  for (const [key, value] of self) {
    const mapped = f(value, key)
    if (Option.isSome(mapped)) {
      result = set(result, key, mapped.value)
    }
  }
  return result
})

/** @internal */
export const findFirst = dual<
  <K, A>(predicate: (a: NoInfer<A>, k: K) => boolean) => (self: HashMap<K, A>) => Option.Option<[K, A]>,
  <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean) => Option.Option<[K, A]>
>(2, <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean) => {
  for (const [key, value] of self) {
    if (predicate(value, key)) {
      return Option.some([key, value])
    }
  }
  return Option.none()
})

/** @internal */
export const some = dual<
  <K, A>(predicate: (a: NoInfer<A>, k: K) => boolean) => (self: HashMap<K, A>) => boolean,
  <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean) => boolean
>(2, <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean): boolean => {
  for (const [key, value] of self) {
    if (predicate(value, key)) {
      return true
    }
  }
  return false
})

/** @internal */
export const every = dual<
  <K, A>(predicate: (a: NoInfer<A>, k: K) => boolean) => (self: HashMap<K, A>) => boolean,
  <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean) => boolean
>(2, <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean): boolean => {
  for (const [key, value] of self) {
    if (!predicate(value, key)) {
      return false
    }
  }
  return true
})
