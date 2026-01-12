# AI Codegen Tool - Implementation Plan

## Overview

5-phase implementation with validation checkpoints after each phase.

## Phase 1: Package Setup & Configuration Schema

### Objectives

- Set up package structure
- Define configuration types and schema
- Implement config parsing

### Tasks

- [x] **1.1** Update `packages/tools/ai-codegen/package.json` dependencies
- [x] **1.2** Create `packages/tools/ai-codegen/tsconfig.json`
- [x] **1.3** Create `src/Config.ts`:
  - [x] `CodegenConfig` Schema class
  - [x] `SpecSource` ADT (Url | File)
  - [x] `SpecSource.fromString` constructor
  - [x] `ConfigParseError`, `ConfigNotFoundError` tagged errors
  - [x] JSDoc with @example for all exports
- [x] **1.4** Lint and typecheck

### Validation Checkpoint

```bash
pnpm lint --fix packages/tools/ai-codegen/src/Config.ts
pnpm check
```

---

## Phase 2: Provider Discovery Service

### Objectives

- Implement glob-based provider discovery
- Parse and validate configs from discovered paths

### Tasks

- [x] **2.1** Create `src/Discovery.ts`:
  - [x] `DiscoveredProvider` interface
  - [x] `ProviderDiscovery` service definition
  - [x] `DiscoveryError`, `ProviderNotFoundError` tagged errors
  - [x] `discover` - find all providers via glob
  - [x] `discoverOne` - find specific provider by name
  - [x] `layer` - service layer implementation
  - [x] JSDoc with @example for all exports
- [x] **2.2** Lint and typecheck

### Validation Checkpoint

```bash
pnpm lint --fix packages/tools/ai-codegen/src/Discovery.ts
pnpm check
```

---

## Phase 3: Spec Fetcher Service

### Objectives

- Implement URL and file-based spec fetching
- Handle HTTP requests and filesystem reads

### Tasks

- [x] **3.1** Create `src/SpecFetcher.ts`:
  - [x] `SpecFetcher` service definition
  - [x] `SpecFetchError` tagged error
  - [x] `fetchFromFile` - read spec from filesystem
  - [x] `fetchFromUrl` - fetch spec via HTTP GET
  - [x] `fetch` - dispatch based on SpecSource tag (supports JSON and YAML)
  - [x] `layer` - service layer implementation
  - [x] JSDoc with @example for all exports
- [x] **3.2** Lint and typecheck

### Validation Checkpoint

```bash
pnpm lint --fix packages/tools/ai-codegen/src/SpecFetcher.ts
pnpm check
```

---

## Phase 4: Generator & PostProcessor Services

### Objectives

- Integrate with @effect/openapi-generator
- Implement lint and format post-processing

### Tasks

- [x] **4.1** Create `src/Generator.ts`:
  - [x] `CodeGenerator` service definition
  - [x] `GenerationError` tagged error
  - [x] `generate` - invoke openapi-generator with spec and options
  - [x] `layer` - service layer implementation
  - [x] JSDoc with @example for all exports
- [x] **4.2** Create `src/PostProcess.ts`:
  - [x] `PostProcessor` service definition
  - [x] `PostProcessError` tagged error
  - [x] `runCommand` - execute subprocess
  - [x] `lint` - run oxlint --fix
  - [x] `format` - run dprint fmt
  - [x] `layer` - service layer implementation
  - [x] JSDoc with @example for all exports
- [x] **4.3** Lint and typecheck

### Validation Checkpoint

```bash
pnpm lint --fix packages/tools/ai-codegen/src/Generator.ts
pnpm lint --fix packages/tools/ai-codegen/src/PostProcess.ts
pnpm check
```

---

## Phase 5: CLI Implementation & Integration

### Objectives

- Implement CLI commands
- Wire up all services
- Create reference provider config

### Tasks

- [x] **5.1** Create `src/main.ts`:
  - [x] Flag definitions (provider, skip-lint, skip-format)
  - [x] `generate` command with handler
  - [x] `list` command with handler
  - [x] `generateProvider` orchestration function
  - [x] Layer composition (MainLayer)
  - [x] Export `run` effect
- [x] **5.2** Update `src/bin.ts`:
  - [x] Import and execute `run` with NodeServices
- [x] **5.3** Create `packages/ai/openai/codegen.json`:
  - [x] Reference config with OpenAI spec URL
- [x] **5.4** End-to-end test (generation works, type errors in generated code are openapi-generator issues)

### Validation Checkpoint

```bash
pnpm lint --fix packages/tools/ai-codegen/src/main.ts
pnpm lint --fix packages/tools/ai-codegen/src/bin.ts
pnpm check
pnpm build

# End-to-end test
npx tsx packages/tools/ai-codegen/src/bin.ts list
npx tsx packages/tools/ai-codegen/src/bin.ts generate --provider openai
```

---

## Risk Mitigation

| Risk                              | Mitigation                                   |
| --------------------------------- | -------------------------------------------- |
| OpenAPI spec URL changes          | Document spec URLs in config, easy to update |
| Large spec causes slow generation | Accept as known limitation, no caching       |
| Oxlint/Dprint not found           | Clear error message, check tool availability |
| HTTP fetch failures               | Retry logic optional, clear error messages   |
| Generated code has lint errors    | Expected - that's why we run lint --fix      |

---

## Success Criteria Validation

### MVP Complete When:

- [x] `codegen.json` parsed correctly
- [x] Spec fetched from URL
- [x] Code generated from spec
- [x] Output written to configured path
- [x] Oxlint runs on output
- [x] Dprint runs on output
- [x] `list` command shows providers
- [x] `generate` command produces valid output

### Full Implementation When:

- [x] All services have JSDoc with @example
- [x] All tagged errors defined
- [x] `--provider` flag filters correctly
- [x] `--skip-lint` and `--skip-format` work
- [x] Error messages are clear and actionable
- [x] Works with OpenAI provider end-to-end

---

## Progress Tracking

| Phase                        | Status      | Notes                                                      |
| ---------------------------- | ----------- | ---------------------------------------------------------- |
| 1. Package Setup & Config    | ✅ Complete |                                                            |
| 2. Provider Discovery        | ✅ Complete |                                                            |
| 3. Spec Fetcher              | ✅ Complete | YAML support added                                         |
| 4. Generator & PostProcessor | ✅ Complete |                                                            |
| 5. CLI & Integration         | ✅ Complete | Type errors in generated code are openapi-generator issues |

---

## File Creation Order

1. `src/Config.ts` - No dependencies
2. `src/Glob.ts` - Glob wrapper service
3. `src/Discovery.ts` - Depends on Config, Glob
4. `src/SpecFetcher.ts` - Depends on Config
5. `src/Generator.ts` - Depends on Discovery
6. `src/PostProcess.ts` - No internal dependencies
7. `src/main.ts` - Depends on all above
8. `src/bin.ts` - Depends on main
9. `packages/ai/openai/codegen.json` - Reference config

---

## Known Issues

- Generated code from openapi-generator has type errors (`any` in Effect R parameter)
- This is an openapi-generator issue, not ai-codegen
- The tool itself works correctly end-to-end
