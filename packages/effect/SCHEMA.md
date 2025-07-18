This document outlines upcoming improvements to the `Schema` module in the Effect library.

## Introduction

Since the release of version 3, we've quietly gathered all user feedback, especially around pain points.
Version 4 is focused on addressing those issues and, hopefully, alleviating most of them.

Some improvements have already been introduced in v3, but others require breaking changes. We've been waiting for the right moment, and the new version of Effect is the opportunity we were all waiting for.

We're aiming to design APIs that strike a balance: preserving names and behavior from v3 where possible, while also aligning with the design of other validation libraries (especially zod v4), so that users coming from those tools find Schema familiar and approachable.

An important note about the breaking changes in version 4 is our strong focus on **bundle size**. To avoid bloat, we're designing new ways of doing things that, in some cases, require a bit more work from users but result in a slimmer bundle.

For example, we're removing some defaults like built-in formatting of parse issues, so that formatting code doesn't end up in the bundle if the feature is never used.

In general, Schema v4 requires more explicit decisions from the user about which features to use. This is especially important to make Schema usable even in contexts where bundle size is critical, without giving up the features that make Effect great.

Ultimately, the intent is to eliminate the need for two separate paths like in version 3 (Effect as the full-featured version and Micro for more constrained use cases).

## Summary

### 1. Design Goals

- **Smaller bundles & opt‑in features** – defaults like issue formatting moved out of the core; you explicitly import what you use.
- **Keep v3 names when possible** while borrowing ergonomics from Zod v4, so migrating users feel at home.

### 2. Core Type Model

- `Bottom<…>` now tracks **14 type parameters** giving fine‑grained control over mutability, optionality, defaults, encoded/decoded shapes, etc.
- Separate requirement type params **`RD` / `RE`** let decoding and encoding depend on different service environments.

### 3. Encoding / Decoding

- **Default JSON codec generator**: `Serializer.json(schema)` does round‑trip‑safe network serialization (Maps → pairs, Options → arrays, Dates → ISO strings, etc.).
- **Explicit helpers**: `Schema.UnknownFromJsonString`, `Schema.fromJsonString`.

### 4. Schema Algebra Goodies

- `Schema.flip` ‑ swap input/output types (encode ≙ decode of the flipped schema).
- **Redesigned constructors** (`makeSync`) everywhere, including unions, with smart handling of brands / refinements / defaults (sync or effectful).
- **Optional & mutable keys** via `Schema.optionalKey` / `Schema.mutableKey`; nested default‑value resolution.
- **Derivation APIs** for structs, tuples, unions (`mapFields`, `mapElements`, `mapMembers`, etc.) to pick/omit/evolve/rename without losing checks.

### 5. Validation Pipeline

- Filters (`Check`) are **first‑class values**:
  - chainable without losing original schema type info,
  - reusable (groups, factories),
  - structural vs element filters,
  - `abort` wrapper to short‑circuit,
  - multi‑issue reporting with `{ errors: "all" }`.

### 6. Transformations

- Now standalone objects (`Transformation<T,E,RD,RE>`) you attach with `Schema.decode`, `Schema.decodeTo`, etc.—composable like optics.
- Passthrough helpers (`passthrough`, `passthroughSubtype`, `passthroughSupertype`) ease schema‑to‑schema transformations.

### 7. Data Types Beyond Plain Structs

- **Opaque structs & classes** – wrap a `Struct` in a class for nominal typing; `Schema.Class` when you need methods/constructors/equality.
- **Tagged structs / tagged unions** helpers (`Schema.TaggedStruct`, `Schema.TaggedUnion`, `Schema.asTaggedUnion`) with auto‑generated guards, matchers, helpers.

### 8. Tooling

- **Middlewares** – intercept decoding/encoding, supply services, or provide fallbacks.
- Generators:
  - **JSON Schema** exporter with override hooks and per‑check fragments.
  - **Fast‑Check Arbitrary** (`ToArbitrary`), **Equivalence** (`ToEquivalence`) derivation.

- **Formatters**: Tree (debug), StandardSchemaV1 (i18n‑friendly hooks), Structured (machine‑consumable).

### 9. Misc

- **UniqueArray**, **TemplateLiteral** & parser, index‑signature merging, key transforms on records, generics are now covariant & simpler.

## Model

A "schema" in is a strongly typed wrapper around an untyped AST (abstract syntax tree) node.

The base interface is `Bottom`, which sits at the bottom of the schema type hierarchy. In Schema v4, the number of tracked type parameters has increased to 14, allowing for more precise and flexible schema definitions.

```ts
export interface Bottom<
  T,
  E,
  RD,
  RE,
  Ast extends SchemaAST.AST,
  RebuildOut extends Top,
  AnnotateIn extends SchemaAnnotations.Annotations,
  TypeMakeIn = T,
  TypeMake = TypeMakeIn,
  TypeMutability extends Mutability = "readonly",
  TypeOptionality extends Optionality = "required",
  TypeConstructorDefault extends ConstructorDefault = "no-default",
  EncodedMutability extends Mutability = "readonly",
  EncodedOptionality extends Optionality = "required"
> extends Pipeable {
  readonly [TypeId]: TypeId

  readonly ast: Ast
  readonly "~rebuild.out": RebuildOut
  readonly "~annotate.in": AnnotateIn

  readonly Type: T
  readonly Encoded: E
  readonly DecodingServices: RD
  readonly EncodingServices: RE

  readonly "~type.make.in": TypeMakeIn
  readonly "~type.make": TypeMake
  readonly "~type.mutability": TypeMutability
  readonly "~type.optionality": TypeOptionality
  readonly "~type.constructor.default": TypeConstructorDefault

  readonly "~encoded.mutability": EncodedMutability
  readonly "~encoded.optionality": EncodedOptionality

  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"]
  rebuild(ast: this["ast"]): this["~rebuild.out"]
  /**
   * @throws {Error} The issue is contained in the error cause.
   */
  makeSync(input: this["~type.make.in"], options?: MakeOptions): this["Type"]
  check(
    ...checks: readonly [Check.Check<this["Type"]>, ...ReadonlyArray<Check.Check<this["Type"]>>]
  ): this["~rebuild.out"]
}
```

### Parameter Overview

- `T`: the decoded output type
- `E`: the encoded representation
- `RD`: the type of the services required for decoding
- `RE`: the type of the services required for encoding
- `Ast`: the AST node type
- `RebuildOut`: the type returned when modifying the schema (namely when you add annotations or checks)
- `AnnotateIn`: the type of accepted annotations
- `TypeMakeIn`: the type of the input to the `makeSync` constructor

Contextual information about the schema (when the schema is used in a composite schema such as a struct or a tuple):

- `TypeMake`: the type used to construct the value
- `TypeReadonly`: whether the schema is readonly on the type side
- `TypeIsOptional`: whether the schema is optional on the type side
- `TypeDefault`: whether the constructor has a default value
- `EncodedIsReadonly`: whether the schema is readonly on the encoded side
- `EncodedIsOptional`: whether the schema is optional on the encoded side

### AST Node Structure

Every schema is based on an AST node with a consistent internal shape:

```mermaid
classDiagram
    class ASTNode {
      + annotations
      + checks
      + encoding
      + context
      + ...specific node fields...
    }
```

- `annotations`: metadata attached to the schema node
- `checks`: an array of validation rules
- `encoding`: a list of transformations that describe how to encode the value
- `context`: includes details used when the schema appears inside composite schemas such as structs or tuples (e.g., whether the field is optional or mutable)

## Type Hierarchy

The `Bottom` type sits at the base of the schema system. It tracks all type parameters used internally by the library.

From this base, higher-level schema types are defined by selectively narrowing the parameters. Some commonly used derived types include:

- `Top`: a generic schema with no fixed shape
- `Schema<T>`: represents the TypeScript type `T`
- `Codec<T, E, RD, RE>`: a schema that both decodes `E` to `T` and encodes `T` to `E`, possibly requiring services `RD` and `RE`

```mermaid
flowchart TD
    T[Top] --> S["Schema[T]"]
    S --> C["Codec[T, E, RD, RE]"]
    C --> B["Bottom[T, E, RD, RE, Ast, RebuildOut, AnnotateIn, TypeMakeIn, TypeMake, TypeReadonly, TypeIsOptional, TypeDefault, EncodedIsReadonly, EncodedIsOptional]"]
```

## 🆕 Separate Requirement Type Parameters

In real-world applications, decoding and encoding often have different dependencies. For example, decoding may require access to a database, while encoding does not.

To support this, schemas now have two separate requirement parameters:

```ts
interface Codec<T, E, RD, RE> {
  // ...
}
```

- `RD`: services required **only for decoding**
- `RE`: services required **only for encoding**

This makes it easier to work with schemas in contexts where one direction has no external dependencies.

**Example** (Decoding requirements are ignored during encoding)

```ts
import type { Effect } from "effect"
import { ServiceMap } from "effect/services"
import { Schema } from "effect/schema"

// A service that retrieves full user info from an ID
class UserDatabase extends ServiceMap.Key<
  UserDatabase,
  {
    getUserById: (id: string) => Effect.Effect<{ readonly id: string; readonly name: string }>
  }
>()("UserDatabase") {}

// Schema that decodes from an ID to a user object using the database,
// but encodes just the ID
declare const User: Schema.Codec<
  { id: string; name: string },
  string,
  UserDatabase, // Decoding requires the database
  never // Encoding does not require any services
>

//     ┌─── Effect<{ readonly id: string; readonly name: string; }, Schema.SchemaError, UserDatabase>
//     ▼
const decoding = Schema.decodeEffect(User)("user-123")

//     ┌─── Effect<string, Schema.SchemaError, never>
//     ▼
const encoding = Schema.encodeEffect(User)({ id: "user-123", name: "John Doe" })
```

## 🆕 Default JSON Serialization / Deserialization

The `Schema` module is not just for validation, it also supports serializing and deserializing data.

Two common scenarios for JSON serialization and deserialization are:

1. **Network Transmission** (for RPC or messaging systems)
2. **Custom JSON Formats** (for REST APIs, file storage, etc.)

This section focuses on the first use case, where the exact JSON format is less important. In these cases, you often want to send structured data over a network without manually specifying how to convert it to and from JSON. The goal is to send something that can be encoded on one end and decoded on the other.

### Transmitting Data Over the Network

For use cases like RPC or messaging systems, the JSON format only needs to support round-trip encoding and decoding. The `SchemaSerializer.json` operator helps with this by taking a schema and returning a `Codec` that knows how to serialize and deserialize the data using a JSON-compatible format.

**Example** (Serializing and deserializing a Map with complex keys and values)

```ts
import { Option } from "effect"
import { Schema, Serializer } from "effect/schema"

// A schema for Map<Option<symbol>, Date>
const schema = Schema.Map(Schema.Option(Schema.Symbol), Schema.Date)

// Generate a JSON serializer for the schema
const serializer = Serializer.json(schema)

// Create a sample value
const data = new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]])

// Encode and serialize the value
const serialized = JSON.stringify(Schema.encodeUnknownSync(serializer)(data))

console.log(serialized)
// → [[["a"],"2021-01-01T00:00:00.000Z"]]

// Deserialize and decode the value
console.log(Schema.decodeUnknownSync(serializer)(JSON.parse(serialized)))
// → Map(1) {
//     Some(Symbol(a)) => 2021-01-01T00:00:00.000Z
//   }
```

The schema automatically chooses a suitable JSON format:

- `Map` is encoded as an array of `[key, value]` pairs
- `Option` is encoded as an array with zero or one element (e.g. `[value]` or `[]`)
- `Date` is encoded as an ISO string
- `Symbol` is encoded as a string

> [!WARNING]
> This default format is designed for portability and round-tripping. It may not match domain-specific formats like those used in public APIs.

#### How it works

By default, Schema can encode and decode values, including recursive structures. However, certain types like `Map` or `Option` are defined using `SchemaAST.Declaration`, which must provide a default serialization strategy using annotations.

This is done by attaching a `defaultJsonSerializer` annotation when defining the schema.

**Example** (Providing a default serializer for Date)

```ts
import { Schema, Serializer, Transformation } from "effect/schema"

// Custom Date schema with a default serializer
const MyDate = Schema.instanceOf({
  constructor: Date,
  annotations: {
    defaultJsonSerializer: () =>
      Schema.link<Date>()(
        Schema.String, // JSON representation
        Transformation.transform({
          decode: (s) => new Date(s),
          encode: (date) => date.toISOString()
        })
      )
  }
})

const serializer = Serializer.json(MyDate)

const serialized = JSON.stringify(Schema.encodeUnknownSync(serializer)(new Date("2021-01-01")))

console.log(serialized)
/*
"2021-01-01T00:00:00.000Z"
*/
```

In this example, the `Date` is encoded as a string and decoded back using the standard ISO format.

## Explicit JSON Serialization

### UnknownFromJsonString

A schema that decodes a JSON-encoded string into an unknown value.

This schema takes a string as input and attempts to parse it as JSON during decoding. If parsing succeeds, the result is passed along as an unknown value. If the string is not valid JSON, decoding fails.

When encoding, any value is converted back into a JSON string using JSON.stringify. If the value is not a valid JSON value, encoding fails.

**Example**

```ts
import { Schema } from "effect/schema"

Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(`{"a":1,"b":2}`)
// => { a: 1, b: 2 }
```

### fromJsonString

Returns a schema that decodes a JSON string and then decodes the parsed value using the given schema.

This is useful when working with JSON-encoded strings where the actual structure of the value is known and described by an existing schema.

The resulting schema first parses the input string as JSON, and then runs the provided schema on the parsed result.

**Example**

```ts
import { Schema } from "effect/schema"

const schema = Schema.Struct({ a: Schema.Number })
const schemaFromJsonString = Schema.fromJsonString(schema)

Schema.decodeUnknownSync(schemaFromJsonString)(`{"a":1,"b":2}`)
// => { a: 1 }
```

## 🆕 Flipping Schemas

You can now flip a schema to create a new one that reverses its input and output types.

This is useful when you want to reuse an existing schema but invert its direction.

**Example** (Flipping a schema that parses a string into a number)

```ts
import { Schema } from "effect/schema"

// Flips a schema that decodes a string into a number,
// turning it into one that decodes a number into a string
//
//      ┌─── flip<FiniteFromString>
//      ▼
const StringFromFinite = Schema.flip(Schema.FiniteFromString)
```

You can access the original schema using the `.schema` property:

**Example** (Accessing the original schema)

```ts
import { Schema } from "effect/schema"

const StringFromFinite = Schema.flip(Schema.FiniteFromString)

//                 ┌─── FiniteFromString
//                 ▼
StringFromFinite.schema
```

Flipping a schema twice returns a schema with the same structure and behavior as the original:

**Example** (Double flipping restores the original schema)

```ts
import { Schema } from "effect/schema"

//      ┌─── FiniteFromString
//      ▼
const schema = Schema.flip(Schema.flip(Schema.FiniteFromString))
```

### How it works

All internal operations defined in the Schema AST are now symmetrical. This change simplifies the design of the encoding and decoding engine, allowing one to be defined in terms of the other:

```ts
// Encoding with a schema is the same as decoding with its flipped version
encode(schema) = decode(flip(schema))
```

This symmetry made it possible to introduce `Schema.flip` and ensures that flipping works consistently across all schema types.

### Flipped constructors

A flipped schema also includes a constructor. It builds values of the **encoded** type from the original schema.

**Example** (Using a flipped schema to construct an encoded value)

```ts
import { Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.FiniteFromString
})

/*
type Encoded = {
    readonly a: string;
}
*/
type Encoded = (typeof schema)["Encoded"]

// makeSync: { readonly a: string }  ──▶  { readonly a: string }
Schema.flip(schema).makeSync
```

## Constructors Redesign

### Constructors in Composed Schemas

To support constructing values from composed schemas, `makeSync` is now available on all schemas, including unions.

```ts
import { Schema } from "effect/schema"

const schema = Schema.Union([Schema.Struct({ a: Schema.String }), Schema.Struct({ b: Schema.Number })])

schema.makeSync({ a: "hello" })
schema.makeSync({ b: 1 })
```

### Branded Constructors

For branded schemas, the default constructor accepts an unbranded input and returns a branded output.

```ts
import { Schema } from "effect/schema"

const schema = Schema.String.pipe(Schema.brand("a"))

// makeSync(input: string, options?: Schema.MakeOptions): string & Brand<"a">
schema.makeSync
```

