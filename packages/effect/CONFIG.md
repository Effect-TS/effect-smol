# ConfigProvider

The `ConfigProvider` module provides a unified interface for reading configuration values from various sources. It abstracts over different configuration formats and provides a consistent API for accessing configuration data.

## Overview

A `ConfigProvider` is a service that can read configuration values from a hierarchical data structure. It works with a path-based navigation system where:

- **Paths** are arrays of strings or numbers that represent the location of a configuration value
- **Stats** describe the structure at a given path (leaf values, objects, or arrays)
- **Sources** can be environment variables, JSON files, file systems, or any custom data source

The module provides a composable architecture where providers can be:

- Combined using `orElse` for fallback behavior
- Transformed using `mapInput` for path mapping
- Nested using `nested` for adding prefixes
- Layered using Effect's layer system

## Core APIs

### `run`

Executes a configuration lookup at the specified path.

```ts
const result = await Effect.runPromise(provider.load(["database", "host"]))
```

The `run` function applies any configured `mapInput` transformations and `prefix` additions before performing the lookup.

### `nested`

Adds a prefix to all configuration paths. **Important**: The prefix is added directly without applying any `mapInput` transformations.

```ts
const nestedProvider = ConfigProvider.nested("app")(provider)
// This will look for "app__database__host" when you request ["database", "host"]
```

### `mapInput`

Transforms input paths before they are used for lookup. This transformation is applied to both the input path and any existing prefix.

```ts
const transformedProvider = ConfigProvider.mapInput((path) =>
  path.map((segment) => (typeof segment === "string" ? segment.toUpperCase() : segment))
)(provider)
```

**Key difference from `nested`**: `mapInput` transforms both the input path AND any existing prefix, while `nested` only adds a prefix without transformation.

## Configuration Sources

### `fromEnv`

Creates a `ConfigProvider` that reads from environment variables using a mini-language for representing hierarchical data.

#### Environment Variable Mini-Language

The `fromEnv` provider uses a simple but powerful mini-language for representing nested structures in environment variables:

**Basic Rules:**

- Use `__` (double underscore) to separate path segments
- Arrays use numeric indices (0, 1, 2, etc.)
- Objects use string keys
- Nodes can be both leaves and containers simultaneously

**Examples:**

```bash
# Simple key-value pairs
DATABASE_HOST=localhost
DATABASE_PORT=5432

# Nested objects
DATABASE__HOST=localhost
DATABASE__PORT=5432
DATABASE__CREDENTIALS__USERNAME=admin
DATABASE__CREDENTIALS__PASSWORD=secret

# Arrays
SERVERS__0=server1.example.com
SERVERS__1=server2.example.com
SERVERS__2=server3.example.com

# Mixed structures (node as both leaf and container)
DATABASE=default
DATABASE__HOST=localhost
DATABASE__PORT=5432

# Empty containers using __TYPE
EMPTY_ARRAY__TYPE=A
EMPTY_OBJECT__TYPE=O
```

**Array Constraints:**

- Arrays must be dense (indices 0, 1, 2, ..., n-1)
- Indices must be canonical (no leading zeros except "0")
- All children of an array node must be numeric indices

**Type Sentinels:**

- `__TYPE=A` creates an empty array
- `__TYPE=O` creates an empty object
- Type sentinels cannot coexist with children

**Validation Rules:**

- Duplicate leaf values must be identical
- Arrays must be dense (no gaps in indices)
- Type sentinels cannot have children

### `fromDotEnv`

Creates a `ConfigProvider` from a `.env` file content. This provider uses the same mini-language as `fromEnv` (see above).

**Features:**

- Supports comments (lines starting with `#`)
- Supports `export` keyword
- Handles quoted values (single, double, backticks)
- Optional variable expansion with `expandVariables: true`

**Example .env file:**

