import { NodeServices } from "@effect/platform-node"
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node"
import { Layer } from "effect"
import { fileURLToPath } from "node:url"

export const SqlClientLayer = SqliteMigrator.layer({
  loader: SqliteMigrator.fromFileSystem(
    fileURLToPath(new URL("./migrations", import.meta.url)),
  ),
}).pipe(
  Layer.provideMerge(
    SqliteClient.layer({
      filename: "./todos.db",
    }),
  ),
  Layer.provide(NodeServices.layer),
)
