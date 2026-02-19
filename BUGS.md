# Bugs Found During v3→v4 Migration

Issues that appear to be unintended behavior (not just API changes).

---

## 1. `ChildProcess.spawn` + `Stream.runFold` Deadlocks on Large Output

**Severity:** High — causes test timeouts and production hangs

When spawning a process that produces large stdout output (>50KB), reading the stream via `Stream.runFold` or `Stream.decodeText` inside `Effect.scoped` deadlocks. The process waits for its stdout buffer to drain, but the stream consumer never completes.

```ts
// Deadlocks with large output
Effect.scoped(
  Effect.gen(function* () {
    const cmd = ChildProcess.make("bash", ["-c", "seq 1 10000"])
    const handle = yield* ChildProcess.spawn(cmd)
    const stdout = yield* handle.stdout.pipe(
      Stream.decodeText(),
      Stream.runFold(() => "", (acc, chunk) => acc + chunk),
    )
    // ^ never completes
  }),
)
```

**Also affects:** `ChildProcess.string(cmd)` — hangs with any non-trivial output.

**Workaround:** Use `Bun.spawn` directly:
```ts
Effect.tryPromise({
  try: async () => {
    const proc = Bun.spawn(["bash", "-c", cmd], { stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    await proc.exited
    return { stdout, stderr }
  },
  catch: (e) => e as Error,
})
```

**Tested with:** `@effect/platform-bun@4.0.0-beta.5`, `effect@4.0.0-beta.5`, Bun 1.3.9, macOS 24.6.0

---

## 2. `Stream.fromQueue` Rejects `PubSub.Subscription`

**Severity:** Medium — breaks common PubSub subscription pattern

`PubSub.subscribe` returns `Subscription<A>`, but `Stream.fromQueue` expects `Dequeue<A, E>`. In v3, `Subscription` extended `Dequeue`. In v4, it doesn't — they're unrelated types.

```ts
const queue = yield* PubSub.subscribe(pubsub)
Stream.fromQueue(queue) // Type error: Subscription not assignable to Dequeue
```

**Workaround:** Use `Stream.fromSubscription(queue)` or `Stream.fromPubSub(pubsub)`.

**Note:** `Stream.fromSubscription` exists and works, but the migration from `Stream.fromQueue` is not obvious since `fromQueue` still exists and the type error message doesn't suggest the alternative.

---

## 3. `Effect.tap` Callback No Longer Accepts `void` Return

**Severity:** Low — but breaks many existing patterns

In v3, `Effect.tap(() => { sideEffect() })` worked (void return). In v4, the callback must return an `Effect`. This is not documented in the migration guide and silently changes semantics — the void return compiles but may produce runtime issues.

```ts
// v3 — worked
Effect.tap(() => { console.log("hi") })

// v4 — must wrap
Effect.tap(() => Effect.sync(() => { console.log("hi") }))
```

If this is intentional, it should be in the migration guide.
