# CLI Semantics (Effect CLI)

This file records the intended parsing semantics with a short usage example and the test that locks it in. Examples show shell usage, not code.

- **Parent flags allowed before or after subcommand (npm-style)**  
  Example: `tool --global install --pkg cowsay` and `tool install --pkg cowsay --global`  
  Test: `packages/effect/test/unstable/cli/Command.test.ts` – "should accept parent flags before or after a subcommand (npm-style)"

- **Only the first value token may open a subcommand; later values are operands**  
  Example: `tool install pkg1 pkg2` → `install` chosen as subcommand; `pkg1 pkg2` are operands  
  Test: `packages/effect/test/unstable/cli/Command.test.ts` – "should accept parent flags before or after a subcommand (npm-style)" (second invocation covers later operands)

- **`--` stops option parsing; everything after is an operand (no subcommands/flags)**  
  Example: `tool -- child --value x` → operands: `child --value x`; subcommand `child` is not entered  
  Test: `packages/effect/test/unstable/cli/Command.test.ts` – "should treat tokens after -- as operands (no subcommand or flags)"

- **Options may appear before, after, or between operands (relaxed POSIX Guideline 9)**  
  Examples: `tool copy --recursive src dest`, `tool copy src dest --recursive`, `tool copy --recursive src dest --force`  
  Test: `packages/effect/test/unstable/cli/Command.test.ts` – "should support options before, after, or between operands (relaxed POSIX Syntax Guideline No. 9)"

- **Boolean flags default to true when present; explicit true/false literals are accepted immediately after**  
  Example: `tool --verbose deploy --target-version 1.0.0`  
  Test: `packages/effect/test/unstable/cli/Command.test.ts` – "should handle boolean flags before subcommands"

- **Unknown subcommands emit suggestions**  
  Example: `tool cpy` → suggests `copy`  
  Test: `packages/effect/test/unstable/cli/Command.test.ts` – "should suggest similar subcommands for unknown subcommands"

- **Unknown options emit suggestions (long and short)**  
  Examples: `tool --debugs copy ...`, `tool -u copy ...`  
  Tests: `packages/effect/test/unstable/cli/Command.test.ts` – "should suggest similar options for unrecognized options" and "should suggest similar short options for unrecognized short options"

- **Repeated key=value flags merge into one map**  
  Example: `tool env --env foo=bar --env cool=dude` → `{ foo: "bar", cool: "dude" }`  
  Test: `packages/effect/test/unstable/cli/Command.test.ts` – "should merge repeated key=value flags into a single record"

- **Parent context is accessible inside subcommands**  
  Example: `tool --global install --pkg cowsay` → subcommand can read `global` from parent context  
  Test: `packages/effect/test/unstable/cli/Command.test.ts` – "should allow direct accessing parent config in subcommands"

If you add or change semantics, update this file and reference the exact test that proves the behavior.
