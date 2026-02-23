/**
 * Immutable path-based value manipulation utilities.
 *
 * @since 1.0.0
 */

/**
 * @since 1.0.0
 * @category utils
 */
export const setAtPath = (root: unknown, path: ReadonlyArray<string>, value: unknown): unknown => {
  if (path.length === 0) return value
  const [head, ...tail] = path
  if (Array.isArray(root)) {
    const copy = [...root]
    copy[Number(head)] = setAtPath(copy[Number(head)], tail, value)
    return copy
  }
  return { ...(root as any), [head]: setAtPath((root as any)[head], tail, value) }
}

/**
 * @since 1.0.0
 * @category utils
 */
export const removeAtPath = (root: unknown, path: ReadonlyArray<string>): unknown => {
  if (path.length === 0) return root
  if (path.length === 1) {
    if (Array.isArray(root)) return root.filter((_, i) => i !== Number(path[0]))
    const { [path[0]]: _, ...rest } = root as Record<string, unknown>
    return rest
  }
  const [head, ...tail] = path
  if (Array.isArray(root)) {
    const copy = [...root]
    copy[Number(head)] = removeAtPath(copy[Number(head)], tail)
    return copy
  }
  return { ...(root as any), [head]: removeAtPath((root as any)[head], tail) }
}

/**
 * @since 1.0.0
 * @category utils
 */
export const appendToArray = (root: unknown, path: ReadonlyArray<string>, value: unknown): unknown => {
  if (path.length === 0) {
    if (Array.isArray(root)) return [...root, value]
    return root
  }
  const [head, ...tail] = path
  if (Array.isArray(root)) {
    const copy = [...root]
    copy[Number(head)] = appendToArray(copy[Number(head)], tail, value)
    return copy
  }
  return { ...(root as any), [head]: appendToArray((root as any)[head], tail, value) }
}

/**
 * @since 1.0.0
 * @category utils
 */
export const addKeyToObject = (root: unknown, path: ReadonlyArray<string>, key: string, value: unknown): unknown => {
  if (path.length === 0) {
    return { ...(root as any), [key]: value }
  }
  const [head, ...tail] = path
  if (Array.isArray(root)) {
    const copy = [...root]
    copy[Number(head)] = addKeyToObject(copy[Number(head)], tail, key, value)
    return copy
  }
  return { ...(root as any), [head]: addKeyToObject((root as any)[head], tail, key, value) }
}

/**
 * @since 1.0.0
 * @category utils
 */
export const parseValue = (input: string, current: unknown): unknown => {
  if (input === "null") return null
  if (input === "undefined") return undefined
  if (input === "true") return true
  if (input === "false") return false
  if (typeof current === "number") {
    const n = Number(input)
    if (!Number.isNaN(n)) return n
  }
  try {
    return JSON.parse(input)
  } catch {
    return input
  }
}
