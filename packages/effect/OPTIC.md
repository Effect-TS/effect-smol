## Introduction

`effect/optic/Optic` is a module for creating and composing functional optics.

Optics are a way to access and modify parts of data structures.

## Features

- **Unified Representation of Optics**. All optics compose in the same way because they are instances of the same data type (`Optic`).
- **Integration**. `Iso` generation via `effect/schema/ToOptic`.

## Known Limitations

The `Optic` module only works with plain JavaScript objects and collections (structs, records, tuples, and arrays).

## Getting started

Suppose we have an employee object, and we want to capitalize the first character of the street name of the company address.

**Example** (Uppercasing the first character of a street name)

```ts
import { Optic } from "effect/optic"
import { String } from "effect/primitives"

// Define some nested data structures
interface Street {
  readonly num: number
  readonly name: string
}
interface Address {
  readonly city: string
  readonly street: Street
}
interface Company {
  readonly name: string
  readonly address: Address
}
interface Employee {
  readonly name: string
  readonly company: Company
}

// A sample employee object
const from: Employee = {
  name: "john",
  company: {
    name: "awesome inc",
    address: {
      city: "london",
      street: {
        num: 23,
        name: "high street"
      }
    }
  }
}

// Build an optic that drills down to the street name
const _name = Optic.id<Employee>()
  .key("company") // access "company"
  .key("address") // access "address"
  .key("street") // access "street"
  .key("name") // access "name"

// Modify the targeted value
const capitalizeName = _name.modify(String.capitalize)

console.dir(capitalizeName(from), { depth: null })
/*
{
  name: 'john',
  company: {
    name: 'awesome inc',
    address: {
      city: 'london',
      street: { num: 23, name: { value: 'High street' } }
    }
  }
}
*/
```

## Basic Usage

### Accessing a key in a struct or a tuple

**Example** (Accessing a key in a struct)

```ts
import { Optic } from "effect/optic"

type S = {
  readonly a: string
}

// Build an optic to access the "a" field
const _a = Optic.id<S>().key("a")

console.log(_a.replace("b", { a: "a" }))
// { a: 'b' }
```

**Example** (Accessing a key in a tuple)

```ts
import { Optic } from "effect/optic"

type S = readonly [string]

// Build an optic to access the first element
const _0 = Optic.id<S>().key(0)

console.log(_0.replace("b", ["a"]))
// ["b"]
```

### Accessing a key in a record or an array

**Example** (Accessing a key in a record)

```ts
import { Optic } from "effect/optic"

type S = { [key: string]: number }

// Build an optic to access the value at key "a"
const _a = Optic.id<S>().at("a")

console.log(_a.replace(2, { a: 1 }))
// { a: 2 }
```

**Example** (Accessing a key in an array)

```ts
import { Optic } from "effect/optic"

type S = ReadonlyArray<number>

// Build an optic to access the first element
const _0 = Optic.id<S>().at(0)

console.log(_0.replace(3, [1, 2]))
// [3, 2]
```

### Accessing an optional key in a struct or a tuple

There are two ways to handle an optional key in a struct or a tuple, depending on how you want to treat the `undefined` value:

1. when setting `undefined`, the key is preserved
2. when setting `undefined`, the key is removed

**Example** (Preserving the key when setting `undefined`)

```ts
import { Optic } from "effect/optic"

type S = {
  readonly a?: number | undefined
}

// Lens<S, number | undefined>
const _a = Optic.id<S>().key("a")

console.log(_a.getResult({ a: 1 }))
// { _id: 'Result', _tag: 'Success', value: 1 }

console.log(_a.getResult({}))
// { _id: 'Result', _tag: 'Success', value: undefined }

console.log(_a.getResult({ a: undefined }))
// { _id: 'Result', _tag: 'Success', value: undefined }

console.log(_a.replace(2, { a: 1 }))
// { a: 2 }

console.log(_a.replace(2, {}))
// { a: 2 }

console.log(_a.replace(undefined, { a: 1 }))
// { a: undefined }

console.log(_a.replace(undefined, {}))
// { a: undefined }

console.log(_a.replace(2, { a: undefined }))
// { a: 2 }
```

**Example** (Removing the key when setting `undefined`)

```ts
import { Optic } from "effect/optic"

type S = {
  readonly a?: number
}

// Lens<S, number | undefined>
const _a = Optic.id<S>().optionalKey("a")

console.log(_a.getResult({ a: 1 }))
// { _id: 'Result', _tag: 'Success', value: 1 }

console.log(_a.getResult({}))
// { _id: 'Result', _tag: 'Success', value: undefined }

console.log(_a.replace(2, { a: 1 }))
// { a: 2 }

console.log(_a.replace(2, {}))
// { a: 2 }

console.log(_a.replace(undefined, { a: 1 }))
// {}

console.log(_a.replace(undefined, {}))
// {}
```

**Example** (Removing the element when setting `undefined`)

```ts
import { Optic } from "effect/optic"

type S = readonly [number, number?]

// Build an optic to access the optional second element
const _1 = Optic.id<S>().optionalKey(1)

console.log(_1.get([1, 2]))
// 2

console.log(_1.get([1]))
// undefined

console.log(_1.replace(3, [1, 2]))
// [1, 3]

console.log(_1.replace(undefined, [1, 2]))
// [1]
```

### Accessing a member in a tagged union

**Aside** (Convention for tagged unions)
The convention is to use `"_tag"` as the field that identifies the variant.

**Example** (Accessing a member in a tagged union)

```ts
import { Optic } from "effect/optic"

// A union of two tagged types
type S =
  | {
      readonly _tag: "A"
      readonly a: number
    }
  | {
      readonly _tag: "B"
      readonly b: number
    }

// Build an optic that focuses on the "a" field of the "A" variant
const _a = Optic.id<S>().tag("A").key("a")

console.log(_a.replace(2, { _tag: "A", a: 1 }))
// { _tag: 'A', a: 2 }

console.log(_a.replace(2, { _tag: "B", b: 1 })) // no match, so no change
// { _tag: 'B', b: 1 }
```
