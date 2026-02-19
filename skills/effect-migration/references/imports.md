# Import Path Rewrites

## `@effect/platform` → `"effect"` (stable)

| v3 | v4 |
|----|----|
| `import { FileSystem } from "@effect/platform"` | `import { FileSystem } from "effect"` |
| `import { Path } from "@effect/platform"` | `import { Path } from "effect"` |
| `import type { PlatformError } from "@effect/platform/Error"` | `import { PlatformError } from "effect"` |

### PlatformError Gotcha

v4: `import { PlatformError } from "effect"` gives a **namespace**, not a class.

```ts
// WRONG — type-only import of a namespace
import type { PlatformError } from "effect"
Layer.Layer<Foo, PlatformError, Bar>

// RIGHT — value import, access the class
import { PlatformError } from "effect"
Layer.Layer<Foo, PlatformError.PlatformError, Bar>
```

## `@effect/platform` → `"effect/unstable/http"`

| v3 | v4 |
|----|----|
| `{ HttpClient } from "@effect/platform"` | `{ HttpClient } from "effect/unstable/http"` |
| `{ FetchHttpClient } from "@effect/platform"` | `{ FetchHttpClient } from "effect/unstable/http"` |
| `{ HttpClientRequest } from "@effect/platform"` | `{ HttpClientRequest } from "effect/unstable/http"` |
| `{ HttpRouter } from "@effect/platform"` | `{ HttpRouter } from "effect/unstable/http"` |
| `{ HttpServer } from "@effect/platform"` | `{ HttpServer } from "effect/unstable/http"` |
| `{ HttpServerResponse } from "@effect/platform"` | `{ HttpServerResponse } from "effect/unstable/http"` |
| `{ HttpLayerRouter } from "@effect/platform"` | `{ HttpRouter } from "effect/unstable/http"` (renamed) |

## `@effect/platform` → `"effect/unstable/httpapi"`

| v3 | v4 |
|----|----|
| `{ HttpApi, HttpApiEndpoint, HttpApiGroup }` | `from "effect/unstable/httpapi"` |
| `{ HttpApiBuilder, HttpApiScalar }` | `from "effect/unstable/httpapi"` |
| `{ OpenApi }` | `from "effect/unstable/httpapi"` |

## `@effect/platform` → `"effect/unstable/process"`

| v3 | v4 |
|----|----|
| `{ Command } from "@effect/platform"` | `{ ChildProcess } from "effect/unstable/process"` |

## `@effect/sql/*` → `"effect/unstable/sql"`

```ts
// v3
import { SqlClient } from "@effect/sql/SqlClient"
import { SqlError } from "@effect/sql/SqlError"

// v4
import { SqlClient } from "effect/unstable/sql/SqlClient"
import { SqlError } from "effect/unstable/sql/SqlError"
```

Driver packages (`@effect/sql-sqlite-bun`, `@effect/sql-pg`) stay separate.

## `@effect/rpc` → `"effect/unstable/rpc"`

```ts
// v3                                    // v4
import { Rpc, RpcGroup } from           import { Rpc, RpcGroup, RpcServer } from
  "@effect/rpc"                            "effect/unstable/rpc"
```

## `@effect/cluster` → `"effect/unstable/cluster"`

```ts
// v3                                    // v4
import * as Entity from                  import { Entity, Sharding } from
  "@effect/cluster/Entity"                 "effect/unstable/cluster"
```

## `@effect/cli` → `"effect/unstable/cli"`

```ts
// v3                                    // v4
import { Command, Options, Args }        import { Command, Flag, Argument }
  from "@effect/cli"                       from "effect/unstable/cli"
```

## `@effect/platform-bun`

| v3 | v4 |
|----|----|
| `BunContext` | `BunServices` |
| `BunContext.layer` | `BunServices.layer` |

`BunServices.layer` provides FileSystem, Path, Terminal, ChildProcessSpawner, Stdio.

## Removed Subpaths

| v3 | v4 |
|----|----|
| `import { ConfigError } from "effect/ConfigError"` | `Config.ConfigError` from `"effect"` |
| `import { globalValue } from "effect/GlobalValue"` | Module-level lazy singleton |
