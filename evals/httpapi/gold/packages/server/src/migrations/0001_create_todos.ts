import { Effect } from "effect"
import { SqlClient } from "effect/unstable/sql"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    create table if not exists todos (
      id text primary key,
      title text not null,
      completed boolean not null,
      createdAt text not null,
      updatedAt text not null
    )
  `
})
