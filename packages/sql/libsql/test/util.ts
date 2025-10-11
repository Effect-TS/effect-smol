import { LibsqlClient } from "@effect/sql-libsql"
import { Effect, Layer, ServiceMap } from "effect"
import { GenericContainer, type StartedTestContainer } from "testcontainers"

export class LibsqlContainer extends ServiceMap.Service<
  LibsqlContainer,
  StartedTestContainer
>()("test/LibsqlContainer") {
  static layer = Layer.effect(this)(
    Effect.acquireRelease(
      Effect.promise(() =>
        new GenericContainer("ghcr.io/tursodatabase/libsql-server:main")
          .withExposedPorts(8080)
          .withEnvironment({ SQLD_NODE: "primary" })
          .withCommand(["sqld", "--no-welcome", "--http-listen-addr", "0.0.0.0:8080"]).start()
      ),
      (container) => Effect.promise(() => container.stop())
    )
  )

  static layerClient = Layer.unwrap(
    Effect.gen(function*() {
      const container = yield* LibsqlContainer
      return LibsqlClient.layer({
        url: `http://localhost:${container.getMappedPort(8080)}`
      })
    })
  ).pipe(Layer.provide(this.layer))
}
