## CLI parsing overview

This document explains how the CLI parses argv into typed inputs. The flow is:

- lex argv into tokens and split trailing operands with `--`
- peel built-in flags (help, log-level)
- parse per-command using a single-pass scanner with optional recursion for subcommands
- map parsed strings to typed values using Param primitives

### Lexing

- Input is tokenized into one of:
  - LongOption: `--name` or `--name=value`
  - ShortOption: `-n` or `-n=value` or `-abc` (emits `-a`, `-b`, `-c`)
  - Value: any non-dash argument
- `--` acts as an end-of-options delimiter; anything after it becomes `trailingOperands` and is not tokenized.

### Built-in flags extraction

- We extract built-ins before normal parsing using `peelForSingles`, which:
  - walks tokens once, recognizing only the provided built-in singles
  - consumes associated value tokens (or explicit boolean literals) when present
  - returns `{ options, remainder }`, where `remainder` preserves token order for downstream parsing
- Parsed results: `{ help: boolean, logLevel: Option<LogLevel>, remainder: Token[] }`

### Single-pass command parser

`parseArgs` uses `scanLevel` to parse one command level and optionally recurse for a subcommand.

Inputs to `scanLevel`:

- tokens: tokens to parse at this level (excludes `trailingOperands`)
- command: the current command descriptor
- optionSingles: flattened option singles from the command config
- commandPath: the accumulated path for error messages
- recordUnknownOptionErrors: whether to record errors for unrecognized options

Algorithm:

- Build an alias map `aliasOrName -> canonical Single`.
- Scan tokens left-to-right once:
  - Option token:
    - if not in lookup: record `UnrecognizedOption` (with suggestions) if enabled; continue
    - if inline value present (`--x=v` / `-x=v`): record it
    - else if boolean: consume next token if it is an explicit boolean literal; otherwise imply `true`
    - else if next is a `Value`: consume as the option's value; otherwise leave missing (Param layer reports `MissingOption` later)
  - Value token:
    - if it matches a subcommand name: stop scanning and return `sub` with remaining tokens for the child
    - else treat as a positional operand for this level

Outputs of `scanLevel`:

- Leaf: `{ options, operands, errors }`
- Sub: `{ options, parentOperands, sub, childTokens, errors }`

### Recursion and operand merging

- `parseArgs` merges `trailingOperands` from lex into the parent’s operands:
  - leaf: `operands = leaf.operands + trailingOperands`
  - sub: `operands = parentOperands + trailingOperands` and then recurses into the child with `childTokens`

### Mapping to typed input

- After `parseArgs`, `Command.parse` calls each `Param` in `parsedConfig.paramOrder` to turn strings into typed values.
- It reconstructs the user’s config shape (`reconstructConfigTree`), which is passed to the command handler.

### Errors and suggestions

- Unknown option at a level → `UnrecognizedOption` with suggestions (nearest matches among names and aliases)
- Unknown subcommand → `UnknownSubcommand` with suggestions
- Missing/invalid values are surfaced by Param parsing as `MissingOption` / `InvalidValue`

### Complexity and guarantees

- Single O(n) scan per level; recursion only when a subcommand boundary is found
- No mutation of input arrays; preserves token order for remainder/child
- Canonicalization ensures all aliases map to one canonical option name

### Notes

- Booleans accept explicit literals immediately following the flag: `--flag false` → false
- `--` delimiter reliably separates remaining operands from further option parsing
- The same scanning principles are used to peel built-ins before user command parsing

## Proposed improvements

- Precompute option lookups
  - What: Build `aliasOrName -> Single` maps once per command at construction (e.g., store on `parsedConfig`).
  - Why: Avoid re-building the map on every `parseArgs` call; simplifies `scanLevel` signature.
  - How: Extend `parseConfig` to compute `optionLookup: Map<string, Single>` and `canonicalNames: string[]`. Update `scanLevel` to accept the precomputed map and the canonical name list for initializing the options store.
  - Edge cases: Keep duplicate detection at build time; surface a `DuplicateOption` error early.

- Duplicate alias/name error type
  - What: Replace throws in `buildLookup` with `CliError.DuplicateOption` (with parent/child where known).
  - Why: Better error reporting and consistency with other CLI errors.
  - How: Either (a) move duplicate detection entirely into `withSubcommands` (already checks parent vs child), and (b) for intra-command duplicates, throw `CliError.DuplicateOption` when constructing the lookup.

- GNU-style negative booleans (`--no-flag`)
  - What: Recognize `--no-<name>` as setting boolean flag `<name>` to `false`.
  - Why: Common CLI convention; complements explicit boolean literal support.
  - How: In `scanLevel`, when seeing a `LongOption` whose name starts with `no-`, look up `<name>` (without `no-`). If it resolves to a boolean Single, push `"false"` into that option.
  - Edge cases: If both `--flag` and `--no-flag` are present, keep last-wins semantics (current array preserves order; Param can pick first/last by policy).

- Short option value ergonomics
  - What: Support `-p8080` as `-p=8080`. For grouped flags with value `-abc=1`, treat as `-a -b -c=1`.
  - Why: Improves UX; aligns with many CLIs.
  - How: Adjust lexer:
    - If an arg starts with a single `-` and has no `=` and length > 2 and the second char is a letter, emit `ShortOption(flag: first char, value: rest)`.
    - If there is an `=` in a multi-flag cluster, split all but the last into individual short options and assign the value to the last.
  - Tests: Add cases for `-p8080`, `-abc=1`, and ensure existing `-abc` still emits three flags.

