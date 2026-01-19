---
root: false
targets: ["*"]
description: "Effect library conventions and code organization guidelines"
globs: ["**/*.ts", "**/*.tsx"]
---

# Code Style Guidelines

## Effect Library Conventions

- Follow existing TypeScript patterns in the codebase
- Use functional programming principles
- Maintain consistency with Effect library conventions
- Use proper Effect constructors (e.g., `Array.make()`, `Chunk.fromIterable()`)
- Prefer `Effect.gen` for monadic composition
- Use `Data.TaggedError` for custom error types
- Implement resource safety with automatic cleanup patterns

## Code Organization

- Follow existing file structure and naming conventions
- Delete old code when replacing functionality
- Choose clarity over cleverness in all implementations
