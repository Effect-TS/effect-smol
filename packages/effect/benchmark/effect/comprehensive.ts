import { type Cause, Context, Data, Deferred, Effect, Fiber, Layer, Queue, Ref, Semaphore } from "effect"
import { Bench } from "tinybench"

/**
 * Comprehensive benchmark of the core Effect primitives composed into
 * realistic workloads.
 *
 * Each task runs a whole pipeline end-to-end (layer construction, dependency
 * injection, error handling, caching, retries, timeouts, racing, queues,
 * fibers, layer-managed resources) over a batch of requests, so results
 * reflect application-level throughput rather than the cost of a single
 * primitive in isolation.
 *
 * All resources are managed by layers: every iteration builds the layer
 * graph, runs the workload and tears the resources back down, exactly like an
 * application boot/serve/shutdown cycle.
 */

/*
┌─────────┬──────────────────────────────────────────────────────────────────────────┬──────────────────┬───────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name                                                                │ Latency avg (ns) │ Latency med (ns)  │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┼───────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'request pipeline: DI + cache + error recovery (100 reqs)'              │ '70599 ± 0.81%'  │ '67750 ± 3375.0'  │ '14651 ± 0.18%'        │ '14760 ± 734'          │ 14165   │
│ 1       │ 'concurrent fan-out: forEach(16) x Effect.all (100 reqs)'               │ '408069 ± 1.77%' │ '372437 ± 12000'  │ '2604 ± 0.57%'         │ '2685 ± 87'            │ 2454    │
│ 2       │ 'producer/consumer: bounded queue, 4 workers (100 jobs)'                │ '46573 ± 0.32%'  │ '44667 ± 1667.0'  │ '21986 ± 0.16%'        │ '22388 ± 844'          │ 21472   │
│ 3       │ 'resilience: retry + timeout + hedged race (100 reqs)'                  │ '809768 ± 0.48%' │ '789583 ± 22166'  │ '1242 ± 0.40%'         │ '1266 ± 36'            │ 1235    │
│ 4       │ 'connection pool: layered resources + semaphore (20 units x 5 queries)' │ '64814 ± 0.30%'  │ '62834 ± 1876.0'  │ '15703 ± 0.16%'        │ '15915 ± 478'          │ 15429   │
│ 5       │ 'fork/join: 25 fibers gated on a Deferred'                              │ '17928 ± 0.32%'  │ '17333 ± 376.00'  │ '57294 ± 0.09%'        │ '57693 ± 1276'         │ 55778   │
│ 6       │ 'full application: layers + queue + workers + retry (100 reqs)'         │ '312945 ± 1.26%' │ '292292 ± 8729.0' │ '3335 ± 0.44%'         │ '3421 ± 103'           │ 3196    │
└─────────┴──────────────────────────────────────────────────────────────────────────┴──────────────────┴───────────────────┴────────────────────────┴────────────────────────┴─────────┘
*/

const bench = new Bench({ time: 1000 })

const REQUESTS = 100
const ids = Array.from({ length: REQUESTS }, (_, i) => i)

// ----------------------------------------------------------------------------
// Domain: services, errors and layers shared by the workloads
// ----------------------------------------------------------------------------

interface User {
  readonly id: number
  readonly name: string
  readonly orgId: number
}

class UserNotFound extends Data.TaggedError("UserNotFound")<{
  readonly id: number
}> {}

class TransientError extends Data.TaggedError("TransientError")<{
  readonly attempt: number
}> {}

class UserRepo extends Context.Service<UserRepo, {
  readonly findById: (id: number) => Effect.Effect<User, UserNotFound>
}>()("UserRepo") {}

class Metrics extends Context.Service<Metrics, {
  readonly increment: (name: string) => Effect.Effect<void>
}>()("Metrics") {}

class ConnectionPool extends Context.Service<ConnectionPool, {
  readonly query: (n: number) => Effect.Effect<number>
}>()("ConnectionPool") {}

class Listener extends Context.Service<Listener, {
  readonly active: boolean
}>()("Listener") {}

const anonymous: User = { id: -1, name: "anonymous", orgId: 0 }

// `findById` yields to the scheduler before answering, like a real driver
// crossing an async boundary, and misses on every 7th id to exercise the
// typed error channel.
const findById = Effect.fnUntraced(function*(id: number) {
  yield* Effect.yieldNow
  if (id % 7 === 0) {
    return yield* new UserNotFound({ id })
  }
  return { id, name: `user-${id}`, orgId: id % 5 }
})

const UserRepoLive = Layer.succeed(UserRepo, { findById })

const MetricsLive = Layer.effect(
  Metrics,
  Effect.gen(function*() {
    const counters = yield* Ref.make(new Map<string, number>())
    return {
      increment: (name: string) => Ref.update(counters, (map) => map.set(name, (map.get(name) ?? 0) + 1))
    }
  })
)

