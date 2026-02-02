/**
 * @since 1.0.0
 */
import type * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import type { JSX } from "solid-js"
import { createComponent, createContext, onCleanup } from "solid-js"

/**
 * @since 1.0.0
 * @category context
 */
export function scheduleTask(f: () => void): () => void {
  const timeout = setTimeout(f, 0)
  return () => clearTimeout(timeout)
}

/**
 * @since 1.0.0
 * @category context
 */
export const RegistryContext = createContext<AtomRegistry.AtomRegistry>(AtomRegistry.make({
  scheduleTask,
  defaultIdleTTL: 400
}))

/**
 * @since 1.0.0
 * @category context
 */
export const RegistryProvider = (options: {
  readonly children?: JSX.Element | undefined
  readonly initialValues?: Iterable<readonly [Atom.Atom<any>, any]> | undefined
  readonly scheduleTask?: ((f: () => void) => () => void) | undefined
  readonly timeoutResolution?: number | undefined
  readonly defaultIdleTTL?: number | undefined
}) => {
  const registry = AtomRegistry.make({
    scheduleTask: options.scheduleTask ?? scheduleTask,
    initialValues: options.initialValues,
    timeoutResolution: options.timeoutResolution,
    defaultIdleTTL: options.defaultIdleTTL
  })
  onCleanup(() => {
    setTimeout(() => registry.dispose(), 500)
  })
  return createComponent(RegistryContext.Provider, {
    value: registry,
    get children() {
      return options.children
    }
  })
}
