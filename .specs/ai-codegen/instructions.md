# AI Codegen Tool - Instructions

## Overview

Internal CLI tool for generating Effect Schemas and HttpClient code from OpenAPI specifications provided by LLM providers. Lives in `packages/tools/ai-codegen` and integrates with the existing `@effect/openapi-generator` package.

## User Story

As an Effect library maintainer, I want a streamlined, declarative workflow for adding/updating generated code for LLM provider integrations so that:

- Adding a new AI provider requires minimal boilerplate
- Updating specs (e.g., when OpenAI releases new API versions) is low-friction
- Generated code is automatically linted and formatted per monorepo standards
- Configuration stays localized within each AI provider's package

## Core Requirements

1. **Declarative Configuration**: Each AI provider package (`packages/ai/<provider>`) contains its own codegen config file specifying:
   - OpenAPI spec source (file path or URL)
   - Output file name/path
   - Generation options (type-only vs schema, client name, etc.)

2. **Output File Specification**: Config must allow declaring the output filename for generated code

3. **Lint Integration**: Tool must run Oxlint with autofix via monorepo scripts after generation

4. **Format Integration**: Tool must run Dprint with autofix via monorepo scripts after generation

5. **Location**: All tool code in `packages/tools/ai-codegen`

## Technical Specifications

### Configuration File

- Format: JSON or TypeScript (prefer `codegen.json` for declarative simplicity)
- Location: `packages/ai/<provider>/codegen.json`
- Schema:
  ```typescript
  interface CodegenConfig {
    spec: string // URL or file path to OpenAPI spec
    output: string // Output filename (relative to package src/)
    name?: string // Client name (default: "Client")
    typeOnly?: boolean // Generate types only (default: false)
  }
  ```

### Spec Fetching

- **URL specs**: Fetched via HTTP at generation time (always up-to-date)
- **File specs**: Read from filesystem (relative to package directory)
- URL detection: strings starting with `http://` or `https://`
- No spec storage in VCS required for URL-based configs

### CLI Interface

- Binary: `effect-ai-codegen`
- Commands:
  - `effect-ai-codegen generate [--provider <name>]` - Generate code for one or all providers
  - `effect-ai-codegen list` - List discovered providers and their configs

### Integration Points

- Uses `@effect/openapi-generator` for spec parsing and code generation
- Uses monorepo `oxlint --fix` for linting
- Uses monorepo `dprint fmt` for formatting
- Discovers providers via glob pattern `packages/ai/*/codegen.json`

## Acceptance Criteria

- [ ] `codegen.json` in provider package fully specifies generation
- [ ] Running `effect-ai-codegen generate` produces correctly linted and formatted output
- [ ] Adding new provider requires only: directory, `codegen.json`, OpenAPI spec
- [ ] Generated file matches config's `output` field
- [ ] Lint and format run automatically after generation
- [ ] Clear error messages for missing configs/specs

## Out of Scope

- Version management for specs
- Diffing/changelog for generated code
- Watch mode for spec changes

## Success Metrics

- Zero manual steps between spec update and valid generated code
- New provider setup < 5 minutes
- Tool follows existing Effect library patterns (Effect.gen, proper error handling)

## Future Considerations

- Support for multiple specs per provider
- Custom transformers/post-processors
- Integration with CI for automated regeneration checks

## Testing Requirements

- Unit tests for config parsing
- Integration tests for full generation pipeline
- Test with at least one real OpenAPI spec (e.g., OpenAI)
