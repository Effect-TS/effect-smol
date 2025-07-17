import { Issue } from "effect/schema"
import { describe, it } from "vitest"
import { assertTrue } from "../utils/assert.ts"

describe("Issue", () => {
  it("isIssue", () => {
    assertTrue(Issue.isIssue(new Issue.MissingKey(undefined)))
  })
})
