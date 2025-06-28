import { Effect } from "effect"

export const aaa = Effect.fn(
  function*<N extends number>(x: N) {
    console.log("aaa", x)
    return x
  }
)

export const bbb = Effect.fn(
  { this: { n: 100 } },
  function*<N extends number>(x: N) {
    console.log("bbb", this, x)
    return x
  },
  Effect.withSpan("bbb", (x) => ({ attributes: { x } }))
)

export const ccc = Effect.fn(
  function*<N extends number>(this: { n: number }, x: N) {
    console.log("ccc", this, x)
    return x
  }
)

Effect.runPromise(aaa(10))
Effect.runPromise(bbb(10))
Effect.runPromise(ccc.apply({ n: 100 }, [10]))
