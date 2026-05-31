import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { Cause, Context, Effect, Exit, Layer, Tracer } from "effect"

// Two services mirroring a real app: `Svc` grabs `Repo` at make-time and calls
// it, so a failure should surface a nested `@svc/Repo.find` -> `@svc/Svc.load`
// chain once the instrumenting tracer is installed. Services are built with
// `Layer.effect` — the idiomatic path — so every `yield* Svc` resolves through
// the tracer's `context` hook and is wrapped.
interface RepoShape {
  readonly find: (id: number) => Effect.Effect<number>
}
class Repo extends Context.Service<Repo, RepoShape>()("@svc/Repo") {}

interface SvcShape {
  readonly load: (id: number) => Effect.Effect<number>
}
class Svc extends Context.Service<Svc, SvcShape>()("@svc/Svc") {}

const RepoOk = Layer.succeed(Repo, { find: (id) => Effect.succeed(id * 2) })
const RepoFail = Layer.succeed(Repo, { find: () => Effect.fail("db down") })

const SvcLayer = Layer.effect(
  Svc,
  Effect.gen(function*() {
    const repo = yield* Repo
    return { load: (id: number) => repo.find(id) }
  })
)

const tracer = Tracer.instrumenting({ match: (key) => key.startsWith("@svc/") })

// A failed cause carries a `Cause.StackTrace` annotation: a `StackFrame` linked
// list of `{ name, parent }`. Walk `parent` to recover the span names, innermost
// first. Mirrors the idiom in Effect.test.ts's "tracing" describe.
interface Frame {
  readonly name: string
  readonly parent: Frame | undefined
}
const spanNames = (cause: Cause.Cause<unknown>): ReadonlyArray<string> => {
  const names: Array<string> = []
  let frame = Context.getUnsafe(Cause.annotations(cause), Cause.StackTrace) as Frame | undefined
  while (frame !== undefined) {
    names.push(frame.name)
    frame = frame.parent
  }
  return names
}

describe("Tracer.instrumenting", () => {
  it.effect("wraps a matched service method in a span named key.method", () =>
    Effect.gen(function*() {
      // A failure inside `find` carries a single-frame span chain named after
      // the method — proof the wrapper ran.
      const cause = yield* Effect.gen(function*() {
        const repo = yield* Repo
        return yield* repo.find(1)
      }).pipe(
        Effect.provide(RepoFail),
        Effect.withTracer(tracer),
        Effect.sandbox,
        Effect.flip
      )
      deepStrictEqual(spanNames(cause), ["@svc/Repo.find"])
    }))

  it.effect("captures make-time deps: the nested chain is traced", () =>
    Effect.gen(function*() {
      const cause = yield* Effect.gen(function*() {
        const svc = yield* Svc
        return yield* svc.load(1)
      }).pipe(
        Effect.provide(SvcLayer.pipe(Layer.provide(RepoFail))),
        // installed OUTSIDE provide, so the layer build's make-time `yield* Repo`
        // resolves the wrapped repo too
        Effect.withTracer(tracer),
        Effect.sandbox,
        Effect.flip
      )
      // `find` runs inside `load`, so it is the innermost span (first), with
      // `load` as its ancestor.
      deepStrictEqual(spanNames(cause), ["@svc/Repo.find", "@svc/Svc.load"])
    }))

  it.effect("unmatched services are untouched", () =>
    Effect.gen(function*() {
      const result = yield* Effect.gen(function*() {
        const repo = yield* Repo
        return yield* repo.find(21)
      }).pipe(
        Effect.provide(RepoOk),
        Effect.withTracer(Tracer.instrumenting({ match: () => false })),
        Effect.exit
      )
      deepStrictEqual(result, Exit.succeed(42))
    }))

  it.effect("spans nest correctly across parallel fibers, no bleeding", () =>
    Effect.gen(function*() {
      // Each concurrent branch fails through its own service method; every
      // branch's cause must carry its OWN nested chain, not a sibling's.
      const chains = yield* Effect.forEach(
        [1, 2, 3],
        (n) =>
          Effect.gen(function*() {
            const svc = yield* Svc
            return yield* svc.load(n)
          }).pipe(Effect.sandbox, Effect.flip, Effect.map(spanNames)),
        { concurrency: "unbounded" }
      ).pipe(
        Effect.provide(SvcLayer.pipe(Layer.provide(RepoFail))),
        Effect.withTracer(tracer)
      )
      for (const names of chains) {
        deepStrictEqual(names, ["@svc/Repo.find", "@svc/Svc.load"])
      }
    }))
})
