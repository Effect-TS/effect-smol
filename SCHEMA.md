# Pain Points

- schemas lose their `make` constructor
  - **solution**: add `make` to the base Schema class and derive from that
- simplify formatters
  - **solution**: a single operation
- better mutability management
- Classes should be first class citizens
- `partial` doesnt work nicely and it's an all or nothing
- effectful defaults
- too many replicated filters (`greaterThan`, `greaterThanBigInt`, `greaterThanDuration`, etc...)
- suspended schemas are a PITA
- performance
- bundle size
- key transformations are not supported by `SchemaAST.TypeLiteral`
- (optional) better custom error handling: example https://discord.com/channels/795981131316985866/1347665724361019433/1347831833282347079

## Programming with generics

**Problem**: Programming with generics is a PITA

**Solution**: make all generics covariant

**Example** (Filters)

v3

```ts
export const minLength = <S extends Schema.Any>(
  minLength: number,
  annotations?: Annotations.Filter<Schema.Type<S>>
) =>
<A extends string>(self: S & Schema<A, Schema.Encoded<S>, Schema.Context<S>>): filter<S>
```

v4

```ts
export const minLength = <T extends string>(
  minLength: number,
  annotations?: Annotations<T>
) =>
<S extends Schema<T, any, any>>(self: S): filter<S>
```

# Breaking Changes

- the order of the filter parameters has been changed from `(value, options, ast)` to `(ast, ast, options)`

# RWC

- https://github.com/Anastasia-Labs/lucid-evolution/blob/5068114c9f8f95c6b997d0d2233a9e9543632f35/packages/experimental/src/TSchema.ts#L353
