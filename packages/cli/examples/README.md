# CLI Examples

This directory contains examples demonstrating the features of `@effect/cli`.

## Fake Git CLI

A simple fake git CLI that demonstrates:

- 🏗️ **Command Creation**: Basic command setup with descriptions
- ⚙️ **Options**: String, boolean, and integer options with aliases
- 🌳 **Subcommands**: Hierarchical command structure (git → clone/add/status/commit)
- 🤝 **Handlers**: Custom logic for each command and subcommand
- 📚 **Help System**: Automatic help generation for all commands
- 🔧 **Type Safety**: Full TypeScript support with proper typing

### Quick Start

```bash
# Navigate to the examples directory
cd packages/cli/examples

# Install dependencies
pnpm install

# Run the main command
pnpm fake-git

# Show help for the main command
pnpm fake-git:help

# Show help for a specific subcommand
tsx fake-git.ts clone --help
```

### Example Commands

```bash
# Clone a repository with options
pnpm fake-git:clone
# or
tsx fake-git.ts clone --url https://github.com/Effect-TS/effect.git --depth 1 --branch main

# Check status in different formats
pnpm fake-git:status
tsx fake-git.ts status --porcelain
tsx fake-git.ts status --short --branch

# Add files to staging
pnpm fake-git:add
tsx fake-git.ts add --files "src/*.ts"
tsx fake-git.ts add --patch

# Create commits
pnpm fake-git:commit
tsx fake-git.ts commit --message "Fix bug in parser" --author "John Doe <john@example.com>"
tsx fake-git.ts commit --message "Quick fix" --amend

# Global options work with any command
tsx fake-git.ts --verbose status
tsx fake-git.ts --version
```

### What You'll See

The fake git CLI will:

- ✅ Parse your command-line arguments correctly
- 🎯 Show structured output based on the options you provide
- 📖 Display helpful error messages for invalid input
- 🔍 Generate comprehensive help documentation automatically
- 🚀 Demonstrate real-world CLI patterns

### Key Features Demonstrated

1. **Option Types**:
   - `Options.string()` - for URLs, messages, file paths
   - `Options.boolean()` - for flags like `--all`, `--verbose`
   - `Options.integer()` - for numeric values like `--depth`

2. **Option Modifiers**:
   - `.pipe(Options.withAlias("v"))` - short aliases like `-v`
   - `.pipe(Options.withDescription("..."))` - help text
   - `.pipe(Options.optional)` - make options optional

3. **Command Structure**:
   - Main command with global options
   - Subcommands with their own specific options
   - Hierarchical help system

4. **Effect Integration**:
   - All handlers return `Effect.Effect<void, never, never>`
   - Use `Effect.gen` for sequential operations
   - Integration with `Console` for logging

### Learning Path

1. Start by running `tsx fake-git.ts --help` to see the auto-generated help
2. Try different subcommands with `--help` to see their specific options
3. Run commands with various option combinations
4. Look at the source code to understand how each part works
5. Modify the example to add your own commands and options

This example provides a solid foundation for building your own CLI applications with Effect!
