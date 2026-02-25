/**
 * @title Defining cluster entities
 *
 * Define entity RPCs, implement stateful handlers, and call entities through a
 * typed client. This example also shows `SingleRunner.layer` for local
 * development and `maxIdleTime` for passivation.
 */
import { Effect, Layer, Ref, Schema } from "effect"
import { Entity, SingleRunner } from "effect/unstable/cluster"
import { Rpc } from "effect/unstable/rpc"
import { type SqlClient } from "effect/unstable/sql"

export const Increment = Rpc.make("Increment", {
  payload: { amount: Schema.Number },
  success: Schema.Number
})

export const GetCount = Rpc.make("GetCount", {
  success: Schema.Number
})

// `Entity.make` takes an array of Rpc definitions, not an RpcGroup.
export const Counter = Entity.make("Counter", [Increment, GetCount])

// Entity handlers can keep in-memory state while the entity is active.
// `maxIdleTime` controls passivation: if the entity is idle long enough, it is
// stopped and later recreated on demand.
export const CounterEntityLayer = Counter.toLayer(
  Effect.gen(function*() {
    const count = yield* Ref.make(0)

    return Counter.of({
      Increment: ({ payload }) => Ref.updateAndGet(count, (current) => current + payload.amount),
      GetCount: () => Ref.get(count)
    })
  }),
  { maxIdleTime: "5 minutes" }
)

// `SingleRunner.layer` is useful for local development / tests where you still
// want the cluster entity runtime model.
declare const SqlClientLive: Layer.Layer<SqlClient.SqlClient>

export const ShardingLive = SingleRunner.layer().pipe(
  Layer.provide(SqlClientLive)
)

export const CounterLive = CounterEntityLayer.pipe(
  Layer.provide(ShardingLive)
)

export const useCounter = Effect.gen(function*() {
  const clientFor = yield* Counter.client
  const counter = clientFor("counter-123")

  const afterIncrement = yield* counter.Increment({ amount: 1 })
  const currentCount = yield* counter.GetCount()

  return { afterIncrement, currentCount }
}).pipe(
  Effect.provide(CounterLive)
)
