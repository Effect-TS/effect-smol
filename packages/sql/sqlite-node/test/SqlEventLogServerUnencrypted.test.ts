import { SqliteClient } from "@effect/sql-sqlite-node"
import * as SqlEventLogServerUnencryptedStorageTest from "effect-test/unstable/eventlog/SqlEventLogServerUnencryptedStorageTest"

SqlEventLogServerUnencryptedStorageTest.suite(
  "sql-sqlite-node",
  SqliteClient.layer({
    filename: ":memory:"
  })
)
