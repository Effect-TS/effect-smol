# ConfigProvider

A `ConfigProvider` exposes one operation to navigate configuration data and read values.

```ts
interface ConfigProvider extends Pipeable {
  /**
   * Returns the node found at `path`, or `undefined` if it does not exist.
   * Fails with `GetError` when the underlying source cannot be read.
   */
  readonly get: (path: Path) => Effect<Stat | undefined, GetError>
}
```

- **Path**
  A path is a list of segments. Use **strings** for object keys and **numbers** for array indices.

  ```ts
  type Path = ReadonlyArray<string | number>
  ```

- **Stat**
  Describes what exists at a path. If the path does not exist, `get` resolves to `undefined`.

  ```ts
  type Stat =
    // terminal string value
    | { readonly _tag: "leaf"; readonly value: string }
    // object container; keys are unordered
    | { readonly _tag: "object"; readonly keys: ReadonlyArray<string> }
    // array-like container; `length` is the number of elements
    | { readonly _tag: "array"; readonly length: number }
  ```

- **GetError**
  Returned when the provider cannot read a value due to an underlying failure (I/O, permissions, and similar).

Why a stat result instead of the full value?

- `Stat` tells you the **kind** of node at a path without loading everything under it.
- This mirrors filesystem APIs where you first check what a path is (file or directory) and then decide how to read it.

## Filesystem Analogy

- **Path navigation**: As with a filesystem (`/usr/local/bin`, `C:\Program Files\App`), you navigate config with paths like `["database", "host"]` or `["api", "endpoints", 0]`.
- **Stat-like response**: `get` returns metadata about what exists at that path:
  - **Leaf** → similar to a regular file (it holds a value).
  - **Object** → similar to a directory (it holds named entries).
  - **Array** → similar to a directory with numbered entries.

- **Virtual filesystem**: The provider hides the actual source (environment variables, files, and so on) behind a unified interface.
- **Behavior**:
  - Returns `undefined` when a path is missing.
  - Returns the node type and basic structure when present.
  - Does not return nested content for containers (similar to `stat` not reading file contents).

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
