---
"effect": minor
---

unstable/rpc: add server-to-client response headers

Server handlers can now attach headers to the response sent back to the
client. Headers ride along on every `Chunk` and `Exit` message and are
exposed to the client via per-call options or the new
`RpcClient.withResponseHeaders` helper.

### Setting headers (server)

Handlers and middleware receive a mutable `responseHeaders` holder on the
metadata object. The same value is also available through `Rpc.setResponseHeader`,
`Rpc.setAllResponseHeaders` and `Rpc.mergeResponseHeaders`:

```ts
import { Effect, Schema } from "effect"
import { Rpc, RpcGroup } from "effect/unstable/rpc"

const group = RpcGroup.make(
  Rpc.make("Echo", { payload: { value: Schema.String }, success: Schema.String })
)

const handlers = group.toLayer({
  Echo: (req) =>
    Effect.gen(function*() {
      yield* Rpc.setResponseHeader("x-echo", req.value)
      return req.value
    })
})
```

### Reading headers (client)

Three options on the call site:

```ts
Effect.gen(function*() {
  // 1. withResponseHeaders — wrap the call, get [result, headers]
  const [user, headers] = yield* RpcClient.withResponseHeaders(client.GetUser({ id: 1 }))

  // 2. onResponseHeaders — Effect callback. Its E and R bubble into the call's
  //    error and requirements. Failures propagate into the result Cause.
  yield* client.GetUser(
    { id: 1 },
    { onResponseHeaders: (h) => Logger.log(`headers: ${JSON.stringify(h)}`) }
  )

  // 3. onResponseHeadersSync — fire-and-forget sync callback
  yield* client.GetUser(
    { id: 1 },
    {
      onResponseHeadersSync: (h) => {
        lastHeaders = h
      }
    }
  )
})
```

For streaming RPCs, `onResponseHeaders` / `onResponseHeadersSync` fire on
each chunk and on the final exit; `withResponseHeaders` is for single-response
calls.

### Message shape

`ResponseChunk(Encoded)` and `ResponseExit(Encoded)` now carry a (required)
`headers` field, defaulting to an empty value when none are set.
