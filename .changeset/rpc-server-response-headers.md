---
"effect": minor
---

unstable/rpc: add server-to-client response headers

Server handlers can now attach headers to the response sent back to the client.
The headers are emitted on `Chunk` and `Exit` messages and exposed to the
client via a new per-call `onResponseHeaders` option.

Server-side handlers and middleware can set response headers either via the
mutable `responseHeaders` holder available on the metadata object, or via
the new `Rpc.setResponseHeader`, `Rpc.setAllResponseHeaders`, and
`Rpc.mergeResponseHeaders` effects.

```ts
import { Effect } from "effect"
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

// client side
const result = yield* client.Echo(
  { value: "hi" },
  { onResponseHeaders: (headers) => console.log(headers) }
)
```
