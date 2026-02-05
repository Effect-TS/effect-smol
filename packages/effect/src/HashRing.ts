/**
 * @since 4.0.0
 */
import { dual } from "./Function.ts"
import { PipeInspectableProto } from "./internal/core.ts"
import * as Iterable from "./Iterable.ts"
import type { Pipeable } from "./Pipeable.ts"
import { hasProperty } from "./Predicate.ts"
import * as PrimaryKey from "./PrimaryKey.ts"

const TypeId = "~effect/cluster/HashRing" as const

/**
 * @since 4.0.0
 * @category Models
 */
export interface HashRing<A extends PrimaryKey.PrimaryKey> extends Pipeable, Iterable<A> {
  readonly [TypeId]: typeof TypeId
  readonly baseWeight: number
  totalWeightCache: number
  readonly nodes: Map<string, [node: A, weight: number]>
  ring: Array<[hash: bigint, node: string]>
}

/**
 * @since 4.0.0
 * @category Guards
 */
export const isHashRing = (u: unknown): u is HashRing<any> => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = <A extends PrimaryKey.PrimaryKey>(options?: {
  readonly baseWeight?: number | undefined
}): HashRing<A> => {
  const self = Object.create(Proto)
  self.baseWeight = Math.max(options?.baseWeight ?? 128, 1)
  self.totalWeightCache = 0
  self.nodes = new Map()
  self.ring = []
  return self
}

const Proto = {
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  [Symbol.iterator]<A extends PrimaryKey.PrimaryKey>(this: HashRing<A>): Iterator<A> {
    return Iterable.map(this.nodes.values(), ([n]) => n)[Symbol.iterator]()
  },
  toJSON(this: HashRing<any>) {
    return {
      _id: "HashRing",
      baseWeight: this.baseWeight,
      nodes: this.ring.map(([, n]) => this.nodes.get(n)![0])
    }
  }
}

/**
 * Add new nodes to the ring. If a node already exists in the ring, it
 * will be updated. For example, you can use this to update the node's weight.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const addMany: {
  <A extends PrimaryKey.PrimaryKey>(nodes: Iterable<A>, options?: {
    readonly weight?: number | undefined
  }): (self: HashRing<A>) => HashRing<A>
  <A extends PrimaryKey.PrimaryKey>(self: HashRing<A>, nodes: Iterable<A>, options?: {
    readonly weight?: number | undefined
  }): HashRing<A>
} = dual(
  (args) => isHashRing(args[0]),
  <A extends PrimaryKey.PrimaryKey>(self: HashRing<A>, nodes: Iterable<A>, options?: {
    readonly weight?: number | undefined
  }): HashRing<A> => {
    const weight = Math.max(options?.weight ?? 1, 0.1)
    const keys: Array<string> = []
    let toRemove: Set<string> | undefined
    for (const node of nodes) {
      const key = PrimaryKey.value(node)
      const entry = self.nodes.get(key)
      if (entry) {
        if (entry[1] === weight) continue
        toRemove ??= new Set()
        toRemove.add(key)
        self.totalWeightCache -= entry[1]
        self.totalWeightCache += weight
        entry[1] = weight
      } else {
        self.nodes.set(key, [node, weight])
        self.totalWeightCache += weight
      }
      keys.push(key)
    }
    if (toRemove) {
      self.ring = self.ring.filter(([, n]) => !toRemove.has(n))
    }
    addNodesToRing(self, keys, Math.round(weight * self.baseWeight))
    return self
  }
)

function addNodesToRing<A extends PrimaryKey.PrimaryKey>(self: HashRing<A>, keys: Array<string>, weight: number) {
  for (let i = weight; i > 0; i--) {
    for (let j = 0; j < keys.length; j++) {
      const key = keys[j]
      self.ring.push([
        hashRingHash(`${key}:${i}`),
        key
      ])
    }
  }
  self.ring.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
}

/**
 * Add a new node to the ring. If the node already exists in the ring, it
 * will be updated. For example, you can use this to update the node's weight.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const add: {
  <A extends PrimaryKey.PrimaryKey>(node: A, options?: {
    readonly weight?: number | undefined
  }): (self: HashRing<A>) => HashRing<A>
  <A extends PrimaryKey.PrimaryKey>(self: HashRing<A>, node: A, options?: {
    readonly weight?: number | undefined
  }): HashRing<A>
} = dual((args) => isHashRing(args[0]), <A extends PrimaryKey.PrimaryKey>(self: HashRing<A>, node: A, options?: {
  readonly weight?: number | undefined
}): HashRing<A> => addMany(self, [node], options))

/**
 * Removes the node from the ring. No-op's if the node does not exist.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const remove: {
  <A extends PrimaryKey.PrimaryKey>(node: A): (self: HashRing<A>) => HashRing<A>
  <A extends PrimaryKey.PrimaryKey>(self: HashRing<A>, node: A): HashRing<A>
} = dual(2, <A extends PrimaryKey.PrimaryKey>(self: HashRing<A>, node: A): HashRing<A> => {
  const key = PrimaryKey.value(node)
  const entry = self.nodes.get(key)
  if (entry) {
    self.nodes.delete(key)
    self.ring = self.ring.filter(([, n]) => n !== key)
    self.totalWeightCache -= entry[1]
  }
  return self
})

/**
 * @since 4.0.0
 * @category Combinators
 */
