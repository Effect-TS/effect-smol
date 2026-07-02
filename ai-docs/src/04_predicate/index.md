## Working with Predicates

The `Predicate` module contains small, reusable runtime checks. A
`Predicate<A>` returns `true` or `false` for a value, while a
`Refinement<A, B>` is a predicate that also narrows the TypeScript type when
it succeeds.

Use predicates at the boundary of your program when data is `unknown`, and
then compose those checks with helpers such as `Predicate.and`,
`Predicate.or`, `Predicate.not`, and `Predicate.compose`.
