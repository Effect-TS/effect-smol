import { Effect } from "effect"

export const aaa = Effect.fn(
  function*<N extends number>(x: N) {
    return x
  }
)

export const bbb = Effect.fn(
  { n: 100 },
  function*<N extends number>(x: N) {
    console.log(this)
    return x
  }
)

export const ccc = Effect.fn(
  function*<N extends number>(this: { n: number }, x: N) {
    return x
  }
)
