import { defineWebWorkers } from "@vitest/web-worker/pure"
import "fake-indexeddb/auto"

defineWebWorkers({
  clone: "none"
})