// A pool of 4 connections acquired in the layer scope and released on layer
// teardown; checkouts are limited by a 4-permit semaphore, like a client-side
// connection limit.
const ConnectionPoolLive = Layer.effect(
  ConnectionPool,
  Effect.gen(function*() {
    const open = yield* Ref.make(0)
    const connections = yield* Effect.forEach([1, 2, 3, 4], (id) =>
      Effect.acquireRelease(
        Ref.update(open, (n) => n + 1).pipe(Effect.as({ id })),
        () => Ref.update(open, (n) => n - 1)
      ))
    const permits = yield* Semaphore.make(connections.length)
    return {
      query: (n: number) =>
        permits.withPermits(1)(
          Effect.yieldNow.pipe(Effect.as(connections[n % connections.length].id * n))
        )
    }
  })
)

// A "listener" resource (think server socket) acquired when the layer is
// built and released when the application shuts down.
const ListenerLive = Layer.effect(
  Listener,
  Effect.acquireRelease(
    Effect.succeed({ active: true }),
    () => Effect.void
  )
)

// ----------------------------------------------------------------------------
// 1. Request pipeline: DI + read-through cache + typed error recovery
// ----------------------------------------------------------------------------

// Models an HTTP handler: look up services, hit a read-through cache, fall
// back on a typed domain error and record a metric per request. Requests
// reuse 25 distinct ids so the cache warms up and most hits are cheap, like
// production traffic.
const requestPipeline = Effect.gen(function*() {
  const repo = yield* UserRepo
  const metrics = yield* Metrics
  const cache = new Map<number, User>()
  const hits = yield* Ref.make(0)

  const handle = Effect.fnUntraced(function*(id: number) {
    const cached = cache.get(id)
    if (cached !== undefined) {
      yield* Ref.update(hits, (n) => n + 1)
      return cached.name
    }
    const user = yield* repo.findById(id).pipe(
      Effect.catchTag("UserNotFound", () => Effect.succeed(anonymous)),
      Effect.tap(() => metrics.increment("user.lookup"))
    )
    cache.set(id, user)
    return user.name
  })

  yield* Effect.forEach(ids, (i) => handle(i % 25), { discard: true })
  return yield* Ref.get(hits)
})

// ----------------------------------------------------------------------------
// 2. Concurrent fan-out: structured concurrency over a batch
// ----------------------------------------------------------------------------

// Models loading a page of profiles: a bounded pool of 16 workers, each
// request fanning out to three sub-fetches that run concurrently and are
// joined back into a single record.
const concurrentFanOut = Effect.gen(function*() {
  const repo = yield* UserRepo

  const loadProfile = (id: number) =>
    Effect.all({
      user: repo.findById(id).pipe(
        Effect.catchTag("UserNotFound", () => Effect.succeed(anonymous))
      ),
      posts: Effect.yieldNow.pipe(Effect.as(id * 3)),
      settings: Effect.yieldNow.pipe(Effect.as(id % 2 === 0))
    }, { concurrency: "unbounded" })

  return yield* Effect.forEach(ids, loadProfile, { concurrency: 16 })
})

// ----------------------------------------------------------------------------
// 3. Producer/consumer: back-pressured queue with a worker pool
// ----------------------------------------------------------------------------

// Models a job system: one producer pushes jobs through a bounded queue
// (capacity 32, so back-pressure kicks in), four consumers drain it until the
// producer signals completion, and results accumulate in shared state.
const producerConsumer = Effect.gen(function*() {
  const queue = yield* Queue.bounded<number, Cause.Done>(32)
  const processed = yield* Ref.make(0)

  const producer = Queue.offerAll(queue, ids).pipe(
    Effect.flatMap(() => Queue.end(queue))
  )

  const consume = Queue.take(queue).pipe(
    Effect.flatMap((job) =>
      Effect.yieldNow.pipe(
        Effect.flatMap(() => Ref.update(processed, (n) => n + job))
      )
    ),
    Effect.forever,
    Effect.catchTag("Done", () => Effect.void)
  )

  yield* Effect.forkChild(producer)
  const consumers = yield* Effect.forEach([1, 2, 3, 4], () => Effect.forkChild(consume))
  yield* Fiber.joinAll(consumers)
  return yield* Ref.get(processed)
})

// ----------------------------------------------------------------------------
// 4. Resilience: retry + timeout + hedged race
// ----------------------------------------------------------------------------

// Models calling a flaky upstream: the primary fails two calls out of three
// and is retried, the whole attempt is fenced by a timeout (which should not
// fire), and a slower-but-reliable replica is raced against it as a hedge.
const resilience = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  const flaky = Effect.gen(function*() {
    const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
    yield* Effect.yieldNow
    if (attempt % 3 !== 0) {
      return yield* new TransientError({ attempt })
    }
    return "primary"
  })

  const primary = flaky.pipe(
    Effect.retry({ times: 5 }),
    Effect.timeout("10 seconds")
  )

  const replica = Effect.yieldNow.pipe(
    Effect.flatMap(() => Effect.yieldNow),
    Effect.as("replica")
  )

  yield* Effect.forEach(ids, () => Effect.race(primary, replica), { discard: true })
})

