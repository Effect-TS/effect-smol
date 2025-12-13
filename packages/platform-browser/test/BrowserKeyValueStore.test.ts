import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"
import { describe } from "@effect/vitest"
// @ts-ignore
import { testLayer } from "../../effect/test/unstable/persistence/KeyValueStore.test.ts"

describe("KeyValueStore / layerLocalStorage", () => testLayer(BrowserKeyValueStore.layerLocalStorage))

describe("KeyValueStore / layerSessionStorage", () => testLayer(BrowserKeyValueStore.layerSessionStorage))
