import * as AtomDevtools from "@effect/atom-devtools-react/AtomDevtools"
import * as RegistryContext from "@effect/atom-react/RegistryContext"
import * as React from "react"
import * as ReactDOM from "react-dom/client"
import { App } from "./App.tsx"

const Demo = () => (
  <RegistryContext.RegistryProvider>
    <App />
    <AtomDevtools.AtomDevtools initialIsOpen />
  </RegistryContext.RegistryProvider>
)

ReactDOM.createRoot(document.getElementById("root")!).render(<Demo />)
