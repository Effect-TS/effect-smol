import { assert, describe, it } from "@effect/vitest"
import * as SqlError from "effect/unstable/sql/SqlError"

describe("SqlError", () => {
  it("delegates message, retryability and cause to reason", () => {
    const reason = new SqlError.ConnectionError({
      cause: new Error("boom")
    })
    const error = new SqlError.SqlError({ reason })
    const withMessage = new SqlError.SqlError({
      reason: new SqlError.ConnectionError({
        cause: new Error("boom"),
        message: "failed to connect"
      })
    })

    assert.strictEqual(error.message, "ConnectionError")
    assert.strictEqual(withMessage.message, "failed to connect")
    assert.strictEqual(error.isRetryable, true)
    assert.strictEqual(error.cause, reason)
  })

  it("isSqlError only matches the SqlError wrapper", () => {
    const reason = new SqlError.UnknownError({
      cause: new Error("boom")
    })
    const error = new SqlError.SqlError({ reason })
    const mismatch = new SqlError.ResultLengthMismatch({ expected: 1, actual: 0 })

    assert.strictEqual(SqlError.isSqlError(error), true)
    assert.strictEqual(SqlError.isSqlError(reason), false)
    assert.strictEqual(SqlError.isSqlError(mismatch), false)
  })

  it("isSqlErrorReason only matches reason values", () => {
    const reason = new SqlError.UnknownError({
      cause: new Error("boom")
    })
    const error = new SqlError.SqlError({ reason })

    assert.strictEqual(SqlError.isSqlErrorReason(reason), true)
    assert.strictEqual(SqlError.isSqlErrorReason(error), false)
  })

  it("classifySqliteError maps sqlite code strings and numeric codes", () => {
    const byString = SqlError.classifySqliteError({ code: "SQLITE_CONSTRAINT_UNIQUE" })
    const byNumber = SqlError.classifySqliteError({ errno: 2067 })
    const unknown = SqlError.classifySqliteError({ code: "NOT_SQLITE" })

    assert.strictEqual(byString._tag, "ConstraintError")
    assert.strictEqual(byNumber._tag, "ConstraintError")
    assert.strictEqual(unknown._tag, "UnknownError")
  })
})
