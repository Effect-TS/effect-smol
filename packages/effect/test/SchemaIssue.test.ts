import { SchemaIssue } from "effect"
import { describe, it } from "vitest"
import { assertTrue } from "./utils/assert.js"

describe("SchemaIssue", () => {
  it("isIssue", () => {
    assertTrue(SchemaIssue.isIssue(new SchemaIssue.MissingKey(undefined)))
  })
})
