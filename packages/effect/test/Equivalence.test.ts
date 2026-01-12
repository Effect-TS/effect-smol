import { describe, it } from "@effect/vitest"
import { assertFalse, assertTrue } from "@effect/vitest/utils"
import { Equivalence, pipe } from "effect"

describe("Equivalence", () => {
  it("mapInput", () => {
    interface Person {
      readonly name: string
      readonly age: number
    }
    const eqPerson = pipe(Equivalence.strictEqual<string>(), Equivalence.mapInput((p: Person) => p.name))
    assertTrue(eqPerson({ name: "a", age: 1 }, { name: "a", age: 2 }))
    assertTrue(eqPerson({ name: "a", age: 1 }, { name: "a", age: 1 }))
    assertFalse(eqPerson({ name: "a", age: 1 }, { name: "b", age: 1 }))
    assertFalse(eqPerson({ name: "a", age: 1 }, { name: "b", age: 2 }))
  })

  it("combine", () => {
    type T = readonly [string, number, boolean]
    const E0: Equivalence.Equivalence<T> = Equivalence.mapInput((x: T) => x[0])(Equivalence.strictEqual<string>())
    const E1: Equivalence.Equivalence<T> = Equivalence.mapInput((x: T) => x[1])(Equivalence.strictEqual<number>())
    const eqE0E1 = Equivalence.combine(E0, E1)
    assertTrue(eqE0E1(["a", 1, true], ["a", 1, true]))
    assertTrue(eqE0E1(["a", 1, true], ["a", 1, false]))
    assertFalse(eqE0E1(["a", 1, true], ["b", 1, true]))
    assertFalse(eqE0E1(["a", 1, true], ["a", 2, false]))
  })

  it("combineAll", () => {
    type T = readonly [string, number, boolean]
    const E0: Equivalence.Equivalence<T> = Equivalence.mapInput((x: T) => x[0])(Equivalence.strictEqual<string>())
    const E1: Equivalence.Equivalence<T> = Equivalence.mapInput((x: T) => x[1])(Equivalence.strictEqual<number>())
    const E2: Equivalence.Equivalence<T> = Equivalence.mapInput((x: T) => x[2])(Equivalence.strictEqual<boolean>())
    const eqE0E1E2 = Equivalence.combineAll([E0, E1, E2])
    assertTrue(eqE0E1E2(["a", 1, true], ["a", 1, true]))
    assertFalse(eqE0E1E2(["a", 1, true], ["b", 1, true]))
    assertFalse(eqE0E1E2(["a", 1, true], ["a", 2, true]))
    assertFalse(eqE0E1E2(["a", 1, true], ["a", 1, false]))
  })

  it("Tuple", () => {
    const eq = Equivalence.Tuple([Equivalence.strictEqual<string>(), Equivalence.strictEqual<number>()])

    assertTrue(eq(["a", 1], ["a", 1]))
    assertFalse(eq(["a", 1], ["c", 1]))
    assertFalse(eq(["a", 1], ["a", 2]))
  })

  it("Array", () => {
    const eq = Equivalence.Array(Equivalence.strictEqual<number>())

    assertTrue(eq([], []))
    assertTrue(eq([1, 2, 3], [1, 2, 3]))
    assertFalse(eq([1, 2, 3], [1, 2, 4]))
    assertFalse(eq([1, 2, 3], [1, 2]))
  })

  describe("Struct", () => {
    it("string keys", () => {
      const eq = Equivalence.Struct({
        a: Equivalence.strictEqual<string>(),
        b: Equivalence.strictEqual<number>()
      })

      assertTrue(eq({ a: "a", b: 1 }, { a: "a", b: 1 }))
      assertFalse(eq({ a: "a", b: 1 }, { a: "c", b: 1 }))
      assertFalse(eq({ a: "a", b: 1 }, { a: "a", b: 2 }))
    })

    it("symbol keys", () => {
      const a = Symbol.for("a")
      const b = Symbol.for("b")
      const eq = Equivalence.Struct({
        [a]: Equivalence.strictEqual<string>(),
        [b]: Equivalence.strictEqual<number>()
      })

      assertTrue(eq({ [a]: "a", [b]: 1 }, { [a]: "a", [b]: 1 }))
      assertFalse(eq({ [a]: "a", [b]: 1 }, { [a]: "c", [b]: 1 }))
      assertFalse(eq({ [a]: "a", [b]: 1 }, { [a]: "a", [b]: 2 }))
    })

    it("mixed keys", () => {
      const b = Symbol.for("b")
      const eq = Equivalence.Struct({
        a: Equivalence.strictEqual<string>(),
        [b]: Equivalence.strictEqual<number>()
      })

      assertTrue(eq({ a: "a", [b]: 1 }, { a: "a", [b]: 1 }))
      assertFalse(eq({ a: "a", [b]: 1 }, { a: "c", [b]: 1 }))
      assertFalse(eq({ a: "a", [b]: 1 }, { a: "a", [b]: 2 }))
    })
  })

  describe("Record", () => {
    it("string keys", () => {
      const eq = Equivalence.Record(Equivalence.strictEqual<number>())

      assertTrue(eq({ a: 1, b: 2 }, { a: 1, b: 2 }))
      assertFalse(eq({ a: 1, b: 2 }, { a: 1, b: 3 }))
      assertFalse(eq({ a: 1, b: 2 }, { a: 1 }))
      assertFalse(eq({ a: 1 }, { a: 1, b: 2 }))
    })

    it("symbol keys", () => {
      const a = Symbol.for("a")
      const b = Symbol.for("b")
      const eq = Equivalence.Record(Equivalence.strictEqual<number>())

      assertTrue(eq({ [a]: 1, [b]: 2 }, { [a]: 1, [b]: 2 }))
      assertFalse(eq({ [a]: 1, [b]: 2 }, { [a]: 1, [b]: 3 }))
      assertFalse(eq({ [a]: 1, [b]: 2 }, { [a]: 1 }))
      assertFalse(eq({ [a]: 1 }, { [a]: 1, [b]: 2 }))
    })

    it("mixed keys", () => {
      const b = Symbol.for("b")
      const eq = Equivalence.Record(Equivalence.strictEqual<number>())

      assertTrue(eq({ a: 1, [b]: 2 }, { a: 1, [b]: 2 }))
      assertFalse(eq({ a: 1, [b]: 2 }, { a: 1, [b]: 3 }))
      assertFalse(eq({ a: 1, [b]: 2 }, { a: 1 }))
      assertFalse(eq({ a: 1 }, { a: 1, [b]: 2 }))
    })
  })
})
