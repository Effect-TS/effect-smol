# @effect/cli

Command line interface utilities for Effect.

## Installation

```bash
npm install @effect/cli
```

## Documentation

For detailed information and usage examples, please visit the [Effect website](https://effect.website).

## Contributing

Thank you for considering contributing to @effect/cli! For contribution guidelines, please see the [Effect contribution guide](https://github.com/Effect-TS/effect/blob/main/CONTRIBUTING.md).

## License

The MIT License (MIT)

## Todo

- [ ] Add Support for Default Values in Help Text: In HelpFormatter.formatHelpDoc, boolean flags show no default, but others could note defaults (e.g., " (default: false)"). Extract defaults from withDefault combinators during getHelpDoc and include them in descriptions for better user guidance.
- [ ] Add Type Safety for Command Names in Command.make: Command names are strings without validation (e.g., no checks for invalid characters like spaces). Introduce a branded type (e.g., type CommandName = string & { \_brand: "CommandName" }) and a validator function to ensure names are kebab-case or alphanumeric, reducing runtime errors from invalid CLI invocations

# effect-smol

## CLI Package Implementation Status

### Overview

We're building a comprehensive CLI library with three main modules: **Flag** (option flags), **Argument** (positional arguments), and **Command** (full CLI commands). Based on the reference implementation, here's what we need to complete:

### =� Flag Module (Options)

**Status**: Basic constructors implemented (string, boolean)

#### Missing Constructors (High Priority)

- [ ] `choice(name, choices)` / `choiceWithValue(name, kvPairs)` - enum-like selector
- [ ] `date(name)` - date parsing
- [ ] `directory(name, cfg?)` / `file(name, cfg?)` - file system validation
- [ ] `fileContent(name)` / `fileText(name)` - read file contents
- [ ] `fileParse(name, format?)` / `fileSchema(name, schema, format?)` - structured file parsing
- [ ] `float(name)` / `integer(name)` - numeric types
- [ ] `keyValueMap(option)` - `--foo key=val` style options
- [ ] `redacted(name)` / `secret(name)` - sensitive data handling
- [ ] `none` - empty sentinel
- [ ] `all(arg)` - build composite from iterable/tuple/object

#### Missing Combinators (High Priority)

- [ ] `map`, `mapEffect`, `mapTryCatch` - value transformations
- [ ] `optional`, `withDefault(fallback)` - optional values with defaults
- [ ] `repeated`, `atLeast(n)`, `atMost(n)`, `between(min,max)` - cardinality
- [ ] `filterMap(f,msg)` - partial mapping with custom errors
- [ ] `orElse(that)`, `orElseEither(that)` - fallback composition
- [ ] `withAlias(alias)`, `withDescription(text)`, `withPseudoName(name)` - metadata
- [ ] `withSchema(schema)`, `withFallbackConfig(config)`, `withFallbackPrompt(prompt)` - validation

#### Missing Utilities (Medium Priority)

- [ ] `getHelp`, `getIdentifier`, `getUsage`, `isBool` - introspection
- [ ] `parse(...)`, `processCommandLine(...)`, `wizard(config)` - runtime helpers

### =� Argument Module (Positional Arguments)

**Status**: Basic facade implemented

#### Missing Constructors (High Priority)

- [ ] `choice(kvPairs)`, `date()` - structured types
- [ ] `directory()`, `file()`, `fileContent()`, `fileText()` - file system
- [ ] `fileParse(format?)`, `fileSchema(schema, format?)` - structured parsing
- [ ] `float()`, `integer()`, `path()` - basic types
- [ ] `redacted()`, `secret()` - sensitive data
- [ ] `none` - empty sentinel
- [ ] `all(arg)` - aggregate multiple Args

#### Missing Combinators (High Priority)

- [ ] `repeated`, `atLeast(n)`, `atMost(n)`, `between(min,max)` - cardinality
- [ ] `map`, `mapEffect`, `mapTryCatch` - transformations
- [ ] `optional`, `withDefault`, `withFallbackConfig` - defaults
- [ ] `withDescription`, `withSchema` - metadata and validation

#### Missing Metadata/Utils (Medium Priority)

- [ ] `getHelp`, `getIdentifier`, `getMinSize`, `getMaxSize`, `getUsage` - introspection
- [ ] `validate(args, cfg)`, `wizard(cfg)` - runtime utilities

### � Command Module

**Status**: Core functionality implemented (make, withHandler, withSubcommands, withDescription, run)

#### Missing Constructors (Medium Priority)

- [ ] `prompt(name, prompt, handler)` - interactive command creation
- [ ] `fromDescriptor(descriptor [, handler])` - lift pre-built CommandDescriptor

#### Missing Accessors (Medium Priority)

- [ ] `getNames(cmd)` - all invocation names/aliases
- [ ] `getSubcommands(cmd)` - map of nested descriptors
- [ ] `getBashCompletions`, `getFishCompletions`, `getZshCompletions` - shell completion

#### Missing Combinators (Medium Priority)

- [ ] `provide(layer)` - dependency injection
- [ ] `provideEffect(tag, eff)` / `provideEffectDiscard(eff)` - effect injection
- [ ] `provideSync(tag, svc)` - sync service injection
- [ ] `transformHandler(f)` - wrap handler effect

#### Missing Utilities (Low Priority)

- [ ] `wizard(prefix, cfg)` - guided CLI wizard (different from run)

### =' Infrastructure (Low Priority)

- [ ] TypeId symbols and guards for Flag/Argument modules
- [ ] Ensure all combinators work with pipe syntax (curried)
- [ ] Shell completion system integration

### [x] Already Implemented

- [x] Core Command structure with subcommands
- [x] Basic Flag constructors (string, boolean)
- [x] Argument facade structure
- [x] Help system with ShowHelp error handling
- [x] Command parsing and execution pipeline
- [x] Built-in options (--help, --log-level)

---

**Next Steps**: Focus on high-priority Flag and Argument constructors and combinators to achieve feature parity with the reference implementation.
