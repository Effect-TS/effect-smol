import { NodeHttpServer } from "@effect/platform-node"
import { Api } from "@todos/api/Api"
import { Config, Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { createServer } from "node:http"
import { TodoHandlers } from "./Todos/http.ts"

const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
  Layer.provide([TodoHandlers]),
  Layer.provide(HttpRouter.cors()),
)

const HealthRoute = HttpRouter.use(
  Effect.fn(function* (router) {
    yield* router.add(
      "GET",
      "/health",
      HttpServerResponse.jsonUnsafe({ status: "ok" }),
    )
  }),
)

const AllRoutes = Layer.mergeAll(ApiRoutes, HealthRoute)

export const HttpLayer = HttpRouter.serve(AllRoutes).pipe(
  Layer.provide(
    NodeHttpServer.layerConfig(createServer, {
      port: Config.port("PORT").pipe(Config.withDefault(3000)),
    }),
  ),
)
