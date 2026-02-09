# Cause: Flattened Structure

In v3, `Cause<E>` was a recursive tree with six variants:

```
Empty | Fail<E> | Die | Interrupt | Sequential<E> | Parallel<E>
```

The `Sequential` and `Parallel` variants composed causes into a tree to
represent errors from finalizers or concurrent operations.

In v4, `Cause<E>` has been flattened to a simple wrapper around an array of
`Failure` values:

```ts
interface Cause<E> {
  readonly failures: ReadonlyArray<Failure<E>>
}

type Failure<E> = Fail<E> | Die | Interrupt
```

There are only three failure variants — `Fail`, `Die`, and `Interrupt`. The
`Empty`, `Sequential`, and `Parallel` variants have been removed. An empty
cause is represented by an empty `failures` array. Multiple failures (from
concurrent or sequential composition) are collected into a flat array.

## Accessing Failures

**v3** — pattern match on the recursive tree structure:

```ts
import { Cause } from "effect"

const handle = (cause: Cause.Cause<string>) => {
  switch (cause._tag) {
    case "Fail":
      return cause.error
    case "Die":
      return cause.defect
    case "Empty":
      return undefined
    case "Sequential":
      return handle(cause.left)
    case "Parallel":
      return handle(cause.left)
    case "Interrupt":
      return cause.fiberId
  }
}
```

**v4** — iterate over the flat `failures` array:

```ts
import { Cause } from "effect"

const handle = (cause: Cause.Cause<string>) => {
  for (const failure of cause.failures) {
    switch (failure._tag) {
      case "Fail":
        return failure.error
      case "Die":
        return failure.defect
      case "Interrupt":
        return failure.fiberId
    }
  }
}
```

## Predicates and Guards

The v3 type-level guards (`isFailType`, `isDieType`, `isInterruptType`, etc.)
have been replaced by failure-level guards:

| v3                              | v4                                  |
| ------------------------------- | ----------------------------------- |
| `Cause.isEmptyType(cause)`      | `cause.failures.length === 0`       |
| `Cause.isFailType(cause)`       | `Cause.failureIsFail(failure)`      |
| `Cause.isDieType(cause)`        | `Cause.failureIsDie(failure)`       |
| `Cause.isInterruptType(cause)`  | `Cause.failureIsInterrupt(failure)` |
| `Cause.isSequentialType(cause)` | Removed                             |
| `Cause.isParallelType(cause)`   | Removed                             |

Cause-level predicates that check whether any failure of a given kind exists:

| v3                               | v4                               |
| -------------------------------- | -------------------------------- |
| `Cause.isFailure(cause)`         | `Cause.hasFail(cause)`           |
| `Cause.isDie(cause)`             | `Cause.hasDie(cause)`            |
| `Cause.isInterrupted(cause)`     | `Cause.hasInterrupt(cause)`      |
| `Cause.isInterruptedOnly(cause)` | `Cause.isInterruptedOnly(cause)` |

## Constructors

| v3                              | v4                         |
| ------------------------------- | -------------------------- |
| `Cause.empty`                   | `Cause.empty`              |
| `Cause.fail(error)`             | `Cause.fail(error)`        |
| `Cause.die(defect)`             | `Cause.die(defect)`        |
| `Cause.interrupt(fiberId)`      | `Cause.interrupt(fiberId)` |
| `Cause.sequential(left, right)` | `Cause.merge(left, right)` |
| `Cause.parallel(left, right)`   | `Cause.merge(left, right)` |

In v4, `Cause.merge` concatenates the `failures` arrays of two causes. The
distinction between sequential and parallel composition is no longer
represented in the data structure.

## New in v4

- **`Cause.fromFailures(failures)`** — construct a `Cause` from an array of
  `Failure` values.
- **`Cause.failureFail(error)`**, **`Cause.failureDie(defect)`**,
  **`Cause.failureInterrupt(fiberId)`** — construct individual `Failure`
  values.
- **`Cause.annotate(annotations)`** — attach annotations to a `Cause`.
- **`Cause.filterError(cause)`**, **`Cause.filterDefect(cause)`**,
  **`Cause.filterInterrupt(cause)`** — extract specific failure types using
  the `Filter` module.
