# CLI Package Development Notes

## Overview

This document tracks the development of the Effect CLI package, including design decisions, implementation details, and patterns.

## Current Architecture

### Command-Line Argument Parsing

The CLI package implements a robust command-line argument parser with hierarchical command support and structured error handling.

#### 1. **Hierarchical Parsing Pipeline**

- `parseCommandArgs`: Parses raw arguments into `ParsedCommandArgs` with subcommand support
- `parseOptions`: Converts string option values to typed values using primitives
- `CommandDescriptor.parseRaw`: Main entry point combining both stages
- Full support for nested subcommands with independent option sets

#### 2. **Structured Error Handling**

All parsing operations return structured `CliError` types instead of generic strings:

- `UnrecognizedOption`: Unknown command-line flags
- `MissingOption`: Required options not provided
- `InvalidValue`: Value parsing failures (wrong type, format, etc.)
- `DuplicateOption`: Conflicting option names between parent/child commands

#### 3. **Option Features**

- **Aliases**: Multiple aliases per option (e.g., `-f` for `--force`)
- **Clustered Flags**: Unix-style clustering (`-abc` = `-a -b -c`)
- **Mixed Clusters**: Clusters with values (`-afo output.txt`)
- **Equal Sign Syntax**: Both `--name=value` and `-n=10` supported
- **Smart Booleans**: Three states (absent→false, present→true, explicit value)
- **Optional Options**: Options with default values that never fail with MissingOption

#### 4. **Subcommand Architecture**

- Git-style hierarchical commands (`myapp deploy production --force`)
- Independent option parsing per command level
- Automatic conflict detection between parent/child options
- Mode A semantics: parent commands claim conflicting flags

#### 5. **Option Combinators**

- `Options.map`: Transform parsed values
- `Options.mapEffect`: Effectful transformations
- `Options.withAlias`: Add command-line aliases
- `Options.optional`: Make options optional with default values
- `Options.withDefault`: Pipe-friendly way to add default values
- Tree traversal automatically handles nested combinators

### Key Data Structures

```typescript
interface ParsedCommandArgs {
  options: Record<string, ReadonlyArray<string>> // Option name → values
  operands: ReadonlyArray<string> // Non-option arguments
  subcommand?: {
    // Optional nested subcommand
    name: string
    args: ParsedCommandArgs
  }
}

// Structured error types instead of strings
type CliError = UnrecognizedOption | MissingOption | InvalidValue | DuplicateOption
```

### Implementation Patterns

1. **Recursive Subcommand Parsing**: Each command level processes its options first, then delegates to subcommands

2. **Structured Error Types**: All failures return specific `CliError` instances with detailed context

3. **Option Tree Traversal**: Automatically extracts `Single` options from nested combinator structures

4. **Token-Based Lexing**: Separates tokenization from parsing logic for clean architecture

## Design Decisions

### Structured Error Types Over Strings

Instead of returning generic error strings, all CLI parsing operations return structured `CliError` types with specific error categories and detailed context. This provides:

- Better type safety and error handling
- Consistent error messages and formatting
- Programmatic error inspection and recovery
- Clear separation between different failure modes

### Hierarchical Command Architecture

Commands support unlimited nesting with independent option sets per level:

- Parent commands process their options first
- Subcommands inherit context but maintain option independence
- Automatic conflict detection prevents ambiguous flag meanings
- Mode A semantics ensure predictable flag resolution

### Array-Based Option Storage

All option values are stored in arrays to prepare for future features:

- Currently only first value is used for most options
- Ready for `Options.repeated` combinator implementation
- Consistent data structure across all option types
- Simplifies internal parsing logic

### Smart Boolean Options

Boolean options support three distinct states for maximum flexibility:

- Absent: defaults to `false`
- Present without value (`--verbose`): becomes `true`
- Present with explicit value (`--verbose=false`): uses parsed value

### Combinator Tree Traversal

