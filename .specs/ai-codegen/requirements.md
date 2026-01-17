# AI Codegen Tool - Requirements

## FR1: Functional Requirements

### FR1.1 Configuration Discovery

- FR1.1.1: Tool MUST discover provider configs via glob `packages/ai/*/codegen.{json,yaml,yml}`
- FR1.1.2: Tool MUST support explicit provider selection via `--provider <name>` flag
- FR1.1.3: Tool MUST list all discovered providers with `list` command
- FR1.1.4: Tool MUST support both JSON and YAML configuration file formats

### FR1.2 Configuration Schema

- FR1.2.1: Config MUST specify `spec` field (URL or file path to OpenAPI spec)
- FR1.2.2: Config MUST specify `output` field (output filename, relative to codegen config file)
- FR1.2.3: Config MAY specify `name` field (client name, defaults to "Client")
- FR1.2.4: Config MAY specify `typeOnly` field (boolean, defaults to false)
- FR1.2.5: Config MAY specify `patches` field (array of JSON patch file paths or inline patches)

### FR1.6 Spec Fetching

- FR1.6.1: Tool MUST detect URL specs (strings starting with `http://` or `https://`)
- FR1.6.2: Tool MUST fetch URL specs via HTTP GET at generation time
- FR1.6.3: Tool MUST read file specs from filesystem (path relative to package)
- FR1.6.4: Tool MUST support JSON and YAML spec formats
- FR1.6.5: Tool SHOULD cache fetched specs in memory during single run (no disk cache)

### FR1.7 Spec Patching

- FR1.7.1: Tool MUST apply JSON patches to spec before code generation
- FR1.7.2: Tool MUST support patch files in JSON and YAML formats
- FR1.7.3: Tool MUST apply patches in order specified in config
- FR1.7.4: Tool MUST report all patch errors at once (not fail on first error)

### FR1.3 Code Generation

- FR1.3.1: Tool MUST read OpenAPI spec from configured path
- FR1.3.2: Tool MUST invoke `@effect/openapi-generator` with spec and options
- FR1.3.3: Tool MUST write generated code to configured output path
- FR1.3.4: Tool MUST preserve existing file header comments (e.g., `@since` tags)

### FR1.4 Post-Generation Processing

- FR1.4.1: Tool MUST run Oxlint with `--fix` on generated file
- FR1.4.2: Tool MUST run Dprint with `fmt` on generated file
- FR1.4.3: Processing steps MUST run sequentially: generate → lint → format

### FR1.5 CLI Interface

- FR1.5.1: Binary name: `effect-ai-codegen`
- FR1.5.2: Command `generate`: Run code generation for providers
- FR1.5.3: Command `list`: Display discovered providers and their configs
- FR1.5.4: Flag `--provider <name>`: Filter to specific provider
- FR1.5.5: Flag `--skip-lint`: Skip Oxlint step
- FR1.5.6: Flag `--skip-format`: Skip Dprint step
- FR1.5.7: `list` command MUST display colorful output with provider details
- FR1.5.8: `list` command MUST show client name from config

## NFR2: Non-Functional Requirements

### NFR2.1 Performance

- NFR2.1.1: Single provider generation SHOULD complete in < 10 seconds
- NFR2.1.2: Multiple providers MAY run concurrently

### NFR2.2 Usability

- NFR2.2.1: Error messages MUST clearly identify: missing config, invalid spec, generation failures
- NFR2.2.2: Tool MUST provide progress feedback during generation
- NFR2.2.3: Tool MUST exit with non-zero code on any failure

### NFR2.3 Maintainability

- NFR2.3.1: Code MUST follow Effect library patterns (Effect.gen, tagged errors, layers)
- NFR2.3.2: Code MUST have comprehensive JSDoc documentation
- NFR2.3.3: Code MUST pass all monorepo checks (lint, typecheck, docgen)

## TC3: Technical Constraints

### TC3.1 Language & Runtime

- TC3.1.1: Implementation in TypeScript
- TC3.1.2: Must run on Node.js (via tsx for development)
- TC3.1.3: Must use Effect v4 patterns

### TC3.2 Dependencies

