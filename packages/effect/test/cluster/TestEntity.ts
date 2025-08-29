import { Effect, Layer, MutableRef, Queue, Schedule, ServiceMap } from "effect"
import { Option } from "effect/data"
import { Schema } from "effect/schema"
import { Stream } from "effect/stream"
import type { Envelope } from "effect/unstable/cluster"
import { ClusterSchema, Entity } from "effect/unstable/cluster"
import type { RpcGroup } from "effect/unstable/rpc"
import { Rpc, RpcSchema } from "effect/unstable/rpc"

export class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String
}) {}

export class StreamWithKey extends Rpc.make("StreamWithKey", {
  success: RpcSchema.Stream({
    success: Schema.Number,
    error: Schema.Never
  }),
  payload: { key: Schema.String },
  primaryKey: ({ key }) => key
}) {}

export const TestEntity = Entity.make("TestEntity", [
  Rpc.make("GetUser", {
    success: User,
    payload: { id: Schema.Number }
  }),
  Rpc.make("GetUserVolatile", {
    success: User,
    payload: { id: Schema.Number }
  }).annotate(ClusterSchema.Persisted, false),
  Rpc.make("Never"),
  Rpc.make("NeverFork"),
  Rpc.make("NeverVolatile").annotate(ClusterSchema.Persisted, false),
  Rpc.make("RequestWithKey", {
    payload: { key: Schema.String },
    primaryKey: ({ key }) => key
  }),
  StreamWithKey,
  Rpc.make("GetAllUsers", {
    success: User,
    payload: { ids: Schema.Array(Schema.Number) },
    stream: true
  })
]).annotateRpcs(ClusterSchema.Persisted, true)

export class TestEntityState extends ServiceMap.Key<TestEntityState>()("TestEntityState", {
  make: Effect.gen(function*() {
    const messages = yield* Queue.make<void>()
    const streamMessages = yield* Queue.make<void, Queue.Done>()
    const envelopes = yield* Queue.make<
      RpcGroup.Rpcs<typeof TestEntity.protocol> extends infer R ? R extends Rpc.Any ? Envelope.Request<R> : never
        : never
    >()
    const interrupts = yield* Queue.make<
      RpcGroup.Rpcs<typeof TestEntity.protocol> extends infer R ? R extends Rpc.Any ? Envelope.Request<R> : never
        : never
    >()
    const defectTrigger = MutableRef.make(false)
    const layerBuilds = MutableRef.make(0)

    return {
      messages,
      streamMessages,
      envelopes,
      interrupts,
      defectTrigger,
      layerBuilds
    } as const
  })
}) {
  static layer = Layer.effect(this)(this.make)
}

export const TestEntityNoState = TestEntity.toLayer(
  Effect.gen(function*() {
    const state = yield* TestEntityState

    MutableRef.update(state.layerBuilds, (count) => count + 1)

    const never = (envelope: any) =>
      Effect.suspend(() => {
        Queue.offerUnsafe(state.envelopes, envelope)
        return Effect.never
      }).pipe(Effect.onInterrupt(() => {
        Queue.offerUnsafe(state.interrupts, envelope)
        return Effect.void
      }))
    return TestEntity.of({
      GetUser: (envelope) =>
        Effect.sync(() => {
          Queue.offerUnsafe(state.envelopes, envelope)
          if (state.defectTrigger.current) {
            MutableRef.set(state.defectTrigger, false)
            throw new Error("User not found")
          }
          return new User({ id: envelope.payload.id, name: `User ${envelope.payload.id}` })
        }),
      GetUserVolatile: (envelope) =>
        Effect.sync(() => {
          Queue.offerUnsafe(state.envelopes, envelope)
          return new User({ id: envelope.payload.id, name: `User ${envelope.payload.id}` })
        }),
      Never: never,
      NeverFork: (envelope) => Rpc.fork(never(envelope)),
      NeverVolatile: never,
      RequestWithKey: (envelope) => {
        Queue.offerUnsafe(state.envelopes, envelope)
        return Queue.take(state.messages)
      },
      StreamWithKey: (envelope) => {
        let sequence = envelope.lastSentChunkValue.pipe(
          Option.map((value) => value + 1),
          Option.getOrElse(() => 0)
        )
        return Stream.fromQueue(state.streamMessages).pipe(
          Stream.map(() => sequence++)
        )
      },
      GetAllUsers: (envelope) => {
        Queue.offerUnsafe(state.envelopes, envelope)
        return Stream.fromIterable(envelope.payload.ids.map((id) => new User({ id, name: `User ${id}` }))).pipe(
          Stream.rechunk(1)
        )
      }
    })
  }),
  { defectRetryPolicy: Schedule.forever }
)

export const TestEntityLayer = TestEntityNoState.pipe(Layer.provideMerge(TestEntityState.layer))