However, when a branded schema is part of a composite (such as a struct), you must pass a branded value.

```ts
import { Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.String.pipe(Schema.brand("a")),
  b: Schema.Number
})

/*
makeSync(input: {
    readonly a: string & Brand<"a">;
    readonly b: number;
}, options?: Schema.MakeOptions): {
    readonly a: string & Brand<"a">;
    readonly b: number;
}
*/
schema.makeSync
```

### Refined Constructors

For refined schemas, the constructor accepts the unrefined type and returns the refined one.

```ts
import { Option } from "effect"
import { Schema } from "effect/schema"

const schema = Schema.Option(Schema.String).pipe(Schema.guard(Option.isSome))

// makeSync(input: Option.Option<string>, options?: Schema.MakeOptions): Option.Some<string>
schema.makeSync
```

As with branding, when used in a composite schema, the refined value must be provided.

```ts
import { Option } from "effect"
import { Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.Option(Schema.String).pipe(Schema.guard(Option.isSome)),
  b: Schema.Number
})

/*
makeSync(input: {
    readonly a: Option.Some<string>;
    readonly b: number;
}, options?: Schema.MakeOptions): {
    readonly a: Option.Some<string>;
    readonly b: number;
}
*/
schema.makeSync
```

### Default Values in Constructors

You can define a default value for a field using `Schema.withConstructorDefault`. If no value is provided at runtime, the constructor uses this default.

**Example** (Providing a default number)

```ts
import { Option } from "effect"
import { Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.Number.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
})

console.log(schema.makeSync({ a: 5 }))
// { a: 5 }

console.log(schema.makeSync({}))
// { a: -1 }
```

The function passed to `withConstructorDefault` will be executed each time a default value is needed.

**Example** (Re-executing the default function)

```ts
import { Option } from "effect"
import { Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.Date.pipe(Schema.withConstructorDefault(() => Option.some(new Date())))
})

console.log(schema.makeSync({}))
// { a: 2025-05-19T16:46:10.912Z }

console.log(schema.makeSync({}))
// { a: 2025-05-19T16:46:10.913Z }
```

If the default function returns `Option.none()`, it means no default value was provided, and the field is considered missing.

**Example** (Returning `None` to skip a default)

```ts
import { Option } from "effect"
import { Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.Date.pipe(
    Schema.withConstructorDefault(() => {
      const d = new Date()
      if (d.getTime() % 2 === 0) {
        // Provide a default value
        return Option.some(d)
      }
      // Skip the default
      return Option.none()
    })
  )
})

try {
  console.log(schema.makeSync({}))
} catch (error) {
  console.error(error)
}
// Error: makeSync failure

try {
  console.log(schema.makeSync({}))
  // { a: 2025-05-19T16:46:10.913Z }
} catch (error) {
  console.error(error)
}
// { a: 2025-05-19T16:48:41.948Z }
```

#### Nested Constructor Default Values

Default values can be nested inside composed schemas. In this case, inner defaults are resolved first.

**Example** (Nested default values)

```ts
import { Result } from "effect"
import { Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.Struct({
    b: Schema.Number.pipe(Schema.withConstructorDefault(() => Result.succeedSome(-1)))
  }).pipe(Schema.withConstructorDefault(() => Result.succeedSome({})))
})

console.log(schema.makeSync({}))
// { a: { b: -1 } }
console.log(schema.makeSync({ a: {} }))
// { a: { b: -1 } }
```

### Effectful Defaults

Default values can also be computed using effects, as long as the environment is `never`.

**Example** (Using an effect to provide a default)

```ts
import { Effect, Option } from "effect"
import { Schema, SchemaResult, ToParser } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.Number.pipe(
    Schema.withConstructorDefault(() =>
      Effect.gen(function* () {
        yield* Effect.sleep(100)
        return Option.some(-1)
      })
    )
  )
})

SchemaResult.asEffect(ToParser.makeSchemaResult(schema)({})).pipe(Effect.runPromise).then(console.log)
// { a: -1 }
```

**Example** (Providing a default from an optional service)

```ts
import { ServiceMap, Effect, Option } from "effect"
import { Schema, SchemaResult, ToParser } from "effect/schema"

// Define a service that may provide a default value
class ConstructorService extends ServiceMap.Key<ConstructorService, { defaultValue: Effect.Effect<number> }>()(
  "ConstructorService"
) {}

const schema = Schema.Struct({
  a: Schema.Number.pipe(
    Schema.withConstructorDefault(() =>
      Effect.gen(function* () {
        yield* Effect.sleep(100)
        const oservice = yield* Effect.serviceOption(ConstructorService)
        if (Option.isNone(oservice)) {
          return Option.none()
        }
        return Option.some(yield* oservice.value.defaultValue)
      })
    )
  )
})

SchemaResult.asEffect(ToParser.makeSchemaResult(schema)({}))
  .pipe(
    Effect.provideService(ConstructorService, ConstructorService.of({ defaultValue: Effect.succeed(-1) })),
    Effect.runPromise
  )
  .then(console.log, console.error)
// { a: -1 }
```

## Filters Redesign

Filters are applied using either the `.check` method or the `Schema.check` function.

You can define your own filters using `Check.make`.

**Example** (Defining a custom filter)

```ts
import { Effect } from "effect"
import { Check, Formatter, Schema } from "effect/schema"

// A simple filter that checks if a string has at least 3 characters
const schema = Schema.String.check(Check.make((s) => s.length >= 3))

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)("").pipe(Effect.runPromise).then(console.log, console.error)
/*
Output:
string & <filter>
└─ <filter>
   └─ Invalid data ""
*/
```

You can also attach annotations and provide a custom error message when defining a filter.

**Example** (Custom filter with annotations and error message)

```ts
import { Effect } from "effect"
import { Check, Formatter, Schema } from "effect/schema"

// A filter with a title, description, and custom error message
const schema = Schema.String.check(
  Check.make((s) => s.length >= 3 || `length must be >= 3, got ${s.length}`, {
    title: "length >= 3",
    description: "a string with at least 3 characters"
  })
)

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)("").pipe(Effect.runPromise).then(console.log, console.error)
/*
Output:
string & length >= 3
└─ length >= 3
   └─ length must be >= 3, got 0
*/
```

### 🆕 Preserving Schema Type After Filtering

When you apply a filter using `Schema.check`, the original schema's type and methods remain available. This means you can still access schema-specific properties like `.fields` or use methods like `.makeSync` after applying filters.

**Example** (Chaining filters and annotations without losing type information)

```ts
import { Check, Schema } from "effect/schema"

//      ┌─── Schema.String
//      ▼
Schema.String

//      ┌─── Schema.String
//      ▼
const NonEmptyString = Schema.String.check(Check.nonEmpty())

//      ┌─── Schema.String
//      ▼
const schema = NonEmptyString.annotate({})
```

Even though we've applied a filter and an annotation, the schema is still recognized as a `Schema.String`.

**Example** (Accessing struct fields after filtering)

```ts
import { Check, Schema } from "effect/schema"

// Define a struct and apply a filter
const schema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
}).check(Check.make(() => true)) // dummy filter for the example

// The `.fields` property is still available
const fields = schema.fields
```

### 🆕 Filters as First-Class

Filters are now standalone value. You can reuse them across schemas, combine them, or apply them to any compatible type. For example, `Check.minLength` is no longer restricted to strings, it can also be used with arrays or any object that has a `length` property.

You can also pass multiple filters at once to a single `.check(...)` call.

**Example** (Combining filters on a string)

```ts
import { Effect } from "effect"
import { Check, Formatter, Schema } from "effect/schema"

const schema = Schema.String.check(
  Check.minLength(3), // Filter<string>
  Check.trimmed() // Filter<string>
)

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)(" a")
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
string & minLength(3) & trimmed
└─ minLength(3)
   └─ Invalid data " a"
*/
```

**Example** (Applying `minLength` to an object with a `length` field)

```ts
import { Effect } from "effect"
import { Check, Formatter, Schema } from "effect/schema"

// Object has a numeric `length` field, which must be >= 3
const schema = Schema.Struct({ length: Schema.Number }).check(Check.minLength(3))

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)({ length: 2 })
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
{ readonly "length": number } & minLength(3)
└─ minLength(3)
   └─ Invalid data {"length":2}
*/
```

**Example** (Validating array length)

```ts
import { Effect } from "effect"
import { Check, Formatter, Schema } from "effect/schema"

// Array must contain at least 3 strings
const schema = Schema.Array(Schema.String).check(Check.minLength(3))

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)(["a", "b"])
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
ReadonlyArray<string> & minLength(3)
└─ minLength(3)
   └─ Invalid data ["a","b"]
*/
```

### 🆕 Multiple Issues Reporting

By default, when `{ errors: "all" }` is passed, all filters are evaluated, even if one fails. This allows multiple issues to be reported at once.

**Example** (Collecting multiple validation issues)

```ts
import { Effect } from "effect"
import { Check, Formatter, Schema } from "effect/schema"

const schema = Schema.String.check(Check.minLength(3), Check.trimmed())

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)(" a", {
  errors: "all"
})
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
string & minLength(3) & trimmed
├─ minLength(3)
│  └─ Invalid data " a"
└─ trimmed
   └─ Invalid data " a"
*/
```

### 🆕 Stop Validation

If you want to stop validation as soon as a filter fails, you can wrap it with `Check.abort`.

**Example** (Stop validation)

```ts
import { Effect } from "effect"
import { Check, Formatter, Schema } from "effect/schema"

const schema = Schema.String.check(
  Check.abort(Check.minLength(3)), // Stop on failure here
  Check.trimmed() // This will not run if minLength fails
)

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)(" a", {
  errors: "all"
})
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
string & minLength(3) & trimmed
└─ minLength(3)
   └─ Invalid data " a"
*/
```

### 🆕 Filter Groups

Filters can be grouped together into a reusable unit using `Check.FilterGroup`. This is useful when you want to define a set of checks that are often applied together.

**Example** (Defining a reusable group for 32-bit integers)

```ts
import { Check } from "effect/schema"

//      ┌─── FilterGroup<number>
//      ▼
const int32 = Check.makeGroup([Check.int(), Check.between(-2147483648, 2147483647)], {
  title: "int32",
  description: "a 32-bit integer"
})
```

### Refinements

You can refine a schema using `Schema.refine`. This is used to apply additional checks, such as type guards or branding, to an existing schema.

For convenience, `Schema.guard` and `Schema.brand` are shorthand utilities that wrap common refinement patterns.

**Example** (Using a type guard to restrict array shape)

```ts
import { Schema } from "effect/schema"

//      ┌─── refine<readonly [string, string, ...string[]], Schema.Array$<Schema.String>>
//      ▼
const guarded = Schema.Array(Schema.String).pipe(
  Schema.guard((arr): arr is readonly [string, string, ...Array<string>] => arr.length >= 2)
)
```

**Example** (Applying a brand to a string)

```ts
import { Schema } from "effect/schema"

//      ┌─── Schema.refine<string & Brand<"UserId">, Schema.String>
//      ▼
const branded = Schema.String.pipe(Schema.brand("UserId"))
```

#### 🆕 Refinement Groups

You can group multiple refinements together using `Check.FilterGroup`. This allows you to reuse and apply related constraints as a unit.

**Example** (Grouping a type guard and other checks)

```ts
import { Check } from "effect/schema"

// A group that checks:
// - minimum length of 3
// - all letters are lowercase
//
//      ┌─── RefinementGroup<Lowercase<string>, string>
//      ▼
export const guardedGroup = Check.makeGroup([Check.minLength(3), Check.trimmed()], undefined).pipe(
  Check.guard((s): s is Lowercase<string> => s.toLowerCase() === s)
)
```

**Example** (Grouping a brand with other checks)

```ts
import { Check } from "effect/schema"

// A group that checks:
// - minimum length of 3
// - the string is trimmed
// - the value is branded as "my-string"
//
//      ┌─── Check.RefinementGroup<string & Brand<"my-string">, string>
//      ▼
export const brandedGroup = Check.makeGroup([Check.minLength(3), Check.trimmed()], undefined).pipe(
  Check.brand("my-string")
)
```

Let's see a more complex example:

**Example** (Branded `Username` schema with grouped refinements)

Imagine you are building a system where usernames must:

- Be at least 3 characters long
- Contain only alphanumeric characters
- Have no leading or trailing whitespace
- Be treated as a distinct type (`Username`) once validated

You can group these constraints and brand the result for use throughout your codebase.

```ts
import { Check, Schema } from "effect/schema"

// Group for a valid username
const username = Check.makeGroup(
  [
    Check.minLength(3),
    Check.regex(/^[a-zA-Z0-9]+$/, {
      title: "alphanumeric",
      description: "must contain only letters and numbers"
    }),
    Check.trimmed()
  ],
  {
    title: "username",
    description: "a valid username"
  }
).pipe(Check.brand("Username"))

// Apply the group to a string
//
//      ┌─── refine<string & Brand<"Username">, Schema.String>
//      ▼
export const Username = Schema.String.pipe(Schema.refine(username))
```

### Structural Filters

Some filters apply not to individual elements, but to the overall structure of a value. These are called **structural filters**.

Structural filters are different from regular filters in that they validate aspects of a container type, like the number of items in an array or the presence of keys in an object, rather than the contents themselves. Examples include:

- `minLength` or `maxLength` on arrays
- `minKeys` or `maxKeys` on objects
- any constraint that applies to the "shape" of a value rather than to its nested values

These filters are evaluated separately from item-level filters and allow multiple issues to be reported when `{ errors: "all" }` is used.

**Example** (Validating an array with item and structural constraints)

```ts
import { Effect } from "effect"
import { Check, Formatter, Schema } from "effect/schema"

const schema = Schema.Struct({
  tags: Schema.Array(Schema.String.check(Check.nonEmpty())).check(
    Check.minLength(3) // structural filter
  )
})

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)({ tags: ["a", ""] }, { errors: "all" })
  .pipe(Effect.runPromise)
  .then(console.log, console.error)

/*
Output:
{ readonly "tags": ReadonlyArray<string> }
└─ ["tags"]
   └─ ReadonlyArray<string> & minLength(3)
      ├─ [1]
      │  └─ string & minLength(1)
      │     └─ minLength(1)
      │        └─ Invalid data ""
      └─ minLength(3)
         └─ Invalid data ["a",""]
*/
```

### Effectful Filters

Simple filters defined using `.check` must be synchronous.

For more advanced scenarios, such as performing asynchronous validation or accessing services during decoding, you can define an effectful filter using `Getter.checkEffect`. This is done as part of a transformation.

**Example** (Asynchronous validation of a numeric value)

```ts
import { Effect, Option, Result } from "effect"
import { Getter, Issue, Schema } from "effect/schema"

// Simulated API call that fails when userId is 0
const myapi = (userId: number) =>
  Effect.gen(function* () {
    if (userId === 0) {
      return new Error("not found")
    }
    return { userId }
  }).pipe(Effect.delay(100))

const schema = Schema.Finite.pipe(
  Schema.decode({
    decode: Getter.checkEffect((n) =>
      Effect.gen(function* () {
        // Call the async API and wrap the result in a Result
        const user = yield* Effect.result(myapi(n))

        // If the result is an error, return a SchemaIssue
        return Result.isErr(user) ? new Issue.InvalidValue(Option.some(n), { title: "not found" }) : undefined // No issue, value is valid
      })
    ),
    encode: Getter.passthrough()
  })
)
```

### Pattern: Filter Factories

A **filter factory** is a function that creates reusable filters. These can be configured with arguments at runtime.

**Example** (Creating a `greaterThan` filter for ordered values)

You can create filters like `greaterThan` for any type with an ordering.

```ts
import { Order } from "effect"
import type { Annotations } from "effect/schema"
import { Check } from "effect/schema"

// Create a filter factory for values greater than a given value
export const deriveGreaterThan = <T>(options: {
  readonly order: Order.Order<T>
  readonly annotate?: ((exclusiveMinimum: T) => Annotations.Filter) | undefined
  readonly format?: (value: T) => string | undefined
}) => {
  const greaterThan = Order.greaterThan(options.order)
  const format = options.format ?? globalThis.String
  return (exclusiveMinimum: T, annotations?: Annotations.Filter) => {
    return Check.make<T>((input) => greaterThan(input, exclusiveMinimum), {
      title: `greaterThan(${format(exclusiveMinimum)})`,
      description: `a value greater than ${format(exclusiveMinimum)}`,
      ...options.annotate?.(exclusiveMinimum),
      ...annotations
    })
  }
}
```

