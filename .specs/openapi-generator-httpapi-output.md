# OpenAPI Generator: HttpApi Output Mode

## Summary

Add a third format mode to `@effect/openapi-generator` that emits a full
`effect/unstable/httpapi` module with supporting runtime schemas. Replace the
current `--type-only` CLI flag with `--format httpclient |
httpclient-type-only | httpapi`, keeping `httpclient` as the default.

The new `httpapi` format must generate:

- supporting `Schema` runtime declarations and exported types
- an exported `class <Name> extends HttpApi.make("<Name>") {}` root API declaration named from `--name`
- generated `HttpApiGroup` / `HttpApiEndpoint` structure
- generated placeholder security declarations, but not security layer implementations
- explicit warnings for lossy mappings and skipped operations

## Background

The package at `packages/tools/openapi-generator` already parses OpenAPI and
renders two HttpClient-oriented outputs. The Effect repository also already
contains `OpenApi.fromApi(api)`, so the missing piece is OpenAPI -> HttpApi
code generation.

## Goals

1. Add `httpapi` as a first-class generator format without regressing current HttpClient generation.
2. Reuse the existing schema generation path for supporting schemas and component handling.
3. Preserve OpenAPI metadata where `HttpApi` can represent it directly.
4. Emit deterministic warnings for every lossy or skipped feature approved during discovery.
5. Keep the design maintainable by separating HttpApi rendering concerns from HttpClient rendering concerns.

## Non-goals

- Implementing runtime security middleware layers.
- Modeling SSE / `text/event-stream` in generated HttpApi output.
- Modeling response headers in generated HttpApi output.
- Modeling ordinary non-security cookie parameters.
- Supporting request bodies on `GET`, `HEAD`, `OPTIONS`, or `TRACE`.

## User-confirmed product decisions

### Output modes

- Replace `typeOnly: boolean` and `--type-only` with an explicit format enum.
- Supported output values: `httpclient`, `httpclient-type-only`, `httpapi`.
- Default output remains `httpclient`.
- The `name` option controls both the exported HttpApi class name and the string passed to `HttpApi.make(name)`.

### Grouping

- Use the first OpenAPI tag as the owning `HttpApiGroup` when tags are present.
- If an operation has no tags, place it in a generated fallback group with `topLevel: true`.
- If multiple tags are present, keep the first and drop the rest with a warning.

### Lossy / unsupported feature policy

- Generate security declarations, but do not implement them.
- Drop non-security cookie parameters with a warning.
- Skip SSE endpoints with a warning.
- Ignore response headers with a warning.
- Approximate optional request bodies by adding a no-content payload alternative.
- Best-effort map `default` responses to numeric statuses with a warning.
- For OpenAPI security AND requirements, generate a plain `HttpApiMiddleware` placeholder instead, with a warning.
- If a no-body method defines a request body, skip the operation with a warning.

## Public API changes

Replace the generator options with an explicit format mode:

```ts
export type OpenApiGeneratorFormat = "httpclient" | "httpclient-type-only" | "httpapi"

export interface OpenApiGeneratorWarning {
  readonly code:
    | "cookie-parameter-dropped"
    | "additional-tags-dropped"
    | "sse-operation-skipped"
    | "response-headers-ignored"
    | "optional-request-body-approximated"
    | "default-response-remapped"
    | "security-and-downgraded"
    | "no-body-method-request-body-skipped"
    | "naming-collision"
  readonly message: string
  readonly path?: string | undefined
  readonly method?: OpenAPISpecMethodName | undefined
  readonly operationId?: string | undefined
}

export interface OpenApiGenerateOptions {
  readonly name: string
  readonly format: OpenApiGeneratorFormat
  readonly onEnter?: ((js: JsonSchema.JsonSchema) => JsonSchema.JsonSchema) | undefined
  readonly onWarning?: ((warning: OpenApiGeneratorWarning) => void) | undefined
}
```

Requirements:

- `typeOnly` is removed from the public API.
- The CLI prints warnings to stderr-equivalent output only; stdout remains the generated source.
- Existing HttpClient behavior must remain byte-for-byte stable except for the migrated option shape.
- Task 1 must update all downstream callers of `OpenApiGenerator.generate`, including `packages/tools/ai-codegen`, so type checking remains green at every task boundary.
- The package description / CLI help text should be updated from client-specific wording to output-neutral wording before final release.

