/**
 * @since 4.0.0
 */

/**
 * @category model
 * @since 4.0.0
 */
export interface Formatter<T> {
  (t: T): string
}
