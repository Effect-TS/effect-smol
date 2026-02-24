# AI docs

`LLMS.md` is generated from `ai-docs/src`.

## Add content

1. Add or update markdown in `ai-docs/src/**/index.md` for section intro text.
2. Add examples as `.ts` files in the same folder.
3. Run `pnpm ai-docgen` to regenerate `LLMS.md`.

## Source file conventions

- Use numeric filename prefixes to control ordering (`10_`, `20_`, etc).
- If a `.ts` filename starts with `0`, its code is inlined into `LLMS.md`, this should almost never be done so don't do it by default.
- If a `.ts` filename does not start with `0`, it is listed as a linked reference.
- Use a top JSDoc block with `@title` and optional description to control rendered title/description.

## Example guidelines

All code examples should be well commented explaining the how and why of the
code, not just what the code is doing. The goal is to teach users how to use the
API.

**Code must represent real world usage and best practices.**
Do not include toy examples that are not representative of how the API should be
used in practice.

## Regeneration

- One-shot: `pnpm ai-docgen`
- Watch mode: `pnpm ai-docgen:watch`

`pnpm ai-docgen` regenerates `LLMS.md` files from content in `ai-docs/src`.
