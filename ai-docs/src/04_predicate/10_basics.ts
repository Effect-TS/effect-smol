/**
 * @title Introducing Predicate
 *
 * Use predicates to validate unknown data and keep type narrowing close to the
 * runtime checks that make it safe.
 */
import { Array, Predicate } from "effect"

interface Todo {
  readonly id: number
  readonly title: string
  readonly completed: boolean
}

// A Refinement is a Predicate that narrows the input type when it returns true.
// This is useful at application boundaries where values usually start as
// unknown, for example after reading JSON from an HTTP request, local storage,
// or a message queue.
const isTodo: Predicate.Refinement<unknown, Todo> = (input): input is Todo =>
  Predicate.isObject(input) &&
  Predicate.isNumber(input.id) &&
  Predicate.isString(input.title) &&
  Predicate.isBoolean(input.completed)

// Predicates are regular functions, so you can combine them into named checks
// that explain the business rule being enforced. `Predicate.compose` keeps the
// type narrowing from `isTodo`, then applies the Todo-specific predicate.
const isOpenTodo = Predicate.compose(
  isTodo,
  (todo) => todo.completed === false
)

const payload: ReadonlyArray<unknown> = [
  { id: 1, title: "Write docs", completed: false },
  { id: 2, title: "Review pull request", completed: true },
  { id: "bad-data", title: "Skip invalid items", completed: false }
]

// Array.filter accepts refinements, so `openTodos` is narrowed to
// Array<Todo>. Invalid values and completed todos are removed in one
// pass using the composed Predicate.
export const openTodos = Array.filter(payload, isOpenTodo)

console.log(openTodos)
