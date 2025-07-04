# Claude Instructions

## Project Overview
This is the Effect library repository, focusing on functional programming patterns and effect systems in TypeScript.

## Development Workflow
- Always run tests after making changes: `pnpm test <file>`
- Run type checking: `pnpm check`
- Run linting and fix formatting: `pnpm lint --fix`
- Build the project: `pnpm build`
- **CRITICAL**: Check JSDoc examples compile: `pnpm docgen` - MUST PASS before committing
- Always lint files that are changed
- Always check for type errors before committing: `pnpm check`
- **MANDATORY**: Always run docgen to check for examples errors before committing

## Documentation Examples
- **CRITICAL REQUIREMENT**: Check that all JSDoc examples compile: `pnpm docgen`
- This command extracts code examples from JSDoc comments and type-checks them
- **ABSOLUTELY NEVER COMMIT if docgen fails** - Fix ANY and ALL compilation errors in examples before committing
- **MANDATORY**: `pnpm docgen` must pass with ZERO errors before any commit
- **ZERO TOLERANCE**: Even pre-existing errors must be fixed before committing new examples
- **NEVER remove examples to make docgen pass** - Fix the type issues properly instead
- Examples should use correct imports and API usage
- **IMPORTANT**: Only edit `@example` sections in the original source files (e.g., `packages/effect/src/*.ts`)
- **DO NOT** edit files in the `docs/examples/` folder - these are auto-generated from JSDoc comments
- **CRITICAL**: When the JSDoc analysis tool reports false positives (missing examples that actually exist), fix the tool in `scripts/analyze-jsdoc.mjs` to correctly detect existing examples

### Writing Examples Guidelines
- Always check test code to ensure the example reflects correct usage
- **MANDATORY**: All examples must compile without errors when docgen runs
- **CRITICAL**: Use proper JSDoc `@example title` tags, not markdown-style `**Example**` headers
- Convert any existing `**Example** (Title)` sections to `@example Title` format
- Always wrap example code in \`\`\`ts \`\`\` code blocks
- **CRITICAL**: NEVER use `any` type or `as any` assertions in examples - always use proper types and imports
- **FORBIDDEN**: Never use `declare const Service: any` - import actual services or use proper type definitions
- Avoid use of `as unknown` - prefer proper constructors and type-safe patterns
- Make sure category tag is set (e.g., `@category models`, `@category constructors`)
- Use proper Effect library patterns and constructors (e.g., `Array.make()`, `Chunk.fromIterable()`)
- Add explicit type annotations when TypeScript type inference fails
- **NEVER remove examples to fix compilation errors** - always fix the underlying type issues

### Common Issues
- Missing imports (e.g., `Effect`, `Stream`, `Console`)
- Using non-existent API methods
- Type mismatches in function signatures
- Incorrect generic type arguments
- Missing type annotations causing implicit `any` types
- Using direct type assertions instead of proper constructors

## Code Style Guidelines
- Follow existing TypeScript patterns in the codebase
- Use functional programming principles
- Maintain consistency with Effect library conventions
- No comments unless explicitly requested
- Follow existing file structure and naming conventions

## Testing
- Test files are located in `packages/*/test/` directories for each package
- Main Effect library tests: `packages/effect/test/`
- Platform-specific tests: `packages/platform-*/test/`
- Use existing test patterns and utilities
- Always verify implementations with tests
- Run specific tests with: `pnpm test <filename>`

## Git Workflow
- Main branch: `main`
- Create feature branches for new work
- Only commit when explicitly requested
- Follow conventional commit messages

## Packages
- `packages/effect/` - Core Effect library
- `packages/platform-node/` - Node.js platform implementation
- `packages/platform-node-shared/` - Shared Node.js utilities
- `packages/platform-bun/` - Bun platform implementation
- `packages/vitest/` - Vitest testing utilities

## Key Directories
- `packages/effect/src/` - Core Effect library source code
- `packages/effect/test/` - Effect library test files
- `packages/effect/dtslint/` - TypeScript definition tests
- `packages/effect/src/internal/` - Internal implementation details
- `packages/effect/src/schema/` - Schema validation and parsing
- `packages/effect/src/unstable/` - Experimental features (e.g., HTTP client)
- `packages/platform-node/src/` - Node.js platform source code
- `packages/platform-node/test/` - Node.js platform tests
- `packages/platform-node-shared/src/` - Shared Node.js utilities source
- `packages/platform-node-shared/test/` - Shared Node.js utilities tests
- `packages/platform-bun/src/` - Bun platform source code
- `packages/vitest/src/` - Vitest utilities source code
- `packages/vitest/test/` - Vitest utilities tests
- `scripts/` - Build and maintenance scripts
- `bundle/` - Bundle size analysis files

## Performance Considerations
- Prefer eager evaluation patterns where appropriate
- Consider memory usage and optimization
- Follow established performance patterns in the codebase