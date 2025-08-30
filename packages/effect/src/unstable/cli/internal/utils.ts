/**
 * @since 4.0.0
 * @internal
 */

/**
 * Creates objects with a shared prototype in a type-safe manner.
 * This pattern improves performance by reusing the same prototype
 * and provides better type safety than manual Object.create usage.
 *
 * @example
 * ```ts
 * const CommonProto = {
 *   pipe() { return pipeArguments(this, arguments) }
 * }
 *
 * const create = createWithCommonProto(CommonProto)
 *
 * const myObject = create<MyType>({
 *   _tag: "MyTag",
 *   value: 42
 * })
 * ```
 *
 * @internal
 */
export const createWithCommonProto = <P extends object = object>(
  proto: P
) =>
<T>(
  params: Omit<T, keyof P>
): T => {
  return Object.assign(
    Object.create(proto),
    params
  ) as T
}