## Generated HttpApi source shape

The `httpapi` format must generate one compilable module containing:

1. imports for `Schema`, `HttpApi`, `HttpApiGroup`, `HttpApiEndpoint`, `HttpApiSchema`, `HttpApiSecurity`, `HttpApiMiddleware`, and `OpenApi`
2. supporting schema class / opaque-schema declarations
3. generated security scheme constants
4. generated placeholder middleware classes
5. group builders
6. `export class <Name> extends HttpApi.make("<Name>") {}` with subsequent chained `.annotate(...)` / `.add(...)` composition applied to the class value

The output should remain deterministic and string-testable, matching the style of the existing generator tests.

### Schema declaration style for `httpapi`

To keep generated HttpApi types opaque, supporting schemas in `httpapi` format must use class-based schema declarations rather than `export type` + `export const` pairs.

Rules:

- Prefer `class X extends Schema.Class<X>("X")({ ... }) {}` for object / struct-like schemas.
- For non-struct schemas that cannot use `Schema.Class`, use a class-based opaque wrapper such as `class X extends Schema.Opaque<X>()(SomeSchema) {}`.
- The generated HttpApi graph must reference these class values directly.
- The generator should avoid exposing plain structural type aliases for HttpApi mode except where TypeScript or Schema APIs make a class-based wrapper impossible. Any fallback should be minimal and documented in tests.

## Mapping specification

### 1. API-level metadata

| OpenAPI | HttpApi output |
| --- | --- |
| `info.title` | `.annotate(OpenApi.Title, ...)` |
| `info.version` | `.annotate(OpenApi.Version, ...)` |
| `info.description` | `.annotate(OpenApi.Description, ...)` |
| `info.summary` | `.annotate(OpenApi.Summary, ...)` |
| `info.license` | `.annotate(OpenApi.License, ...)` |
| `servers` | `.annotate(OpenApi.Servers, ...)` |

Rules:

- The exported class name and `HttpApi.make(...)` identifier come from `options.name`, not `info.title`.
- Global OpenAPI security must be normalized into effective per-operation security before rendering so operation-level `security: []` can clear inherited security.

### 2. Group mapping

- First tag wins ownership.
- Untagged operations are placed in `HttpApiGroup.make("default", { topLevel: true })`.
- If tag metadata exists in `spec.tags`, map `description` and `externalDocs` to group annotations.
- If later operations force a naming collision after sanitization, suffix deterministically and emit a `naming-collision` warning.

### 3. Endpoint identity and annotations

- Endpoint names use the current generator strategy: `operationId` when present, otherwise a deterministic method/path-derived identifier.
- Preserve the original `operationId` with `.annotate(OpenApi.Identifier, originalOperationId)`.
- Map `summary`, `description`, `deprecated`, and `externalDocs` to the matching endpoint annotations.

### 4. Parameters

- `in: path` -> endpoint `params`, converting `/pets/{id}` to `/pets/:id`.
- `in: query` -> endpoint `query`.
- `in: header` -> endpoint `headers`.
- `in: cookie` -> drop and warn unless the cookie arrives through a security scheme.
- Required query / header params become required properties in the assembled parameter schema; optional params become optional properties.
- Unsupported serialization styles or explode behaviors should be approximated only when they already align with the generator's current object-schema assembly; otherwise drop or degrade with a warning rather than silently inventing semantics.
- Warnings for dropped parameters should be emitted once per dropped parameter, in source order.

### 5. Request bodies

Supported request body mappings:

| OpenAPI content type | HttpApi output |
| --- | --- |
| `application/json` | plain schema |
| `multipart/form-data` | schema piped through `HttpApiSchema.asMultipart()` |
| `application/x-www-form-urlencoded` | schema piped through `HttpApiSchema.asFormUrlEncoded()` |
| `text/plain` | schema piped through `HttpApiSchema.asText()` |
| `application/octet-stream` | schema piped through `HttpApiSchema.asUint8Array()` |
| custom JSON/text/binary variants | matching `HttpApiSchema.as*({ contentType })` helper |

Rules:

- Treat `application/*+json` as JSON-like, `text/*` as text-like, and `application/octet-stream` as binary. Other unsupported media types should be dropped with a warning.
- Multiple supported media types may be emitted as an array payload in stable input order.
- If `requestBody.required === false`, add a no-content payload alternative and emit `optional-request-body-approximated`.
- If a no-body method defines a request body, skip the operation and emit `no-body-method-request-body-skipped`.

### 6. Responses

- Status codes below 400 become success schemas; 400+ become error schemas.
- Empty responses become `HttpApiSchema.Empty(status)` or an equivalent convenience helper.
- `application/json`, `application/x-www-form-urlencoded`, `text/plain`, `application/octet-stream`, `application/*+json`, and `text/*` responses must be mapped to representable `HttpApiSchema` encodings. Unsupported media types should be dropped with a warning. Multipart responses are unsupported and should be warned about if encountered.
- If a successful `text/event-stream` response is present, skip the entire operation and emit `sse-operation-skipped`.
- If response headers are present, ignore them and emit `response-headers-ignored` while keeping the operation. Emit one warning per affected response object.
- If a `default` response is present, remap it with warning: use `500` when any explicit success response exists, otherwise use `200`. After remapping, classify it as success or error using the remapped numeric code.

### 7. Security

Additional security rules:

- Preserve bearer format metadata with `HttpApiSecurity.annotate(OpenApi.Format, bearerFormat)` when present.
- Unsupported security scheme types (such as OAuth2, OpenID Connect, or mutual TLS) must be dropped with a warning; the warning code can use a generic unsupported-feature style extension if the final implementation chooses to broaden the warning enum.
- `security: []` clears inherited security.
- A security requirement object equal to `{}` means no auth required and must not generate middleware.
- For arrays mixing OR-compatible entries and AND entries, keep the OR-compatible entries and downgrade each AND entry independently with warnings rather than downgrading the whole operation.
- Security warning payloads should include the affected scheme name when available.


Security scheme declarations:

| OpenAPI scheme | HttpApi output |
| --- | --- |
| HTTP bearer | `HttpApiSecurity.bearer` |
| HTTP basic | `HttpApiSecurity.basic` |
| apiKey header/query/cookie | `HttpApiSecurity.apiKey({ key, in })` |

Rules:

- If a scheme has a description, preserve it with `HttpApiSecurity.annotate(OpenApi.Description, ...)`.
- Resolve effective security per operation after inheritance / override.
- For OR requirement sets made of single-scheme requirement objects, generate a placeholder security middleware class with a `security` object containing the referenced schemes, then attach that middleware to the endpoint.
- For AND requirements (multiple schemes in one requirement object), generate a plain `HttpApiMiddleware.Service` placeholder without a `security` object and emit `security-and-downgraded`.
- Do not generate any middleware implementation layer.

### 8. Naming rules

- Reuse the current schema naming strategy for generated supporting schema declarations, but emit them as classes / opaque wrappers in `httpapi` format.
- Sanitize helper declaration names to valid TS identifiers.
- Preserve original OpenAPI names inside runtime values where possible, such as group identifiers, original operation IDs, and security scheme keys.
- On collisions after sanitization, append deterministic suffixes using `Name2`, `Name3`, and so on, and emit `naming-collision`.
- The `--name` value must be a valid exported TypeScript class identifier; invalid values should fail fast rather than being silently rewritten.

## Internal design

1. Keep one `OpenApiGenerator.generate` entry point but convert it into a format dispatcher.
2. Replace the current HttpClient-specific inline parse assumptions with a richer parsed model that carries tags, request bodies by content type, responses by status/content type, default responses, metadata, cookies, and effective security.
3. Add a dedicated `HttpApiTransformer.ts` renderer rather than extending `OpenApiTransformer.ts` into a mixed-responsibility file. The renderer must emit the root API as `export class <Name> extends HttpApi.make("<Name>") {}` rather than `export const <Name> = ...`.
3a. Extend schema rendering so `httpapi` format can emit class-based declarations (`Schema.Class` / `Schema.Opaque`) instead of the current type-and-const style.
4. Route all lossy decisions through one warning helper that forwards structured warnings through `options.onWarning`. Warning emission must be stable and ordered by source traversal.
5. Keep the existing HttpClient renderer behavior stable on top of the richer parsed model.
6. Order generated output deterministically: imports, schema exports, security constants, middleware declarations, helper declarations, group/api assembly.
7. Prefer a round-trip invariant where representable features from the source OpenAPI document survive through generated HttpApi and back through `OpenApi.fromApi` as closely as possible.