// ----------------------------------------------------------------------------
// 5. Connection pool: layer-managed resources with limited parallelism
// ----------------------------------------------------------------------------

// Models database access through a pooled client: the pool connections are
// acquired and released by the layer around the workload, and 20 units of
// work each run five queries that contend for the pool's permits.
const pooledQueries = Effect.gen(function*() {
  const pool = yield* ConnectionPool

  yield* Effect.forEach(
    ids.slice(0, 20),
    () => Effect.forEach([1, 2, 3, 4, 5], (n) => pool.query(n)),
    { discard: true }
  )
})

// ----------------------------------------------------------------------------
// 6. Fork/join coordination: fibers synchronized through a Deferred
// ----------------------------------------------------------------------------

// Models a coordinated batch start: 25 workers are forked up front, all block
// on a Deferred until the coordinator releases them, then results are joined
// back in order.
const forkJoin = Effect.gen(function*() {
  const start = yield* Deferred.make<void>()

  const worker = (i: number) =>
    Deferred.await(start).pipe(
      Effect.flatMap(() => Effect.yieldNow),
      Effect.map(() => i * 2)
    )

  const fibers = yield* Effect.forEach(
    ids.slice(0, 25),
    (i) => Effect.forkChild(worker(i))
  )
  yield* Deferred.succeed(start, void 0)
  return yield* Fiber.joinAll(fibers)
})

// ----------------------------------------------------------------------------
// 7. Full application: everything combined
// ----------------------------------------------------------------------------

// Models a small service: a layer-managed listener resource, a queue fed by
// concurrent request producers, and a worker pool where each job goes through
// the cached repo lookup with retry and a timeout fence. This is the closest
// approximation of steady-state application behavior.
const fullApplication = Effect.gen(function*() {
  const repo = yield* UserRepo
  const metrics = yield* Metrics
  yield* Listener

  const queue = yield* Queue.bounded<number, Cause.Done>(32)
  const served = yield* Ref.make(0)
  const cache = new Map<number, User>()

  const handle = Effect.fnUntraced(function*(id: number) {
    const cached = cache.get(id)
    const user = cached !== undefined ? cached : yield* repo.findById(id).pipe(
      Effect.retry({ times: 2 }),
      Effect.timeout("10 seconds"),
      Effect.catchTag("UserNotFound", () => Effect.succeed(anonymous)),
      Effect.tap(() => metrics.increment("served"))
    )
    cache.set(id, user)
    yield* Ref.update(served, (n) => n + 1)
    return user.name
  })

  const worker = Queue.take(queue).pipe(
    Effect.flatMap((id) => handle(id % 25)),
    Effect.forever,
    Effect.catchTag("Done", () => Effect.void)
  )

  const workers = yield* Effect.forEach([1, 2, 3], () => Effect.forkChild(worker))

  yield* Effect.forEach(ids, (id) => Queue.offer(queue, id), {
    concurrency: 8,
    discard: true
  })
  yield* Queue.end(queue)
  yield* Fiber.joinAll(workers)

  return yield* Ref.get(served)
})

// ----------------------------------------------------------------------------
// Bench
// ----------------------------------------------------------------------------

// Each iteration provides the layers the workload needs, so layer build and
// teardown (resource lifecycles included) are part of the measured cost.

bench
  .add("request pipeline: DI + cache + error recovery (100 reqs)", async function() {
    await Effect.runPromise(Effect.provide(requestPipeline, [UserRepoLive, MetricsLive]))
  })
  .add("concurrent fan-out: forEach(16) x Effect.all (100 reqs)", async function() {
    await Effect.runPromise(Effect.provide(concurrentFanOut, [UserRepoLive]))
  })
  .add("producer/consumer: bounded queue, 4 workers (100 jobs)", async function() {
    await Effect.runPromise(producerConsumer)
  })
  .add("resilience: retry + timeout + hedged race (100 reqs)", async function() {
    await Effect.runPromise(resilience)
  })
  .add("connection pool: layered resources + semaphore (20 units x 5 queries)", async function() {
    await Effect.runPromise(Effect.provide(pooledQueries, [ConnectionPoolLive]))
  })
  .add("fork/join: 25 fibers gated on a Deferred", async function() {
    await Effect.runPromise(forkJoin)
  })
  .add("full application: layers + queue + workers + retry (100 reqs)", async function() {
    await Effect.runPromise(Effect.provide(fullApplication, [UserRepoLive, MetricsLive, ListenerLive]))
  })

await bench.run()

console.table(bench.table())
