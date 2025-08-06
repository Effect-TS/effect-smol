# Config

## Goals

- Configure the application with a single schema.
- Do not worry about how strings are decoded into typed values.
- Optionally customize how raw values are transformed before decoding.

## schema API

**Example** (Config from a Schema)

The environment provides strings only, but you can describe the desired output using a schema. The library decodes strings into typed values (e.g., `Int`, `URL`) for you.

```ts
import { Effect } from "effect"
import { Config, ConfigProvider } from "effect/config"
import { Formatter, Schema } from "effect/schema"

// Define the shape of the configuration you want to read.
// Each field declares the target type you expect in your program.
// - PORT will be parsed from string to an integer.
// - LOCALHOST will be parsed from string to a URL instance.
const config = Config.schema(
  Schema.Struct({
    API_KEY: Schema.String,
    PORT: Schema.Int,
    LOCALHOST: Schema.URL
  })
)

// Simulated environment: all values are strings.
const env = {
  API_KEY: "abc123",
  PORT: "1",
  LOCALHOST: "https://example.com"
}

// Create a provider that reads from the given environment object.
// In a real application you can omit `environment` to use process/env defaults.
const configProvider = ConfigProvider.fromEnv({ env })

// Program that reads the typed configuration once and logs it.
const program = Effect.gen(function* () {
  // `yield* config` runs the decoding using the active provider.
  const c = yield* config
  console.dir(c)
}).pipe(
  // Basic error reporter: pretty-prints schema errors,
  // prints a generic reason for non-schema errors.
  Effect.tapError((e) =>
    Effect.sync(() => {
      switch (e._tag) {
        case "SchemaError":
          console.log("SchemaError", Formatter.makeTree().format(e.issue))
          break
        default:
          console.log("SourceError", e.reason)
      }
    })
  ),
  // Supply the provider to the program.
  Effect.provide(ConfigProvider.layer(configProvider))
)

// Run in the background (fire-and-forget for this example).
Effect.runFork(program)

// Output:
// { API_KEY: 'abc123', PORT: 1, LOCALHOST: URL { href: 'https://example.com/' } }
```

The `schema` function accepts an optional second argument: the `path` from which to read the value.

- If omitted, the config is read from the root.
- The path can be a string or an array of strings.
- This is useful for reading a single nested value from a larger structure.

**Example** (Reading a value from the root)

```ts
import { Effect } from "effect"
import { Config, ConfigProvider } from "effect/config"
import { Formatter, Schema } from "effect/schema"

// Expecting a string at the root
const config = Config.schema(Schema.String)

// Provide a single value at the root
const configProvider = ConfigProvider.fromJson("value")

const program = Effect.gen(function* () {
  const c = yield* config
  console.dir(c)
}).pipe(
  Effect.tapError((e) =>
    Effect.sync(() => {
      switch (e._tag) {
        case "SchemaError":
          console.log("SchemaError", Formatter.makeTree().format(e.issue))
          break
        default:
          console.log("SourceError", e.reason)
      }
    })
  ),
  Effect.provide(ConfigProvider.layer(configProvider))
)

Effect.runFork(program)
// "value"
```

**Example** (Using a string path)

```ts
import { Effect } from "effect"
import { Config, ConfigProvider } from "effect/config"
import { Formatter, Schema } from "effect/schema"

// Read a string at path "a"
const config = Config.schema(Schema.String, "a")

const configProvider = ConfigProvider.fromJson({ a: "value" })

const program = Effect.gen(function* () {
  const c = yield* config
  console.dir(c)
}).pipe(
  Effect.tapError((e) =>
    Effect.sync(() => {
      switch (e._tag) {
        case "SchemaError":
          console.log("SchemaError", Formatter.makeTree().format(e.issue))
          break
        default:
          console.log("SourceError", e.reason)
      }
    })
  ),
  Effect.provide(ConfigProvider.layer(configProvider))
)

Effect.runFork(program)
// "value"
```

**Example** (Using an array path)

```ts
import { Effect } from "effect"
import { Config, ConfigProvider } from "effect/config"
import { Formatter, Schema } from "effect/schema"

// Read a string at nested path ["a", "b"]
const config = Config.schema(Schema.String, ["a", "b"])

const configProvider = ConfigProvider.fromJson({ a: { b: "value" } })

const program = Effect.gen(function* () {
  const c = yield* config
  console.dir(c)
}).pipe(
  Effect.tapError((e) =>
    Effect.sync(() => {
      switch (e._tag) {
        case "SchemaError":
          console.log("SchemaError", Formatter.makeTree().format(e.issue))
          break
        default:
          console.log("SourceError", e.reason)
      }
    })
  ),
  Effect.provide(ConfigProvider.layer(configProvider))
)

Effect.runFork(program)
// "value"
```
