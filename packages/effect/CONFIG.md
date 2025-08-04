# ConfigProvider

A `ConfigProvider` exposes a single operation used to navigate and read values.

```ts
interface ConfigProvider extends Pipeable {
  readonly get: (path: Path) => Effect<Node | undefined, GetError>
}
```

- **Path**. A path is a list of segments. Use **strings** for object keys and **numbers** for array indices.

  ```ts
  type Path = ReadonlyArray<string | number>
  ```

- **Node**. Describes what exists at a path. If the path does not exist, `get` resolves to `undefined`.

  ```ts
  type Node =
    // a terminal string value
    | { readonly _tag: "leaf"; readonly value: string }
    // an object; keys are unordered
    | { readonly _tag: "object"; readonly keys: ReadonlyArray<string> }
    // an array-like container; length is the number of elements
    | { readonly _tag: "array"; readonly length: number }
  ```

- **GetError**. Returned when the provider cannot read a value due to an underlying failure (I/O, permissions, etc.).

# Config

## Goals

- Configure the application with a single schema.
- Do not worry about how strings are decoded into typed values.
- Optionally customize how raw values are transformed before decoding.

**Example** (Config from a Schema)

The environment provides strings only, but you can describe the desired output using a schema. The library decodes strings into typed values (e.g., `Int`, `URL`) for you.

```ts
import { Effect } from "effect"
import { Config2, ConfigProvider2 } from "effect/config"
import { Formatter, Schema } from "effect/schema"

// Define the shape of the configuration you want to read.
// Each field declares the target type you expect in your program.
// - PORT will be parsed from string to an integer.
// - LOCALHOST will be parsed from string to a URL instance.
const config = Config2.schema(
  Schema.Struct({
    API_KEY: Schema.String,
    PORT: Schema.Int,
    LOCALHOST: Schema.URL
  })
)

// Simulated environment: all values are strings.
const environment = {
  API_KEY: "abc123",
  PORT: "1",
  LOCALHOST: "https://example.com"
}

// Create a provider that reads from the given environment object.
// In a real application you can omit `environment` to use process/env defaults.
const configProvider = ConfigProvider2.fromEnv({ environment })

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
          console.log("GetError", e.reason)
      }
    })
  ),
  // Supply the provider to the program.
  Effect.provide(ConfigProvider2.layer(configProvider))
)

// Run in the background (fire-and-forget for this example).
Effect.runFork(program)

// Output:
// { API_KEY: 'abc123', PORT: 1, LOCALHOST: https://example.com/ }
```
