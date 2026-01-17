# AI Codegen Tool - Design

## Module Architecture

```
packages/tools/ai-codegen/
├── src/
│   ├── bin.ts                 # CLI entry point
│   ├── main.ts                # CLI command definitions
│   ├── Config.ts              # Configuration schema and parsing
│   ├── Discovery.ts           # Provider discovery service
│   ├── SpecFetcher.ts         # Fetch specs from URL or filesystem
│   ├── Generator.ts           # Code generation orchestration
│   └── PostProcess.ts         # Lint and format execution
├── package.json
├── tsconfig.json
└── docgen.json
```

## Effect Library Patterns

### Effect.fn / Effect.fnUntraced Convention

All functions returning Effects MUST use `Effect.fn` or `Effect.fnUntraced`:

- **`Effect.fn("name")`**: For service methods and internal functions (adds tracing span)
- **`Effect.fnUntraced`**: For CLI handlers and one-off effects (no tracing overhead)
- **`Effect.fn.Return<A, E, R>`**: Only when explicit return type annotation is required

```typescript
// ✅ Correct - named Effect.fn for tracing
const fetch = Effect.fn("fetch")(function*(source: SpecSource) {
  // ...
})

// ✅ Correct - untraced for CLI handlers
Command.withHandler(Effect.fnUntraced(function*({ provider }) {
  // ...
}))

// ❌ Avoid - plain Effect.gen without Effect.fn wrapper
const fetch = (source: SpecSource) =>
  Effect.gen(function*() {
    // ...
  })
```

### Service Definitions

All services use `ServiceMap.Service` pattern consistent with codebase:

```typescript
// Config.ts
export class CodegenConfig extends Schema.Class<CodegenConfig>("CodegenConfig")({
  spec: Schema.String,
  output: Schema.String,
  name: Schema.optional(Schema.String),
  typeOnly: Schema.optional(Schema.Boolean),
  patches: Schema.optional(Schema.Array(Schema.String))
}) {
  get clientName(): string {
    return this.name ?? "Client"
  }
  get isTypeOnly(): boolean {
    return this.typeOnly ?? false
  }
}

// Discovery.ts
export interface ProviderDiscovery {
  readonly discover: () => Effect.Effect<Array<DiscoveredProvider>, DiscoveryError>
  readonly discoverOne: (name: string) => Effect.Effect<DiscoveredProvider, DiscoveryError>
}

export const ProviderDiscovery: ServiceMap.Service<ProviderDiscovery, ProviderDiscovery> = ServiceMap.Service(
  "@effect/ai-codegen/ProviderDiscovery"
)

// SpecFetcher.ts
export interface SpecFetcher {
  readonly fetch: (source: SpecSource) => Effect.Effect<unknown, SpecFetchError>
}

export const SpecFetcher: ServiceMap.Service<SpecFetcher, SpecFetcher> = ServiceMap.Service(
  "@effect/ai-codegen/SpecFetcher"
)

// Generator.ts
export interface CodeGenerator {
  readonly generate: (provider: DiscoveredProvider, spec: unknown) => Effect.Effect<string, GenerationError>
}

export const CodeGenerator: ServiceMap.Service<CodeGenerator, CodeGenerator> = ServiceMap.Service(
  "@effect/ai-codegen/CodeGenerator"
)

// Patches are parsed and applied before generation
// Uses @effect/openapi-generator/OpenApiPatch for patch parsing and application

// PostProcess.ts
export interface PostProcessor {
  readonly lint: (filePath: string) => Effect.Effect<void, PostProcessError>
  readonly format: (filePath: string) => Effect.Effect<void, PostProcessError>
}

export const PostProcessor: ServiceMap.Service<PostProcessor, PostProcessor> = ServiceMap.Service(
  "@effect/ai-codegen/PostProcessor"
)
```

## Type Safety Approach

### Tagged Errors

```typescript
// Config.ts
export class ConfigParseError extends Data.TaggedError("ConfigParseError")<{
  readonly path: string
  readonly cause: unknown
}> {}

export class ConfigNotFoundError extends Data.TaggedError("ConfigNotFoundError")<{
  readonly provider: string
  readonly expectedPath: string
}> {}

// Discovery.ts
export class DiscoveryError extends Data.TaggedError("DiscoveryError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ProviderNotFoundError extends Data.TaggedError("ProviderNotFoundError")<{
  readonly provider: string
  readonly available: ReadonlyArray<string>
}> {}

// SpecFetcher.ts
export class SpecFetchError extends Data.TaggedError("SpecFetchError")<{
  readonly provider: string
  readonly source: string
  readonly cause: unknown
}> {}

// Generator.ts
export class GenerationError extends Data.TaggedError("GenerationError")<{
  readonly provider: string
  readonly cause: unknown
}> {}

// PostProcess.ts
export class PostProcessError extends Data.TaggedError("PostProcessError")<{
  readonly step: "lint" | "format"
  readonly filePath: string
  readonly cause: unknown
}> {}
```