```bash
# Database configuration
DATABASE__HOST=localhost
DATABASE__PORT=5432
DATABASE__CREDENTIALS__USERNAME=admin
DATABASE__CREDENTIALS__PASSWORD=secret

# Server list
SERVERS__0=server1.example.com
SERVERS__1=server2.example.com

# With variable expansion
PASSWORD=secret
DB_PASS=$PASSWORD
```

### `fromJson`

Creates a `ConfigProvider` from a JSON object. Automatically converts all primitive values to strings.

```ts
const provider = ConfigProvider.fromJson({
  database: {
    host: "localhost",
    port: 5432,
    credentials: {
      username: "admin",
      password: "secret"
    }
  },
  servers: ["server1", "server2", "server3"]
})
```

### `fromStringLeafJson`

Creates a `ConfigProvider` from a `StringLeafJson` structure (where all leaf values are strings).

```ts
const provider = ConfigProvider.fromStringLeafJson({
  database: {
    host: "localhost",
    port: "5432"
  }
})
```

### `fromDir`

Creates a `ConfigProvider` from a file system tree structure.

**Resolution Rules:**

- **Regular files** → `{ _tag: "leaf", value }` (file content, trimmed)
- **Directories** → `{ _tag: "object", keys }` (immediate child names)
- **Not found** → `undefined`
- **I/O errors** → `SourceError`

**Example file structure:**

```
/config
  /database
    host.txt          # contains "localhost"
    port.txt          # contains "5432"
  /servers
    server1.txt       # contains "server1.example.com"
    server2.txt       # contains "server2.example.com"
```

This would be accessible as:

- `["database", "host"]` → `"localhost"`
- `["database", "port"]` → `"5432"`
- `["servers"]` → object with keys `["server1", "server2"]`

## Combinators

### `orElse`

Creates a fallback provider that tries the first provider, then falls back to the second if the first returns `undefined`.

```ts
const provider = ConfigProvider.orElse(primaryProvider, fallbackProvider)
```

### `constantCase`

Transforms input paths from kebab-case/snake-case to CONSTANT_CASE for environment variable compatibility.

```ts
const provider = ConfigProvider.constantCase(baseProvider)
// ["database", "host"] becomes ["DATABASE", "HOST"]
```

## Error Handling

All providers can fail with a `SourceError` when the underlying source cannot be read or is invalid. The error includes:

- `reason`: A human-readable error message
- `cause`: The underlying error (if any)

## Integration with Effect

ConfigProviders can be integrated into Effect applications using layers:

```ts
import { Effect } from "effect"
import { ConfigProvider } from "effect"

const provider = ConfigProvider.fromEnv({ env: { DATABASE_HOST: "localhost" } })

const program = Effect.gen(function*() {
  const provider = yield* ConfigProvider.ConfigProvider
  const host = yield* provider.load(["DATABASE_HOST"])
  console.log(host)
  return host
}).pipe(Effect.provide(ConfigProvider.layer(provider)))

Effect.runFork(program)
// { _tag: 'leaf', value: 'localhost' }
```

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
import { Config, ConfigProvider } from "effect"
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
const program = Effect.gen(function*() {
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
import { Config, ConfigProvider } from "effect"
import { Formatter, Schema } from "effect/schema"

// Expecting a string at the root
const config = Config.schema(Schema.String)

// Provide a single value at the root
const configProvider = ConfigProvider.fromJson("value")

const program = Effect.gen(function*() {
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
import { Config, ConfigProvider } from "effect"
import { Formatter, Schema } from "effect/schema"

// Read a string at path "a"
const config = Config.schema(Schema.String, "a")

const configProvider = ConfigProvider.fromJson({ a: "value" })

const program = Effect.gen(function*() {
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
import { Config, ConfigProvider } from "effect"
import { Formatter, Schema } from "effect/schema"

// Read a string at nested path ["a", "b"]
const config = Config.schema(Schema.String, ["a", "b"])

const configProvider = ConfigProvider.fromJson({ a: { b: "value" } })

const program = Effect.gen(function*() {
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