## Structs

### 🆕 Optional and Mutable Keys

You can mark struct properties as optional or mutable using `Schema.optionalKey` and `Schema.mutableKey`.

```ts
import { Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.optionalKey(Schema.String),
  c: Schema.mutableKey(Schema.String),
  d: Schema.optionalKey(Schema.mutableKey(Schema.String))
})

/*
with "exactOptionalPropertyTypes": true

type Type = {
    readonly a: string;
    readonly b?: string;
    c: string;
    d?: string;
}
*/
type Type = (typeof schema)["Type"]
```

### Optional Fields

By combining `Schema.optionalKey` and `Schema.NullOr` you can represent any kind of optional property.

```ts
import { Schema } from "effect/schema"

export const schema = Schema.Struct({
  // Exact Optional Property
  a: Schema.optionalKey(Schema.NumberFromString),
  // Optional Property
  b: Schema.optional(Schema.NumberFromString),
  // Exact Optional Property with Nullability
  c: Schema.optionalKey(Schema.NullOr(Schema.NumberFromString)),
  // Optional Property with Nullability
  d: Schema.optional(Schema.NullOr(Schema.NumberFromString))
})

/*
type Encoded = {
    readonly a?: string;
    readonly b?: string | undefined;
    readonly c?: string | null;
    readonly d?: string | null | undefined;
}
*/
type Encoded = typeof schema.Encoded

/*
type Type = {
    readonly a?: number;
    readonly b?: number | undefined;
    readonly c?: number | null;
    readonly d?: number | null | undefined;
}
*/
type Type = typeof schema.Type
```

#### Omitting Values When Transforming Optional Fields

```ts
import { Option, Predicate } from "effect"
import { Getter, Schema } from "effect/schema"

export const schema = Schema.Struct({
  a: Schema.optional(Schema.NumberFromString).pipe(
    Schema.decodeTo(Schema.optionalKey(Schema.Number), {
      decode: Getter.mapOptional(
        Option.filter(Predicate.isNotUndefined) // omit undefined
      ),
      encode: Getter.passthrough()
    })
  )
})

/*
type Encoded = {
    readonly a?: string | undefined;
}
*/
type Encoded = typeof schema.Encoded

/*
type Type = {
    readonly a?: number;
}
*/
type Type = typeof schema.Type
```

#### Representing Optional Fields with never Type

```ts
import { Schema } from "effect/schema"

export const schema = Schema.Struct({
  a: Schema.optionalKey(Schema.Never)
})

/*
type Encoded = {
    readonly a?: never;
}
*/
type Encoded = typeof schema.Encoded

/*
type Type = {
    readonly a?: never;
}
*/
type Type = typeof schema.Type
```

### Decoding Defaults

You can assign default values to fields during decoding using:

- `Schema.withDecodingDefaultKey`: for optional fields
- `Schema.withDecodingDefault`: for optional or undefined fields

In both cases, the provided value must be of the **encoded** type, and it is used when:

1. the field is missing, or
2. the field is explicitly `undefined`

**Example** (Providing a default for a missing or undefined value)

```ts
import { Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1"))
})

//     ┌─── { readonly a?: string | undefined; }
//     ▼
type Encoded = typeof schema.Encoded

//     ┌─── { readonly a: number; }
//     ▼
type Type = typeof schema.Type

console.log(Schema.decodeUnknownSync(schema)({}))
// Output: { a: 1 }

console.log(Schema.decodeUnknownSync(schema)({ a: undefined }))
// Output: { a: 1 }

console.log(Schema.decodeUnknownSync(schema)({ a: "2" }))
// Output: { a: 2 }
```

#### Nested Decoding Defaults

You can also apply decoding defaults within nested structures.

**Example** (Nested struct with defaults for missing or undefined fields)

```ts
import { Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.Struct({
    b: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1"))
  }).pipe(Schema.withDecodingDefault(() => ({})))
})

/*
type Encoded = {
    readonly a?: {
        readonly b?: string | undefined;
    } | undefined;
}
*/
type Encoded = typeof schema.Encoded

/*
type Type = {
    readonly a: {
        readonly b: number;
    };
}
*/
type Type = typeof schema.Type

console.log(Schema.decodeUnknownSync(schema)({}))
// Output: { a: { b: 1 } }

console.log(Schema.decodeUnknownSync(schema)({ a: undefined }))
// Output: { a: { b: 1 } }

console.log(Schema.decodeUnknownSync(schema)({ a: {} }))
// Output: { a: { b: 1 } }

console.log(Schema.decodeUnknownSync(schema)({ a: { b: undefined } }))
// Output: { a: { b: 1 } }

console.log(Schema.decodeUnknownSync(schema)({ a: { b: "2" } }))
// Output: { a: { b: 2 } }
```

### Manual Decoding Defaults

If the defaulting logic is more specific than just handling `undefined` or missing values, you can use `Schema.decodeTo` to apply custom fallback rules.

This is useful when you need to account for values like `null` or other invalid states.

**Example** (Providing a fallback when value is `null` or missing)

```ts
import { Option, Predicate } from "effect"
import { Getter, Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.optionalKey(Schema.NullOr(Schema.String)).pipe(
    Schema.decodeTo(Schema.FiniteFromString, {
      decode: Getter.mapOptional((oe) =>
        oe.pipe(
          // remove null values
          Option.filter(Predicate.isNotNull),
          // default to "1" if none
          Option.orElseSome(() => "1")
        )
      ),
      encode: Getter.passthrough()
    })
  )
})

//     ┌─── { readonly a?: string | null; }
//     ▼
type Encoded = typeof schema.Encoded

//     ┌─── { readonly a: number; }
//     ▼
type Type = typeof schema.Type

console.log(Schema.decodeUnknownSync(schema)({}))
// Output: { a: 1 }

// console.log(Schema.decodeUnknownSync(Product)({ quantity: undefined }))
// throws

console.log(Schema.decodeUnknownSync(schema)({ a: null }))
// Output: { a: 1 }

console.log(Schema.decodeUnknownSync(schema)({ a: "2" }))
// Output: { a: 2 }
```

**Example** (Providing a fallback when value is `null`, `undefined`, or missing)

```ts
import { Option, Predicate } from "effect"
import { Getter, Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    Schema.decodeTo(Schema.FiniteFromString, {
      decode: Getter.mapOptional((oe) =>
        oe.pipe(
          // remove null and undefined
          Option.filter(Predicate.isNotNullish),
          // default to "1" if none
          Option.orElseSome(() => "1")
        )
      ),
      encode: Getter.passthrough()
    })
  )
})

//     ┌─── { readonly a?: string | null | undefined; }
//     ▼
type Encoded = typeof schema.Encoded

//     ┌─── { readonly a: number; }
//     ▼
type Type = typeof schema.Type

console.log(Schema.decodeUnknownSync(schema)({}))
// Output: { a: 1 }

console.log(Schema.decodeUnknownSync(schema)({ a: undefined }))
// Output: { a: 1 }

console.log(Schema.decodeUnknownSync(schema)({ a: null }))
// Output: { a: 1 }

console.log(Schema.decodeUnknownSync(schema)({ a: "2" }))
// Output: { a: 2 }
```

### Optional Fields as Options

#### Exact Optional Property

```ts
import { Option } from "effect"
import { Schema, Transformation } from "effect/schema"

const Product = Schema.Struct({
  quantity: Schema.optionalKey(Schema.NumberFromString).pipe(
    Schema.decodeTo(
      Schema.Option(Schema.Number),
      Transformation.transformOptional({
        decode: Option.some,
        encode: Option.flatten
      })
    )
  )
})

//     ┌─── { readonly quantity?: string; }
//     ▼
type Encoded = typeof Product.Encoded

//     ┌─── { readonly quantity: Option<number>; }
//     ▼
export type Type = typeof Product.Type

console.log(Schema.decodeUnknownSync(Product)({}))
// Output: { quantity: { _id: 'Option', _tag: 'None' } }

console.log(Schema.decodeUnknownSync(Product)({ quantity: "2" }))
// Output: { quantity: { _id: 'Option', _tag: 'Some', value: 2 } }

// console.log(Schema.decodeUnknownSync(Product)({ quantity: undefined }))
// throws:

console.log(Schema.encodeSync(Product)({ quantity: Option.some(2) }))
// Output: { quantity: "2" }

console.log(Schema.encodeSync(Product)({ quantity: Option.none() }))
// Output: {}
```

#### Optional Property

```ts
import { Option, Predicate } from "effect"
import { Schema, Transformation } from "effect/schema"

const Product = Schema.Struct({
  quantity: Schema.optional(Schema.NumberFromString).pipe(
    Schema.decodeTo(
      Schema.Option(Schema.Number),
      Transformation.transformOptional({
        decode: (oe) => oe.pipe(Option.filter(Predicate.isNotUndefined), Option.some),
        encode: Option.flatten
      })
    )
  )
})

//     ┌─── { readonly quantity?: string; }
//     ▼
type Encoded = typeof Product.Encoded

//     ┌─── { readonly quantity: Option<number>; }
//     ▼
export type Type = typeof Product.Type

console.log(Schema.decodeUnknownSync(Product)({}))
// Output: { quantity: { _id: 'Option', _tag: 'None' } }

console.log(Schema.decodeUnknownSync(Product)({ quantity: "2" }))
// Output: { quantity: { _id: 'Option', _tag: 'Some', value: 2 } }

// console.log(Schema.decodeUnknownSync(Product)({ quantity: undefined }))
// throws:

console.log(Schema.encodeSync(Product)({ quantity: Option.some(2) }))
// Output: { quantity: "2" }

console.log(Schema.encodeSync(Product)({ quantity: Option.none() }))
// Output: {}
```

#### Exact Optional Property with Nullability

```ts
import { Option, Predicate } from "effect"
import { Schema, Transformation } from "effect/schema"

const Product = Schema.Struct({
  quantity: Schema.optionalKey(Schema.NullOr(Schema.NumberFromString)).pipe(
    Schema.decodeTo(
      Schema.Option(Schema.Number),
      Transformation.transformOptional({
        decode: (oe) => oe.pipe(Option.filter(Predicate.isNotNull), Option.some),
        encode: Option.flatten
      })
    )
  )
})

//     ┌─── { readonly quantity?: string | null; }
//     ▼
type Encoded = typeof Product.Encoded

//     ┌─── { readonly quantity: Option<number>; }
//     ▼
export type Type = typeof Product.Type

console.log(Schema.decodeUnknownSync(Product)({}))
// Output: { quantity: { _id: 'Option', _tag: 'None' } }

console.log(Schema.decodeUnknownSync(Product)({ quantity: null }))
// Output: { quantity: { _id: 'Option', _tag: 'None' } }

console.log(Schema.decodeUnknownSync(Product)({ quantity: "2" }))
// Output: { quantity: { _id: 'Option', _tag: 'Some', value: 2 } }

// console.log(Schema.decodeUnknownSync(Product)({ quantity: undefined }))
// throws:
```

#### Optional Property with Nullability

```ts
import { Option, Predicate } from "effect"
import { Schema, Transformation } from "effect/schema"

const Product = Schema.Struct({
  quantity: Schema.optional(Schema.NullOr(Schema.NumberFromString)).pipe(
    Schema.decodeTo(
      Schema.Option(Schema.Number),
      Transformation.transformOptional({
        decode: (oe) => oe.pipe(Option.filter(Predicate.isNotNullish), Option.some),
        encode: Option.flatten
      })
    )
  )
})

//     ┌─── { readonly quantity?: string | null | undefined; }
//     ▼
type Encoded = typeof Product.Encoded

//     ┌─── { readonly quantity: Option<number>; }
//     ▼
export type Type = typeof Product.Type

console.log(Schema.decodeUnknownSync(Product)({}))
// Output: { quantity: { _id: 'Option', _tag: 'None' } }

console.log(Schema.decodeUnknownSync(Product)({ quantity: undefined }))
// Output: { quantity: { _id: 'Option', _tag: 'None' } }

console.log(Schema.decodeUnknownSync(Product)({ quantity: null }))
// Output: { quantity: { _id: 'Option', _tag: 'None' } }

console.log(Schema.decodeUnknownSync(Product)({ quantity: "2" }))
// Output: { quantity: { _id: 'Option', _tag: 'Some', value: 2 }
```

### Key Annotations

You can annotate individual keys using `Schema.annotateKey`. This is useful for adding a description or customizing the error message shown when the key is missing.

**Example** (Annotating a required `username` field)

```ts
import { Effect } from "effect"
import { Formatter, Schema } from "effect/schema"

const schema = Schema.Struct({
  username: Schema.String.pipe(
    Schema.annotateKey({
      description: "The username used to log in",
      // Custom message shown if the key is missing
      missingKeyMessage: "Username is required"
    })
  )
})

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)({}).pipe(Effect.runPromise).then(console.log, console.error)

/*
Output:
{ readonly "username": string }
└─ ["username"]
   └─ Username is required
*/
```

### Unexpected Key Message

You can annotate a struct with a custom message to use when a key is unexpected (when `onExcessProperty` is `error`).

**Example** (Annotating a struct with a custom message)

```ts
import { Effect } from "effect"
import { Formatter, Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.String
}).annotate({ unexpectedKeyMessage: "Custom message" })

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)({ a: "a", b: "b" }, { onExcessProperty: "error" })
  .pipe(Effect.runPromise)
  .then(console.log, console.error)

/*
Output:
{ readonly "a": string }
└─ ["b"]
   └─ Custom message
*/
```

### Preserve unexpected keys

You can preserve unexpected keys by setting `onExcessProperty` to `preserve`.

**Example** (Preserving unexpected keys)

```ts
import { Effect } from "effect"
import { Formatter, Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.String
})

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)({ a: "a", b: "b" }, { onExcessProperty: "preserve" })
  .pipe(Effect.runPromise)
  .then(console.log, console.error)

/*
Output:
{ b: 'b', a: 'a' }
*/
```

### Index Signatures

You can extend a struct with an index signature using `Schema.StructWithRest`. This allows you to define both fixed and dynamic properties in a single schema.

Filters applied to either the struct or the record are preserved when combined.

**Example** (Combining fixed properties with an index signature)

```ts
import { Schema } from "effect/schema"

// Define a schema with one fixed key "a" and any number of string keys mapping to numbers
export const schema = Schema.StructWithRest(Schema.Struct({ a: Schema.Number }), [
  Schema.Record(Schema.String, Schema.Number)
])

/*
type Type = {
    readonly [x: string]: number;
    readonly a: number;
}
*/
type Type = typeof schema.Type

/*
type Encoded = {
    readonly [x: string]: number;
    readonly a: number;
}
*/
type Encoded = typeof schema.Encoded
```

If you want the record part to be mutable, you can wrap it in `Schema.mutable`.

**Example** (Allowing dynamic keys to be mutable)

```ts
import { Schema } from "effect/schema"

// Define a schema with one fixed key "a" and any number of string keys mapping to numbers
export const schema = Schema.StructWithRest(Schema.Struct({ a: Schema.Number }), [
  Schema.mutable(Schema.Record(Schema.String, Schema.Number))
])

/*
type Type = {
    [x: string]: number;
    readonly a: number;
}
*/
type Type = typeof schema.Type

/*
type Encoded = {
    [x: string]: number;
    readonly a: number;
}
*/
type Encoded = typeof schema.Encoded
```

### 🆕 Deriving Structs

You can map the fields of a struct schema using the `mapFields` static method on `Schema.Struct`. The `mapFields` static method accepts a function from `Struct.Fields` to new fields, and returns a new `Schema.Struct` based on the result.

This can be used to pick, omit, modify, or extend struct fields.

#### Pick

Use `Struct.pick` to keep only a selected set of fields.

**Example** (Picking specific fields from a struct)

```ts
import { Struct } from "effect/data"
import { Schema } from "effect/schema"

/*
const schema: Schema.Struct<{
  readonly a: Schema.String;
}>
*/
const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number
}).mapFields(Struct.pick(["a"]))
```

#### Omit

Use `Struct.omit` to remove specified fields from a struct.

**Example** (Omitting fields from a struct)

