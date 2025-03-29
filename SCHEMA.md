# Pain Points

- better mutability management
- Classes should be first class citizens
- `partial` doesnt work nicely and it's an all or nothing
- effectful defaults
- suspended schemas are a PITA
- performance
- bundle size
- key transformations are not supported by `SchemaAST.TypeLiteral`
- (optional) better custom error handling: example https://discord.com/channels/795981131316985866/1347665724361019433/1347831833282347079

## Formatters

**Problem**: Too many operations

**Solution**: A single operation

TODO:

- what if formatting depends on some service?

**Example** (Formatter API interface)

```ts
export interface SchemaFormatter<A> {
  readonly format: (
    issue: SchemaAST.Issue
  ) => Result.Result<A> | Effect.Effect<A>
}
```

## Filters

**Problem**: Too many filters

**Solution**: Filter factories

**Example** (Generating filters from orders)

```ts
const makeGreaterThan = <A>(O: Order.Order<A>) => {
  const f = Order.greaterThan(O)
  return <T extends A>(exclusiveMinimum: A, annotations?: Annotations<T>) => {
    return <S extends Schema<T, any, any>>(self: S) =>
      self.pipe(
        filter(f(exclusiveMinimum), {
          title: `greaterThan(${exclusiveMinimum})`,
          description: `a value greater than ${exclusiveMinimum}`,
          ...annotations
        })
      )
  }
}
```

## Constructors

**Problem**: Schemas lose their `make` constructor

**Solution**: add `make` to the base Schema class and derive from that

**Example** (Struct API interface)

```diff
export interface Struct<Fields extends Struct.Fields>
  extends Schema<
    Struct.Type<Fields>,
    Struct.Encoded<Fields>,
    Struct.Context<Fields>
  > {
+  make(input: {
+    readonly [K in keyof Fields]: Parameters<Fields[K]["make"]>[0]
+  }): Simplify<Struct.Type<Fields>>
}
```

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
