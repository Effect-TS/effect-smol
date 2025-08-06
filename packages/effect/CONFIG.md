# ConfigProvider

A `ConfigProvider` exposes one operation to navigate configuration data and read values.

```ts
interface ConfigProvider extends Pipeable {
  /**
   * Returns the node found at `path`, or `undefined` if it does not exist.
   * Fails with `SourceError` when the underlying source cannot be read.
   */
  readonly get: (path: Path) => Effect.Effect<Stat | undefined, SourceError>
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
    | { readonly _tag: "object"; readonly keys: ReadonlySet<string> }
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

## fromEnv

### Rules of Interpretation

**R0 — Domain & Goal**

- Input: `Env = Record<string, string>` (pairs `NAME=VALUE`).
- Output: a single `StringLeafJson = string | { [k: string]: StringLeafJson } | ReadonlyArray<StringLeafJson>`.
- Each `NAME=VALUE` encodes **one string leaf** in a tree, except for **empty-container sentinels** (`__TYPE`).

**R1 — Path Segmentation**

- A variable **name** encodes a path of **segments** separated by `__` (two underscores).
  Example: `a__0__b__c=foo` → segments `["a","0","b","c"]`.
- Segment strings must be **non-empty** (no `a____b`). Empty segments are invalid.

**R2 — Building the Trie**

- Create a trie: every **prefix** of a path is a **node**.
- A node may carry:
  - a **leaf value** (string) if a `NAME=VALUE` ends exactly at that node;
  - a **type sentinel** if there is a `NAME__TYPE=O|A` for that node (see R7);
  - zero or more **children**.

**R3 — Role Exclusivity (conflicts)**

- A node **cannot** be both **leaf** and **container**.
  (`leaf value` together with `children` is **invalid**.)
- A node **cannot** have a `__TYPE` sentinel and also have **leaf** or **children** (see R7).

**R4 — Container Kind Disambiguation (per node)**

- Look at a container’s **immediate child names** (its next segments).
- Let `NUMERIC := ^(0|[1-9][0-9]*)$` (no leading zeros, except `"0"`).
  - If **all** child names match `NUMERIC` → the node is an **array**.
  - If **any** child name is not `NUMERIC` → the node is an **object**.

**R5 — Arrays Must Be Dense**

- For an array node, the present indices must be **exactly** `0..max` with **no gaps**.
- For **array nodes**, indices must match `^(0|[1-9][0-9]*)$`; indices with **leading zeros** (e.g., `"01"`) are **invalid**.
  **Object** keys that look numeric (including `"01"`) are treated as **plain property names** (R6).

**R6 — Objects Use Segments As-Is**

- Object property names are **exactly** the segment strings (no escaping or decoding).
- Object property order is irrelevant.

**R7 — Empty Containers (Sentinels)**

- Empty containers are represented explicitly via a sentinel variable:
  - `…__TYPE=O` → an empty **O**bject `{}` at that path.
  - `…__TYPE=A` → an empty **A**rray `[]` at that path.

- A `__TYPE` **must not** coexist (same path) with either **leaf** or **children** (see R3).
- The root may also be empty: a single variable named `__TYPE` with value `O` or `A`.

**R8 — Root Shape**

- If there is at least one **multi-segment** name (contains `__`) or a root `__TYPE`, the root is a **container** determined by R4.
- A **root string** is **not representable** without a dedicated single variable name (namespace). This spec has **no namespace**, therefore **encoding a top-level string is an error**.
- When the input environment has **no variables at all**, the decoded value is the **empty object `{}`**.
  This is a permissive default and keeps the empty configuration representable.

**R9 — Duplicate Leaves**

- If multiple `NAME=VALUE` pairs map to the **same path** and their values differ, the input is **invalid**.

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
