import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"
import { describe } from "@effect/vitest"
import { testLayer } from "effect-test/unstable/persistence/KeyValueStore.test"
import { indexedDB as fakeIndexedDb } from "fake-indexeddb"

describe("KeyValueStore / layerLocalStorage", () => testLayer(BrowserKeyValueStore.layerLocalStorage))

describe("KeyValueStore / layerSessionStorage", () => testLayer(BrowserKeyValueStore.layerSessionStorage))

describe("KeyValueStore / layerIndexedDb", () => {
  Reflect.set(globalThis, "indexedDB", fakeIndexedDb)
  testLayer(BrowserKeyValueStore.layerIndexedDb({ database: "kvs_test_db" }))
})
