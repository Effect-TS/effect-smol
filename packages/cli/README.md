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
