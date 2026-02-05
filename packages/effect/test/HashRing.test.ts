import * as HashRing from "effect/HashRing"
import { xxh3_64bitsString } from "effect/internal/xxHash3"
import * as PrimaryKey from "effect/PrimaryKey"
import { describe, expect, it } from "vitest"

class Key implements PrimaryKey.PrimaryKey {
  constructor(readonly key: string) {
  }
  [PrimaryKey.symbol](): string {
    return this.key
  }
}

describe("HashRing", () => {
  it("uses XXH3 64-bit bigint hashes", () => {
    const ring = HashRing.make<Key>({ baseWeight: 1 })
    HashRing.add(ring, new Key("node"), { weight: 1 })
    expect(ring.ring.length).toBe(1)
    expect(typeof ring.ring[0][0]).toBe("bigint")
    expect(ring.ring[0][0]).toBe(xxh3_64bitsString("node:1"))
  })

  it("get returns undefined on empty ring", () => {
    const ring = HashRing.make<Key>()
    expect(HashRing.get(ring, "k")).toBeUndefined()
  })

  it("getShards returns undefined on empty ring", () => {
    const ring = HashRing.make<Key>()
    expect(HashRing.getShards(ring, 4)).toBeUndefined()
  })

  it("getShards returns assignments", () => {
    const ring = HashRing.make<Key>({ baseWeight: 1 })
    HashRing.addMany(ring, [new Key("a"), new Key("b"), new Key("c")], { weight: 1 })
    const shards = HashRing.getShards(ring, 16)
    expect(shards?.length).toBe(16)
    for (const shard of shards!) {
      expect(["a", "b", "c"]).toContain(PrimaryKey.value(shard))
    }
  })
})
