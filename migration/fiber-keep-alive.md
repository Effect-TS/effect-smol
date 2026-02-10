# Fiber Keep-Alive: Automatic Process Lifetime Management

In v3, the core `effect` runtime did **not** keep the Node.js process alive while
fibers were suspended on asynchronous operations. If a fiber was waiting on
something like `Deferred.await` and there was no other work scheduled on the
event loop, the process would exit immediately — the fiber's suspension did not
register as pending work from Node.js's perspective.

The only way to prevent this was to use `runMain` from `@effect/platform-node`
(or `@effect/platform-bun`), which installed a long-lived `setInterval` timer
to hold the process open until the root fiber completed.

In v4, **the keep-alive mechanism is built into the core runtime**. Any
asynchronous operation — `Deferred.await`, `Effect.callback`, `Effect.never`,
etc. — automatically keeps the process alive while the fiber is suspended. This
works regardless of how you run the program (`Effect.runPromise`,
`Effect.runFork`, or `runMain`).

## The Problem in v3

Consider a program that forks a background fiber, then waits on a `Deferred`:

```ts
import { Deferred, Effect, Fiber } from "effect"

const program = Effect.gen(function*() {
  const deferred = yield* Deferred.make<string>()

  const worker = yield* Effect.fork(
    Effect.delay(Effect.succeed("done"), "2 seconds").pipe(
      Effect.flatMap((value) => Deferred.succeed(deferred, value))
    )
  )

  // Wait for the deferred to be completed by the worker
  const result = yield* deferred // v3: Deferred is an Effect subtype
  console.log(result)
})

Effect.runPromise(program)
```

In v3, when the main fiber reached `yield* deferred`, it suspended — waiting for
the worker to complete the deferred. But from Node.js's perspective, there was
nothing keeping the event loop alive (the `Effect.delay` was implemented via the
Effect scheduler, not a raw `setTimeout` visible to Node.js). The process would
exit before the worker had a chance to complete.

The workaround was to use `runMain` from the platform package:

```ts
import { NodeRuntime } from "@effect/platform-node"

NodeRuntime.runMain(program)
```

`runMain` installed a `setInterval(constVoid, 2 ** 31 - 1)` timer that held the
process open until the root fiber completed, then cleared it.

## What Changed in v4

In v4, the async primitive (`Effect.callback`, which underlies `Deferred.await`,
`Effect.never`, and all other async operations) automatically manages a
reference-counted keep-alive timer:

1. When a fiber suspends on an async operation, the runtime increments a counter
   and starts a `setInterval` timer (if one is not already running).
2. When the fiber resumes, the counter is decremented.
3. When the counter reaches zero (no fibers are suspended), the timer is cleared
   and the process is free to exit.

This means the following program works correctly in v4 **without** `runMain`:

```ts
import { Deferred, Effect, Fiber } from "effect"

const program = Effect.gen(function*() {
  const deferred = yield* Deferred.make<string>()

  const worker = yield* Effect.forkChild(
    Effect.delay(Effect.succeed("done"), "2 seconds").pipe(
      Effect.flatMap((value) => Deferred.succeed(deferred, value))
    )
  )

  // The process stays alive while waiting — no runMain needed
  const result = yield* Deferred.await(deferred)
  console.log(result) // "done"
})

Effect.runPromise(program)
```

Note the two v4 changes visible in the example above (covered in their own
migration guides):

- `Effect.fork` → `Effect.forkChild`
- `yield* deferred` → `yield* Deferred.await(deferred)` (Deferred is no longer
  an Effect subtype)

## When Does This Matter?

The keep-alive change affects any program where a fiber is suspended with no
other visible event-loop work. Common cases:

- **Waiting on a `Deferred`** that will be completed by another fiber or an
  external event.
- **`Effect.never`** — in v3 this had its own dedicated `setInterval` to stay
  alive. In v4, it uses `Effect.callback` like everything else and benefits from
  the shared keep-alive.
- **Long-running servers** — a server that calls `Effect.never` to keep running
  after setup no longer needs special handling.
- **`Effect.runFork` followed by `Fiber.join`** — the forked fiber's async
  operations keep the process alive automatically.

## `runMain` Is Still Recommended

Even though the core runtime now handles keep-alive, `runMain` from the platform
packages is still the recommended way to run Effect programs. It provides:

- **Signal handling** — listens for `SIGINT` / `SIGTERM` and interrupts the
  root fiber gracefully.
- **Exit code management** — calls `process.exit(code)` when the program fails
  or receives a signal.
- **Error reporting** — reports unhandled errors to the console.

The difference is that `runMain` in v4 **no longer needs its own keep-alive
timer** — it delegates to the core runtime's built-in mechanism.
