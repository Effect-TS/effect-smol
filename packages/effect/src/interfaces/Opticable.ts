/**
 * The unique identifier used to identify objects that implement the `Equal` interface.
 *
 * @since 2.0.0
 */
export const symbol = "~effect/interfaces/Opticable"

/**
 * @category Models
 * @since 2.0.0
 */
export interface Opticable {
  [symbol]<T extends object>(this: T, patch?: Partial<T>): T
}

/**
 * @category Guards
 * @since 2.0.0
 */
export const isOpticable = (u: unknown): u is Opticable => {
  return typeof u === "object" && u != null && symbol in u
}

/**
 * @category Opticable
 * @since 2.0.0
 */
export const patch = <T extends Opticable>(opticable: T, patchObj?: Partial<T> | undefined): T => {
  return opticable[symbol](patchObj)
}
