/**
 * Display helpers for atom devtools.
 *
 * @since 1.0.0
 */
import type * as Atom from "effect/unstable/reactivity/Atom"

/**
 * @since 1.0.0
 * @category utils
 */
export const getLabel = (atom: Atom.Atom<any>): string => atom.label?.[0] ?? String(atom)

/**
 * @since 1.0.0
 * @category utils
 */
export const truncate = (str: string, max: number): string => str.length > max ? str.slice(0, max) + "..." : str

/**
 * @since 1.0.0
 * @category utils
 */
export const valuePreview = (value: unknown): string => {
  try {
    return truncate(JSON.stringify(value), 50)
  } catch {
    return String(value)
  }
}
