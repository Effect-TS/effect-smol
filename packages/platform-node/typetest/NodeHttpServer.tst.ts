import { NodeHttpServer, type NodeServices } from "@effect/platform-node"
import { Config, type Layer } from "effect"
import type * as Etag from "effect/unstable/http/Etag"
import type * as HttpPlatform from "effect/unstable/http/HttpPlatform"
import type * as HttpServer from "effect/unstable/http/HttpServer"
import * as Http from "node:http"
import { describe, expect, it } from "tstyche"

describe("NodeHttpServer", () => {
  it("layerConfig provides the same services as layer", () => {
    const layer = NodeHttpServer.layer(Http.createServer, { port: 0 })
    const layerConfig = NodeHttpServer.layerConfig(Http.createServer, Config.succeed({ port: 0 }))

    expect<Layer.Success<typeof layerConfig>>().type.toBe<Layer.Success<typeof layer>>()
    expect<Layer.Success<typeof layerConfig>>().type.toBe<
      HttpServer.HttpServer | NodeServices.NodeServices | HttpPlatform.HttpPlatform | Etag.Generator
    >()
  })
})