## Testing requirements

Extend `packages/tools/openapi-generator/test/OpenApiGenerator.test.ts` to cover:

1. `format: "httpclient"` regression coverage
2. `format: "httpclient-type-only"` regression coverage
3. basic `httpapi` generation for tagged operations
4. top-level fallback group generation for untagged operations
5. endpoint annotations
6. request body encodings: json, multipart, form-urlencoded, text, binary
7. response encodings: json, text, binary, empty responses
8. optional request body approximation
9. warning emission for default remapping, cookies, extra tags, SSE skip, response headers, no-body request-body skip, AND security downgrade, and naming collisions
10. security declaration and placeholder middleware generation

Add CLI-focused coverage proving:

- `--format httpclient` selects runtime client generation
- `--format httpclient-type-only` selects type-only generation
- `--format httpapi` selects HttpApi generation
- legacy `--type-only` is rejected
- warnings are written to stderr-equivalent output only

Required validation:

- `pnpm lint-fix`
- `pnpm test packages/tools/openapi-generator/test/OpenApiGenerator.test.ts`
- any new targeted CLI test file
- `pnpm check:tsgo`
- `pnpm docgen`

## Expected file changes

| File | Purpose |
| --- | --- |
| `packages/tools/openapi-generator/src/OpenApiGenerator.ts` | replace `typeOnly` with `format`, coordinate parsing, warnings, and renderer dispatch |
| `packages/tools/openapi-generator/src/OpenApiTransformer.ts` | keep HttpClient generation working with the new format API |
| `packages/tools/openapi-generator/src/HttpApiTransformer.ts` | new HttpApi renderer |
| `packages/tools/openapi-generator/src/main.ts` | replace `--type-only` with `--format` and print warnings to stderr |
| `packages/tools/openapi-generator/test/OpenApiGenerator.test.ts` | add HttpApi and warning coverage |
| `packages/tools/openapi-generator/test/*` | optional CLI-focused tests |
| `.changeset/*.md` | changeset for `@effect/openapi-generator` |

## Implementation plan

### Task 1 — Migrate the API and CLI to `format` for existing HttpClient modes

Scope:

- replace `typeOnly` with `format` in `OpenApiGenerateOptions`
- add the `OpenApiGeneratorFormat` union, but keep runtime support limited to `httpclient` and `httpclient-type-only` in this task
- update the existing HttpClient code paths to dispatch from `format`
- replace the CLI `--type-only` flag with `--format` while keeping `httpclient` as the default
- update all downstream callers, including `packages/tools/ai-codegen`, to use the new API
- update existing tests to use the new API

Why this task is atomic: it preserves the two existing outputs, introduces no partial HttpApi behavior, keeps all existing callers type-safe, and establishes the public contract needed by later tasks.

Validation: `pnpm lint-fix`, `pnpm test packages/tools/openapi-generator/test/OpenApiGenerator.test.ts`, `pnpm check:tsgo`, `pnpm docgen`.

### Task 2 — Introduce warnings and a richer parsed model

Scope:

- add `OpenApiGeneratorWarning` and `onWarning` plumbing
- extract or expand parsing into a renderer-agnostic model that can carry tags, content types, default responses, metadata, cookies, and effective security
- keep current HttpClient output unchanged on top of that richer model
- add regression tests proving current HttpClient output remains stable

Why this task is atomic: it de-risks the feature without exposing incomplete HttpApi output and can ship independently with stable HttpClient behavior.

Validation: `pnpm lint-fix`, `pnpm test packages/tools/openapi-generator/test/OpenApiGenerator.test.ts`, `pnpm check:tsgo`, `pnpm docgen`.

### Task 3 — Add baseline HttpApi rendering for representable operations and opaque schema declarations

Scope:

- add `HttpApiTransformer.ts`
- add class-based / opaque schema emission for `httpapi` format
- generate runtime schemas plus the exported root HttpApi class
- generate groups from first-tag ownership with top-level fallback
- generate endpoint annotations, parameters, supported request/response encodings, empty responses, optional request-body approximation, deterministic naming / collision handling, class-based opaque schema bindings, and the `export class <Name> extends HttpApi.make(...) {}` root declaration
- add tests for the supported happy path

