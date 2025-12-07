import { Layer } from "effect"
import * as PersistedCacheTest from "effect-test/persistence/PersistedCacheTest"
import * as PersistedQueueTest from "effect-test/persistence/PersistedQueueTest"
import { PersistedQueue, Persistence } from "effect/unstable/persistence"
import { PgContainer } from "./utils.ts"

PersistedCacheTest.suite(
  "sql-pg",
  Persistence.layerSql.pipe(
    Layer.provide(PgContainer.layerClient)
  )
)

PersistedQueueTest.suite(
  "sql-pg",
  PersistedQueue.layerStoreSql().pipe(
    Layer.provide(PgContainer.layerClient)
  )
)
