// oxlint-disable-next-line no-unassigned-import
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@solidjs/testing-library"
import { afterEach } from "vitest"
;(globalThis as { navigator?: { userAgent?: string } }).navigator = {
  userAgent: "solid-js"
}

const solidWeb = await import("solid-js/web")
;(solidWeb as { isServer: boolean }).isServer = false

afterEach(() => {
  cleanup()
})
