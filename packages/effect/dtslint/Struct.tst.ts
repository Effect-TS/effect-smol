import { hole, pipe, Struct } from "effect"
import { describe, expect, it, when } from "tstyche"

const aSym = Symbol.for("a")
const bSym = Symbol.for("b")
const cSym = Symbol.for("c")
const dSym = Symbol.for("d")

const stringKeys = hole<{ a: string; b: number; c: boolean }>()
const stringOptionalKeys = hole<{ a?: string; b?: number; c?: boolean }>()
const symbolKeys = { [aSym]: "a", [bSym]: 1, [cSym]: true }
const numberKeys = { 1: "a", 2: 1, 3: true }
const mixedKeys = hole<{ a: string; 1: number; [aSym]: boolean }>()
const optionalMixedKeys = hole<{ a?: string; 1?: number; [aSym]?: boolean }>()

describe("Struct", () => {
  it("Mutable", () => {
    expect<Struct.Mutable<any>>().type.toBe<{ [x: string]: any }>()
    expect<Struct.Mutable<unknown>>().type.toBe<{}>()
    expect<Struct.Mutable<never>>().type.toBe<never>()
    expect<Struct.Mutable<void>>().type.toBe<void>()
    expect<Struct.Mutable<null>>().type.toBe<null>()
    expect<Struct.Mutable<undefined>>().type.toBe<undefined>()
    expect<Struct.Mutable<string>>().type.toBe<string>()
    expect<Struct.Mutable<number>>().type.toBe<number>()
    expect<Struct.Mutable<boolean>>().type.toBe<boolean>()
    expect<Struct.Mutable<symbol>>().type.toBe<symbol>()
    expect<Struct.Mutable<bigint>>().type.toBe<bigint>()
    expect<Struct.Mutable<object>>().type.toBe<object>()
    expect<Struct.Mutable<"a">>().type.toBe<"a">()
    expect<Struct.Mutable<1>>().type.toBe<1>()
    expect<Struct.Mutable<1n>>().type.toBe<1n>()
    expect<Struct.Mutable<true>>().type.toBe<true>()
    expect<Struct.Mutable<false>>().type.toBe<false>()
    expect<Struct.Mutable<Date>>().type.toBe<Date>()
    expect<Struct.Mutable<Error>>().type.toBe<Error>()
    expect<Struct.Mutable<Array<unknown>>>().type.toBe<Array<unknown>>()
    expect<Struct.Mutable<ReadonlyArray<unknown>>>().type.toBe<Array<unknown>>()
    expect<Struct.Mutable<readonly [string, number]>>().type.toBe<[string, number]>()
    expect<Struct.Mutable<{ readonly a: string; readonly b: number }>>().type.toBe<{ a: string; b: number }>()
    expect<Struct.Mutable<{ readonly a: string } | { readonly b: number }>>().type.toBe<
      { a: string } | { b: number }
    >()
    interface Category {
      readonly name: string
      readonly subcategories: ReadonlyArray<Category>
    }
    expect<Struct.Mutable<Category>>().type.toBe<{ name: string; subcategories: ReadonlyArray<Category> }>()
  })

  describe("get", () => {
    it("required property", () => {
      expect(pipe(mixedKeys, Struct.get("a"))).type.toBe<string>()
      expect(pipe(mixedKeys, Struct.get(1))).type.toBe<number>()
      expect(pipe(mixedKeys, Struct.get(aSym))).type.toBe<boolean>()
    })

    it("optional property", () => {
      expect(pipe(optionalMixedKeys, Struct.get("a"))).type.toBe<string | undefined>()
      expect(pipe(optionalMixedKeys, Struct.get(1))).type.toBe<number | undefined>()
      expect(pipe(optionalMixedKeys, Struct.get(aSym))).type.toBe<boolean | undefined>()
    })
  })

  it("keys", () => {
    expect(Struct.keys(hole<{ a: string; b: number; [aSym]: boolean }>())).type.toBe<
      Array<"a" | "b">
    >()
    expect(pipe(hole<{ a: string; b: number; [aSym]: boolean }>(), Struct.keys)).type.toBe<
      Array<"a" | "b">
    >()
  })

  describe("pick", () => {
    it("errors when picking a non-existent key", () => {
      when(pipe).isCalledWith(mixedKeys, expect(Struct.pick).type.not.toBeCallableWith(["d"]))
      expect(Struct.pick).type.not.toBeCallableWith(mixedKeys, ["d"])

      when(pipe).isCalledWith(mixedKeys, expect(Struct.pick).type.not.toBeCallableWith([dSym]))
      expect(Struct.pick).type.not.toBeCallableWith(mixedKeys, [dSym])

      when(pipe).isCalledWith(mixedKeys, expect(Struct.pick).type.not.toBeCallableWith([4]))
      expect(Struct.pick).type.not.toBeCallableWith(mixedKeys, [4])
    })

    it("required properties", () => {
      expect(pipe(stringKeys, Struct.pick(["a", "b"]))).type.toBe<{ a: string; b: number }>()
      expect(Struct.pick(stringKeys, ["a", "b"])).type.toBe<{ a: string; b: number }>()

      expect(Struct.pick(symbolKeys, [aSym, bSym])).type.toBe<{ [aSym]: string; [bSym]: number }>()
      expect(pipe(symbolKeys, Struct.pick([aSym, bSym]))).type.toBe<{ [aSym]: string; [bSym]: number }>()

      expect(Struct.pick(numberKeys, [1, 2])).type.toBe<{ 1: string; 2: number }>()
      expect(pipe(numberKeys, Struct.pick([1, 2]))).type.toBe<{ 1: string; 2: number }>()
    })

    it("optional properties", () => {
      expect(Struct.pick(stringOptionalKeys, ["a", "b"])).type.toBe<{ a?: string; b?: number }>()
      expect(pipe(stringOptionalKeys, Struct.pick(["a", "b"]))).type.toBe<{ a?: string; b?: number }>()
    })
  })

  describe("omit", () => {
    it("errors when omitting a non-existent key", () => {
      when(pipe).isCalledWith(mixedKeys, expect(Struct.omit).type.not.toBeCallableWith(["d"]))
      expect(Struct.omit).type.not.toBeCallableWith(mixedKeys, ["d"])

      when(pipe).isCalledWith(mixedKeys, expect(Struct.omit).type.not.toBeCallableWith([dSym]))
      expect(Struct.omit).type.not.toBeCallableWith(mixedKeys, [dSym])

      when(pipe).isCalledWith(mixedKeys, expect(Struct.omit).type.not.toBeCallableWith([4]))
      expect(Struct.omit).type.not.toBeCallableWith(mixedKeys, [4])
    })

    it("required properties", () => {
      expect(pipe(stringKeys, Struct.omit(["c"]))).type.toBe<{ a: string; b: number }>()
      expect(Struct.omit(stringKeys, ["c"])).type.toBe<{ a: string; b: number }>()

      expect(Struct.omit(symbolKeys, [cSym])).type.toBe<{ [aSym]: string; [bSym]: number }>()
      expect(pipe(symbolKeys, Struct.omit([cSym]))).type.toBe<{ [aSym]: string; [bSym]: number }>()

      expect(Struct.omit(numberKeys, [3])).type.toBe<{ 1: string; 2: number }>()
      expect(pipe(numberKeys, Struct.omit([3]))).type.toBe<{ 1: string; 2: number }>()
    })

    it("optional properties", () => {
      expect(Struct.omit(stringOptionalKeys, ["c"])).type.toBe<{ a?: string; b?: number }>()
      expect(pipe(stringOptionalKeys, Struct.omit(["c"]))).type.toBe<{ a?: string; b?: number }>()
    })
  })

  describe("evolve", () => {
    it("errors when not providing a well-typed transformation function for a key", () => {
      expect(Struct.evolve).type.not.toBeCallableWith(
        { a: "a", b: 1 },
        { a: (n: number) => n }
      )
      when(pipe).isCalledWith(
        { a: "a", b: 1 },
        expect(Struct.evolve).type.not.toBeCallableWith({ a: (n: number) => n })
      )
    })

    it("partial required fields", () => {
      expect(Struct.evolve(stringKeys, {
        a: (s) => {
          expect(s).type.toBe<string>()
          return s.length
        }
      })).type.toBe<{ a: number; b: number; c: boolean }>()
      expect(pipe(
        stringKeys,
        Struct.evolve({
          a: (s) => {
            expect(s).type.toBe<string>()
            return s.length
          }
        })
      )).type.toBe<{ a: number; b: number; c: boolean }>()

      expect(Struct.evolve(symbolKeys, {
        [aSym]: (s) => {
          expect(s).type.toBe<string>()
          return s.length
        }
      })).type.toBe<{ [aSym]: number; [bSym]: number; [cSym]: boolean }>()
      expect(pipe(
        symbolKeys,
        Struct.evolve({
          [aSym]: (s) => {
            expect(s).type.toBe<string>()
            return s.length
          }
        })
      )).type.toBe<{ [aSym]: number; [bSym]: number; [cSym]: boolean }>()
    })

    it("all required fields", () => {
      expect(Struct.evolve(stringKeys, {
        a: (s) => {
          expect(s).type.toBe<string>()
          return s.length
        },
        b: (n) => {
          expect(n).type.toBe<number>()
          return n * 2
        },
        c: (b) => {
          expect(b).type.toBe<boolean>()
          return !b
        }
      })).type.toBe<{ a: number; b: number; c: boolean }>()
      expect(pipe(
        stringKeys,
        Struct.evolve({
          a: (s) => {
            expect(s).type.toBe<string>()
            return s.length
          },
          b: (n) => {
            expect(n).type.toBe<number>()
            return n * 2
          },
          c: (b) => {
            expect(b).type.toBe<boolean>()
            return !b
          }
        })
      )).type.toBe<{ a: number; b: number; c: boolean }>()

      expect(Struct.evolve(symbolKeys, {
        [aSym]: (s) => {
          expect(s).type.toBe<string>()
          return s.length
        },
        [bSym]: (n) => {
          expect(n).type.toBe<number>()
          return n * 2
        },
        [cSym]: (b) => {
          expect(b).type.toBe<boolean>()
          return !b
        }
      })).type.toBe<{ [aSym]: number; [bSym]: number; [cSym]: boolean }>()
      expect(pipe(
        symbolKeys,
        Struct.evolve({
          [aSym]: (s) => {
            expect(s).type.toBe<string>()
            return s.length
          },
          [bSym]: (n) => {
            expect(n).type.toBe<number>()
            return n * 2
          },
          [cSym]: (b) => {
            expect(b).type.toBe<boolean>()
            return !b
          }
        })
      )).type.toBe<{ [aSym]: number; [bSym]: number; [cSym]: boolean }>()
    })
  })
})