```ts
import { Struct } from "effect/data"
import { Schema } from "effect/schema"

/*
const schema: Schema.Struct<{
  readonly a: Schema.String;
}>
*/
const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number
}).mapFields(Struct.omit(["b"]))
```

#### Merge

Use `Struct.merge` to add new fields to an existing struct.

**Example** (Adding fields to a struct)

```ts
import { Struct } from "effect/data"
import { Schema } from "effect/schema"

/*
const schema: Schema.Struct<{
  readonly a: Schema.String;
  readonly b: Schema.Number;
  readonly c: Schema.Boolean;
}>
*/
const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number
}).mapFields(
  Struct.merge({
    c: Schema.Boolean
  })
)
```

If you want to preserve the checks of the original struct, you can pass `{ preserveChecks: true }` to the `map` method.

**Example** (Preserving checks when merging fields)

```ts
import { Effect, Struct } from "effect"
import { Check, Formatter, Schema } from "effect/schema"

const original = Schema.Struct({
  a: Schema.String,
  b: Schema.String
}).check(Check.make(({ a, b }) => a === b, { title: "a === b" }))

const schema = original.mapFields(Struct.merge({ c: Schema.String }), {
  preserveChecks: true
})

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)({
  a: "a",
  b: "b",
  c: "c"
})
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
{ readonly "a": string; readonly "b": string; readonly "c": string } & a === b
└─ a === b
   └─ Invalid data {"a":"a","b":"b","c":"c"}
*/
```

#### Mapping individual fields

Use `Struct.evolve` to transform the value schema of individual fields.

**Example** (Modifying the type of a single field)

```ts
import { Struct } from "effect/data"
import { Schema } from "effect/schema"

/*
const schema: Schema.Struct<{
  readonly a: Schema.optionalKey<Schema.String>;
  readonly b: Schema.Number;
}>
*/
const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number
}).mapFields(
  Struct.evolve({
    a: (field) => Schema.optionalKey(field)
  })
)
```

#### Mapping all fields at once

If you want to transform the value schema of multiple fields at once, you can use `Struct.map`.

**Example** (Making all fields optional)

```ts
import { Struct } from "effect/data"
import { Schema } from "effect/schema"

/*
const schema: Schema.Struct<{
    readonly a: Schema.optionalKey<Schema.String>;
    readonly b: Schema.optionalKey<Schema.Number>;
    readonly c: Schema.optionalKey<Schema.Boolean>;
}>
*/
const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number,
  c: Schema.Boolean
}).mapFields(Struct.map(Schema.optionalKey))
```

#### Mapping a subset of fields at once

If you want to map a subset of elements, you can use `Struct.mapPick` or `Struct.mapOmit`.

**Example** (Making a subset of fields optional)

```ts
import { Struct } from "effect/data"
import { Schema } from "effect/schema"

/*
const schema: Schema.Struct<{
    readonly a: Schema.optionalKey<Schema.String>;
    readonly b: Schema.Number;
    readonly c: Schema.optionalKey<Schema.Boolean>;
}>
*/
const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number,
  c: Schema.Boolean
}).mapFields(Struct.mapPick(["a", "c"], Schema.optionalKey))
```

Or if it's more convenient, you can use `Struct.mapOmit`.

```ts
import { Struct } from "effect/data"
import { Schema } from "effect/schema"

/*
const schema: Schema.Struct<{
    readonly a: Schema.optionalKey<Schema.String>;
    readonly b: Schema.Number;
    readonly c: Schema.optionalKey<Schema.Boolean>;
}>
*/
const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number,
  c: Schema.Boolean
}).mapFields(Struct.mapOmit(["b"], Schema.optionalKey))
```

#### Mapping individual keys

Use `Struct.evolveKeys` to rename field keys while keeping the corresponding value schemas.

**Example** (Uppercasing keys in a struct)

```ts
import { Struct } from "effect/data"
import { String } from "effect/primitives"
import { Schema } from "effect/schema"

/*
const schema: Schema.Struct<{
  readonly A: Schema.String;
  readonly b: Schema.Number;
}>
*/
const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number
}).mapFields(
  Struct.evolveKeys({
    a: (key) => String.toUpperCase(key)
  })
)
```

If you simply want to rename keys with static keys, you can use `Struct.renameKeys`.

**Example** (Renaming keys in a struct)

```ts
import { Struct } from "effect/data"
import { Schema } from "effect/schema"

/*
const schema: Schema.Struct<{
  readonly A: Schema.String;
  readonly b: Schema.Number;
}>
*/
const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number
}).mapFields(
  Struct.renameKeys({
    a: "A"
  })
)
```

#### Mapping individual entries

Use `Struct.evolveEntries` when you want to transform both the key and the value of specific fields.

**Example** (Transforming keys and value schemas)

```ts
import { Struct } from "effect/data"
import { String } from "effect/primitives"
import { Schema } from "effect/schema"

/*
const schema: Schema.Struct<{
  readonly b: Schema.Number;
  readonly A: Schema.optionalKey<Schema.String>;
}>
*/
const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number
}).mapFields(
  Struct.evolveEntries({
    a: (key, value) => [String.toUpperCase(key), Schema.optionalKey(value)]
  })
)
```

#### Opaque Structs

The previous examples can be applied to opaque structs as well.

```ts
import { Struct } from "effect/data"
import { Schema } from "effect/schema"

class A extends Schema.Opaque<A>()(
  Schema.Struct({
    a: Schema.String,
    b: Schema.Number
  })
) {}

/*
const schema: Schema.Struct<{
  readonly a: Schema.optionalKey<Schema.String>;
  readonly b: Schema.Number;
}>
*/
const schema = A.mapFields(
  Struct.evolve({
    a: (field) => Schema.optionalKey(field)
  })
)
```

### Tagged Structs

A tagged struct is a struct that includes a `_tag` field. This field is used to identify the specific variant of the object, which is especially useful when working with union types.

When using the `makeSync` method, the `_tag` field is optional and will be added automatically. However, when decoding or encoding, the `_tag` field must be present in the input.

**Example** (Tagged struct as a shorthand for a struct with a `_tag` field)

```ts
import { Schema } from "effect/schema"

// Defines a struct with a fixed `_tag` field
const tagged = Schema.TaggedStruct("A", {
  a: Schema.String
})

// This is the same as writing:
const equivalent = Schema.Struct({
  _tag: Schema.tag("A"),
  a: Schema.String
})
```

**Example** (Accessing the literal value of the tag)

```ts
// The `_tag` field is a schema with a known literal value
const literal = tagged.fields._tag.schema.literal
// literal: "A"
```

## Opaque Structs

Use an opaque struct when you want to create a distinct type from a `Struct` without adding runtime behavior.

An opaque struct wraps a `Struct` in a class while preserving its schema shape.

Instance methods and custom constructors **are not allowed** in opaque structs. This is not enforced at the type level, but it may be enforced through a linter in the future.

Use `Schema.Class` instead of an opaque struct when you need runtime behavior.

`Schema.Class` wraps a `Struct` in a class and allows:

- Defining instance methods, getters, and custom constructors
- Structural equality via the `Equal` trait

**Example** (Creating an Opaque Struct)

```ts
import { Schema } from "effect/schema"

class Person extends Schema.Opaque<Person>()(
  Schema.Struct({
    name: Schema.String
  })
) {}

//      ┌─── Codec<Person, { readonly name: string; }, never, never>
//      ▼
const codec = Schema.revealCodec(Person)

// const x: Person
const person = Person.makeSync({ name: "John" })

console.log(person.name)
// "John"

// The class itself holds the original schema and its metadata
console.log(Person)
// -> [Function: Person] Struct$

// { readonly name: Schema.String }
Person.fields

/*
const another: Schema.Struct<{
    readonly name: typeof Person;
}>
*/
const another = Schema.Struct({ name: Person }) // You can use the opaque type inside other schemas

/*
type Type = {
    readonly name: Person;
}
*/
type Type = (typeof another)["Type"]
```

Opaque structs can be used just like regular structs, with no other changes needed.

**Example** (Retrieving Schema Fields)

```ts
import { Schema } from "effect/schema"

// A function that takes a generic struct
const getFields = <Fields extends Schema.Struct.Fields>(struct: Schema.Struct<Fields>) => struct.fields

class Person extends Schema.Opaque<Person>()(
  Schema.Struct({
    name: Schema.String
  })
) {}

/*
const fields: {
    readonly name: Schema.String;
}
*/
const fields = getFields(Person)
```

### Static methods

You can add static members to an opaque struct class to extend its behavior.

**Example** (Custom serializer via static method)

```ts
import { Schema, Serializer } from "effect/schema"

class Person extends Schema.Opaque<Person>()(
  Schema.Struct({
    name: Schema.String,
    createdAt: Schema.Date
  })
) {
  // Create a custom serializer using the class itself
  static readonly serializer = Serializer.json(this)
}

console.log(
  Schema.encodeUnknownSync(Person)({
    name: "John",
    createdAt: new Date()
  })
)
// { name: 'John', createdAt: 2025-05-02T13:49:29.926Z }

console.log(
  Schema.encodeUnknownSync(Person.serializer)({
    name: "John",
    createdAt: new Date()
  })
)
// { name: 'John', createdAt: '2025-05-02T13:49:29.928Z' }
```

### Annotations and filters

You can attach filters and annotations to the struct passed into `Opaque`.

**Example** (Applying a filter and title annotation)

```ts
import { Effect } from "effect"
import { Check, Formatter, Schema } from "effect/schema"

class Person extends Schema.Opaque<Person>()(
  Schema.Struct({
    name: Schema.String
  })
    .annotate({ id: "Person" })
    .check(Check.make(({ name }) => name.length > 0))
) {}

Formatter.decodeUnknownEffect(Formatter.makeTree())(Person)({ name: "" })
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Person & <filter>
└─ <filter>
   └─ Invalid data {"name":""}
*/
```

When you call methods like `annotate` on an opaque struct, you get back the original struct, not a new class.

```ts
import { Schema } from "effect/schema"

class Person extends Schema.Opaque<Person>()(
  Schema.Struct({
    name: Schema.String
  })
) {}

/*
const S: Schema.Struct<{
    readonly name: Schema.String;
}>
*/
const S = Person.annotate({ title: "Person" }) // `annotate` returns the wrapped struct type
```

### Recursive Opaque Structs

**Example** (Recursive Opaque Struct with Same Encoded and Type)

```ts
import { Schema } from "effect/schema"

export class Category extends Schema.Opaque<Category>()(
  Schema.Struct({
    name: Schema.String,
    children: Schema.Array(Schema.suspend((): Schema.Codec<Category> => Category))
  })
) {}

/*
type Encoded = {
    readonly children: readonly Category[];
    readonly name: string;
}
*/
export type Encoded = (typeof Category)["Encoded"]
```

**Example** (Recursive Opaque Struct with Different Encoded and Type)

```ts
import { Schema } from "effect/schema"

interface CategoryEncoded extends Schema.Codec.Encoded<typeof Category> {}

export class Category extends Schema.Opaque<Category>()(
  Schema.Struct({
    name: Schema.FiniteFromString,
    children: Schema.Array(Schema.suspend((): Schema.Codec<Category, CategoryEncoded> => Category))
  })
) {}

/*
type Encoded = {
    readonly children: readonly CategoryEncoded[];
    readonly name: string;
}
*/
export type Encoded = (typeof Category)["Encoded"]
```

**Example** (Mutually Recursive Schemas)

```ts
import { Schema } from "effect/schema"

class Expression extends Schema.Opaque<Expression>()(
  Schema.Struct({
    type: Schema.Literal("expression"),
    value: Schema.Union([Schema.Number, Schema.suspend((): Schema.Codec<Operation> => Operation)])
  })
) {}

class Operation extends Schema.Opaque<Operation>()(
  Schema.Struct({
    type: Schema.Literal("operation"),
    operator: Schema.Literals(["+", "-"]),
    left: Expression,
    right: Expression
  })
) {}

/*
type Encoded = {
    readonly type: "operation";
    readonly operator: "+" | "-";
    readonly left: {
        readonly type: "expression";
        readonly value: number | Operation;
    };
    readonly right: {
        readonly type: "expression";
        readonly value: number | Operation;
    };
}
*/
export type Encoded = (typeof Operation)["Encoded"]
```

## Records

### Key Transformations

`Schema.Record` supports transforming keys during decoding and encoding. This can be useful when working with different naming conventions.

**Example** (Transforming snake_case keys to camelCase)

```ts
import { Schema, Transformation } from "effect/schema"

const SnakeToCamel = Schema.String.pipe(Schema.decode(Transformation.snakeToCamel()))

const schema = Schema.Record(SnakeToCamel, Schema.Number)

console.log(Schema.decodeUnknownSync(schema)({ a_b: 1, c_d: 2 }))
// { aB: 1, cD: 2 }
```

By default, if a transformation results in duplicate keys, the last value wins.

**Example** (Merging transformed keys by keeping the last one)

```ts
import { Schema, Transformation } from "effect/schema"

const SnakeToCamel = Schema.String.pipe(Schema.decode(Transformation.snakeToCamel()))

const schema = Schema.Record(SnakeToCamel, Schema.Number)

console.log(Schema.decodeUnknownSync(schema)({ a_b: 1, aB: 2 }))
// { aB: 2 }
```

You can customize how key conflicts are resolved by providing a `combine` function.

**Example** (Combining values for conflicting keys)

```ts
import { Schema, Transformation } from "effect/schema"

const SnakeToCamel = Schema.String.pipe(Schema.decode(Transformation.snakeToCamel()))

const schema = Schema.Record(SnakeToCamel, Schema.Number, {
  key: {
    decode: {
      // When decoding, combine values of conflicting keys by summing them
      combine: ([_, v1], [k2, v2]) => [k2, v1 + v2] // you can pass a Semigroup to combine keys
    },
    encode: {
      // Same logic applied when encoding
      combine: ([_, v1], [k2, v2]) => [k2, v1 + v2]
    }
  }
})

console.log(Schema.decodeUnknownSync(schema)({ a_b: 1, aB: 2 }))
// { aB: 3 }

console.log(Schema.encodeUnknownSync(schema)({ a_b: 1, aB: 2 }))
// { a_b: 3 }
```

### Mutability

By default, records are tagged as `readonly`. You can mark a record as mutable using `Schema.mutableKey` as you do with structs.

**Example** (Defining a mutable record)

```ts
import { Schema } from "effect/schema"

export const schema = Schema.Record(Schema.String, Schema.mutableKey(Schema.Number))

/*
type Type = {
    [x: string]: number;
}
*/
type Type = typeof schema.Type

/*
type Encoded = {
    [x: string]: number;
}
*/
type Encoded = typeof schema.Encoded
```

### Literal Structs

When you pass a union of string literals as the key schema to `Schema.Record`, you get a struct-like schema where each literal becomes a required key. This mirrors how TypeScript's built-in `Record` type behaves.

**Example** (Creating a literal struct with fixed string keys)

```ts
import { Schema } from "effect/schema"

const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.Number)

/*
type Type = {
    readonly a: number;
    readonly b: number;
}
*/
type Type = typeof schema.Type
```

#### Mutable Keys

By default, keys are readonly. To make them mutable, use `Schema.mutableKey` just as you would with a standard struct.

**Example** (Literal struct with mutable keys)

```ts
import { Schema } from "effect/schema"

const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.mutableKey(Schema.Number))

/*
type Type = {
    a: number;
    b: number;
}
*/
type Type = typeof schema.Type
```

#### Optional Keys

You can make the keys optional by wrapping the value schema with `Schema.optional`.

**Example** (Literal struct with optional keys)

```ts
import { Schema } from "effect/schema"

const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.optional(Schema.Number))

/*
type Type = {
    readonly a?: number;
    readonly b?: number;
}
*/
type Type = typeof schema.Type
```

## Tuples

### Rest Elements

You can add rest elements to a tuple using `Schema.TupleWithRest`.

**Example** (Adding rest elements to a tuple)

```ts
import { Schema } from "effect/schema"

export const schema = Schema.TupleWithRest(Schema.Tuple([Schema.FiniteFromString, Schema.String]), [
  Schema.Boolean,
  Schema.String
])

/*
type Type = readonly [number, string, ...boolean[], string]
*/
type Type = typeof schema.Type

/*
type Encoded = readonly [string, string, ...boolean[], string]
*/
type Encoded = typeof schema.Encoded
```

### Element Annotations

You can annotate elements using `Schema.annotateKey`.

