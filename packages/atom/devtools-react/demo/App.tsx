import * as Hooks from "@effect/atom-react/Hooks"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as React from "react"

const countAtom = Atom.make(0).pipe(Atom.withLabel("count"))
const nameAtom = Atom.make("Effect").pipe(Atom.withLabel("name"))
const todosAtom = Atom.make<Array<string>>(["Learn Effect", "Build something"]).pipe(Atom.withLabel("todos"))
const doubleCount = Atom.map(countAtom, (n) => n * 2).pipe(Atom.withLabel("doubleCount"))

const Counter = () => {
  const [count, setCount] = Hooks.useAtom(countAtom)
  const doubled = Hooks.useAtomValue(doubleCount)
  return (
    <div className="card">
      <h2>Counter</h2>
      <div className="value">{count}</div>
      <div style={{ color: "#888", fontSize: "12px", marginTop: 4 }}>doubled: {doubled}</div>
      <div className="row">
        <button onClick={() => setCount((c) => c - 1)}>-</button>
        <button onClick={() => setCount((c) => c + 1)}>+</button>
        <button onClick={() => setCount(0)}>Reset</button>
      </div>
    </div>
  )
}

const NameInput = () => {
  const [name, setName] = Hooks.useAtom(nameAtom)
  return (
    <div className="card">
      <h2>Name</h2>
      <div className="value">{name}</div>
      <div className="row">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
    </div>
  )
}

const TodoList = () => {
  const [todos, setTodos] = Hooks.useAtom(todosAtom)
  const [draft, setDraft] = React.useState("")
  return (
    <div className="card">
      <h2>Todos ({todos.length})</h2>
      <ul style={{ listStyle: "none", marginTop: 8 }}>
        {todos.map((todo, i) => (
          <li key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span>{todo}</span>
            <button
              style={{ fontSize: 11, padding: "2px 6px" }}
              onClick={() => setTodos((t) => t.filter((_, j) => j !== i))}
            >
              x
            </button>
          </li>
        ))}
      </ul>
      <div className="row">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="New todo..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft) {
              setTodos((t) => [...t, draft])
              setDraft("")
            }
          }}
        />
        <button
          onClick={() => {
            if (draft) {
              setTodos((t) => [...t, draft])
              setDraft("")
            }
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

export const App = () => (
  <div>
    <h1>Atom Devtools Demo</h1>
    <Counter />
    <NameInput />
    <TodoList />
  </div>
)
