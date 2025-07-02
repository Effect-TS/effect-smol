import { it } from "@effect/vitest"
import { Effect } from "effect"
import { describe, expect } from "vitest"

describe("Effect.fn", () => {
  describe("bounded without this", () => {
    it.effect("should work with 0 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x * 2
        }
      ) satisfies (x: number) => Effect.Effect<number, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe(10) // 5*2 = 10
      })
    })

    it.effect("should work with 1 pipe function", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x * 2
        },
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("10") // 5*2 = 10
      })
    })

    it.effect("should work with 2 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x * 2
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("11") // (5*2)+1 = 11
      })
    })

    it.effect("should work with 3 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x * 2
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 3),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("33") // ((5*2)+1)*3 = 33
      })
    })

    it.effect("should work with 4 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x * 2
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 3),
        Effect.map((n) => n - 2),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("31") // ((5*2)+1)*3-2 = 31
      })
    })

    it.effect("should work with 5 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("5") // 0 + 5 ones = 5
      })
    })

    it.effect("should work with 6 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 2),
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 2),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(1)
        expect(result).toBe("11") // (((1+1)*2+1)*2)+1 = 11
      })
    })

    it.effect("should work with 7 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("6") // 0 + 6 ones = 6
      })
    })

    it.effect("should work with 8 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("7") // 0 + 7 ones = 7
      })
    })

    it.effect("should work with 9 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("8") // 0 + 8 ones = 8
      })
    })

    it.effect("should work with 10 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(1)
        // 1 -> 2 -> 4 -> 5 -> 10 -> 11 -> 22 -> 23 -> 46 -> 47 -> "47"
        expect(result).toBe("47")
      })
    })

    it.effect("should work with 11 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("11") // 0 + 10 +1 ops + toString = "11"
      })
    })

    it.effect("should work with 12 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("12") // 0 + 12 +1 ops + toString = "12"
      })
    })

    it.effect("should work with 13 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("13") // 0 + 13 +1 ops + toString = "13"
      })
    })

    it.effect("should work with 14 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("14") // 0 + 14 +1 ops + toString = "14"
      })
    })

    it.effect("should work with 15 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("15") // 0 + 15 +1 ops + toString = "15"
      })
    })

    it.effect("should work with 16 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("15") // 0 + 15 +1 ops + toString = "15"
      })
    })

    it.effect("should work with 17 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("16") // 0 + 16 +1 ops + toString = "16"
      })
    })

    it.effect("should work with 18 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("17") // 0 + 17 +1 ops + toString = "17"
      })
    })

    it.effect("should work with 19 pipe functions", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("18") // 0 + 18 +1 ops + toString = "18"
      })
    })

    it.effect("should work with 20 pipe functions (maximum)", () => {
      const fn = Effect.fn(
        function*(x: number) {
          return x
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        // 0 + 19 +1 ops + toString = "19"
        expect(result).toBe("19")
      })
    })
  })

  describe("bounded with this", () => {
    it.effect("should work with 0 pipe functions", () => {
      const context = { multiplier: 10 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x * this.multiplier
        }
      ) satisfies (x: number) => Effect.Effect<number, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(3)
        expect(result).toBe(30) // 3 * 10 = 30
      })
    })

    it.effect("should work with 1 pipe function", () => {
      const context = { multiplier: 5 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x * this.multiplier
        },
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(4)
        expect(result).toBe("20") // 4 * 5 = 20
      })
    })

    it.effect("should work with 2 pipe functions", () => {
      const context = { base: 100 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x + this.base
        },
        Effect.map((n) => n * 2),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("210") // (5 + 100) * 2 = 210
      })
    })

    it.effect("should work with 3 pipe functions", () => {
      const context = { factor: 3 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x * this.factor
        },
        Effect.map((n) => n + 10),
        Effect.map((n) => n / 2),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(4)
        expect(result).toBe("11") // ((4 * 3) + 10) / 2 = 11
      })
    })

    it.effect("should work with 4 pipe functions", () => {
      const context = { offset: 20 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x + this.offset
        },
        Effect.map((n) => n * 2),
        Effect.map((n) => n - 5),
        Effect.map((n) => Math.floor(n / 3)),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(10)
        expect(result).toBe("18") // ((10 + 20) * 2 - 5) / 3 = 55/3 -> floor(18.33) = 18 + toString = "18"
      })
    })

    it.effect("should work with 5 pipe functions", () => {
      const context = { increment: 1 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x + this.increment
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("5") // (0 + 1) + 1 + 1 + 1 + 1 = 5
      })
    })

    it.effect("should work with 6 pipe functions", () => {
      const context = { value: 2 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x * this.value
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(3)
        expect(result).toBe("11") // (3 * 2) + 5 ones = 11
      })
    })

    it.effect("should work with 7 pipe functions", () => {
      const context = { divisor: 2 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x / this.divisor
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(10)
        expect(result).toBe("11") // (10 / 2) + 6 ones = 11
      })
    })

    it.effect("should work with 8 pipe functions", () => {
      const context = { start: 0 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x + this.start
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        expect(result).toBe("9") // (2 + 0) + 7 ones = 9
      })
    })

    it.effect("should work with 9 pipe functions", () => {
      const context = { power: 2 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return Math.pow(x, this.power)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(3)
        expect(result).toBe("17") // (3^2) + 8 ones = 17
      })
    })

    it.effect("should work with 10 pipe functions", () => {
      const context = { multiplier: 2, addend: 5 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x * this.multiplier + this.addend
        },
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(3)
        // 3 * 2 + 5 = 11 -> 12 -> 24 -> 25 -> 50 -> 51 -> 102 -> 103 -> 206 -> 207 -> "207"
        expect(result).toBe("207")
      })
    })

    it.effect("should work with 11 pipe functions", () => {
      const context = { offset: 10 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x + this.offset
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("25") // (5 + 10) + 10 ones = 25
      })
    })

    it.effect("should work with 12 pipe functions", () => {
      const context = { factor: 3 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x * this.factor
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        expect(result).toBe("17") // (2 * 3) + 11 ones = 17
      })
    })

    it.effect("should work with 13 pipe functions", () => {
      const context = { initial: 100 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x + this.initial
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(1)
        expect(result).toBe("113") // (1 + 100) + 12 ones = 113
      })
    })

    it.effect("should work with 14 pipe functions", () => {
      const context = { multiplier: 2 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x * this.multiplier
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(7)
        expect(result).toBe("27") // (7 * 2) + 13 ones = 27
      })
    })

    it.effect("should work with 15 pipe functions", () => {
      const context = { base: 50 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x + this.base
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(8)
        expect(result).toBe("72") // (8 + 50) + 14 ones = 72
      })
    })

    it.effect("should work with 16 pipe functions", () => {
      const context = { value: 5 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x * this.value
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(3)
        expect(result).toBe("29") // (3 * 5) + 14 +1 ops + toString = "29"
      })
    })

    it.effect("should work with 17 pipe functions", () => {
      const context = { addition: 20 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x + this.addition
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(4)
        expect(result).toBe("39") // (4 + 20) + 15 +1 ops + toString = "39"
      })
    })

    it.effect("should work with 18 pipe functions", () => {
      const context = { scale: 2 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x * this.scale
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(6)
        expect(result).toBe("28") // (6 * 2) + 16 +1 ops + toString = "28"
      })
    })

    it.effect("should work with 19 pipe functions", () => {
      const context = { prefix: 10 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x + this.prefix
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        expect(result).toBe("30") // (2 + 10) + 18 ones = 30
      })
    })

    it.effect("should work with 20 pipe functions (maximum)", () => {
      const context = { base: 100 }

      const fn = Effect.fn(
        { this: context },
        function*(x: number) {
          return x + this.base
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        // 5 + 100 = 105, then +19 ones = 124, toString = "124"
        expect(result).toBe("124")
      })
    })
  })

  describe("unbounded with this", () => {
    it.effect("should work with 0 pipe functions", () => {
      const context = { multiplier: 10 }

      const fn = Effect.fn(
        function*(this: { multiplier: number }, x: number) {
          return x * this.multiplier
        }
      ) satisfies (x: number) => Effect.Effect<number, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(3)
        expect(result).toBe(30) // 3 * 10 = 30
      })
    })

    it.effect("should work with 1 pipe function", () => {
      const context = { multiplier: 5 }

      const fn = Effect.fn(
        function*(this: { multiplier: number }, x: number) {
          return x * this.multiplier
        },
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(4)
        expect(result).toBe("20") // 4 * 5 + toString = "20"
      })
    })

    it.effect("should work with 2 pipe functions", () => {
      const context = { base: 100 }

      const fn = Effect.fn(
        function*(this: { base: number }, x: number) {
          return x + this.base
        },
        Effect.map((n) => n * 2),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(5)
        expect(result).toBe("210") // (5 + 100) * 2 + toString = "210"
      })
    })

    it.effect("should work with 3 pipe functions", () => {
      const context = { factor: 3 }

      const fn = Effect.fn(
        function*(this: { factor: number }, x: number) {
          return x * this.factor
        },
        Effect.map((n) => n + 10),
        Effect.map((n) => n / 2),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(4)
        expect(result).toBe("11") // ((4 * 3) + 10) / 2 + toString = "11"
      })
    })

    it.effect("should work with 4 pipe functions", () => {
      const context = { offset: 20 }

      const fn = Effect.fn(
        function*(this: { offset: number }, x: number) {
          return x + this.offset
        },
        Effect.map((n) => n * 2),
        Effect.map((n) => n - 5),
        Effect.map((n) => Math.floor(n / 3)),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(10)
        expect(result).toBe("18") // ((10 + 20) * 2 - 5) / 3 -> floor(18.33) = 18 + toString = "18"
      })
    })

    it.effect("should work with 5 pipe functions", () => {
      const context = { increment: 1 }

      const fn = Effect.fn(
        function*(this: { increment: number }, x: number) {
          return x + this.increment
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(0)
        expect(result).toBe("5") // (0 + 1) + 4 +1 ops + toString = "5"
      })
    })

    it.effect("should work with 6 pipe functions", () => {
      const context = { value: 2 }

      const fn = Effect.fn(
        function*(this: { value: number }, x: number) {
          return x * this.value
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(3)
        expect(result).toBe("11") // (3 * 2) + 5 +1 ops + toString = "11"
      })
    })

    it.effect("should work with 7 pipe functions", () => {
      const context = { divisor: 2 }

      const fn = Effect.fn(
        function*(this: { divisor: number }, x: number) {
          return x / this.divisor
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(10)
        expect(result).toBe("11") // (10 / 2) + 6 +1 ops + toString = "11"
      })
    })

    it.effect("should work with 8 pipe functions", () => {
      const context = { start: 0 }

      const fn = Effect.fn(
        function*(this: { start: number }, x: number) {
          return x + this.start
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(2)
        expect(result).toBe("9") // (2 + 0) + 7 +1 ops + toString = "9"
      })
    })

    it.effect("should work with 9 pipe functions", () => {
      const context = { power: 2 }

      const fn = Effect.fn(
        function*(this: { power: number }, x: number) {
          return Math.pow(x, this.power)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(3)
        expect(result).toBe("17") // (3^2) + 8 +1 ops + toString = "17"
      })
    })

    it.effect("should work with 10 pipe functions", () => {
      const context = { multiplier: 2, addend: 5 }

      const fn = Effect.fn(
        function*(this: { multiplier: number; addend: number }, x: number) {
          return x * this.multiplier + this.addend
        },
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(3)
        expect(result).toBe("207") // 3 * 2 + 5 = 11 -> 12 -> 24 -> 25 -> 50 -> 51 -> 102 -> 103 -> 206 -> 207 + toString = "207"
      })
    })

    it.effect("should work with 11 pipe functions", () => {
      const context = { offset: 10 }

      const fn = Effect.fn(
        function*(this: { offset: number }, x: number) {
          return x + this.offset
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(5)
        expect(result).toBe("25") // (5 + 10) + 10 +1 ops + toString = "25"
      })
    })

    it.effect("should work with 12 pipe functions", () => {
      const context = { factor: 3 }

      const fn = Effect.fn(
        function*(this: { factor: number }, x: number) {
          return x * this.factor
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(2)
        expect(result).toBe("17") // (2 * 3) + 11 +1 ops + toString = "17"
      })
    })

    it.effect("should work with 13 pipe functions", () => {
      const context = { initial: 100 }

      const fn = Effect.fn(
        function*(this: { initial: number }, x: number) {
          return x + this.initial
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(1)
        expect(result).toBe("113") // (1 + 100) + 12 +1 ops + toString = "113"
      })
    })

    it.effect("should work with 14 pipe functions", () => {
      const context = { multiplier: 2 }

      const fn = Effect.fn(
        function*(this: { multiplier: number }, x: number) {
          return x * this.multiplier
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(7)
        expect(result).toBe("27") // (7 * 2) + 13 +1 ops + toString = "27"
      })
    })

    it.effect("should work with 15 pipe functions", () => {
      const context = { base: 50 }

      const fn = Effect.fn(
        function*(this: { base: number }, x: number) {
          return x + this.base
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(8)
        expect(result).toBe("72") // (8 + 50) + 14 +1 ops + toString = "72"
      })
    })

    it.effect("should work with 16 pipe functions", () => {
      const context = { value: 5 }

      const fn = Effect.fn(
        function*(this: { value: number }, x: number) {
          return x * this.value
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(3)
        expect(result).toBe("30") // (3 * 5) + 15 +1 ops + toString = "30"
      })
    })

    it.effect("should work with 17 pipe functions", () => {
      const context = { addition: 20 }

      const fn = Effect.fn(
        function*(this: { addition: number }, x: number) {
          return x + this.addition
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(4)
        expect(result).toBe("40") // (4 + 20) + 16 +1 ops + toString = "40"
      })
    })

    it.effect("should work with 18 pipe functions", () => {
      const context = { scale: 2 }

      const fn = Effect.fn(
        function*(this: { scale: number }, x: number) {
          return x * this.scale
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(6)
        expect(result).toBe("29") // (6 * 2) + 17 +1 ops + toString = "29"
      })
    })

    it.effect("should work with 19 pipe functions", () => {
      const context = { prefix: 10 }

      const fn = Effect.fn(
        function*(this: { prefix: number }, x: number) {
          return x + this.prefix
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(2)
        expect(result).toBe("30") // (2 + 10) + 18 +1 ops + toString = "30"
      })
    })

    it.effect("should work with 20 pipe functions (maximum)", () => {
      const context = { base: 100 }

      const fn = Effect.fn(
        function*(this: { base: number }, x: number) {
          return x + this.base
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(5)
        expect(result).toBe("124") // (5 + 100) + 19 +1 ops + toString = "124"
      })
    })
  })

  describe("plain functions - bounded without this", () => {
    it.effect("should work with 0 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x * 2)
      ) satisfies (x: number) => Effect.Effect<number, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe(10) // 5*2 = 10
      })
    })

    it.effect("should work with 1 pipe function", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x * 2),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("10") // 5*2 = 10
      })
    })

    it.effect("should work with 2 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x * 2),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("11") // (5*2)+1 = 11
      })
    })

    it.effect("should work with 3 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x * 2),
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 3),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("33") // ((5*2)+1)*3 = 33
      })
    })

    it.effect("should work with 4 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x * 2),
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 3),
        Effect.map((n) => n - 2),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("31") // ((5*2)+1)*3-2 = 31
      })
    })

    it.effect("should work with 5 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("4") // 0 + 4 ones = 4
      })
    })

    it.effect("should work with 6 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 2),
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 2),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(1)
        expect(result).toBe("11") // (((1+1)*2+1)*2)+1 = 11
      })
    })

    it.effect("should work with 7 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("6") // 0 + 6 ones = 6
      })
    })

    it.effect("should work with 8 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("7") // 0 + 7 ones = 7
      })
    })

    it.effect("should work with 9 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("8") // 0 + 8 ones = 8
      })
    })

    it.effect("should work with 10 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(1)
        // 1 -> 2 -> 4 -> 5 -> 10 -> 11 -> 22 -> 23 -> 46 -> 47 -> "47"
        expect(result).toBe("47")
      })
    })

    it.effect("should work with 11 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("10") // 0 + 10 ones = 10
      })
    })

    it.effect("should work with 12 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("11") // 0 + 11 ones = 11
      })
    })

    it.effect("should work with 13 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("12") // 0 + 12 ones = 12
      })
    })

    it.effect("should work with 14 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("13") // 0 + 13 ones = 13
      })
    })

    it.effect("should work with 15 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("14") // 0 + 14 ones = 14
      })
    })

    it.effect("should work with 16 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("15") // 0 + 15 ones = 15
      })
    })

    it.effect("should work with 17 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("16") // 0 + 16 ones = 16
      })
    })

    it.effect("should work with 18 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("17") // 0 + 17 ones = 17
      })
    })

    it.effect("should work with 19 pipe functions", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("18") // 0 + 18 ones = 18
      })
    })

    it.effect("should work with 20 pipe functions (maximum)", () => {
      const fn = Effect.fn(
        (x: number) => Effect.succeed(x),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        // 0 + 19 ones = 19
        expect(result).toBe("19")
      })
    })
  })

  describe("plain functions - bounded with this", () => {
    it.effect("should work with 0 pipe functions", () => {
      const context = { factor: 2 }

      const fn = Effect.fn(
        { this: context },
        function(this: { factor: number }, x: number) {
          return Effect.succeed(x * this.factor)
        }
      ) satisfies (x: number) => Effect.Effect<number, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe(10) // 5*2 = 10
      })
    })

    it.effect("should work with 1 pipe function", () => {
      const context = { factor: 2 }

      const fn = Effect.fn(
        { this: context },
        function(x: number) {
          return Effect.succeed(x * this.factor)
        },
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("10") // 5*2 = 10
      })
    })

    it.effect("should work with 2 pipe functions", () => {
      const context = { factor: 3 }

      const fn = Effect.fn(
        { this: context },
        function(this: { factor: number }, x: number) {
          return Effect.succeed(x * this.factor)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(4)
        expect(result).toBe("13") // (4*3)+1 = 13
      })
    })

    it.effect("should work with 3 pipe functions", () => {
      const context = { offset: 5 }

      const fn = Effect.fn(
        { this: context },
        function(this: { offset: number }, x: number) {
          return Effect.succeed(x + this.offset)
        },
        Effect.map((n) => n * 2),
        Effect.map((n) => n - 3),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(7)
        expect(result).toBe("21") // ((7+5)*2)-3 = 21
      })
    })

    it.effect("should work with 4 pipe functions", () => {
      const context = { multiplier: 4 }

      const fn = Effect.fn(
        { this: context },
        function(this: { multiplier: number }, x: number) {
          return Effect.succeed(x * this.multiplier)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n / 2),
        Effect.map((n) => Math.floor(n)),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(3)
        expect(result).toBe("6") // floor((3*4+1)/2) = floor(13/2) = 6
      })
    })

    it.effect("should work with 5 pipe functions", () => {
      const context = { base: 10 }

      const fn = Effect.fn(
        { this: context },
        function(this: { base: number }, x: number) {
          return Effect.succeed(x + this.base)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("19") // 5+10+4 = 19
      })
    })

    it.effect("should work with 6 pipe functions", () => {
      const context = { scale: 2 }

      const fn = Effect.fn(
        { this: context },
        function(this: { scale: number }, x: number) {
          return Effect.succeed(x * this.scale)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 2),
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 2),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        expect(result).toBe("23") // (((2*2+1)*2+1)*2)+1 = 23
      })
    })

    it.effect("should work with 7 pipe functions", () => {
      const context = { increment: 1 }

      const fn = Effect.fn(
        { this: context },
        function(this: { increment: number }, x: number) {
          return Effect.succeed(x + this.increment)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("7") // 0+1+6 = 7
      })
    })

    it.effect("should work with 8 pipe functions", () => {
      const context = { value: 3 }

      const fn = Effect.fn(
        { this: context },
        function(this: { value: number }, x: number) {
          return Effect.succeed(x * this.value)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        expect(result).toBe("13") // 2*3+7 = 13
      })
    })

    it.effect("should work with 9 pipe functions", () => {
      const context = { factor: 1 }

      const fn = Effect.fn(
        { this: context },
        function(this: { factor: number }, x: number) {
          return Effect.succeed(x + this.factor)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("9") // 0+1+8 = 9
      })
    })

    it.effect("should work with 10 pipe functions", () => {
      const context = { multiplier: 2 }

      const fn = Effect.fn(
        { this: context },
        function(this: { multiplier: number }, x: number) {
          return Effect.succeed(x * this.multiplier)
        },
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(1)
        // 1*2 = 2 -> 3 -> 6 -> 7 -> 14 -> 15 -> 30 -> 31 -> 62 -> 63 -> "63"
        expect(result).toBe("63")
      })
    })

    it.effect("should work with 11 pipe functions", () => {
      const context = { start: 0 }

      const fn = Effect.fn(
        { this: context },
        function(this: { start: number }, x: number) {
          return Effect.succeed(x + this.start)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(5)
        expect(result).toBe("15") // 5+0+10 = 15
      })
    })

    it.effect("should work with 12 pipe functions", () => {
      const context = { offset: 1 }

      const fn = Effect.fn(
        { this: context },
        function(this: { offset: number }, x: number) {
          return Effect.succeed(x + this.offset)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(1)
        expect(result).toBe("13") // 1+1+11 = 13
      })
    })

    it.effect("should work with 13 pipe functions", () => {
      const context = { base: 2 }

      const fn = Effect.fn(
        { this: context },
        function(this: { base: number }, x: number) {
          return Effect.succeed(x + this.base)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(0)
        expect(result).toBe("14") // 0+2+12 = 14
      })
    })

    it.effect("should work with 14 pipe functions", () => {
      const context = { multiplier: 1 }

      const fn = Effect.fn(
        { this: context },
        function(this: { multiplier: number }, x: number) {
          return Effect.succeed(x * this.multiplier)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        expect(result).toBe("15") // 2*1+13 = 15
      })
    })

    it.effect("should work with 15 pipe functions", () => {
      const context = { value: 0 }

      const fn = Effect.fn(
        { this: context },
        function(this: { value: number }, x: number) {
          return Effect.succeed(x + this.value)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        expect(result).toBe("16") // 2+0+14 = 16
      })
    })

    it.effect("should work with 16 pipe functions", () => {
      const context = { factor: 1 }

      const fn = Effect.fn(
        { this: context },
        function(this: { factor: number }, x: number) {
          return Effect.succeed(x * this.factor)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        expect(result).toBe("17") // 2*1+15 = 17
      })
    })

    it.effect("should work with 17 pipe functions", () => {
      const context = { increment: 0 }

      const fn = Effect.fn(
        { this: context },
        function(this: { increment: number }, x: number) {
          return Effect.succeed(x + this.increment)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        expect(result).toBe("18") // 2+0+16 = 18
      })
    })

    it.effect("should work with 18 pipe functions", () => {
      const context = { multiplier: 1 }

      const fn = Effect.fn(
        { this: context },
        function(this: { multiplier: number }, x: number) {
          return Effect.succeed(x * this.multiplier)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        expect(result).toBe("19") // 2*1+17 = 19
      })
    })

    it.effect("should work with 19 pipe functions", () => {
      const context = { base: 0 }

      const fn = Effect.fn(
        { this: context },
        function(this: { base: number }, x: number) {
          return Effect.succeed(x + this.base)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        expect(result).toBe("20") // 2+0+18 = 20
      })
    })

    it.effect("should work with 20 pipe functions (maximum)", () => {
      const context = { factor: 1 }

      const fn = Effect.fn(
        { this: context },
        function(this: { factor: number }, x: number) {
          return Effect.succeed(x * this.factor)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies (x: number) => Effect.Effect<string, never, never>

      return Effect.gen(function*() {
        const result = yield* fn(2)
        // 2*1+19 = 21
        expect(result).toBe("21")
      })
    })
  })

  describe("plain functions - unbounded with this", () => {
    it.effect("should work with 0 pipe functions", () => {
      const context = { multiplier: 3 }

      const fn = Effect.fn(
        function(this: { multiplier: number }, x: number) {
          return Effect.succeed(x * this.multiplier)
        }
      ) satisfies {
        call: (thisArg: { multiplier: number }, x: number) => Effect.Effect<number, never, never>
        bind: (thisArg: { multiplier: number }) => (x: number) => Effect.Effect<number, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 7)
        expect(result).toBe(21) // 7*3 = 21
      })
    })

    it.effect("should work with 1 pipe function", () => {
      const context = { base: 10 }

      const fn = Effect.fn(
        function(this: { base: number }, x: number) {
          return Effect.succeed(x + this.base)
        },
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { base: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { base: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 5)
        expect(result).toBe("15") // 5+10 = 15
      })
    })

    it.effect("should work with 2 pipe functions", () => {
      const context = { offset: 5 }

      const fn = Effect.fn(
        function(this: { offset: number }, x: number) {
          return Effect.succeed(x + this.offset)
        },
        Effect.map((n) => n * 2),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { offset: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { offset: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 3)
        expect(result).toBe("16") // (3+5)*2 = 16
      })
    })

    it.effect("should work with 3 pipe functions", () => {
      const context = { factor: 3 }

      const fn = Effect.fn(
        function(this: { factor: number }, x: number) {
          return Effect.succeed(x * this.factor)
        },
        Effect.map((n) => n + 2),
        Effect.map((n) => n / 2),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { factor: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { factor: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 4)
        expect(result).toBe("7") // ((4*3)+2)/2 = 7
      })
    })

    it.effect("should work with 4 pipe functions", () => {
      const context = { multiplier: 2 }

      const fn = Effect.fn(
        function(this: { multiplier: number }, x: number) {
          return Effect.succeed(x * this.multiplier)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 3),
        Effect.map((n) => n - 2),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { multiplier: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { multiplier: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 5)
        expect(result).toBe("31") // ((5*2+1)*3)-2 = 31
      })
    })

    it.effect("should work with 5 pipe functions", () => {
      const context = { value: 1 }

      const fn = Effect.fn(
        function(this: { value: number }, x: number) {
          return Effect.succeed(x + this.value)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { value: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { value: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 3)
        expect(result).toBe("8") // 3+1+4 = 8
      })
    })

    it.effect("should work with 6 pipe functions", () => {
      const context = { scale: 2 }

      const fn = Effect.fn(
        function(this: { scale: number }, x: number) {
          return Effect.succeed(x * this.scale)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 2),
        Effect.map((n) => n + 1),
        Effect.map((n) => n * 2),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { scale: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { scale: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 1)
        expect(result).toBe("15") // 1*2=2 -> +1=3 -> *2=6 -> +1=7 -> *2=14 -> +1=15
      })
    })

    it.effect("should work with 7 pipe functions", () => {
      const context = { add: 0 }

      const fn = Effect.fn(
        function(this: { add: number }, x: number) {
          return Effect.succeed(x + this.add)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { add: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { add: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 2)
        expect(result).toBe("8") // 2+0+6 = 8
      })
    })

    it.effect("should work with 8 pipe functions", () => {
      const context = { factor: 1 }

      const fn = Effect.fn(
        function(this: { factor: number }, x: number) {
          return Effect.succeed(x * this.factor)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { factor: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { factor: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 3)
        expect(result).toBe("10") // 3*1+7 = 10
      })
    })

    it.effect("should work with 9 pipe functions", () => {
      const context = { base: 2 }

      const fn = Effect.fn(
        function(this: { base: number }, x: number) {
          return Effect.succeed(x + this.base)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { base: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { base: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 1)
        expect(result).toBe("11") // 1+2+8 = 11
      })
    })

    it.effect("should work with 10 pipe functions", () => {
      const context = { multiplier: 2 }

      const fn = Effect.fn(
        function(this: { multiplier: number }, x: number) {
          return Effect.succeed(x * this.multiplier)
        },
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n * 2), // *2
        Effect.map((n) => n + 1), // +1
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { multiplier: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { multiplier: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 1)
        // 1*2 = 2 -> 3 -> 6 -> 7 -> 14 -> 15 -> 30 -> 31 -> 62 -> 63 -> "63"
        expect(result).toBe("63")
      })
    })

    it.effect("should work with 11 pipe functions", () => {
      const context = { offset: 0 }

      const fn = Effect.fn(
        function(this: { offset: number }, x: number) {
          return Effect.succeed(x + this.offset)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { offset: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { offset: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 2)
        expect(result).toBe("12") // 2+0+10 = 12
      })
    })

    it.effect("should work with 12 pipe functions", () => {
      const context = { factor: 1 }

      const fn = Effect.fn(
        function(this: { factor: number }, x: number) {
          return Effect.succeed(x * this.factor)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { factor: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { factor: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 2)
        expect(result).toBe("13") // 2*1+11 = 13
      })
    })

    it.effect("should work with 13 pipe functions", () => {
      const context = { value: 1 }

      const fn = Effect.fn(
        function(this: { value: number }, x: number) {
          return Effect.succeed(x + this.value)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { value: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { value: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 1)
        expect(result).toBe("14") // 1+1+12 = 14
      })
    })

    it.effect("should work with 14 pipe functions", () => {
      const context = { scale: 1 }

      const fn = Effect.fn(
        function(this: { scale: number }, x: number) {
          return Effect.succeed(x * this.scale)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { scale: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { scale: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 2)
        expect(result).toBe("15") // 2*1+13 = 15
      })
    })

    it.effect("should work with 15 pipe functions", () => {
      const context = { increment: 0 }

      const fn = Effect.fn(
        function(this: { increment: number }, x: number) {
          return Effect.succeed(x + this.increment)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { increment: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { increment: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 2)
        expect(result).toBe("16") // 2+0+14 = 16
      })
    })

    it.effect("should work with 16 pipe functions", () => {
      const context = { multiplier: 1 }

      const fn = Effect.fn(
        function(this: { multiplier: number }, x: number) {
          return Effect.succeed(x * this.multiplier)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { multiplier: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { multiplier: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 2)
        expect(result).toBe("17") // 2*1+15 = 17
      })
    })

    it.effect("should work with 17 pipe functions", () => {
      const context = { base: 0 }

      const fn = Effect.fn(
        function(this: { base: number }, x: number) {
          return Effect.succeed(x + this.base)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { base: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { base: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 2)
        expect(result).toBe("18") // 2+0+16 = 18
      })
    })

    it.effect("should work with 18 pipe functions", () => {
      const context = { factor: 1 }

      const fn = Effect.fn(
        function(this: { factor: number }, x: number) {
          return Effect.succeed(x * this.factor)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { factor: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { factor: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 2)
        expect(result).toBe("19") // 2*1+17 = 19
      })
    })

    it.effect("should work with 19 pipe functions", () => {
      const context = { value: 0 }

      const fn = Effect.fn(
        function(this: { value: number }, x: number) {
          return Effect.succeed(x + this.value)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { value: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { value: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 2)
        expect(result).toBe("20") // 2+0+18 = 20
      })
    })

    it.effect("should work with 20 pipe functions (maximum)", () => {
      const context = { multiplier: 1 }

      const fn = Effect.fn(
        function(this: { multiplier: number }, x: number) {
          return Effect.succeed(x * this.multiplier)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { multiplier: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { multiplier: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.call(context, 2)
        // 2*1+19 = 21
        expect(result).toBe("21")
      })
    })

    it.effect("should work with bind", () => {
      const context = { scale: 4 }

      const fn = Effect.fn(
        function(this: { scale: number }, x: number) {
          return Effect.succeed(x * this.scale)
        },
        Effect.map((n) => n + 1),
        Effect.map((n) => n.toString())
      ) satisfies {
        call: (thisArg: { scale: number }, x: number) => Effect.Effect<string, never, never>
        bind: (thisArg: { scale: number }) => (x: number) => Effect.Effect<string, never, never>
      }

      return Effect.gen(function*() {
        const result = yield* fn.bind(context)(6)
        expect(result).toBe("25") // (6*4)+1 = 25
      })
    })
  })

  describe("unified return types", () => {
    it.effect("should unify Effect return types with safeDivide and test behavior", () => {
      // Type-level test to ensure Fn.UnifyEffect properly unifies the return type
      const safeDivide = Effect.fn(
        (a: number, b: number) =>
          b === 0
            ? Effect.fail(new Error("Division by zero"))
            : Effect.succeed(a / b),
        Effect.map((result) => Math.round(result * 100) / 100)
      ) satisfies (a: number, b: number) => Effect.Effect<number, Error, never>

      return Effect.gen(function*() {
        // Test successful division
        const result1 = yield* safeDivide(10, 3)
        expect(result1).toBe(3.33)

        // Test exact division
        const result2 = yield* safeDivide(20, 4)
        expect(result2).toBe(5)

        // Test division by zero using match to handle the error
        const result3 = yield* Effect.match(safeDivide(10, 0), {
          onFailure: (error) => error.message,
          onSuccess: (value) => `Success: ${value}`
        })
        expect(result3).toBe("Division by zero")
      })
    })
  })
})