### No Type Assertions

- All JSON parsing via `Schema.decodeUnknown`
- File paths constructed via `Path` service
- Subprocess results typed via platform types

## Error Handling Strategy

### Generator Flow with Error Recovery

```typescript
const generateProvider = Effect.fn("generateProvider")(
  function*(provider: DiscoveredProvider) {
    const specFetcher = yield* SpecFetcher
    const generator = yield* CodeGenerator
    const postProcessor = yield* PostProcessor
    const fs = yield* FileSystem.FileSystem

    // Fetch spec (from URL or filesystem)
    const spec = yield* specFetcher.fetch(provider.specSource, provider.name)

    // Generate code
    const code = yield* generator.generate(provider, spec)

    // Write output
    yield* fs.writeFileString(provider.outputPath, code)

    // Post-process (lint then format)
    yield* postProcessor.lint(provider.outputPath)
    yield* postProcessor.format(provider.outputPath)

    return provider.outputPath
  }
)
```

### CLI Error Display

```typescript
const handleError = Effect.fn("handleError")(function*(error: unknown) {
  if (error instanceof ConfigNotFoundError) {
    yield* Console.error(`Config not found for provider "${error.provider}"`)
    yield* Console.error(`Expected: ${error.expectedPath}`)
    return yield* Effect.fail(new CliError.ExitCode(1))
  }

  if (error instanceof ProviderNotFoundError) {
    yield* Console.error(`Provider "${error.provider}" not found`)
    yield* Console.error(`Available: ${error.available.join(", ")}`)
    return yield* Effect.fail(new CliError.ExitCode(1))
  }

  // ... other error types
})
```

## Layer Composition

```typescript
// main.ts
const MainLayer = Layer.mergeAll(
  ProviderDiscovery.layer,
  SpecFetcher.layer,
  CodeGenerator.layer,
  PostProcessor.layer
).pipe(
  Layer.provide(Glob.layer),
  Layer.provide(OpenApiGenerator.layerTransformerSchema)
)

// CLI provides platform services (includes HttpClient)
const run = Command.run(cli, { version: "0.0.0" }).pipe(
  Effect.provide(MainLayer),
  Effect.provide(NodeServices.layer)
)
```

## CLI Design

### Command Structure (using effect/unstable/cli)

