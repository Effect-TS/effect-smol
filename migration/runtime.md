# Runtime: `Runtime<R>` Removed

In v3, `Runtime<R>` bundled a `Context<R>`, `RuntimeFlags`, and `FiberRefs`
into a single value used to execute effects:

```ts
// v3
interface Runtime<in R> {
  readonly context: Context.Context<R>
  readonly runtimeFlags: RuntimeFlags
  readonly fiberRefs: FiberRefs
}
```

In v4, this type no longer exists and you can use `ServiceMap<R>` instead.
Run functions live directly on `Effect`, and the `Runtime` module is reduced to
process lifecycle utilities.

## `Runtime.runFork(runtime)` -> `Effect.runForkWith(services)`

In v3, running an effect with dependencies usually meant building a
`Runtime.Runtime<R>` value and calling `Runtime.runFork(runtime)`.

**v3**

```ts
import { Context, Effect, Runtime } from "effect"

class Logger extends Context.Tag("Logger")<Logger, {
  readonly log: (message: string) => void
}>() {}

const runtime: Runtime.Runtime<Logger> = Runtime.defaultRuntime.pipe(
  Runtime.provideService(Logger, {
    log: (message) => console.log(message)
  })
)

const program = Effect.gen(function*() {
  const logger = yield* Logger
  logger.log("Hello from Logger")
})

const fiber = Runtime.runFork(runtime)(program)
```

In v4, you pass a `ServiceMap<R>` directly to the run function:

**v4**

```ts
import { Effect, ServiceMap } from "effect"

class Logger extends ServiceMap.Service<Logger, {
  readonly log: (message: string) => void
}>()("Logger") {}

const services = ServiceMap.make(Logger, {
  log: (message) => console.log(message)
})

const program = Effect.gen(function*() {
  const logger = yield* Logger
  logger.log("Hello from Logger")
})

const fiber = Effect.runForkWith(services)(program)
```

If your effect has no service requirements, use `Effect.runFork(effect)`.

## `Runtime` Module Contents

The `Runtime` module now only contains:

- `Teardown` — interface for handling process exit
- `defaultTeardown` — default teardown implementation
- `makeRunMain` — creates platform-specific main runners
