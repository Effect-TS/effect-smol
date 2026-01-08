# Simple CLI Example

A demonstration CLI application showcasing Effect CLI features including shell completions.

## Features Demonstrated

- **Subcommands**: `copy`, `build`, `deploy`, `db`
- **Nested subcommands**: `deploy staging/production`, `db migrate/seed`
- **Various flag types**: boolean, string, integer, file, directory
- **Flag aliases**: `-r` for `--recursive`, `-v` for `--verbose`, etc.
- **Optional and default values**: Most flags have sensible defaults
- **Positional arguments**: File paths for copy command
- **Shell completions**: Generate completion scripts for bash, fish, zsh

## Usage

### Install dependencies

```bash
pnpm install
```

### Run directly with tsx

```bash
pnpm dev --help
pnpm dev copy --help
pnpm dev build --watch --target production
pnpm dev deploy staging --force
pnpm dev db migrate --up --count 3
```

### Build and run

```bash
pnpm build
pnpm start --help
```

## Testing Shell Completions

### Generate completion scripts

```bash
# Bash completions
pnpm dev --completions bash

# Fish completions
pnpm dev --completions fish

# Zsh completions
pnpm dev --completions zsh
```

### Install completions (bash example)

```bash
# Generate and save completion script
pnpm dev --completions bash > myapp-completion.bash

# Source it in your shell
source myapp-completion.bash

# Or install system-wide (varies by system)
sudo cp myapp-completion.bash /etc/bash_completion.d/myapp
```

### Test tab completion

After installing completions, you can test tab completion:

```bash
myapp <TAB>          # Shows: build copy db deploy
myapp deploy <TAB>   # Shows: production staging
myapp build --<TAB>  # Shows: --minify --out-dir --target --watch
```

## Command Structure

```
myapp [global-options] <command> [command-options] [args]

Global Options:
  --config, -c     Path to config file
  --verbose, -v    Enable verbose logging
  --log-level      Set log level (debug, info, warn, error)

Commands:
  copy <source> <destination>
    --recursive, -r    Copy directories recursively
    --force, -f        Overwrite existing files
    --verbose, -v      Show detailed output

  build
    --out-dir, -o      Output directory (default: ./dist)
    --target           Build target (default: development)
    --watch, -w        Watch for file changes
    --minify           Minify output

  deploy [subcommand]
    --dry-run          Show what would be deployed

    staging
      --skip-tests     Skip running tests
      --force          Force deployment

    production
      --skip-tests     Skip running tests
      --confirm        Confirm production deployment (required)

  db [subcommand]

    migrate
      --up             Run pending migrations
      --down           Rollback migrations
      --count          Number of migrations (default: 1)

    seed
      --env            Environment to seed (default: dev)
      --reset          Reset database before seeding
```