export const has: {
  <A extends PrimaryKey.PrimaryKey>(node: A): (self: HashRing<A>) => boolean
  <A extends PrimaryKey.PrimaryKey>(self: HashRing<A>, node: A): boolean
} = dual(
  2,
  <A extends PrimaryKey.PrimaryKey>(self: HashRing<A>, node: A): boolean => self.nodes.has(PrimaryKey.value(node))
)

/**
 * Gets the node which should handle the given input. Returns undefined if
 * the hashring has no elements with weight.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const get = <A extends PrimaryKey.PrimaryKey>(self: HashRing<A>, input: string): A | undefined => {
  if (self.ring.length === 0) {
    return undefined
  }
  const index = getIndexForInput(self, hashRingHash(input))[0]
  const node = self.ring[index][1]!
  return self.nodes.get(node)![0]
}

/**
 * Distributes `count` shards across the nodes in the ring, attempting to
 * balance the number of shards allocated to each node. Returns undefined if
 * the hashring has no elements with weight.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const getShards = <A extends PrimaryKey.PrimaryKey>(self: HashRing<A>, count: number): Array<A> | undefined => {
  if (self.ring.length === 0) {
    return undefined
  }

  const shards = new Array<A>(count)

  // for tracking how many shards have been allocated to each node
  const allocations = new Map<string, number>()
  // for tracking which shards still need to be allocated
  const remaining = new Set<number>()
  // for tracking which nodes have reached the max allocation
  const exclude = new Set<string>()

  // First pass - allocate the closest nodes, skipping nodes that have reached
  // max
  const distances = new Array<[shard: number, node: string, distance: bigint]>(count)
  for (let shard = 0; shard < count; shard++) {
    const hash = (shardHashes[shard] ??= hashRingHash(`shard-${shard}`))
    const [index, distance] = getIndexForInput(self, hash)
    const node = self.ring[index][1]!
    distances[shard] = [shard, node, distance]
    remaining.add(shard)
  }
  distances.sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0))
  for (let i = 0; i < count; i++) {
    const [shard, node] = distances[i]
    if (exclude.has(node)) continue
    const [value, weight] = self.nodes.get(node)!
    shards[shard] = value
    remaining.delete(shard)
    const nodeCount = (allocations.get(node) ?? 0) + 1
    allocations.set(node, nodeCount)
    const maxPerNode = Math.max(1, Math.floor(count * (weight / self.totalWeightCache)))
    if (nodeCount >= maxPerNode) {
      exclude.add(node)
    }
  }

  // Second pass - allocate any remaining shards, skipping nodes that have
  // reached max
  let allAtMax = exclude.size === self.nodes.size
  remaining.forEach((shard) => {
    const index = getIndexForInput(self, shardHashes[shard], allAtMax ? undefined : exclude)[0]
    const node = self.ring[index][1]
    const [value, weight] = self.nodes.get(node)!
    shards[shard] = value

    if (allAtMax) return
    const nodeCount = (allocations.get(node) ?? 0) + 1
    allocations.set(node, nodeCount)
    const maxPerNode = Math.max(1, Math.floor(count * (weight / self.totalWeightCache)))
    if (nodeCount >= maxPerNode) {
      exclude.add(node)
      if (exclude.size === self.nodes.size) {
        allAtMax = true
      }
    }
  })

  return shards
}

const shardHashes: Array<bigint> = []

function getIndexForInput<A extends PrimaryKey.PrimaryKey>(
  self: HashRing<A>,
  hash: bigint,
  exclude?: ReadonlySet<string> | undefined
): readonly [index: number, distance: bigint] {
  const ring = self.ring
  const len = ring.length

  let mid: number
  let lo = 0
  let hi = len - 1

  while (lo <= hi) {
    mid = ((lo + hi) / 2) >>> 0
    if (ring[mid][0] >= hash) {
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }
  const a = lo === len ? lo - 1 : lo
  const distA = abs64(ring[a][0] - hash)
  if (exclude === undefined) {
    const b = lo - 1
    if (b < 0) {
      return [a, distA]
    }
    const distB = abs64(ring[b][0] - hash)
    return distA <= distB ? [a, distA] : [b, distB]
  } else if (!exclude.has(ring[a][1])) {
    return [a, distA]
  }
  const range = Math.max(lo, len - lo)
  for (let i = 1; i < range; i++) {
    let index = lo - i
    if (index >= 0 && index < len && !exclude.has(ring[index][1])) {
      return [index, abs64(ring[index][0] - hash)]
    }
    index = lo + i
    if (index >= 0 && index < len && !exclude.has(ring[index][1])) {
      return [index, abs64(ring[index][0] - hash)]
    }
  }
  return [a, distA]
}

const hashRingEncoder = new TextEncoder()
const hashRingMask = 0xffffffffffffffffn
const hashRingC1 = 0x87c37b91114253d5n
const hashRingC2 = 0x4cf5ad432745937fn
const hashRingBlockSize = 16

const hashRingHash = (input: string): bigint => murmurHash3x64(hashRingEncoder.encode(input), 0n)

const hashRingRotl = (value: bigint, shift: bigint): bigint =>
  ((value << shift) & hashRingMask) | (value >> (64n - shift))

const hashRingFmix = (value: bigint): bigint => {
  let h = value
  h ^= h >> 33n
  h = (h * 0xff51afd7ed558ccdn) & hashRingMask
  h ^= h >> 33n
  h = (h * 0xc4ceb9fe1a85ec53n) & hashRingMask
  h ^= h >> 33n
  return h & hashRingMask
}

const hashRingGetBlock = (data: Uint8Array, index: number): bigint =>
  BigInt(data[index]) |
  (BigInt(data[index + 1]) << 8n) |
  (BigInt(data[index + 2]) << 16n) |
  (BigInt(data[index + 3]) << 24n) |
  (BigInt(data[index + 4]) << 32n) |
  (BigInt(data[index + 5]) << 40n) |
  (BigInt(data[index + 6]) << 48n) |
  (BigInt(data[index + 7]) << 56n)

const murmurHash3x64 = (data: Uint8Array, seed: bigint): bigint => {
  const len = data.length
  const blocks = Math.floor(len / hashRingBlockSize)
  let h1 = seed & hashRingMask
  let h2 = seed & hashRingMask

  for (let i = 0; i < blocks; i++) {
    const offset = i * hashRingBlockSize
    let k1 = hashRingGetBlock(data, offset)
    let k2 = hashRingGetBlock(data, offset + 8)

    k1 = (k1 * hashRingC1) & hashRingMask
    k1 = hashRingRotl(k1, 31n)
    k1 = (k1 * hashRingC2) & hashRingMask
    h1 ^= k1

    h1 = hashRingRotl(h1, 27n)
    h1 = (h1 + h2) & hashRingMask
    h1 = (h1 * 5n + 0x52dce729n) & hashRingMask

    k2 = (k2 * hashRingC2) & hashRingMask
    k2 = hashRingRotl(k2, 33n)
    k2 = (k2 * hashRingC1) & hashRingMask
    h2 ^= k2

    h2 = hashRingRotl(h2, 31n)
    h2 = (h2 + h1) & hashRingMask
    h2 = (h2 * 5n + 0x38495ab5n) & hashRingMask
  }

  let k1 = 0n
  let k2 = 0n
  const tail = blocks * hashRingBlockSize
  const tailLength = len & 15

  if (tailLength >= 15) k2 ^= BigInt(data[tail + 14]) << 48n
  if (tailLength >= 14) k2 ^= BigInt(data[tail + 13]) << 40n
  if (tailLength >= 13) k2 ^= BigInt(data[tail + 12]) << 32n
  if (tailLength >= 12) k2 ^= BigInt(data[tail + 11]) << 24n
  if (tailLength >= 11) k2 ^= BigInt(data[tail + 10]) << 16n
  if (tailLength >= 10) k2 ^= BigInt(data[tail + 9]) << 8n
  if (tailLength >= 9) {
    k2 ^= BigInt(data[tail + 8])
    k2 = (k2 * hashRingC2) & hashRingMask
    k2 = hashRingRotl(k2, 33n)
    k2 = (k2 * hashRingC1) & hashRingMask
    h2 ^= k2
  }

  if (tailLength >= 8) k1 ^= BigInt(data[tail + 7]) << 56n
  if (tailLength >= 7) k1 ^= BigInt(data[tail + 6]) << 48n
  if (tailLength >= 6) k1 ^= BigInt(data[tail + 5]) << 40n
  if (tailLength >= 5) k1 ^= BigInt(data[tail + 4]) << 32n
  if (tailLength >= 4) k1 ^= BigInt(data[tail + 3]) << 24n
  if (tailLength >= 3) k1 ^= BigInt(data[tail + 2]) << 16n
  if (tailLength >= 2) k1 ^= BigInt(data[tail + 1]) << 8n
  if (tailLength >= 1) {
    k1 ^= BigInt(data[tail])
    k1 = (k1 * hashRingC1) & hashRingMask
    k1 = hashRingRotl(k1, 31n)
    k1 = (k1 * hashRingC2) & hashRingMask
    h1 ^= k1
  }

  const total = BigInt(len)
  h1 ^= total
  h2 ^= total

  h1 = (h1 + h2) & hashRingMask
  h2 = (h2 + h1) & hashRingMask

  h1 = hashRingFmix(h1)
  h2 = hashRingFmix(h2)

  h1 = (h1 + h2) & hashRingMask

  return h1
}

const abs64 = (value: bigint): bigint => (value < 0n ? -value : value)
