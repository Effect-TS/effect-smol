/**
 * @since 4.0.0
 */

/**
 * @since 4.0.0
 */
export * as AST from "./AST.ts"

/**
 * Design: "pretty good" persistency.
 * Real updates copy only the path; unrelated branches keep referential identity.
 * No-op updates may still allocate a new root/parents — callers must not rely on identity for no-ops.
 *
 * @since 4.0.0
 */
export * as Optic from "./Optic.ts"
