import { pipe, Tuple } from "effect"
import { describe, expect, it, when } from "tstyche"

const tuple = ["a", 2, true] as [string, number, boolean]

const optionalTuple = ["a", 2, true] as [string?, number?, boolean?]

describe("Tuple", () => {
  describe("get", () => {
    it("errors", () => {
      when(pipe).isCalledWith(tuple, expect(Tuple.get).type.not.toBeCallableWith(4))
      expect(Tuple.get).type.not.toBeCallableWith(tuple, 4)

      when(pipe).isCalledWith(optionalTuple, expect(Tuple.get).type.not.toBeCallableWith(0))
      expect(Tuple.get).type.not.toBeCallableWith(optionalTuple, 0)
    })

    it("data-first", () => {
      expect(Tuple.get(tuple, 0)).type.toBe<string>()
      expect(Tuple.get(tuple, 1)).type.toBe<number>()
      expect(Tuple.get(tuple, 2)).type.toBe<boolean>()
    })

    it("data-last", () => {
      expect(pipe(tuple, Tuple.get(0))).type.toBe<string>()
      expect(pipe(tuple, Tuple.get(1))).type.toBe<number>()
      expect(pipe(tuple, Tuple.get(2))).type.toBe<boolean>()
    })
  })

  describe("pick", () => {
    it("errors", () => {
      when(pipe).isCalledWith(tuple, expect(Tuple.pick).type.not.toBeCallableWith([4]))
      expect(Tuple.pick).type.not.toBeCallableWith(tuple, [4])
    })

    it("data-first", () => {
      expect(Tuple.pick(tuple, [0, 2])).type.toBe<[string, boolean]>()
    })

    it("data-last", () => {
      expect(pipe(tuple, Tuple.pick([0, 2]))).type.toBe<[string, boolean]>()
    })
  })

  describe("omit", () => {
    it("errors", () => {
      when(pipe).isCalledWith(tuple, expect(Tuple.omit).type.not.toBeCallableWith([4]))
      expect(Tuple.omit).type.not.toBeCallableWith(tuple, [4])
    })

    it("data-first", () => {
      expect(Tuple.omit(tuple, [1])).type.toBe<[string, boolean]>()
    })

    it("data-last", () => {
      expect(pipe(tuple, Tuple.omit([1]))).type.toBe<[string, boolean]>()
    })
  })

  it("appendElement", () => {
    expect(pipe(tuple, Tuple.appendElement("b"))).type.toBe<[string, number, boolean, "b"]>()
    expect(Tuple.appendElement(tuple, "b")).type.toBe<[string, number, boolean, "b"]>()
  })

  it("appendElements", () => {
    expect(pipe(tuple, Tuple.appendElements(["b", 2]))).type.toBe<[string, number, boolean, "b", 2]>()
    expect(Tuple.appendElements(tuple, ["b", 2])).type.toBe<[string, number, boolean, "b", 2]>()
  })

  it("evolve", () => {
    expect(pipe(tuple, Tuple.evolve([(s) => s.length]))).type.toBe<[number, number, boolean]>()
    expect(Tuple.evolve(tuple, [(s) => s.length] as const)).type.toBe<[number, number, boolean]>()

    expect(pipe(
      tuple,
      Tuple.evolve([
        (s) => s.length,
        undefined,
        (b) => `b: ${b}`
      ])
    )).type.toBe<[number, number, string]>()
    expect(Tuple.evolve(
      tuple,
      [
        (s) => s.length,
        undefined,
        (b) => `b: ${b}`
      ] as const
    )).type.toBe<[number, number, string]>()
  })
})
