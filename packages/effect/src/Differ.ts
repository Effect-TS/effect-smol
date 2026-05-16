/**
 * @since 4.0.0
 */

/**
 * Describes how to compute, combine, and apply patches for values of type `T`.
 *
 * A `Differ` provides an empty patch, computes the patch between two values,
 * combines patches, and applies a patch to an old value to produce an updated
 * value.
 *
 * @category Model
 * @since 4.0.0
 */
export interface Differ<in out T, in out Patch> {
  readonly empty: Patch
  diff(oldValue: T, newValue: T): Patch
  combine(first: Patch, second: Patch): Patch
  patch(oldValue: T, patch: Patch): T
}