- TC3.2.1: MUST use `@effect/openapi-generator` for code generation
- TC3.2.2: MUST use `@effect/platform-node` for filesystem/process operations
- TC3.2.3: MUST use `effect/unstable/cli` for CLI framework
- TC3.2.4: MAY use `glob` package for file discovery (via `@effect/utils`)

### TC3.3 Monorepo Integration

- TC3.3.1: Tool lives in `packages/tools/ai-codegen`
- TC3.3.2: Lint command: `oxlint --fix <file>`
- TC3.3.3: Format command: `dprint fmt <file>`
- TC3.3.4: Commands run from monorepo root

## DR4: Data Requirements

### DR4.1 Configuration File Schema

```typescript
interface CodegenConfig {
  readonly spec: string // Required: URL or file path to OpenAPI spec
  readonly output: string // Required: Output file path (relative to config file)
  readonly name?: string // Optional: Client name
  readonly typeOnly?: boolean // Optional: Type-only generation
  readonly patches?: ReadonlyArray<string> // Optional: JSON patch file paths or inline patches
}
```

### DR4.3 Example Configuration (YAML)

```yaml
# codegen.yaml
spec: https://api.example.com/openapi.yaml
output: src/Generated.ts
name: ExampleClient
patches:
  - patches/fix-schemas.json
  - patches/remove-deprecated.yaml
```

### DR4.2 Provider Discovery Result

```typescript
interface DiscoveredProvider {
  readonly name: string // Provider name (directory name)
  readonly packagePath: string // Absolute path to provider package
  readonly config: CodegenConfig // Parsed configuration
  readonly specSource: SpecSource // URL or resolved file path
  readonly outputPath: string // Resolved absolute output path
}

type SpecSource =
  | { readonly _tag: "Url"; readonly url: string }
  | { readonly _tag: "File"; readonly path: string }
```

## IR5: Integration Requirements

### IR5.1 OpenAPI Generator

- IR5.1.1: Use `OpenApiGenerator.generate(spec, options)` API
- IR5.1.2: Provide layer via `OpenApiGenerator.layerTransformerSchema` or `layerTransformerTs`
- IR5.1.3: Parse spec file as JSON before passing to generator

### IR5.2 Filesystem

- IR5.2.1: Use `FileSystem.readFileString` for file-based spec reading
- IR5.2.2: Use `FileSystem.writeFileString` for output writing
- IR5.2.3: Use `Path` service for path resolution

### IR5.4 HTTP Client

- IR5.4.1: Use `HttpClient` from `@effect/platform-node` for URL spec fetching
- IR5.4.2: Fetch spec via HTTP GET request
- IR5.4.3: Parse response body as JSON

### IR5.3 Process Execution

- IR5.3.1: Use `Command` from `@effect/platform-node` for subprocess execution
- IR5.3.2: Oxlint: `npx oxlint --fix <file>`
- IR5.3.3: Dprint: `npx dprint fmt <file>`

## DEP6: Dependencies

### DEP6.1 Internal Dependencies

| Package                     | Purpose                           |
| --------------------------- | --------------------------------- |
| `effect`                    | Core Effect runtime               |
| `@effect/platform-node`     | Node.js platform services         |
| `@effect/openapi-generator` | OpenAPI to Effect code generation |

### DEP6.2 External Dependencies

| Package | Purpose               |
| ------- | --------------------- |
| `glob`  | File pattern matching |

## SC7: Success Criteria

### SC7.1 Minimum Viable Product

- [ ] SC7.1.1: `codegen.json` parsed correctly
- [ ] SC7.1.2: Code generated from OpenAPI spec
- [ ] SC7.1.3: Output written to configured path
- [ ] SC7.1.4: Oxlint runs on output
- [ ] SC7.1.5: Dprint runs on output

### SC7.2 Complete Implementation

- [ ] SC7.2.1: All FR requirements met
- [ ] SC7.2.2: All NFR requirements met
- [ ] SC7.2.3: Tests pass
- [ ] SC7.2.4: Documentation complete
- [ ] SC7.2.5: Works with OpenAI provider as reference implementation
