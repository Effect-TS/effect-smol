/**
 * @since 1.0.0
 */
"use client"

import * as DevtoolsState from "@effect/atom-devtools/DevtoolsState"
import * as RegistryContext from "@effect/atom-react/RegistryContext"
import * as React from "react"

/**
 * @since 1.0.0
 * @category hooks
 */
export const useDevtoolsController = () => {
  const registry = React.useContext(RegistryContext.RegistryContext)
  const controllerRef = React.useRef<DevtoolsState.DevtoolsController | null>(null)

  if (controllerRef.current === null) {
    controllerRef.current = DevtoolsState.make(registry)
  }

  const state = React.useSyncExternalStore(
    controllerRef.current.subscribe,
    controllerRef.current.getState
  )

  React.useEffect(() => () => controllerRef.current?.dispose(), [])

  return {
    ...state,
    controller: controllerRef.current
  } as const
}