Why this task is atomic: it lands a usable `httpapi` mode for representable inputs without mixing in all lossy edge cases at the same time.

Validation: `pnpm lint-fix`, `pnpm test packages/tools/openapi-generator/test/OpenApiGenerator.test.ts`, `pnpm check:tsgo`, `pnpm docgen`.

### Task 4 — Add security placeholders and lossy-feature handling

Scope:

- generate `HttpApiSecurity` declarations
- normalize effective security per operation
- generate OR security placeholder middleware and AND downgrade placeholders
- implement the approved warning-producing behaviors for cookies, extra tags, SSE skip, response headers, default remapping, and no-body request-body skipping
- add tests for all warning cases

Why this task is atomic: these behaviors are tightly coupled and should land together so the final warning and compatibility story is coherent and validation-stable.

Validation: `pnpm lint-fix`, `pnpm test packages/tools/openapi-generator/test/OpenApiGenerator.test.ts`, `pnpm check:tsgo`, `pnpm docgen`.

### Task 5 — Finish CLI coverage, docs, and release bookkeeping

Scope:

- add CLI-focused tests for `--format` routing and warning surfacing
- update any package docs or examples that still refer to `--type-only`
- update package description / help text to reflect HttpClient + HttpApi generation instead of client-only wording
- add the required changeset for `@effect/openapi-generator` and choose the release type consistent with the public API migration
- run full final validation

Why this task is atomic: it completes rollout and release readiness without blocking core generator work.

Validation: `pnpm lint-fix`, `pnpm test packages/tools/openapi-generator/test/OpenApiGenerator.test.ts`, targeted CLI test file(s), `pnpm check:tsgo`, `pnpm docgen`.

## Notes carried into implementation

- `HttpApi` has no endpoint-level cookie parameter model, so ordinary cookie params must be dropped.
- `httpapi` format should prefer class-based schema declarations to keep decoded types opaque.
- Global OpenAPI security should be normalized into per-operation attachments instead of using API-level middleware directly.

## Task 1 implementation notes

- `OpenApiGenerateOptions` now uses `format: "httpclient" | "httpclient-type-only"` and no longer accepts `typeOnly`.
- CLI flag `--type-only` has been removed in favor of `--format` with default `httpclient`.
- OpenAPI generator CLI help text now uses output-neutral wording for `--spec` and `--name`.
- `packages/tools/ai-codegen` still exposes `typeOnly` in its own config schema for now, but now maps that value into `format` when calling `OpenApiGenerator.generate`.
- There is no dedicated openapi-generator CLI test file yet; Task 5 should add explicit CLI coverage for format flag behavior.

### Follow-up tasks

- Add dedicated openapi-generator CLI tests that exercise `--format` routing (including default behavior).
- Evaluate migrating `packages/tools/ai-codegen` provider config from `typeOnly` to a format enum once downstream config compatibility strategy is defined.

## Task 2 implementation notes

- Added `OpenApiGeneratorWarning` / `OpenApiGeneratorWarningCode` to the generator public API and introduced `onWarning` in `OpenApiGenerateOptions`.
- Parsing now produces a richer renderer-agnostic `ParsedOpenApi` model containing API metadata, tag metadata, and per-operation metadata.
- Per-operation parsed data now includes:
  - declared tags
  - normalized per-location parameter collections (including cookies)
  - request body content types
  - response content types plus explicit `defaultResponse`
  - effective per-operation security after inheritance/override
- Added a centralized warning emission helper and routed parser warnings through it.
- Current warning coverage in Task 2 is intentionally limited to already-lossy HttpClient behavior (`cookie-parameter-dropped` and `default-response-remapped`) while preserving generated source output.
- `OpenApiTransformer` now renders from the richer parsed model while preserving existing HttpClient and HttpClient type-only output text.
- Added regression tests verifying runtime and type-only outputs remain byte-stable when using the new `onWarning` option shape.
- Corrected parsed request-body metadata so `required` reflects OpenAPI semantics (`true` only when explicitly set), keeping HttpClient output unchanged.

### Additional follow-up tasks

