---
name: standard-jsdoc
description: Write, insert, or update Effect public API JSDoc so it satisfies the standard-jsdoc oxlint rule. Use when adding or fixing JSDoc comments, resolving standard-jsdoc diagnostics, preparing docs for JSON extraction, or reviewing public API documentation.
---

Use this skill to write well-formed JSDoc for Effect public APIs.

## Required documentation shape

Use a normal multiline JSDoc comment in TypeScript source:

```ts
/**
 * Short description as one paragraph.
 *
 * **When to use**
 *
 * Optional practical usage guidance.
 *
 * **Details**
 *
 * Optional details for complex APIs, options, overloads, or behavior.
 *
 * **Gotchas**
 *
 * Optional edge cases, footguns, or surprising behavior.
 *
 * **Example** (Short title)
 *
 * Optional prose explaining the example.
 *
 * ```ts
 * const result = example()
 * ```
 *
 * @category constructors
 * @since 1.0.0
 */
```

## Writing rules

- Use sober, practical prose.
- Do not use jargon when a plain word works.
- Do not be clever.
- Do not add filler sections.
- The short description is required and must be exactly one paragraph.
- Optional sections must appear in this order:
  1. `**When to use**`
  2. `**Details**`
  3. `**Gotchas**`
- Include an optional section only when it has useful, non-empty content.
- Use exactly one blank line between the short description, sections, examples, and tags.
- Examples must use `**Example** (Title)`, optional prose, and exactly one non-empty `ts` code fence.
- Do not use `@example`.
- Do not put TypeScript code fences outside `**Example** (Title)` sections.
- Do not document module-level comments; module JSDoc is ignored by this rule.
- `@internal` means the item is ignored; do not rewrite it as public docs.
- Default exports are ignored by this rule and do not need JSDoc.

## Tag rules

Root declarations:

- Require `@category`.
- Require `@since` with stable semver like `1.2.3`.
- May use `@deprecated` with a non-empty message.
- May use repeated non-empty `@see` tags.
- Must not use `@default`.

Namespaces and declarations inside namespaces:

- Require `@since` with stable semver like `1.2.3`.
- May use optional `@category`.
- May use `@deprecated` with a non-empty message.
- May use repeated non-empty `@see` tags.
- Must not use `@default`.

Members:

- JSDoc is optional.
- When member JSDoc is present, it must follow the same description template.
- May use optional `@since` with stable semver like `1.2.3`.
- May use `@default` with a non-empty value.
- May use `@deprecated` with a non-empty message.
- May use repeated non-empty `@see` tags.
- Must not use `@category`.

## Updating existing JSDoc

When fixing or updating existing docs:

1. Preserve correct facts and examples.
2. Rewrite the layout into the standard template.
3. Move usage guidance into `**When to use**`.
4. Move option, overload, and behavior details into `**Details**`.
5. Move caveats into `**Gotchas**`.
6. Convert `@example` tags and loose `ts` fences into `**Example** (Title)` sections.
7. Preserve valid `@see`, `@deprecated`, `@default`, `@category`, and `@since` tags.
8. Remove sections that would be empty.

## Validation

After changing JSDoc governed by the rule, run the narrowest relevant validation:

```sh
pnpm test packages/tools/oxc/test/standard-jsdoc.test.ts
pnpm check:tsgo
```

If the changed package has generated docs, also run `pnpm docgen` from that package directory.