**Example** (Annotating an element)

```ts
import { Effect } from "effect"
import { Formatter, Schema } from "effect/schema"

const schema = Schema.Tuple([
  Schema.String.pipe(
    Schema.annotateKey({
      description: "my element description",
      // a message to display when the element is missing
      missingKeyMessage: "this element is required"
    })
  )
])

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)([]).pipe(Effect.runPromise).then(console.log, console.error)
/*
Output:
readonly [string]
└─ [0]
   └─ this element is required
*/
```

### Deriving Tuples

You can map the elements of a tuple schema using the `mapElements` static method on `Schema.Tuple`. The `mapElements` static method accepts a function from `Tuple.elements` to new elements, and returns a new `Schema.Tuple` based on the result.

#### Pick

Use `Tuple.pick` to keep only a selected set of elements.

**Example** (Picking specific elements from a tuple)

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Tuple<readonly [Schema.String, Schema.Boolean]>
*/
const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(Tuple.pick([0, 2]))
```

#### Omit

Use `Tuple.omit` to remove specified elements from a tuple.

**Example** (Omitting elements from a tuple)

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Tuple<readonly [Schema.String, Schema.Boolean]>
*/
const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(Tuple.omit([1]))
```

#### Adding Elements

You can add elements to a tuple schema using the `appendElement` and `appendElements` APIs of the `Tuple` module.

**Example** (Adding elements to a tuple)

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Tuple<readonly [
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.String,
  Schema.Number
]>
*/
const schema = Schema.Tuple([Schema.String, Schema.Number])
  .mapElements(Tuple.appendElement(Schema.Boolean)) // adds a single element
  .mapElements(Tuple.appendElements([Schema.String, Schema.Number])) // adds multiple elements
```

#### Mapping individual elements

You can evolve the elements of a tuple schema using the `evolve` API of the `Tuple` module

**Example**

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Tuple<readonly [
  Schema.NullOr<Schema.String>,
  Schema.Number,
  Schema.NullOr<Schema.Boolean>
]>
*/
const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
  Tuple.evolve([
    (v) => Schema.NullOr(v),
    undefined, // no change
    (v) => Schema.NullOr(v)
  ])
)
```

#### Mapping all elements at once

You can map all elements of a tuple schema using the `map` API of the `Tuple` module.

**Example** (Making all elements nullable)

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Tuple<readonly [
  Schema.NullOr<Schema.String>,
  Schema.NullOr<Schema.Number>,
  Schema.NullOr<Schema.Boolean>
]>
*/
const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(Tuple.map(Schema.NullOr))
```

#### Mapping a subset of elements at once

If you want to map a subset of elements, you can use `Tuple.mapPick` or `Tuple.mapOmit`.

**Example** (Making a subset of elements nullable)

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Tuple<readonly [
  Schema.NullOr<Schema.String>,
  Schema.Number,
  Schema.NullOr<Schema.Boolean>
]>
*/
const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
  Tuple.mapPick([0, 2], Schema.NullOr)
)
```

Or if it's more convenient, you can use `Tuple.mapOmit`.

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Tuple<readonly [
  Schema.NullOr<Schema.String>,
  Schema.Number,
  Schema.NullOr<Schema.Boolean>
]>
*/
const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
  Tuple.mapOmit([1], Schema.NullOr)
)
```

#### Renaming Indices

You can rename the indices of a tuple schema using the `renameIndices` API of the `Tuple` module.

**Example** (Partial index mapping)

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Tuple<readonly [
  Schema.Number,
  Schema.String,
  Schema.Boolean
]>
*/
const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
  Tuple.renameIndices(["1", "0"]) // flip the first and second elements
)
```

**Example** (Full index mapping)

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Tuple<readonly [
  Schema.Boolean,
  Schema.Number,
  Schema.String
]>
*/
const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
  Tuple.renameIndices([
    "2", // last element becomes first
    "1", // second element keeps its index
    "0" // first element becomes third
  ])
)
```

## Arrays

### 🆕 Unique Arrays

You can deduplicate arrays using `Schema.UniqueArray`.

Internally, `Schema.UniqueArray` uses `Schema.Array` and adds a check based on `Check.deduped` using `ToEquivalence.make(item)` for the equivalence.

```ts
import { Effect } from "effect"
import { Formatter, Schema } from "effect/schema"

const schema = Schema.UniqueArray(Schema.String)

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)(["a", "b", "a"])
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
ReadonlyArray<string> & unique
└─ unique
   └─ Invalid data ["a","b","a"]
*/
```

## Classes

### Existing Classes

#### Validating the Constructor

**Use Case**: When you want to validate the constructor arguments of an existing class.

**Example** (Using a tuple to validate the constructor arguments)

```ts
import { Schema, Formatter, Issue } from "effect/schema"

const PersonConstructorArguments = Schema.Tuple([Schema.String, Schema.Finite])

// Existing class
class Person {
  constructor(
    readonly name: string,
    readonly age: number
  ) {
    PersonConstructorArguments.makeSync([name, age])
  }
}

try {
  new Person("John", NaN)
} catch (error) {
  if (error instanceof Error) {
    if (Issue.isIssue(error.cause)) {
      console.error(Formatter.makeTree().format(error.cause))
    } else {
      console.error(error)
    }
  }
}
/*
readonly [string, number & finite]
└─ [1]
   └─ number & finite
      └─ finite
         └─ Invalid data NaN
*/
```

**Example** (Inheritance)

```ts
import { Schema } from "effect/schema"

const PersonConstructorArguments = Schema.Tuple([Schema.String, Schema.Finite])

class Person {
  constructor(
    readonly name: string,
    readonly age: number
  ) {
    PersonConstructorArguments.makeSync([name, age])
  }
}

const PersonWithEmailConstructorArguments = Schema.Tuple([Schema.String])

class PersonWithEmail extends Person {
  constructor(
    name: string,
    age: number,
    readonly email: string
  ) {
    // Only validate the additional argument
    PersonWithEmailConstructorArguments.makeSync([email])
    super(name, age)
  }
}
```

#### Defining a Schema

```ts
import { Schema, Transformation } from "effect/schema"

class Person {
  constructor(
    readonly name: string,
    readonly age: number
  ) {}
}

const PersonSchema = Schema.instanceOf({
  constructor: Person,
  annotations: {
    title: "Person",
    // optional: default JSON serialization
    defaultJsonSerializer: () =>
      Schema.link<Person>()(
        Schema.Tuple([Schema.String, Schema.Number]),
        Transformation.transform({
          decode: (args) => new Person(...args),
          encode: (instance) => [instance.name, instance.age] as const
        })
      )
  }
})
  // optional: explicit encoding
  .pipe(
    Schema.encodeTo(
      Schema.Struct({
        name: Schema.String,
        age: Schema.Number
      }),
      Transformation.transform({
        decode: (args) => new Person(args.name, args.age),
        encode: (instance) => instance
      })
    )
  )
```

**Example** (Inheritance)

```ts
import { Schema, Transformation } from "effect/schema"

class Person {
  constructor(
    readonly name: string,
    readonly age: number
  ) {}
}

const PersonSchema = Schema.instanceOf({
  constructor: Person,
  annotations: {
    title: "Person",
    // optional: default JSON serialization
    defaultJsonSerializer: () =>
      Schema.link<Person>()(
        Schema.Tuple([Schema.String, Schema.Number]),
        Transformation.transform({
          decode: (args) => new Person(...args),
          encode: (instance) => [instance.name, instance.age] as const
        })
      )
  }
})
  // optional: explicit encoding
  .pipe(
    Schema.encodeTo(
      Schema.Struct({
        name: Schema.String,
        age: Schema.Number
      }),
      Transformation.transform({
        decode: (args) => new Person(args.name, args.age),
        encode: (instance) => instance
      })
    )
  )

class PersonWithEmail extends Person {
  constructor(
    name: string,
    age: number,
    readonly email: string
  ) {
    super(name, age)
  }
}

// const PersonWithEmailSchema = ...repeat the pattern above...
```

#### Errors

**Example** (Extending Data.Error)

```ts
import { Data, Effect, identity } from "effect"
import { Schema, Transformation, Util } from "effect/schema"

const Props = Schema.Struct({
  message: Schema.String
})

class Err extends Data.Error<typeof Props.Type> {
  constructor(props: typeof Props.Type) {
    super(Props.makeSync(props))
  }
}

const program = Effect.gen(function* () {
  yield* new Err({ message: "Uh oh" })
})

Effect.runPromiseExit(program).then((exit) => console.log(JSON.stringify(exit, null, 2)))
/*
{
  "_id": "Exit",
  "_tag": "Failure",
  "cause": {
    "_id": "Cause",
    "failures": [
      {
        "_tag": "Fail",
        "error": {
          "message": "Uh oh"
        }
      }
    ]
  }
}
*/

const transformation = Transformation.transform<Err, (typeof Props)["Type"]>({
  decode: (props) => new Err(props),
  encode: identity
})

const schema = Schema.instanceOf({
  constructor: Err,
  annotations: {
    title: "Err",
    serialization: {
      json: () => Schema.link<Err>()(Props, transformation)
    }
  }
}).pipe(Schema.encodeTo(Props, transformation))

// built-in helper?
const builtIn = Util.getNativeClassSchema(Err, { encoding: Props })
```

### Class API

**Example**

```ts
import { Schema } from "effect/schema"

class A extends Schema.Class<A>("A")({
  a: Schema.String
}) {
  readonly _a = 1
}

console.log(new A({ a: "a" }))
// A { a: 'a', _a: 1 }
console.log(A.makeSync({ a: "a" }))
// A { a: 'a', _a: 1 }
console.log(Schema.decodeUnknownSync(A)({ a: "a" }))
// A { a: 'a', _a: 1 }
```

#### Branded Classes

You can optionally add a brand to a class to prevent accidental mixing of different types.

```ts
import { Schema } from "effect/schema"

class A extends Schema.Class<A, { readonly brand: unique symbol }>("A")({
  a: Schema.String
}) {}

class B extends Schema.Class<B, { readonly brand: unique symbol }>("B")({
  a: Schema.String
}) {}

// @ts-expect-error
export const a: A = B.makeSync({ a: "a" })
// @ts-expect-error
export const b: B = A.makeSync({ a: "a" })
```

or using the `Brand` module:

```ts
import type { Brand } from "effect"
import { Schema } from "effect/schema"

class A extends Schema.Class<A, Brand.Brand<"A">>("A")({
  a: Schema.String
}) {}

class B extends Schema.Class<B, Brand.Brand<"B">>("B")({
  a: Schema.String
}) {}

// @ts-expect-error
export const a: A = B.makeSync({ a: "a" })
// @ts-expect-error
export const b: B = A.makeSync({ a: "a" })
```

#### Filters

```ts
import { Schema, Check, Formatter, Issue } from "effect/schema"

class A extends Schema.Class<A>("A")({
  a: Schema.String.check(Check.nonEmpty())
}) {}

try {
  new A({ a: "" })
} catch (error) {
  if (error instanceof Error) {
    if (Issue.isIssue(error.cause)) {
      console.error(Formatter.makeTree().format(error.cause))
    } else {
      console.error(error)
    }
  }
}
/*
{ readonly "a": string & minLength(1) }
└─ ["a"]
   └─ string & minLength(1)
      └─ minLength(1)
         └─ Invalid data ""
*/
```

#### Annotations

```ts
import { Schema, Formatter, Issue } from "effect/schema"

export class A extends Schema.Class<A>("A")(
  {
    a: Schema.String
  },
  {
    title: "A"
  }
) {}

try {
  Schema.decodeUnknownSync(A)({ a: null })
} catch (error) {
  if (Issue.isIssue(error)) {
    console.error(Formatter.Tree.format(error))
  } else {
    console.error(error)
  }
}
/*
A <-> { readonly "a": string }
└─ { readonly "a": string }
   └─ ["a"]
      └─ Expected string, actual null
*/
```

#### extend

```ts
import { Schema } from "effect/schema"

class A extends Schema.Class<A>("A")(
  Schema.Struct({
    a: Schema.String
  })
) {
  readonly _a = 1
}
class B extends A.extend<B>("B")({
  b: Schema.Number
}) {
  readonly _b = 2
}

console.log(new B({ a: "a", b: 2 }))
// B { a: 'a', _a: 1, _b: 2 }
console.log(B.makeSync({ a: "a", b: 2 }))
// B { a: 'a', _a: 1, _b: 2 }
console.log(Schema.decodeUnknownSync(B)({ a: "a", b: 2 }))
// B { a: 'a', _a: 1, _b: 2 }
```

#### Recursive Classes

```ts
import { Schema } from "effect/schema"

export class Category extends Schema.Class<Category>("Category")(
  Schema.Struct({
    name: Schema.String,
    children: Schema.Array(Schema.suspend((): Schema.Codec<Category> => Category))
  })
) {}

/*
type Encoded = {
    readonly children: readonly Category[];
    readonly name: string;
}
*/
export type Encoded = (typeof Category)["Encoded"]
```

**Example** (Recursive Opaque Struct with Different Encoded and Type)

```ts
import { Schema } from "effect/schema"

interface CategoryEncoded extends Schema.Codec.Encoded<typeof Category> {}

export class Category extends Schema.Class<Category>("Category")(
  Schema.Struct({
    name: Schema.FiniteFromString,
    children: Schema.Array(Schema.suspend((): Schema.Codec<Category, CategoryEncoded> => Category))
  })
) {}

/*
type Encoded = {
    readonly children: readonly CategoryEncoded[];
    readonly name: string;
}
*/
export type Encoded = (typeof Category)["Encoded"]
```

**Example** (Mutually Recursive Schemas)

```ts
import { Schema } from "effect/schema"

class Expression extends Schema.Class<Expression>("Expression")(
  Schema.Struct({
    type: Schema.Literal("expression"),
    value: Schema.Union([Schema.Number, Schema.suspend((): Schema.Codec<Operation> => Operation)])
  })
) {}

class Operation extends Schema.Class<Operation>("Operation")(
  Schema.Struct({
    type: Schema.Literal("operation"),
    operator: Schema.Literals(["+", "-"]),
    left: Expression,
    right: Expression
  })
) {}

/*
type Encoded = {
    readonly type: "operation";
    readonly operator: "+" | "-";
    readonly left: {
        readonly type: "expression";
        readonly value: number | Operation;
    };
    readonly right: {
        readonly type: "expression";
        readonly value: number | Operation;
    };
}
*/
export type Encoded = (typeof Operation)["Encoded"]
```

### ErrorClass

```ts
import { Schema } from "effect/schema"

class E extends Schema.ErrorClass<E>("E")({
  id: Schema.Number
}) {}
```

### RequestClass

```ts
import { Schema } from "effect/schema"

class A extends Schema.RequestClass<A>("A")({
  payload: Schema.Struct({
    a: Schema.String
  }),
  success: Schema.String,
  error: Schema.Number
}) {}
```

## Unions

By default, unions are _inclusive_: a value is accepted if it matches **any** of the union's members.

The members are checked in order, and the first one that matches is used.

### Excluding Incompatible Members

If a union member is not compatible with the input, it is automatically excluded during validation.

**Example** (Excluding incompatible members from the union)

```ts
import { Effect } from "effect"
import { Formatter, Schema } from "effect/schema"

const schema = Schema.Union([Schema.NonEmptyString, Schema.Number])

// Input is "", which is not a number.
// Schema.Number is excluded and Schema.NonEmptyString is used.
Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)("").pipe(Effect.runPromise).then(console.log, console.error)
/*
Output:
string & minLength(1)
└─ minLength(1)
   └─ Invalid data ""
*/
```

If none of the union members match the input, the union fails with a message at the top level.

**Example** (All members excluded)

```ts
import { Effect } from "effect"
import { Formatter, Schema } from "effect/schema"

const schema = Schema.Union([Schema.NonEmptyString, Schema.Number])

// Input is null, which does not match any member
Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)(null)
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
Expected string | number, actual null
*/
```

This behavior is especially helpful when working with literal values. Instead of producing a separate error for each literal (as in version 3), the schema reports a single, clear message.

**Example** (Validating against a set of literals)

```ts
import { Effect } from "effect"
import { Formatter, Schema } from "effect/schema"

