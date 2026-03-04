import { Api } from "@todos/api/Api"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"

const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
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

export const HttpLayer = HttpRouter.serve(AllRoutes)