Option combinators can be arbitrarily nested, and the parser automatically extracts all `Single` options through recursive tree traversal. This enables powerful composition while maintaining simple parsing logic.

## Testing Strategy

- Comprehensive coverage using `@effect/vitest` with `it.effect` patterns
- Edge case testing for clustered flags, equal signs, and boolean values
- Integration tests across the full parsing pipeline
- Structured error testing with proper `CliError` type assertions
- Subcommand interaction and conflict detection testing

## Built-in Help System

### Overview

The CLI package includes automatic `--help` flag support that works out-of-the-box for all commands without any configuration required.

### How It Works

1. **Control Flow via Error Channel**: Uses a `ShowHelp` error type for elegant control flow
2. **Early Detection**: Help flags (`--help` or `-h`) are detected during argument parsing
3. **Contextual Help**: Shows help for the exact command/subcommand where help was requested
4. **Automatic Integration**: `Command.run` catches `ShowHelp` and displays formatted help

### Usage Examples

```bash
# Show help for root command
myapp --help
myapp -h

# Show help for specific subcommand
myapp deploy --help
myapp admin users list --help

# Help flag position doesn't matter
myapp --verbose --help --force
```

### Implementation Details

- **ShowHelp Error**: Special error type in `CliError.ts` that carries command path context
- **Parser Integration**: `parseCommandArgs` detects help flags and returns `ShowHelp`
- **Command.run Handler**: Catches `ShowHelp`, generates help via `CommandDescriptor.getHelpDoc()`, and displays it using `HelpFormatter`
- **Zero Configuration**: Works automatically for all commands and subcommands

### Optional Options

Optional options provide default values when not specified by the user, eliminating `MissingOption` errors:

```typescript
// Constructor approach
const port = Options.optional(Options.integer("port"), 8080)

// Pipe-friendly combinator approach
const port = Options.integer("port").pipe(Options.withDefault(8080))
```

**Key Behaviors:**

- When option is not provided: returns the default value
- When option is provided: uses normal parsing logic
- Works with all option types including primitives, mapped options, and complex combinators
- Boolean options with optional wrapper respect their inherent behavior (absent without default = false, present without value = true)
- Properly handles aliases by checking if any alias was provided

### Positional Arguments Support

The CLI package now includes first-class support for positional arguments through the `Args` module:

```typescript
import * as Args from "@effect/cli/Args"

// Basic positional arguments
const filename = Args.string("filename")
const count = Args.integer("count")
const inputFile = Args.file("input", "yes") // Must exist
const outputDir = Args.directory("output", "no") // Must not exist

// Optional positional arguments
const version = Args.string("version").pipe(Args.optional)

// Positional arguments with defaults
const port = Args.integer("port").pipe(Args.withDefault(8080))

// Variadic positional arguments
const files = Args.string("files").pipe(Args.variadic()) // Any number
const sources = Args.string("sources").pipe(Args.variadic({ min: 1 })) // At least 1
const items = Args.string("items").pipe(Args.variadic({ min: 1, max: 5 })) // 1-5 items
```

**Key Features:**

- **Type-safe**: Same type safety as Options module
- **Validation**: Built-in file/directory existence checking
- **Combinators**: optional, withDefault, withDescription, variadic
- **Mixed usage**: Works seamlessly with options/flags
- **Order matters**: Positional args are parsed in declaration order

**Design Pattern:**

The Args module follows the same pattern as Options - a thin facade around Param that only exposes positional argument constructors and guarantees kind="positional" through branding.

## Future Considerations
- **Enhanced Validation**: Could add post-parsing validators (e.g., port ranges, file existence checks).
- **Shell Completion**: Structured command/option metadata could drive shell completion generation.
- **Configuration Files**: The option system could be extended to merge command-line args with config file values.
- **Custom Help Formatters**: Allow users to provide custom help formatting functions for different output styles (markdown, man pages, etc.).