const schema = Schema.Literals(["a", "b"])

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)(null)
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
Expected "a" | "b", actual null
*/
```

### 🆕 Exclusive Unions

You can create an exclusive union, where the union matches if exactly one member matches, by passing the `{ mode: "oneOf" }` option.

**Example** (Exclusive Union)

```ts
import { Effect } from "effect"
import { Formatter, Schema } from "effect/schema"

const schema = Schema.Union([Schema.Struct({ a: Schema.String }), Schema.Struct({ b: Schema.Number })], {
  mode: "oneOf"
})

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)({ a: "a", b: 1 })
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
Expected exactly one member to match the input {"a":"a","b":1}, but multiple members matched in { readonly "a": string } ⊻ { readonly "b": number }
*/
```

### Deriving Unions

You can map the members of a union schema using the `mapMembers` static method on `Schema.Union`. The `mapMembers` static method accepts a function from `Union.members` to new members, and returns a new `Schema.Union` based on the result.

#### Adding Members

You can add members to a union schema using the `appendElement` and `appendElements` APIs of the `Tuple` module.

**Example** (Adding members to a union)

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Union<readonly [
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.String,
  Schema.Number
]>
*/
const schema = Schema.Union([Schema.String, Schema.Number])
  .mapMembers(Tuple.appendElement(Schema.Boolean)) // adds a single member
  .mapMembers(Tuple.appendElements([Schema.String, Schema.Number])) // adds multiple members
```

#### Mapping individual members

You can evolve the members of a union schema using the `evolve` API of the `Tuple` module

**Example**

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Union<readonly [
  Schema.Array$<Schema.String>,
  Schema.Number,
  Schema.Array$<Schema.Boolean>
]>
*/
const schema = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).mapMembers(
  Tuple.evolve([
    (v) => Schema.Array(v),
    undefined, // no change
    (v) => Schema.Array(v)
  ])
)
```

#### Mapping all members at once

You can map all members of a union schema using the `map` API of the `Tuple` module.

**Example**

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

/*
const schema: Schema.Union<readonly [
  Schema.Array$<Schema.String>,
  Schema.Array$<Schema.Number>,
  Schema.Array$<Schema.Boolean>
]>
*/
const schema = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).mapMembers(Tuple.map(Schema.Array))
```

### 🆕 Union of Literals

You can create a union of literals using `Schema.Literals`.

```ts
import { Schema } from "effect/schema"

const schema = Schema.Literals(["red", "green", "blue"])
```

#### Deriving new literals

You can map the members of a `Schema.Literals` schema using the `mapMembers` method. The `mapMembers` method accepts a function from `Literals.members` to new members, and returns a new `Schema.Union` based on the result.

```ts
import { Tuple } from "effect"
import { Schema } from "effect/schema"

const schema = Schema.Literals(["red", "green", "blue"]).mapMembers(
  Tuple.evolve([
    (a) => Schema.Struct({ _tag: a, a: Schema.String }),
    (b) => Schema.Struct({ _tag: b, b: Schema.Number }),
    (c) => Schema.Struct({ _tag: c, c: Schema.Boolean })
  ])
)

/*
type Type = {
    readonly _tag: "red";
    readonly a: string;
} | {
    readonly _tag: "green";
    readonly b: number;
} | {
    readonly _tag: "blue";
    readonly c: boolean;
}
*/
type Type = (typeof schema)["Type"]
```

### 🆕 Tagged Unions

You can define a tagged union using the `Schema.TaggedUnion` helper. This is useful when combining multiple tagged structs into a union.

**Example** (Defining a tagged union with `Schema.TaggedUnion`)

```ts
import { Schema } from "effect/schema"

// Create a union of two tagged structs
const schema = Schema.TaggedUnion({
  A: { a: Schema.String },
  B: { b: Schema.Finite }
})
```

This is equivalent to writing:

```ts
const schema = Schema.Union([
  Schema.TaggedStruct("A", { a: Schema.String }),
  Schema.TaggedStruct("B", { b: Schema.Finite })
])
```

The result is a tagged union schema with built-in helpers based on the tag values. See the next section for more details.

### 🆕 Augmenting Tagged Unions

The `asTaggedUnion` function enhances a tagged union schema by adding helper methods for working with its members.

You need to specify the name of the tag field used to differentiate between variants.

**Example** (Adding tag-based helpers to a union)

```ts
import { Schema } from "effect/schema"

const original = Schema.Union([
  Schema.Struct({ type: Schema.tag("A"), a: Schema.String }),
  Schema.Struct({ type: Schema.tag("B"), b: Schema.Finite }),
  Schema.Struct({ type: Schema.tag("C"), c: Schema.Boolean })
])

// Enrich the union with tag-based utilities
const tagged = original.pipe(Schema.asTaggedUnion("type"))
```

This helper has some advantages over a dedicated constructor:

- It does not require changes to the original schema, just call a helper.
- You can apply it to schemas from external sources.
- You can choose among multiple possible tag fields if present.
- It supports unions that include nested unions.

**Note**. If the tag is the standard `_tag` field, you can use `Schema.TaggedUnion` instead.

#### Accessing Members by Tag

The `cases` property gives direct access to each member schema of the union.

**Example** (Getting a member schema from a tagged union)

```ts
const A = tagged.cases.A
const B = tagged.cases.B
const C = tagged.cases.C
```

#### Checking Membership in a Subset of Tags

The `isAnyOf` method lets you check if a value belongs to a selected subset of tags.

**Example** (Checking membership in a subset of union tags)

```ts
console.log(tagged.isAnyOf(["A", "B"])({ type: "A", a: "a" })) // true
console.log(tagged.isAnyOf(["A", "B"])({ type: "B", b: 1 })) // true

console.log(tagged.isAnyOf(["A", "B"])({ type: "C", c: true })) // false
```

#### Type Guards

The `guards` property provides a type guard for each tag.

**Example** (Using type guards for tagged members)

```ts
console.log(tagged.guards.A({ type: "A", a: "a" })) // true
console.log(tagged.guards.B({ type: "B", b: 1 })) // true

console.log(tagged.guards.A({ type: "B", b: 1 })) // false
```

#### Matching on a Tag

You can define a matcher function using the `match` method. This is a concise way to handle each variant of the union.

**Example** (Handling union members with `match`)

```ts
const matcher = tagged.match({
  A: (a) => `This is an A: ${a.a}`,
  B: (b) => `This is a B: ${b.b}`,
  C: (c) => `This is a C: ${c.c}`
})

console.log(matcher({ type: "A", a: "a" })) // This is an A: a
console.log(matcher({ type: "B", b: 1 })) // This is a B: 1
console.log(matcher({ type: "C", c: true })) // This is a C: true
```

## Transformations Redesign

### 🆕 Transformations as First-Class

In previous versions, transformations were directly embedded in schemas. In the current version, they are defined as independent values that can be reused across schemas.

**Example** (v3 inline transformation)

```ts
const Trim = transform(
  String,
  Trimmed,
  // non re-usable transformation
  {
    decode: (i) => i.trim(),
    encode: identity
  }
) {}
```

This style made it difficult to reuse logic across different schemas.

Now, transformations like `trim` are declared once and reused wherever needed.

**Example** (The `trim` built-in transformation)

```ts
import { Transformation } from "effect/schema"

// const t: Transformation.Transformation<string, string, never, never>
const t = Transformation.trim()
```

You can apply a transformation to any compatible schema. In this example, `trim` is applied to a string schema using `Schema.decode` (more on this later).

**Example** (Applying `trim` to a string schema)

```ts
import { Schema, Transformation } from "effect/schema"

const schema = Schema.String.pipe(Schema.decode(Transformation.trim()))

console.log(Schema.decodeUnknownSync(schema)("  123"))
// 123
```

### Anatomy of a Transformation

Transformations use the following type:

```ts
Transformation<T, E, RD, RE>
```

- `T`: the decoded (output) type
- `E`: the encoded (input) type
- `RD`: the context used while decoding
- `RE`: the context used while encoding

A transformation consists of two `Getter` functions:

- `decode: Getter<T, E, RD>` — transforms a value during decoding
- `encode: Getter<E, T, RE>` — transforms a value during encoding

Each `Getter` receives an input and an optional context and returns either a value or an error. Getters can be composed to build more complex logic.

**Example** (Implementation of `Transformation.trim`)

```ts
/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim(): Transformation<string, string> {
  return new Transformation(Getter.trim(), Getter.passthrough())
}
```

In this case:

- The `decode` process uses `Getter.trim()` to remove leading and trailing whitespace.
- The `encode` process uses `Getter.passthrough()`, which returns the input as is.

#### Composing Transformations

You can combine transformations using the `.compose` method. The resulting transformation applies the `decode` and `encode` logic of both transformations in sequence.

**Example** (Trim and lowercase a string)

```ts
import { Option } from "effect"
import { Transformation } from "effect/schema"

// Compose two transformations: trim followed by toLowerCase
const trimToLowerCase = Transformation.trim().compose(Transformation.toLowerCase())

// Run the decode logic manually to inspect the result
console.log(trimToLowerCase.decode.run(Option.some("  Abc"), {}))
/*
{
  _id: 'Exit',
  _tag: 'Success',
  value: { _id: 'Option', _tag: 'Some', value: 'abc' }
}
*/
```

In this example:

- The `decode` logic applies `Getter.trim()` followed by `Getter.toLowerCase()`, producing a string that is trimmed and lowercased.
- The `encode` logic is `Getter.passthrough()`, which simply returns the input as-is.

### Transforming One Schema into Another

To define how one schema transforms into another, you can use:

- `Schema.decodeTo` (and its inverse `Schema.encodeTo`)
- `Schema.decode` (and its inverse `Schema.encode`)

These functions let you attach transformations to schemas, defining how values should be converted during decoding or encoding.

#### decodeTo

Use `Schema.decodeTo` when you want to transform a source schema into a different target schema.

You must provide:

1. The target schema
2. An optional transformation

If no transformation is provided, the operation is called "schema composition" (see below).

**Example** (Parsing a number from a string)

```ts
import { Schema, Transformation } from "effect/schema"

const NumberFromString =
  // source schema: String
  Schema.String.pipe(
    Schema.decodeTo(
      Schema.Number, // target schema: Number
      Transformation.numberFromString // built-in transformation that converts a string to a number (and back)
    )
  )

console.log(Schema.decodeUnknownSync(NumberFromString)("123"))
// 123
```

#### decode

Use `Schema.decode` when the source and target schemas are the same and you only want to apply a transformation.

This is a shorter version of `decodeTo`.

**Example** (Trimming whitespace from a string)

```ts
import { Schema, Transformation } from "effect/schema"

// Equivalent to decodeTo(Schema.String, Transformation.trim())
const TrimmedString = Schema.String.pipe(Schema.decode(Transformation.trim()))
```

#### Defining an Inline Transformation

You can create a transformation directly using helpers from the `Transformation` module.

For example, `Transformation.transform` lets you define a simple transformation by providing `decode` and `encode` functions.

**Example** (Converting meters to kilometers and back)

```ts
import { Schema, Transformation } from "effect/schema"

// Defines a transformation that converts meters (number) to kilometers (number)
// 1000 meters -> 1 kilometer (decode)
// 1 kilometer -> 1000 meters (encode)
const Kilometers = Schema.Finite.pipe(
  Schema.decode(
    Transformation.transform({
      decode: (meters) => meters / 1000,
      encode: (kilometers) => kilometers * 1000
    })
  )
)
```

You can define transformations that may fail during decoding or encoding using `Transformation.transformOrFail`.

This is useful when you need to validate input or enforce rules that may not always succeed.

**Example** (Converting a string URL into a `URL` object)

```ts
import { Effect, Option } from "effect"
import { Issue, Schema, Transformation } from "effect/schema"

const URLFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.instanceOf({ constructor: URL }),
    Transformation.transformOrFail({
      decode: (s) =>
        Effect.try({
          try: () => new URL(s),
          catch: (error) => new Issue.InvalidValue(Option.some(s), { cause: error })
        }),
      encode: (url) => Effect.succeed(url.toString())
    })
  )
)
```

### Schema composition

You can compose transformations, but you can also compose schemas.

**Example** (Converting meters to miles via kilometers)

```ts
import { Schema, Transformation } from "effect/schema"

const KilometersFromMeters = Schema.Finite.pipe(
  Schema.decode(
    Transformation.transform({
      decode: (meters) => meters / 1000,
      encode: (kilometers) => kilometers * 1000
    })
  )
)

const MilesFromKilometers = Schema.Finite.pipe(
  Schema.decode(
    Transformation.transform({
      decode: (kilometers) => kilometers * 0.621371,
      encode: (miles) => miles / 0.621371
    })
  )
)

const MilesFromMeters = KilometersFromMeters.pipe(Schema.decodeTo(MilesFromKilometers))
```

This approach does not require the source and target schemas to be type-compatible. If you need more control over type compatibility, you can use one of the `Transformation.passthrough*` helpers.

### Passthrough Helpers

The `passthrough`, `passthroughSubtype`, and `passthroughSupertype` helpers let you compose schemas by describing how their types relate.

#### passthrough

Use `passthrough` when the encoded output of the target schema matches the type of the source schema.

**Example** (When `To.Encoded === From.Type`)

```ts
import { Schema, Transformation } from "effect/schema"

const From = Schema.Struct({
  a: Schema.String
})

const To = Schema.Struct({
  a: Schema.FiniteFromString
})

// To.Encoded (string) = From.Type (string)
const schema = From.pipe(Schema.decodeTo(To, Transformation.passthrough()))
```

#### passthroughSubtype

Use `passthroughSubtype` when the source type is a subtype of the target's encoded output.

**Example** (When `From.Type` is a subtype of `To.Encoded`)

```ts
import { Schema, Transformation } from "effect/schema"

const From = Schema.FiniteFromString

const To = Schema.UndefinedOr(Schema.Number)

// From.Type (number) extends To.Encoded (number | undefined)
const schema = From.pipe(Schema.decodeTo(To, Transformation.passthroughSubtype()))
```

#### passthroughSupertype

Use `passthroughSupertype` when the target's encoded output is a subtype of the source type.

**Example** (When `To.Encoded` is a subtype of `From.Type`)

```ts
import { Schema, Transformation } from "effect/schema"

const From = Schema.UndefinedOr(Schema.String)

const To = Schema.FiniteFromString

// To.Encoded (string) extends From.Type (string | undefined)
const schema = From.pipe(Schema.decodeTo(To, Transformation.passthroughSupertype()))
```

#### Turning off strict mode

Strict mode ensures that decoding and encoding fully match. You can disable it by passing `{ strict: false }` to `passthrough`.

**Example** (Turning off strict mode)

```ts
import { Schema, Transformation } from "effect/schema"

const From = Schema.String

const To = Schema.Number

const schema = From.pipe(Schema.decodeTo(To, Transformation.passthrough({ strict: false })))
```

### Managing Optional Keys

You can control how optional values are handled during transformations using the `Transformation.transformOptional` helper.

This helper works with `Option<E>` and returns an `Option<T>`, where:

- `E` is the encoded type
- `T` is the decoded type

This function is useful when dealing with optional values that may be present or missing during decoding or encoding.

If the input is `Option.none()`, it means the value is not provided.
If it is `Option.some(value)`, then the transformation logic is applied to `value`.

You control the optionality of the output by returning an `Option`:

- `Option.none()`: exclude the key from the output
- `Option.some(transformedValue)`: include the transformed value

**Example** (Optional string key transformed to `Option<NonEmptyString>`)

```ts
import { Option } from "effect"
import { Schema, Transformation } from "effect/schema"

const OptionFromNonEmptyString = Schema.optionalKey(Schema.String).pipe(
  Schema.decodeTo(
    Schema.Option(Schema.NonEmptyString),
    Transformation.transformOptional({
      // Convert empty strings to None, and non-empty strings to Some(value)
      decode: (oe) =>
        Option.isSome(oe) && oe.value !== "" ? Option.some(Option.some(oe.value)) : Option.some(Option.none()),

      // Flatten nested Options back to a single optional string
      encode: (ot) => Option.flatten(ot)
    })
  )
)

const schema = Schema.Struct({
  foo: OptionFromNonEmptyString
})

// Decoding examples

console.log(Schema.decodeUnknownSync(schema)({}))
// Output: { foo: None }

console.log(Schema.decodeUnknownSync(schema)({ foo: "" }))
// Output: { foo: None }

console.log(Schema.decodeUnknownSync(schema)({ foo: "hi" }))
// Output: { foo: Some("hi") }

// Encoding examples

console.log(Schema.encodeSync(schema)({ foo: Option.none() }))
// Output: {}

console.log(Schema.encodeSync(schema)({ foo: Option.some("hi") }))
// Output: { foo: "hi" }
```

