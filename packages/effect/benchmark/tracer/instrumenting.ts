import { Context, Effect, Layer, Tracer } from "effect"
import { Bench } from "tinybench"

// Measures `Tracer.instrumenting` against the idiomatic manual way to span a
// method (`Effect.fn`) and against no tracing — both with bare, do-nothing
// method bodies (where the per-span cost dominates) and with a realistic nested
// request that ends in I/O (where it is lost against latency).
//
// Run: tsx packages/effect/benchmark/tracer/instrumenting.ts

interface RepoShape {
  readonly find: (id: number) => Effect.Effect<number>
}
class Repo extends Context.Service<Repo, RepoShape>()("@svc/Repo") {}

interface SvcShape {
  readonly load: (id: number) => Effect.Effect<number>
}
class Svc extends Context.Service<Svc, SvcShape>()("@svc/Svc") {}

const matchTracer = Tracer.instrumenting({ match: (key) => key.startsWith("@svc/") })

// --- bare spans, no I/O: 200 calls/run ---

const RepoBare = Layer.succeed(Repo, { find: (id) => Effect.succeed(id * 2) })
const SvcBare = Layer.effect(
  Svc,
  Effect.gen(function*() {
    const repo = yield* Repo
    return { load: (id: number) => repo.find(id) }
  })
).pipe(Layer.provide(RepoBare))

const RepoBareFn = Layer.succeed(Repo, {
  find: Effect.fn("Repo.find")(function*(id: number) {
    return id * 2
  })
})
const SvcBareFn = Layer.effect(
  Svc,
  Effect.gen(function*() {
    const repo = yield* Repo
    return {
      load: Effect.fn("Svc.load")(function*(id: number) {
        return yield* repo.find(id)
      })
    }
  })
).pipe(Layer.provide(RepoBareFn))

const bareLoop = Effect.gen(function*() {
  const svc = yield* Svc
  let total = 0
  for (let i = 0; i < 200; i++) {
    total += yield* svc.load(i)
  }
  return total
})

const barePlain = bareLoop.pipe(Effect.provide(SvcBare))
const bareManual = bareLoop.pipe(Effect.provide(SvcBareFn))
const bareAuto = barePlain.pipe(Effect.withTracer(matchTracer))

// --- realistic nested request ending in I/O: 20 requests/run ---

interface DbShape {
  readonly query: (id: number) => Effect.Effect<number>
  readonly exec: (id: number) => Effect.Effect<number>
}
class Db extends Context.Service<Db, DbShape>()("@svc/Db") {}

const ioWork = (id: number) =>
  Effect.gen(function*() {
    yield* Effect.sleep("1 millis")
    return id
  })

const DbLayer = Layer.succeed(Db, { query: ioWork, exec: ioWork })
const ReqRepo = Layer.effect(
  Repo,
  Effect.gen(function*() {
    const db = yield* Db
    return { find: (id) => Effect.flatMap(db.query(id), (n) => db.exec(n)) }
  })
).pipe(Layer.provide(DbLayer))
const ReqSvc = Layer.effect(
  Svc,
  Effect.gen(function*() {
    const repo = yield* Repo
    return { load: (id) => repo.find(id) }
  })
).pipe(Layer.provide(ReqRepo))

const reqLoop = Effect.gen(function*() {
  const svc = yield* Svc
  let total = 0
  for (let i = 0; i < 20; i++) {
    total += yield* svc.load(i)
  }
  return total
})

const reqPlain = reqLoop.pipe(Effect.provide(ReqSvc))
const reqAuto = reqPlain.pipe(Effect.withTracer(matchTracer))

const bareBench = new Bench({ time: 1000 })
bareBench
  .add("bare: no-tracer", () => Effect.runPromise(barePlain))
  .add("bare: manual Effect.fn", () => Effect.runPromise(bareManual))
  .add("bare: instrumenting", () => Effect.runPromise(bareAuto))

const reqBench = new Bench({ time: 2000 })
reqBench
  .add("request: no-tracer", () => Effect.runPromise(reqPlain))
  .add("request: instrumenting", () => Effect.runPromise(reqAuto))

await bareBench.run()
console.log("\nBare spans, no I/O (200 calls/run):")
console.table(bareBench.table())

await reqBench.run()
console.log("\nRealistic nested request, ~3 spans + 2 DB round-trips (20 req/run):")
console.table(reqBench.table())