- Add focused regression coverage for `$ref`-heavy parameter/request-body scenarios to guard byte-for-byte HttpClient compatibility during future parser refactors.
- Decide whether to include `pathItem.parameters` in the parsed intermediate model before wiring HttpApi rendering, and document any intentional compatibility constraints.

## Task 3 implementation notes

- Added a dedicated `HttpApiTransformer.ts` and wired `format: "httpapi"` dispatch in `OpenApiGenerator.generate`.
- Added `JsonSchemaGenerator.generateHttpApi` for class/opaque schema declarations:
  - non-recursive schemas now render as `Schema.Class` when struct-like and as `Schema.Opaque` otherwise
  - recursive definitions currently fall back to the existing `type + const` style to avoid invalid self-references in class heritage expressions
- Extended the parsed operation model with HttpApi-oriented data:
  - per-location parameter schemas (`path`, `query`, `headers`)
  - representable request-body media schema mappings
  - representable response media schema mappings plus empty-response markers
  - metadata for `license` and `servers`
- Added deterministic schema name collision handling (with `Name2`, `Name3`, ... suffixes) via a reserved-name set that includes component schema names and generated operation schema names.
- Implemented baseline HttpApi rendering behavior:
  - first-tag group ownership and fallback `default` top-level group for untagged operations
  - fallback group now remains top-level even when tagged `"default"` operations are encountered first in traversal order
  - endpoint OpenAPI annotations (`Identifier`, `Summary`, `Description`, `Deprecated`, `ExternalDocs`)
  - representable request/response mappings for json, multipart, form-urlencoded, text, binary, and empty responses
  - optional request-body approximation via `HttpApiSchema.NoContent` payload alternative
  - root API class declaration `export class <Name> extends HttpApi.make("<Name>") {}` with composed exported value `export const <Name>Api = <Name>...`
- Added focused HttpApi happy-path tests in `packages/tools/openapi-generator/test/OpenApiGenerator.test.ts` covering:
  - tagged group generation
  - fallback top-level group generation
  - endpoint annotations
  - representable parameter mappings
  - request/response encoding mappings
  - optional request-body approximation
  - class/opaque schema declaration presence

### Additional follow-up tasks

- `OpenAPISpecRequestBody` typing currently models `required` as mandatory/`true` in this repository's OpenAPI type definitions; test fixtures use a local cast for optional request-body scenarios.
- Baseline HttpApi response mapping originally ignored non-numeric response status keys; Task 4 now remaps `default` responses to explicit status codes (200/500) with warnings.

## Task 4 implementation notes

- Added supported OpenAPI security-scheme parsing into the shared parsed model (`basic`, `bearer`, `apiKey`) and surfaced these as generated `HttpApiSecurity` declarations in `httpapi` output.
- `httpapi` output now emits placeholder `HttpApiMiddleware.Service` classes for per-operation security:
  - OR-compatible single-scheme requirements become one middleware with a `security` object.
  - AND requirements are downgraded to plain placeholder middleware classes and emit `security-and-downgraded` warnings.
  - `security: []` and requirement entries containing `{}` now result in no generated security middleware for that operation.
- Implemented the Task 4 lossy warning behaviors for `httpapi` generation:
  - `cookie-parameter-dropped`
  - `additional-tags-dropped`
  - `sse-operation-skipped`
  - `response-headers-ignored`
  - `default-response-remapped` (default -> `200` when no explicit success exists, otherwise `500`)
  - `no-body-method-request-body-skipped`
- Implemented `optional-request-body-approximated` warning emission when `httpapi` generation approximates optional request bodies with `HttpApiSchema.NoContent`.
- Added focused `OpenApiGenerator.test.ts` coverage for security declaration/middleware generation, inherited vs cleared security behavior, security AND downgrade warnings, and all Task 4 lossy-warning/skip behaviors.

### Additional follow-up tasks

- Unsupported security-scheme types are currently ignored (not yet surfaced through a dedicated warning code); decide whether to introduce a new warning code in Task 5 or later.

## Implementation plan status

- ✅ Task 1 — Migrate the API and CLI to `format` for existing HttpClient modes
- ✅ Task 2 — Introduce warnings and a richer parsed model
- ✅ Task 3 — Add baseline HttpApi rendering for representable operations and opaque schema declarations
- ✅ Task 4 — Add security placeholders and lossy-feature handling
