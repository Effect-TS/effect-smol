import { MysqlClient } from "@effect/sql-mysql2"
import type { StartedMySqlContainer } from "@testcontainers/mysql"
import { MySqlContainer } from "@testcontainers/mysql"
import { Effect, Layer, ServiceMap } from "effect"
import { Data, Redacted } from "effect/data"
import { String } from "effect/primitives"

export class ContainerError extends Data.TaggedError("ContainerError")<{
  cause: unknown
}> {}

export class MysqlContainer extends ServiceMap.Key<
  MysqlContainer,
  StartedMySqlContainer
>()("test/MysqlContainer") {
  static layer = Layer.effect(this)(
    Effect.acquireRelease(
      Effect.tryPromise({
        try: () => new MySqlContainer("mysql:lts").start(),
        catch: (cause) => new ContainerError({ cause })
      }),
      (container) => Effect.promise(() => container.stop())
    )
  )

  static layerClient = Layer.unwrap(
    Effect.gen(function*() {
      const container = yield* MysqlContainer
      return MysqlClient.layer({
        url: Redacted.make(container.getConnectionUri())
      })
    })
  ).pipe(Layer.provide(this.layer))

  static layerClientWithTransforms = Layer.unwrap(
    Effect.gen(function*() {
      const container = yield* MysqlContainer
      return MysqlClient.layer({
        url: Redacted.make(container.getConnectionUri()),
        transformQueryNames: String.camelToSnake,
        transformResultNames: String.snakeToCamel
      })
    })
  ).pipe(Layer.provide(this.layer))
}
