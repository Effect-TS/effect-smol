import { NodeFileSystem } from "@effect/platform-node"
import { SqliteClient } from "@effect/sql-sqlite-node"
import { expect, it } from "@effect/vitest"
import { Effect, Encoding, FileSystem, Layer } from "effect"
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore"
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

it.layer(
  KeyValueStore.layerSql.pipe(Layer.provideMerge(ClientLayer))
)("KeyValueStore.layerSql", (it) => {
  it.effect("set + get + size", () =>
    Effect.gen(function*() {
      const kv = yield* KeyValueStore.KeyValueStore
      yield* kv.clear

      yield* kv.set("key", "value")

      expect(yield* kv.get("key")).toEqual("value")
      expect(yield* kv.size).toEqual(1)

      yield* kv.set("key", "value-2")

      expect(yield* kv.get("key")).toEqual("value-2")
      expect(yield* kv.size).toEqual(1)
    }))

  it.effect("binary values", () =>
    Effect.gen(function*() {
      const kv = yield* KeyValueStore.KeyValueStore
      yield* kv.clear
      const bytes = new Uint8Array([0, 42, 255, 128])

      yield* kv.set("binary", bytes)

      expect(yield* kv.get("binary")).toEqual(Encoding.encodeBase64(bytes))
      expect(yield* kv.getUint8Array("binary")).toEqual(bytes)
    }))

  it.effect("remove", () =>
    Effect.gen(function*() {
      const kv = yield* KeyValueStore.KeyValueStore
      yield* kv.clear

      yield* kv.set("a", "1")
      yield* kv.remove("a")

      expect(yield* kv.get("a")).toEqual(undefined)
      expect(yield* kv.size).toEqual(0)
    }))

  it.effect("clear", () =>
    Effect.gen(function*() {
      const kv = yield* KeyValueStore.KeyValueStore
      yield* kv.clear

      yield* kv.set("a", "1")
      yield* kv.set("b", "2")
      yield* kv.clear

      expect(yield* kv.size).toEqual(0)
      expect(yield* kv.get("a")).toEqual(undefined)
      expect(yield* kv.get("b")).toEqual(undefined)
    }))
})