```typescript
// main.ts
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"

const providerFlag = Flag.string("provider").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("Generate for specific provider only"),
  Flag.optional
)

const skipLintFlag = Flag.boolean("skip-lint").pipe(
  Flag.withDescription("Skip Oxlint step")
)

const skipFormatFlag = Flag.boolean("skip-format").pipe(
  Flag.withDescription("Skip Dprint step")
)

const generate = Command.make("generate", {
  provider: providerFlag,
  skipLint: skipLintFlag,
  skipFormat: skipFormatFlag
}).pipe(
  Command.withHandler(Effect.fnUntraced(function*({ provider, skipLint, skipFormat }) {
    const discovery = yield* ProviderDiscovery
    const providers = yield* Option.match(provider, {
      onNone: () => discovery.discover(),
      onSome: (name) => discovery.discoverOne(name).pipe(Effect.map(Array.of))
    })

    yield* Effect.forEach(providers, (p) => generateProvider(p, { skipLint, skipFormat }), {
      concurrency: 1 // Sequential for clearer output
    })
  }))
)

const list = Command.make("list").pipe(
  Command.withHandler(Effect.fnUntraced(function*() {
    const discovery = yield* ProviderDiscovery
    const providers = yield* discovery.discover()

    for (const p of providers) {
      // Use ANSI colors for better readability
      yield* Console.log(`\x1b[1m\x1b[36m${p.name}\x1b[0m`) // Bold cyan provider name
      yield* Console.log(`  \x1b[90mspec:\x1b[0m ${p.config.spec}`)
      yield* Console.log(`  \x1b[90moutput:\x1b[0m ${p.config.output}`)
      yield* Console.log(`  \x1b[90mclient:\x1b[0m ${p.config.clientName}`)
      if (p.config.patches && p.config.patches.length > 0) {
        yield* Console.log(`  \x1b[90mpatches:\x1b[0m ${p.config.patches.length} file(s)`)
      }
    }
  }))
)

const cli = Command.make("effect-ai-codegen").pipe(
  Command.withSubcommands([generate, list])
)
```

## Testing Strategy

### Unit Tests (@effect/vitest)

```typescript
// test/Config.test.ts
import { assert, describe, it } from "@effect/vitest"

describe("Config", () => {
  describe("parse", () => {
    it.effect("parses valid config", () =>
      Effect.gen(function*() {
        const input = { spec: "openapi.json", output: "Generated.ts" }
        const config = yield* Schema.decodeUnknown(CodegenConfig)(input)

        assert.strictEqual(config.spec, "openapi.json")
        assert.strictEqual(config.output, "Generated.ts")
        assert.strictEqual(config.name, "Client") // default
        assert.strictEqual(config.typeOnly, false) // default
      }))

    it.effect("fails on missing required fields", () =>
      Effect.gen(function*() {
        const input = { spec: "openapi.json" } // missing output
        const result = yield* Schema.decodeUnknown(CodegenConfig)(input).pipe(Effect.exit)

        assert.isTrue(Exit.isFailure(result))
      }))
  })
})
```

### Integration Tests

```typescript
// test/Generator.test.ts
describe("Generator", () => {
  it.effect("generates code from spec", () =>
    Effect.gen(function*() {
      const generator = yield* CodeGenerator
      const provider: DiscoveredProvider = {
        name: "test",
        packagePath: "/tmp/test",
        config: { spec: "spec.json", output: "Out.ts", name: "TestClient", typeOnly: false },
        specPath: "/tmp/test/spec.json",
        outputPath: "/tmp/test/src/Out.ts"
      }

      // Would need mock spec file
      const code = yield* generator.generate(provider)

      assert.isTrue(code.includes("TestClient"))
    }).pipe(
      Effect.provide(CodeGenerator.layer),
      Effect.provide(TestLayer)
    ))
})
```

## JSDoc Documentation Plan

All public exports include:

- `@since 1.0.0`
- `@category` (models, errors, constructors, layers)
- `@example` with working code

````typescript
/**
 * Configuration for AI provider code generation.
 *
 * @example
 * ```ts
 * import { CodegenConfig } from "@effect/ai-codegen/Config"
 * import { Schema } from "effect"
 *
 * const config = Schema.decodeUnknownSync(CodegenConfig)({
 *   spec: "openapi.json",
 *   output: "Generated.ts",
 *   name: "OpenAiClient"
 * })
 * ```
 *
 * @since 1.0.0
 * @category models
 */
export class CodegenConfig extends Schema.Class<CodegenConfig>("CodegenConfig")({
  // ...
}) {}
````

## Code Examples

### SpecSource Type

```typescript
// Config.ts
export type SpecSource = SpecSource.Url | SpecSource.File

export declare namespace SpecSource {
  export interface Url {
    readonly _tag: "Url"
    readonly url: string
  }
  export interface File {
    readonly _tag: "File"
    readonly path: string
  }
}

export const SpecSource = {
  Url: (url: string): SpecSource => ({ _tag: "Url", url }),
  File: (path: string): SpecSource => ({ _tag: "File", path }),
  fromString: (spec: string, packagePath: string, pathService: Path.Path): SpecSource => {
    if (spec.startsWith("http://") || spec.startsWith("https://")) {
      return SpecSource.Url(spec)
    }
    return SpecSource.File(pathService.join(packagePath, spec))
  }
}
```

### Discovery Implementation

```typescript
// Discovery.ts
export const layer: Layer.Layer<ProviderDiscovery, never, Glob.Glob | FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const glob = yield* Glob.Glob
    const fs = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path

    const parseConfig = Effect.fn("parseConfig")(function*(configPath: string) {
      const packagePath = pathService.dirname(configPath)
      const name = pathService.basename(packagePath)
      const content = yield* fs.readFileString(configPath)
      const json = yield* Effect.try(() => JSON.parse(content))
      const config = yield* Schema.decodeUnknown(CodegenConfig)(json)

      return {
        name,
        packagePath,
        config,
        specSource: SpecSource.fromString(config.spec, packagePath, pathService),
        outputPath: pathService.join(packagePath, "src", config.output)
      }
    })

    const discover = Effect.fn("discover")(function*() {
      const configFiles = yield* glob.glob("packages/ai/*/codegen.json", {
        cwd: process.cwd(),
        absolute: true
      })

      return yield* Effect.forEach(configFiles, parseConfig)
    })

    const discoverOne = Effect.fn("discoverOne")(function*(providerName: string) {
      const providers = yield* discover()
      const found = providers.find((p) => p.name === providerName)

      if (!found) {
        return yield* Effect.fail(
          new ProviderNotFoundError({
            provider: providerName,
            available: providers.map((p) => p.name)
          })
        )
      }

      return found
    })

    return { discover, discoverOne }
  }
).pipe(Layer.effect(ProviderDiscovery))
```

### SpecFetcher Implementation

```typescript
// SpecFetcher.ts
export const layer: Layer.Layer<SpecFetcher, never, FileSystem.FileSystem | HttpClient.HttpClient> = Effect.gen(
  function*() {
    const fs = yield* FileSystem.FileSystem
    const httpClient = yield* HttpClient.HttpClient

    const fetchFromFile = Effect.fn("fetchFromFile")(function*(path: string, provider: string) {
      return yield* fs.readFileString(path).pipe(
        Effect.mapError((cause) => new SpecFetchError({ provider, source: path, cause }))
      )
    })

    const fetchFromUrl = Effect.fn("fetchFromUrl")(function*(url: string, provider: string) {
      return yield* httpClient.get(url).pipe(
        Effect.flatMap((response) => response.text),
        Effect.mapError((cause) => new SpecFetchError({ provider, source: url, cause }))
      )
    })

    const fetch = Effect.fn("fetch")(function*(source: SpecSource, provider: string) {
      const content = yield* Match.value(source).pipe(
        Match.tag("File", ({ path }) => fetchFromFile(path, provider)),
        Match.tag("Url", ({ url }) => fetchFromUrl(url, provider)),
        Match.exhaustive
      )

      const sourceString = source._tag === "Url" ? source.url : source.path
      return yield* Effect.try({
        try: () => JSON.parse(content),
        catch: (cause) => new SpecFetchError({ provider, source: sourceString, cause })
      })
    })

    return { fetch }
  }
).pipe(Layer.effect(SpecFetcher))
```

### PostProcessor Implementation

```typescript
// PostProcess.ts
export const layer: Layer.Layer<PostProcessor, never, Path.Path | CommandExecutor.CommandExecutor> = Effect.gen(
  function*() {
    const pathService = yield* Path.Path
    const executor = yield* CommandExecutor.CommandExecutor

    const runCommand = Effect.fn("runCommand")(function*(
      command: string,
      args: ReadonlyArray<string>
    ) {
      const cmd = Command.make(command, ...args).pipe(
        Command.workingDirectory(pathService.resolve(".")) // monorepo root
      )
      const process = yield* executor.start(cmd)
      const exitCode = yield* process.exitCode
      if (exitCode !== 0) {
        return yield* Effect.fail(exitCode)
      }
    })

    const lint = Effect.fn("lint")(function*(filePath: string) {
      yield* runCommand("npx", ["oxlint", "--fix", filePath]).pipe(
        Effect.mapError((cause) => new PostProcessError({ step: "lint", filePath, cause }))
      )
    })

    const format = Effect.fn("format")(function*(filePath: string) {
      yield* runCommand("npx", ["dprint", "fmt", filePath]).pipe(
        Effect.mapError((cause) => new PostProcessError({ step: "format", filePath, cause }))
      )
    })

    return { lint, format }
  }
).pipe(Layer.effect(PostProcessor))
```

## Integration Points

### With @effect/openapi-generator

```typescript
// Generator.ts
export const layer: Layer.Layer<CodeGenerator, never, OpenApiGenerator.OpenApiGenerator> = Effect.gen(function*() {
  const openApiGen = yield* OpenApiGenerator.OpenApiGenerator

  const generate = Effect.fn("generate")(function*(
    provider: DiscoveredProvider,
    spec: unknown
  ) {
    // Generate code (spec already fetched by SpecFetcher)
    return yield* openApiGen.generate(spec, {
      name: provider.config.name,
      typeOnly: provider.config.typeOnly
    }).pipe(
      Effect.mapError((cause) => new GenerationError({ provider: provider.name, cause }))
    )
  })

  return { generate }
}).pipe(Layer.effect(CodeGenerator))
```

## File Structure After Implementation

```
packages/tools/ai-codegen/
├── src/
│   ├── bin.ts              # #!/usr/bin/env node + run
│   ├── main.ts             # CLI definition, layer composition
│   ├── Config.ts           # CodegenConfig schema, SpecSource, parse errors
│   ├── Discovery.ts        # ProviderDiscovery service
│   ├── SpecFetcher.ts      # SpecFetcher service (URL + file)
│   ├── Generator.ts        # CodeGenerator service
│   └── PostProcess.ts      # PostProcessor service
├── test/
│   ├── Config.test.ts
│   ├── Discovery.test.ts
│   ├── SpecFetcher.test.ts
│   └── Generator.test.ts
├── package.json
├── tsconfig.json
└── docgen.json

packages/ai/openai/
├── codegen.yaml            # YAML or JSON config with spec URL, output, and optional patches
├── patches/                # Optional directory for JSON patch files
│   └── fix-schemas.json
└── src/
    └── Generated.ts        # Generated output (spec fetched from URL, not stored in VCS)
```