## Generics Improvements

Using generics in schema composition and filters can be difficult.

The plan is to make generics **covariant** and easier to use.

**Before (v3)**

```ts
declare const minLength: <S extends Schema.Any>(
  minLength: number,
  annotations?: Annotations.Filter<Schema.Type<S>>
) => <A extends string>(self: S & Schema<A, Schema.Encoded<S>, Schema.Services<S>>) => filter<S>
```

**After (v4)**

```ts
import type { Schema } from "effect/schema"

declare const minLength: <T extends string>(
  minLength: number,
  annotations?: Schema.Annotations.Annotations<T>
) => <S extends Schema.Schema<T>>(self: S) => S
```

## Middlewares

Middlewares are a new feature that allows you to modify the behavior of schemas.

They are similar to transformations, but they are able to catch errors and modify the schema contexts.

### Fallbacks

```ts
import { Effect } from "effect"
import { Formatter, Schema } from "effect/schema"

const fallback = Effect.succeedSome("b")
const schema = Schema.String.pipe(Schema.catchDecoding(() => fallback))

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)(null)
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
b
*/
```

### Providing a Service

```ts
import { ServiceMap, Effect, Option } from "effect"
import { Formatter, Schema } from "effect/schema"

class Service extends ServiceMap.Key<Service, { fallback: Effect.Effect<string> }>()("Service") {}

//      ┌─── Codec<string, string, Service, never>
//      ▼
const schema = Schema.String.pipe(
  Schema.catchDecodingWithContext(() =>
    Effect.gen(function* () {
      const service = yield* Service
      return Option.some(yield* service.fallback)
    })
  )
)

//      ┌─── Codec<string, string, never, never>
//      ▼
const provided = schema.pipe(
  Schema.decodingMiddleware((sr) =>
    Effect.isEffect(sr) ? Effect.provideService(sr, Service, { fallback: Effect.succeed("b") }) : sr
  )
)

Formatter.decodeUnknownEffect(Formatter.makeTree())(provided)(null)
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
b
*/
```

## Generating a JSON Schema from a Schema

### Basic Conversion (no annotations)

By default, a plain schema (with no extra annotations) will yield the minimal valid JSON Schema for that shape. For example:

```ts
import { Schema, ToJsonSchema } from "effect/schema"

const schema = Schema.Tuple([Schema.String, Schema.Number])

const jsonSchema = ToJsonSchema.makeDraft07(schema)

console.log(JSON.stringify(jsonSchema, null, 2))
/*
Output:
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "array",
  "items": [
    {
      "type": "string"
    },
    {
      "type": "number"
    }
  ],
  "additionalItems": false
}
*/
```

Similarly, for Draft 2020-12:

```ts
import { Schema, ToJsonSchema } from "effect/schema"

const schema = Schema.Tuple([Schema.String, Schema.Number])

const jsonSchema = ToJsonSchema.makeDraft2020(schema)

console.log(JSON.stringify(jsonSchema, null, 2))
/*
Output:
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "prefixItems": [
    {
      "type": "string"
    },
    {
      "type": "number"
    }
  ],
  "items": false
}
*/
```

No errors are thrown as long as your schema is not a “Declaration” (e.g. `Schema.Option(Schema.String)`), `Void`, `Undefined`, `BigInt`, `Symbol`, or `UniqueSymbol` at the top level. In those cases, you'll see runtime errors like:

> `cannot generate JSON Schema for Declaration at root`

> `cannot generate JSON Schema for VoidKeyword at root`

> etc.

### Attaching Standard Metadata (`title`, `description`, `default`, `examples`)

Any schema implementing `Bottom<T>` (which includes all primitive keywords, arrays, tuples, objects, etc.) accepts the `.annotate(...)` method, where you may pass standard “documentation” or “metadata” fields:

```ts
import { Schema, ToJsonSchema } from "effect/schema"

const schema = Schema.NonEmptyString.annotate({
  title: "Username",
  description: "A non-empty user name string",
  default: "anonymous",
  examples: ["alice", "bob"]
})

const jsonSchema = ToJsonSchema.makeDraft07(schema)

console.log(JSON.stringify(jsonSchema, null, 2))
/*
Output:
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "string",
  "title": "Username",
  "description": "A non-empty user name string",
  "default": "anonymous",
  "examples": [
    "alice",
    "bob"
  ],
  "minLength": 1
}
*/
```

### Overriding the Generated JSON Schema

Sometimes you want to tamper with the default JSON Schema that Effect would generate. For that, use the special `jsonSchema: { _tag: "override"; override: () => JsonSchema }` in your annotation. In other words:

```ts
import { Check, Schema, ToJsonSchema } from "effect/schema"

const schema = Schema.Number.check(Check.greaterThan(0)).annotate({
  jsonSchema: {
    _tag: "override",
    override: () => {
      return { type: "integer" }
    }
  }
})

const jsonSchema = ToJsonSchema.makeDraft07(schema)

console.log(JSON.stringify(jsonSchema, null, 2))
/*
Output:
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "integer"
}
*/
```

### Embedding Schema-Level Fragments via `check` Annotations

Whenever you call `.check(...)` on a schema, Effect attaches a filter which may carry a `"jsonSchema"` annotation that represents a JSON Schema fragment that will be merged into the final JSON Schema.

#### Single-fragment filters (e.g. `minLength`, `maxLength`, `exclusiveMinimum`, etc.)

Effect's built-in checks already carry a `jsonSchema` fragment. For example:

```ts
import { Check, Schema, ToJsonSchema } from "effect/schema"

const schema = Schema.String.check(Check.minLength(1))

const jsonSchema = ToJsonSchema.makeDraft07(schema)

console.log(JSON.stringify(jsonSchema, null, 2))
/*
Output:
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "string",
  "title": "minLength(1)",
  "description": "a value with a length of at least 1",
  "minLength": 1
}
*/
```

Because no “outer” annotate() was used, and this is the first filter, we merge the fragment's keywords into the top‐level schema.

If you stack two filters:

```ts
import { Check, Schema, ToJsonSchema } from "effect/schema"

const schema = Schema.String.check(Check.minLength(1), Check.maxLength(2))

const jsonSchema = ToJsonSchema.makeDraft07(schema)

console.log(JSON.stringify(jsonSchema, null, 2))
/*
Output:
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "string",
  "allOf": [
    {
      "title": "maxLength(2)",
      "description": "a value with a length of at most 2",
      "maxLength": 2
    }
  ],
  "title": "minLength(1)",
  "description": "a value with a length of at least 1",
  "minLength": 1
}
*/
```

- the FIRST filter (minLength) is inlined at top level
- the SECOND filter (maxLength) is wrapped in an `allOf` array

In other words:

- The **first** fragment (if any) is merged directly into the parent schema.
- Any **subsequent** fragments are wrapped under `"allOf": [ { /* fragment */ }, … ]`.
- If you later call `.annotate(...)` on top of these checks, your `title/description/default/examples` appear alongside (or above) these filter fragments but never conflict.

#### Declaring your own single-fragment filter

You can build a custom filter and attach a JSON fragment yourself:

```ts
import { Check, Schema, ToJsonSchema } from "effect/schema"

const schema = Schema.String.check(
  Check.make((s) => /foo/.test(s), {
    description: "must contain 'foo'",
    jsonSchema: {
      _tag: "fragment",
      fragment: () => ({
        pattern: "foo", // any valid JSON‐Schema string keyword
        minLength: 3
      })
    },
    meta: { _tag: "containsFoo" }
  })
)

const jsonSchema = ToJsonSchema.makeDraft07(schema)

console.log(JSON.stringify(jsonSchema, null, 2))
/*
Output:
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "string",
  "description": "must contain 'foo'",
  "pattern": "foo",
  "minLength": 3
}
*/
```

The resulting JSON Schema merges `pattern: "foo"` at top level, along with the human‐readable `title` and `description` from your filter.

## Generating an Arbitrary from a Schema

At its simplest, you can go from any non-declaration, non-`never` schema to a Fast-Check `Arbitrary<T>` with:

```ts
import { Schema, ToArbitrary } from "effect/schema"

const arbString = ToArbitrary.make(Schema.String)
// arbString is FastCheck.Arbitrary<string>

const arbTuple = ToArbitrary.make(Schema.Tuple([Schema.String, Schema.Number]))
// arbTuple is FastCheck.Arbitrary<readonly [string, number]>
```

If you need lazy/recursive support, use `makeLazy`:

```ts
const lazyArb = ToArbitrary.makeLazy(Schema.String)
// lazyArb: (fc, ctx) => Arbitrary<string>
const arb = lazyArb(FastCheck, {}) // same as make(...)
```

Under the hood, the library walks your schema's AST and, for each node:

- Emits constants (`null`, `undefined`)
- Maps keywords `fc.boolean()` / `fc.integer()` / `fc.string()` / `fc.bigInt()`
- Tuples `fc.tuple(...)` + optional/rest handling
- Records/structs `fc.record(...)` plus index‐signature expansion
- Unions `fc.oneof(...)`
- Template literals `fc.stringMatching(...)`
- Recursion (`Schema.suspend`) depth-limited `fc.oneof`

It also **collects any `.check(...)` filters** and applies them as `.filter(...)` calls on the generated arbitrary.

### Applying Constraint Filters

Whenever you write

```ts
Schema.String.check(Check.minLength(3), Check.regex(/^[A-Z]/))
```

each `Check` carries an `annotations.arbitrary` fragment like

```json
{
  "_tag": "fragment",
  "fragment": {
    "_tag": "string",
    "minLength": 3
  }
}
```

or multiple fragments under a `"fragments"` annotation. Internally all filter fragments for the same schema node are **merged** into a single `Context.

**Example**

```ts
const s = Schema.String.pipe(Schema.check(Check.minLength(2), Check.maxLength(4)))
const arb = ToArbitrary.make(s)
// arb will only generate strings of length 2–4
```

### Customizing Generation via Annotations

Sometimes you need full control:

#### Overrides

Any schema supporting `Bottom<T>` (primitives, arrays, tuples, objects, etc.) can carry:

```ts
.annotate({
  arbitrary: {
    _tag: "override",
    override: (fc, ctx) => {
      // return any FastCheck.Arbitrary<T>
      return fc.constant("always this")
    }
  }
})
```

This replaces the entire default generation for that node:

```ts
const s = Schema.Number.annotate({
  arbitrary: {
    _tag: "override",
    override: (fc) => fc.integer({ min: 10, max: 20 })
  }
})
const arb = ToArbitrary.make(s)
// arb only ever produces integers between 10 and 20
```

#### Declarations

Some schemas in Effect, like `Schema.Option<T>`, `Schema.Map<K, V>` or any `Schema.Class`, are modeled as **declarations** and carry one or more **type parameters**. To override their default arbitrary, you attach an `arbitrary` annotation of **type** `"declaration"`, whose `declaration` function receives the **inner** arbitraries corresponding to each type parameter.

```ts
{
  arbitrary: {
    _tag: "declaration"
    declaration: (innerArbs: FastCheck.Arbitrary<any>[]) => (fc: typeof FastCheck, ctx?: Context) =>
      FastCheck.Arbitrary<Schema["Type"]>
  }
}
```

## Generating an Equivalence from a Schema

**Example** (Deriving equivalence for a basic schema)

```ts
import { Schema, ToEquivalence } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number
})

const equivalence = ToEquivalence.make(schema)
```

### Declarations

**Example** (Providing a custom equivalence for a class)

```ts
import { Schema, ToEquivalence } from "effect/schema"

class MyClass {
  constructor(readonly a: string) {}
}

const schema = Schema.instanceOf({
  constructor: MyClass,
  annotations: {
    equivalence: {
      type: "declaration",
      declaration: () => (x, y) => x.a === y.a
    }
  }
})

const equivalence = ToEquivalence.make(schema)
```

### Overrides

You can override the derived equivalence for a schema using `ToEquivalence.override`. This is useful when the default derivation does not fit your requirements.

**Example** (Overriding equivalence for a struct)

```ts
import { Equivalence } from "effect"
import { Schema, ToEquivalence } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.String,
  b: Schema.Number
}).pipe(ToEquivalence.override(() => Equivalence.make((x, y) => x.a === y.a)))

const equivalence = ToEquivalence.make(schema)
```

## Formatters

The `SchemaFormatter` module provides three formatters:

- Tree: for debugging purposes.
- StandardSchemaV1: for standard schema v1 validation.
- Structured: for post-processing purposes and to make easier to define custom formatters.

### Tree formatter

The tree formatter is for **debugging** purposes. It is a simple tree-like formatter that is easy to understand and use.

```ts
import { Effect } from "effect"
import { Schema, Check, Formatter } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.String.check(Check.nonEmpty()),
  b: Schema.Number
})

Formatter.decodeUnknownEffect(Formatter.makeTree())(schema)({ a: "", b: null }, { errors: "all" })
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Output:
{ readonly "a": string; readonly "b": number }
├─ ["a"]
│  └─ string & minLength(1)
│     └─ minLength(1)
│        └─ Invalid data ""
└─ ["b"]
   └─ Expected number, actual null
*/
```

#### Generating a title

The `getTitle` annotation allows you to add dynamic context to error messages by generating titles based on the value being validated. For instance, it can include an ID from the validated object, making it easier to identify specific issues in complex or nested data structures.

**Example** (Generating a title based on the value being validated)

```ts
import { Effect, Option } from "effect"
import { Formatter, Issue, Schema } from "effect/schema"

const getOrderId = (issue: Issue.Issue) => {
  const actual = Issue.getActual(issue)
  if (Option.isSome(actual)) {
    const value = actual.value
    if (Schema.is(Schema.Struct({ id: Schema.Number }))(value)) {
      return `Order with ID ${value.id}`
    }
  }
}

const Order = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  totalPrice: Schema.Number
}).annotate({
  id: "Order",
  formatter: {
    Tree: {
      getTitle: getOrderId
    }
  }
})

Formatter.decodeUnknownEffect(Formatter.makeTree())(Order)({ id: 1 })
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
/*
Order with ID 1
└─ ["name"]
   └─ Missing key
*/
```

### StandardSchemaV1 formatter

The StandardSchemaV1 formatter is is used by `Schema.standardSchemaV1` and will return a `StandardSchemaV1.FailureResult` object:

```ts
export interface FailureResult {
  /** The issues of failed validation. */
  readonly issues: ReadonlyArray<Issue>
}

export interface Issue {
  /** The error message of the issue. */
  readonly message: string
  /** The path of the issue. */
  readonly path: ReadonlyArray<PropertyKey>
}
```

You can customize the messages of the `Issue` object in two main ways:

- By passing formatter hooks
- By annotating schemas with `message` or `missingKeyMessage` or `unexpectedKeyMessage`

#### Hooks

Formatter hooks let you define custom messages in one place and apply them across different schemas. This can help avoid repeating message definitions and makes it easier to update them later.

Hooks are **required**. There is a default implementation that can be overridden only for demo purposes. This design helps keep the bundle size smaller by avoiding unused message formatting logic.

There are two kinds of hooks:

- `LeafHook` — for issues that occur at leaf nodes in the schema.
- `CheckHook` — for custom validation checks.

`LeafHook` handles these issue types:

- `InvalidType`
- `InvalidValue`
- `MissingKey`
- `UnexpectedKey`
- `Forbidden`
- `OneOf`

`CheckHook` handles `Check` issues, such as failed filters / refinements.

**Example** (Default hooks)

Default hooks are just for demo purposes:

- LeafHook: returns the issue tag
- CheckHook: returns the meta infos of the check as a string

```ts
import { Effect } from "effect"
import { Formatter, Schema } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.NonEmptyString,
  b: Schema.NonEmptyString
})

Formatter.decodeUnknownEffect(Formatter.makeStandardSchemaV1())(schema)({ b: "" }, { errors: "all" })
  .pipe(Effect.runPromise)
  .then(console.log, (a) => console.dir(a, { depth: null }))
