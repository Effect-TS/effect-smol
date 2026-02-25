import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"
import { describe } from "@effect/vitest"
import { testLayer } from "effect-test/unstable/persistence/KeyValueStore.test"

describe("KeyValueStore / layerLocalStorage", () => testLayer(BrowserKeyValueStore.layerLocalStorage))

describe("KeyValueStore / layerSessionStorage", () => testLayer(BrowserKeyValueStore.layerSessionStorage))

let id = 0
const VERSION = 1

describe(
  "KeyValueStore / layerIndexedDb",
  () =>
    testLayer(() => {
      const name = `test-db-${id++}`
      return BrowserKeyValueStore.layerIndexedDb(name, `test-store-${name}`, VERSION)
    })
)
