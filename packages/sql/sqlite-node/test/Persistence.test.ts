import { NodeFileSystem } from "@effect/platform-node"
import { SqliteClient } from "@effect/sql-sqlite-node"
import { expect, it } from "@effect/vitest"
import { Duration, Effect, FileSystem, Layer } from "effect"
import { TestClock } from "effect/testing"
import { Persistence } from "effect/unstable/persistence"
import { Reactivity } from "effect/unstable/reactivity"

const ClientLayer = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const dir = yield* fs.makeTempDirectoryScoped()
  return SqliteClient.layer({
    filename: dir + "/test.db"
  })
}).pipe(
  Layer.unwrap,
  Layer.provide([NodeFileSystem.layer, Reactivity.layer])
)
const PersistenceLayer = Persistence.layerBackingSql.pipe(Layer.provideMerge(ClientLayer))

it.layer(PersistenceLayer)("Persistence", (it) => {
  it.effect("set + get", () =>
    Effect.gen(function*() {
      const persistence = yield* Persistence.BackingPersistence
      const store = yield* persistence.make("test_store")
      yield* store.set("key1", { name: "Alice" }, undefined)
      const value = yield* store.get("key1")
      expect(value).toEqual({ name: "Alice" })

      // test upsert
      yield* store.set("key1", { name: "Alice" }, undefined)
    }))

  it.effect("setMany + getMany", () =>
    Effect.gen(function*() {
      const persistence = yield* Persistence.BackingPersistence
      const store = yield* persistence.make("test_store_2")
      yield* store.setMany([
        ["key1", { name: "Alice" }, undefined],
        ["key2", { name: "Bob" }, undefined],
        ["key3", { name: "Charlie" }, undefined]
      ])
      const values = yield* store.getMany(["key1", "key2", "key3", "key4"])
      expect(values).toEqual([
        { name: "Alice" },
        { name: "Bob" },
        { name: "Charlie" },
        undefined
      ])
    }))

  it.effect("remove", () =>
    Effect.gen(function*() {
      const persistence = yield* Persistence.BackingPersistence
      const store = yield* persistence.make("test_store_2")
      yield* store.setMany([
        ["key1", { name: "Alice" }, undefined],
        ["key2", { name: "Bob" }, undefined],
        ["key3", { name: "Charlie" }, undefined]
      ])
      yield* store.remove("key2")
      const valuesAfter = yield* store.getMany(["key1", "key2", "key3"])
      expect(valuesAfter).toEqual([{ name: "Alice" }, undefined, { name: "Charlie" }])
    }))

  it.effect("expires", () =>
    Effect.gen(function*() {
      const persistence = yield* Persistence.BackingPersistence
      const store = yield* persistence.make("test_store_3")
      yield* store.setMany([
        ["key1", { name: "Alice" }, undefined],
        ["key2", { name: "Bob" }, undefined],
        ["key3", { name: "Charlie" }, Duration.seconds(10)]
      ])
      let values = yield* store.getMany(["key1", "key2", "key3"])
      expect(values).toEqual([{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }])
      yield* TestClock.adjust(Duration.seconds(5))
      values = yield* store.getMany(["key1", "key2", "key3"])
      expect(values).toEqual([{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }])
      yield* TestClock.adjust(Duration.seconds(5))
      values = yield* store.getMany(["key1", "key2", "key3"])
      expect(values).toEqual([{ name: "Alice" }, { name: "Bob" }, undefined])
    }))
})
