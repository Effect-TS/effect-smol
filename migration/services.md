# Services: `Context.Tag` → `ServiceMap.Service`

In v3, services were defined using `Context.Tag`, `Context.GenericTag`,
`Effect.Tag`, or `Effect.Service`. In v4, all of these have been replaced by
`ServiceMap.Service`.

The underlying data structure has also changed: `Context` has been replaced by
`ServiceMap` — a typed map from service identifiers to their implementations.

## Defining Services

**v3: `Context.GenericTag`**

```ts
import { Context } from "effect"

interface Database {
  readonly query: (sql: string) => string
}

const Database = Context.GenericTag<Database>("Database")
```

**v4: `ServiceMap.Service` (function syntax)**

```ts
import { ServiceMap } from "effect"

interface Database {
  readonly query: (sql: string) => string
}

const Database = ServiceMap.Service<Database>("Database")
```

## Class-Based Services

**v3: `Context.Tag` class syntax**

```ts
import { Context } from "effect"

class Database extends Context.Tag("Database")<Database, {
  readonly query: (sql: string) => string
}>() {}
```

**v4: `ServiceMap.Service` class syntax**

```ts
import { ServiceMap } from "effect"

class Database extends ServiceMap.Service<Database, {
  readonly query: (sql: string) => string
}>()("Database") {}
```

Note the difference in argument order: in v3, the identifier string is passed to
`Context.Tag(id)` before the type parameters. In v4, the type parameters come
first via `ServiceMap.Service<Self, Shape>()` and the identifier string is
passed to the returned constructor `(id)`.

## `Effect.Tag` → `ServiceMap.Service`

v3's `Effect.Tag` provided proxy access to service methods as static properties
on the tag class. This pattern no longer exists in v4. Use `ServiceMap.Service`
and access service methods via `yield*`.

**v3**

```ts
import { Effect } from "effect"

class Notifications extends Effect.Tag("Notifications")<Notifications, {
  readonly notify: (message: string) => Effect.Effect<void>
}>() {}

// Static proxy access
const program = Notifications.notify("hello")
```

**v4**

```ts
import { Effect, ServiceMap } from "effect"

class Notifications extends ServiceMap.Service<Notifications, {
  readonly notify: (message: string) => Effect.Effect<void>
}>()("Notifications") {}

const program = Effect.gen(function*() {
  const notifications = yield* Notifications
  yield* notifications.notify("hello")
})
```

## `Effect.Service` → `ServiceMap.Service` with `make`

v3's `Effect.Service` allowed defining a service with an effectful constructor
and dependencies inline. In v4, use `ServiceMap.Service` with a `make` option.

**v3**

```ts
import { Effect, Layer } from "effect"

class Logger extends Effect.Service<Logger>()("Logger", {
  effect: Effect.gen(function*() {
    const config = yield* Config
    return { log: (msg: string) => Effect.log(`[${config.prefix}] ${msg}`) }
  }),
  dependencies: [Config.Default]
}) {}
```

**v4**

```ts
import { Effect, ServiceMap } from "effect"

class Logger extends ServiceMap.Service<Logger>()("Logger", {
  make: Effect.gen(function*() {
    const config = yield* Config
    return { log: (msg: string) => Effect.log(`[${config.prefix}] ${msg}`) }
  })
}) {}
```

Note: the `dependencies` option is no longer part of the service definition.
Provide dependencies via `Layer` composition instead.

## References (Services with Defaults)

**v3: `Context.Reference`**

```ts
import { Context } from "effect"

class LogLevel extends Context.Reference<LogLevel>()("LogLevel", {
  defaultValue: () => "info" as const
}) {}
```

**v4: `ServiceMap.Reference`**

```ts
import { ServiceMap } from "effect"

const LogLevel = ServiceMap.Reference<"info" | "warn" | "error">("LogLevel", {
  defaultValue: () => "info" as const
})
```

## Quick Reference

| v3                                    | v4                                         |
| ------------------------------------- | ------------------------------------------ |
| `Context.GenericTag<T>(id)`           | `ServiceMap.Service<T>(id)`                |
| `Context.Tag(id)<Self, Shape>()`      | `ServiceMap.Service<Self, Shape>()(id)`    |
| `Effect.Tag(id)<Self, Shape>()`       | `ServiceMap.Service<Self, Shape>()(id)`    |
| `Effect.Service<Self>()(id, opts)`    | `ServiceMap.Service<Self>()(id, { make })` |
| `Context.Reference<Self>()(id, opts)` | `ServiceMap.Reference<T>(id, opts)`        |
| `Context.make(tag, impl)`             | `ServiceMap.make(tag, impl)`               |
| `Context.get(ctx, tag)`               | `ServiceMap.get(map, tag)`                 |
| `Context.add(ctx, tag, impl)`         | `ServiceMap.add(map, tag, impl)`           |
| `Context.mergeAll(...)`               | `ServiceMap.mergeAll(...)`                 |