/*
Output:
{
  issues: [
    { path: [ 'a' ], message: 'MissingKey' },
    { path: [ 'b' ], message: 'minLength.{"minLength":1}' }
  ]
}
*/
```

#### Customizing messages

If a schema has a `message` annotation, it will take precedence over any formatter hook.

To make the examples easier to follow, we define a helper function that prints formatted validation messages using `SchemaFormatter`.

**Example utilities**

```ts
// utils.ts
import { Result } from "effect"
import { Formatter, Schema } from "effect/schema"
import i18next from "i18next"

i18next.init({
  lng: "en",
  resources: {
    en: {
      translation: {
        "string.mismatch": "Please enter a valid string",
        "string.minLength": "Please enter at least {{minLength}} character(s)",
        "struct.missingKey": "This field is required",
        "struct.mismatch": "Please enter a valid object",
        "default.mismatch": "Invalid type",
        "default.invalidValue": "Invalid value",
        "default.forbidden": "Forbidden operation",
        "default.oneOf": "Too many successful values",
        "default.check": "The value does not match the check"
      }
    }
  }
})

export const t = i18next.t

export function getLogIssues(options: {
  readonly leafHook: Formatter.LeafHook
  readonly checkHook: Formatter.CheckHook
}) {
  return <S extends Schema.Codec<unknown, unknown, never, never>>(schema: S, input: unknown) => {
    console.log(
      Schema.decodeUnknownResult(schema)(input, { errors: "all" }).pipe(
        Result.mapError((err) => Formatter.makeStandardSchemaV1(options).format(err.issue).issues),
        Result.merge
      )
    )
  }
}
```

**Example** (Using hooks to translate common messages)

```ts
import { Predicate } from "effect"
import { Schema, Check } from "effect/schema"
import { getLogIssues, t } from "./utils.js"

const Person = Schema.Struct({
  name: Schema.String.check(Check.nonEmpty())
})

// Configure hooks to customize how issues are rendered
const logIssues = getLogIssues({
  // Format leaf-level issues (missing key, wrong type, etc.)
  leafHook: (issue) => {
    switch (issue._tag) {
      case "InvalidType": {
        if (issue.ast._tag === "StringKeyword") {
          return t("string.mismatch") // Wrong type for a string
        } else if (issue.ast._tag === "TypeLiteral") {
          return t("struct.mismatch") // Value is not an object
        }
        return t("default.mismatch") // Fallback for other types
      }
      case "InvalidValue": {
        return t("default.invalidValue")
      }
      case "MissingKey":
        return t("struct.missingKey")
      case "UnexpectedKey":
        return t("struct.unexpectedKey")
      case "Forbidden":
        return t("default.forbidden")
      case "OneOf":
        return t("default.oneOf")
    }
  },
  // Format custom check errors (like minLength or user-defined validations)
  checkHook: (issue) => {
    const meta = issue.filter.annotations?.meta
    if (Predicate.isObject(meta)) {
      const id = meta.id
      if (Predicate.isString(id)) {
        if (id === "minLength") {
          const minLength = meta.minLength
          if (Predicate.isNumber(minLength)) {
            return t("string.minLength", { minLength })
          }
        }
      }
    }
    return t("default.check")
  }
})

// Invalid object (not even a struct)
logIssues(Person, null)
// [ { path: [], message: 'Please enter a valid object' } ]

// Missing "name" key
logIssues(Person, {})
// [ { path: [ 'name' ], message: 'This field is required' } ]

// "name" has the wrong type
logIssues(Person, { name: 1 })
// [ { path: [ 'name' ], message: 'Please enter a valid string' } ]

// "name" is an empty string
logIssues(Person, { name: "" })
// [ { path: [ 'name' ], message: 'Please enter at least 1 character' } ]
```

#### Inline custom messages

You can attach custom error messages directly to a schema using annotations. These messages can either be plain strings or functions that return strings. This is useful when you want to provide field-specific wording or localization without relying on formatter hooks.

**Example** (Attaching custom messages to a struct field)

```ts
import { Schema, Check } from "effect/schema"
import { getLogIssues, t } from "./utils.js"

const Person = Schema.Struct({
  name: Schema.String
    // Message for invalid type (e.g., number instead of string)
    .annotate({ message: t("string.mismatch") })
    // Message to show when the key is missing
    .pipe(Schema.annotateKey({ missingKeyMessage: t("struct.missingKey") }))
    // Message to show when the string is empty
    .check(Check.nonEmpty({ message: t("string.minLength", { minLength: 1 }) }))
})
  // Message to show when the whole object has the wrong shape
  .annotate({ message: t("struct.mismatch") })

// Dummy formatter that just returns the issue tag
const logIssues = getLogIssues({
  leafHook: (issue) => {
    return issue._tag
  },
  checkHook: (issue) => {
    return issue._tag
  }
})

// Invalid object (not even a struct)
logIssues(Person, null)
// [ { path: [], message: 'Please enter a valid object' } ]

// Missing "name" key
logIssues(Person, {})
// [ { path: [ 'name' ], message: 'This field is required' } ]

// "name" has the wrong type
logIssues(Person, { name: 1 })
// [ { path: [ 'name' ], message: 'Please enter a valid string' } ]

// "name" is an empty string
logIssues(Person, { name: "" })
// [ { path: [ 'name' ], message: 'Please enter at least 1 character(s)' } ]
```

### Structured formatter

The Structured formatter is for **post-processing** purposes.

It is a structured formatter that returns an array of issues, where each issue is an object including the following properties:

```ts
export interface StructuredIssue {
  /** The type of issue that occurs at leaf nodes in the schema. */
  readonly _tag: "InvalidType" | "InvalidValue" | "MissingKey" | "UnexpectedKey" | "Forbidden" | "OneOf"
  /** The annotations of the issue, if any. */
  readonly annotations: SchemaAnnotations.Annotations | undefined
  /** The actual value that caused the issue. */
  readonly actual: Option.Option<unknown>
  /** The path to the issue. */
  readonly path: ReadonlyArray<PropertyKey>
  /** The check that caused the issue, if any. */
  readonly check?: {
    /** The annotations of the check, if any. */
    readonly annotations: SchemaAnnotations.Filter | undefined
    /** Whether the check was aborted. */
    readonly abort: boolean
  }
}
```

**Example** (Using the Structured formatter)

```ts
import { Effect } from "effect"
import { Schema, Check, Formatter } from "effect/schema"

const schema = Schema.Struct({
  a: Schema.String.check(Check.nonEmpty()),
  b: Schema.Number
})

Formatter.decodeUnknownEffect(Formatter.makeStructured())(schema)({ a: "", b: null }, { errors: "all" })
  .pipe(Effect.runPromise)
  .then(console.log, (issue) => console.dir(issue, { depth: null }))
/*
Output:
[
  {
    check: {
      annotations: {
        title: 'minLength(1)',
        description: 'a value with a length of at least 1',
        jsonSchema: {
          _tag: 'fragments',
          fragments: { string: { minLength: 1 }, array: { minItems: 1 } }
        },
        meta: { _tag: 'minLength', minLength: 1 },
        '~structural': true,
        arbitrary: {
          _tag: 'fragments',
          fragments: {
            string: { _tag: 'string', minLength: 1 },
            array: { _tag: 'array', minLength: 1 }
          }
        }
      },
      abort: false
    },
    _tag: 'InvalidValue',
    annotations: undefined,
    actual: { value: '' },
    path: [ 'a' ]
  },
  {
    _tag: 'InvalidType',
    annotations: undefined,
    actual: { value: null },
    path: [ 'b' ]
  }
]
*/
```

## Usage

### Primitives

```ts
import { Schema } from "effect/schema"

// primitive types
Schema.String
Schema.Number
Schema.BigInt
Schema.Boolean
Schema.Symbol
Schema.Undefined
Schema.Null
```

To coerce input data to the appropriate type:

```ts
import { Schema, Getter, ToParser } from "effect/schema"

//      ┌─── Codec<string, unknown>
//      ▼
const schema = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.String, {
    decode: Getter.String(),
    encode: Getter.passthrough()
  })
)

const parser = ToParser.decodeUnknownSync(schema)

console.log(parser("tuna")) // => "tuna"
console.log(parser(42)) // => "42"
console.log(parser(true)) // => "true"
console.log(parser(null)) // => "null"
```

### Literals

Literal types:

```ts
import { Schema } from "effect/schema"

const tuna = Schema.Literal("tuna")
const twelve = Schema.Literal(12)
const twobig = Schema.Literal(2n)
const tru = Schema.Literal(true)
```

Symbol literals:

```ts
import { Schema } from "effect/schema"

const terrific = Schema.UniqueSymbol(Symbol("terrific"))
```

`null`, `undefined`, and `void`:

```ts
import { Schema } from "effect/schema"

Schema.Null
Schema.Undefined
Schema.Void
```

To allow multiple literal values:

```ts
import { Schema } from "effect/schema"

const schema = Schema.Literals(["red", "green", "blue"])
```

To extract the set of allowed values from a literal schema:

```ts
import { Schema } from "effect/schema"

const schema = Schema.Literals(["red", "green", "blue"])

// readonly ["red", "green", "blue"]
schema.literals

// readonly [Schema.Literal<"red">, Schema.Literal<"green">, Schema.Literal<"blue">]
schema.members
```

### Strings

```ts
import { Check, Schema } from "effect/schema"

Schema.String.check(Check.maxLength(5))
Schema.String.check(Check.minLength(5))
Schema.String.check(Check.length(5))
Schema.String.check(Check.regex(/^[a-z]+$/))
Schema.String.check(Check.startsWith("aaa"))
Schema.String.check(Check.endsWith("zzz"))
Schema.String.check(Check.includes("---"))
Schema.String.check(Check.uppercased)
Schema.String.check(Check.lowercased)
```

To perform some simple string transforms:

```ts
import { Schema, Transformation } from "effect/schema"

Schema.String.decode(Transformation.trim())
Schema.String.decode(Transformation.toLowerCase())
Schema.String.decode(Transformation.toUpperCase())
```

### String formats

```ts
import { Check, Schema } from "effect/schema"

Schema.String.check(Check.uuid())
Schema.String.check(Check.base64)
Schema.String.check(Check.base64url)
```

### Numbers

```ts
import { Schema } from "effect/schema"

Schema.Number // all numbers
Schema.Finite // finite numbers (i.e. not +/-Infinity or NaN)
```

number-specific validations

```ts
import { Check, Schema } from "effect/schema"

Schema.Number.check(Check.between(5, 10))
Schema.Number.check(Check.greaterThan(5))
Schema.Number.check(Check.greaterThanOrEqualTo(5))
Schema.Number.check(Check.lessThan(5))
Schema.Number.check(Check.lessThanOrEqualTo(5))
Schema.Number.check(Check.positive)
Schema.Number.check(Check.nonNegative)
Schema.Number.check(Check.negative)
Schema.Number.check(Check.nonPositive)
Schema.Number.check(Check.multipleOf(5))
```

### Integers

```ts
import { Check, Schema } from "effect/schema"

Schema.Number.check(Check.int)
Schema.Number.check(Check.int32)
```

### BigInts

```ts
import { Order } from "effect/data"
import { BigInt } from "effect/primitives"
import { Schema, Check } from "effect/schema"

const options = { order: Order.bigint }

const between = Check.deriveBetween(options)
const greaterThan = Check.deriveGreaterThan(options)
const greaterThanOrEqualTo = Check.deriveGreaterThanOrEqualTo(options)
const lessThan = Check.deriveLessThan(options)
const lessThanOrEqualTo = Check.deriveLessThanOrEqualTo(options)
const multipleOf = Check.deriveMultipleOf({
  remainder: BigInt.remainder,
  zero: 0n
})

const positive = greaterThan(0n)
const nonNegative = greaterThanOrEqualTo(0n)
const negative = lessThan(0n)
const nonPositive = lessThanOrEqualTo(0n)

Schema.BigInt.check(between(5n, 10n))
Schema.BigInt.check(greaterThan(5n))
Schema.BigInt.check(greaterThanOrEqualTo(5n))
Schema.BigInt.check(lessThan(5n))
Schema.BigInt.check(lessThanOrEqualTo(5n))
Schema.BigInt.check(multipleOf(5n))
Schema.BigInt.check(positive)
Schema.BigInt.check(nonNegative)
Schema.BigInt.check(negative)
Schema.BigInt.check(nonPositive)
```

### Dates

```ts
import { Schema, Getter } from "effect"

Schema.Date

const DateFromString = Schema.Date.pipe(
  Schema.encodeTo(Schema.String, {
    decode: Getter.Date,
    encode: Getter.String
  })
)
```

### Template literals

You can use `Schema.TemplateLiteral` to define structured string patterns made of multiple parts. Each part can be a literal or a schema, and additional constraints (such as `minLength` or `maxLength`) can be applied to individual segments.

**Example** (Constraining parts of an email-like string)

```ts
import { Effect } from "effect"
import { Schema, Check, Formatter } from "effect/schema"

// Construct a template literal schema for values like `${string}@${string}`
// Apply constraints to both sides of the "@" symbol
const email = Schema.TemplateLiteral([
  // Left part: must be a non-empty string
  Schema.String.check(Check.minLength(1)),

  // Separator
  "@",

  // Right part: must be a string with a maximum length of 64
  Schema.String.check(Check.maxLength(64))
])

// The inferred type is `${string}@${string}`
export type Type = typeof email.Type

Formatter.decodeUnknownEffect(Formatter.makeTree())(email)("@b.com")
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
// Output: Expected `${string & minLength(1)}@${string & maxLength(64)}`, actual "@b.com"
```

#### Template literal parser

If you want to extract the parts of a string that match a template, you can use `Schema.TemplateLiteralParser`. This allows you to parse the input into its individual components rather than treat it as a single string.

**Example** (Parsing a template literal into components)

```ts
import { Effect } from "effect"
import { Schema, Check, Formatter } from "effect/schema"

const email = Schema.TemplateLiteralParser([
  Schema.String.check(Check.minLength(1)),
  "@",
  Schema.String.check(Check.maxLength(64))
])

// The inferred type is `readonly [string, "@", string]`
export type Type = typeof email.Type

Formatter.decodeUnknownEffect(Formatter.makeTree())(email)("a@b.com")
  .pipe(Effect.runPromise)
  .then(console.log, console.error)
// Output: [ 'a', '@', 'b.com' ]
```

## RWC References

- https://github.com/Anastasia-Labs/lucid-evolution/blob/5068114c9f8f95c6b997d0d2233a9e9543632f35/packages/experimental/src/TSchema.ts#L353

## Snippets

```ts
function memoizeIdempotent(f: (ast: AST) => AST): (ast: AST) => AST {
  const cache = new WeakMap<AST, AST>()
  return (ast) => {
    if (cache.has(ast)) {
      return cache.get(ast)!
    }
    const result = f(ast)
    cache.set(ast, result)
    cache.set(result, result)
    return result
  }
}

function memoizeInvolution(f: (ast: AST) => AST): (ast: AST) => AST {
  const cache = new WeakMap<AST, AST>()
  return (ast) => {
    if (cache.has(ast)) {
      return cache.get(ast)!
    }
    const result = f(ast)
    cache.set(ast, result)
    cache.set(result, ast)
    return result
  }
}

/**
 * Conditionally shortens a string by keeping a configurable number of
 * characters from the start + end and inserting a *mask* in the middle.
 *
 * @param s the original string
 * @param keep total number of original characters to keep (split across the start and end). 0 means "always return the ellipsis".
 * @param ellipsis what to insert when the string is longer than `keep + ellipsis.length` (default: `"..."`)
 *
 * @internal
 */
export function truncateMiddle(s: string, keep: number, ellipsis: string = "..."): string {
  if (keep <= 0) return ellipsis // nothing to keep
  if (s.length <= keep + ellipsis.length) return s // no need to shorten
  if (keep === 1) return s[0] + ellipsis // degenerate split

  const head = Math.ceil(keep / 2)
  const tail = keep - head

  return s.slice(0, head) + ellipsis + s.slice(-tail)
}

/** @internal */
export function toDotPath(path: ReadonlyArray<PropertyKey>): string {
  const parts: Array<string> = []
  for (const seg of path) {
    if (typeof seg === "number") parts.push(`[${seg}]`)
    else if (typeof seg === "symbol") parts.push(`[${String(seg)}]`)
    else if (/[^\w$]/.test(seg)) parts.push(`[${JSON.stringify(seg)}]`)
    else {
      if (parts.length) parts.push(".")
      parts.push(seg)
    }
  }

  return parts.join("")
}
```