- Unify single-flag peeling
  - What: Replace `peelForSingles` with a reusable `scanForSingles(tokens, singles)` helper shared by built-ins and any future pre-scan needs.
  - Why: Single source of truth; smaller surface area.
  - How: Extract from `scanLevel` core option-handling logic with a mode that ignores subcommands and accumulates an accurate `remainder`.

- Configurable error strategy (fail-fast vs accumulate)
  - What: Option to stop on the first unrecognized option/subcommand or collect all at a level.
  - Why: Some consumers prefer a single actionable error; others want full diagnostics.
  - How: Add a flag on `CommandConfig` (e.g., `errorMode: "first" | "all"`) and pass to `scanLevel`.

- Early required-option diagnostics (optional)
  - What: Emit `MissingOption` errors at the scanning leaf when an option is non-optional and absent.
  - Why: Earlier, clearer feedback before Param parsing.
  - How: From `parsedConfig`, compute which options are required (using `getParamMetadata` to detect Optional/Variadic). At leaf, for each required option with zero collected values, push `MissingOption`.
  - Edge cases: Respect `Flag.optional`, `withDefault`, and variadic min constraints; avoid duplicating Param logic if it complicates maintenance.

- Lexer resilience and doc parity
  - What: Expand docs with concrete tokenization tables; add more tests (goldens) for complex inputs.
  - Why: Keeps behavior well-specified and prevents regressions.
  - How: Add dedicated lexer tests for: `--`, `--name=value`, `-abc`, `-p8080`, `-abc=1`, values that look like booleans, and subcommand boundaries.

## Low-risk simplifications (no behavior changes)

1. Factor small helpers used by both scanners
   - What: Extract utilities to remove duplication and clarify intent:
     - `getOptionKey(token)`: returns the lookup key for option tokens (`LongOption` name or `ShortOption` flag)
     - `initOptionStore(singles)`: builds the `{ name: [] }` map
     - `consumeOption({ token, next, single, store })`: handles inline value, boolean explicit literal, and next-value consumption, returning how many tokens were consumed (1 or 2)
     - `collectValidFlagNames(singles)`: flattens names and aliases once
   - Why: Both `scanLevel` and `peelForSingles` implement the same micro-steps; extracting them reduces cognitive load and opportunities for drift.
   - Notes: Pure refactor; same inputs/outputs.

2. Tighten and name types
   - What: Introduce local aliases to reduce generic noise and improve readability:
     - `type Singles = ReadonlyArray<Single<unknown, "option">>`
     - `type OptionStore = Record<string, Array<string>>`
     - `type Tokens = ReadonlyArray<Token>`
   - Why: Makes function signatures and local variables easier to scan.
   - Notes: No runtime changes; keeps exported types intact.

3. Rename internal variables for clarity
   - What: `firstValue` → `firstOperand` (what it really is), `optionSingles` → `optionParams`, `childTokens` → `subTokens`.
   - Why: Improves self-documentation without altering shapes.
   - Notes: Only local rename; result object field names stay the same to avoid churn.

4. Consolidate unknown-subcommand error construction
   - What: Create `unknownSubcommandError(firstOperand, subcommands, path)` used from `scanLevel`.
   - Why: Centralizes suggestion formatting and message consistency.
   - Notes: Pure extraction; identical error values.

5. Normalize control flow with early returns
   - What: In both `scanLevel` and `peelForSingles`, replace nested branches with guard-style early returns where possible and group the three option-handling cases (inline, boolean, next-value) under a single `switch`-like structure.
   - Why: Flatter code is easier to read and reason about; avoids repeated `continue`s.
   - Notes: Keep exact token-consumption semantics; run tests after to verify.

## Two-phase parsing (Route → Parse)

High-level alternative that separates command routing from flag parsing:

- Phase 1 (Route): Identify the command path by scanning only Value tokens for subcommand names, producing per-level token segments: parentTokens, subcommandName, childTokens.
- Phase 2 (Parse): For each segment, run the same single-pass option scan to produce `{ options, operands, errors }`, and recurse into the child segment if present.

Benefits

- Option parsing logic never needs to think about subcommand boundaries.
- Unknown-option checks are trivially scoped to each segment.
- Built-ins continue to be peeled before Phase 1.

Example

Input argv:

```
git --verbose clone --depth=1 https://host/repo -- branchName
```

Lex (simplified):

```
[ Value("git"), LongOption("verbose"), Value("clone"), LongOption("depth", value="1"),
  Value("https://host/repo"), Value("--"), Value("branchName") ]
```

Phase 1 (Route):

- Root segment (command `git`): parentTokens = [ --verbose ], first subcommand name encountered = "clone"
- Child segment (command `clone`): childTokens = [ --depth=1, https://host/repo ]
- `--` splits trailingOperands = [ "branchName" ] (belong to parent)

Phase 2 (Parse):

- Parse root segment with `git` options: `{ options: { verbose: ["true"] }, operands: [], errors: [] }`
- Parse clone segment with `clone` options: `{ options: { depth: ["1"] }, operands: ["https://host/repo"], errors: [] }`
- Merge trailingOperands into the parent’s operands at the leaf/sub-boundary as per current semantics.

Mermaid diagram

```mermaid
flowchart TD
    A[argv] --> B[Lex]
    B --> C{Built-ins peel}
    C -->|remainder tokens| D[Phase 1: Route]
    D -->|parentTokens| E[Phase 2: Parse parent]
    D -->|subcommand name| F[Lookup child command]
    D -->|childTokens| G[Phase 2: Parse child]
    B --> H[Trailing operands (--)]
    E --> I[Parent Parsed]
    G --> J[Child Parsed]
    H --> K[Merge into parent operands]
    I --> L[Combine tree]
    J --> L
    K --> L
```
