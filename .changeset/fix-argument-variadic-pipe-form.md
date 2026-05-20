---
"effect": patch
---

Fix `Argument.variadic` no-options pipe form returning `{}` instead of an array

`Argument.variadic` was declared as `dual(2, ...)`, which requires two arguments for
the data-first call form. When used as `.pipe(Argument.variadic)` (no options, no call),
the piped value was incorrectly treated as the options argument, returning a partially-applied
function instead of the expected `Argument<ReadonlyArray<A>>`.

Replaced `dual(2, body)` with the predicate-based overload `dual((args) => Param.isParam(args[0]), body)`,
which detects the data-first form by checking whether the first argument is a `Param`. All four
call forms now work correctly:

```ts
// piped, no options
Argument.string("files").pipe(Argument.variadic)

// piped, with options
Argument.string("files").pipe(Argument.variadic({ min: 1 }))

// direct, no options
Argument.variadic(Argument.string("files"))

// direct, with options
Argument.variadic(Argument.string("files"), { min: 1 })
```
