import { Effect } from "effect"

//
// Generator Function
//

export const genNoThis = Effect.fn(
  {},
  function*<N extends number>(x: N) {
    yield* Effect.log(`Ok!`)
    return x
  },
  Effect.map((n) => n + 1)
)

genNoThis(100)

export const genNoThis3 = Effect.fn(
  function*<N extends number>(x: N) {
    yield* Effect.log(`Ok!`)
    return x
  },
  Effect.map((n) => n + 1)
)

const testInference = (options: {
  method: (x: number) => Effect.Effect<string>
}) => options

testInference({
  method: Effect.fn(function*(x) {
    return x
  })
})

export const genThis = Effect.fn(
  {},
  function*<N extends number>(this: { message: string }, x: N) {
    yield* Effect.log(this.message)
    return x
  },
  Effect.map((n) => n + 1)
)

genThis.bind({ message: "Ok!" })(100)

export const genBounded = Effect.fn(
  { this: { message: "Ok!" } },
  function*<N extends number>(x: N) {
    // @ts-expect-error https://github.com/microsoft/TypeScript/pull/61792
    yield* Effect.log(this.message)
    return x
  }
)

export const genBoundedOk = Effect.fn(
  { this: { message: "Ok!" } },
  function*(x: number) {
    yield* Effect.log(this.message)
    return x
  }
)

genBounded(100)

export const genPlainFn = Effect.fn(function<N extends number>(n: N) {
  return Effect.succeed(n)
})

export const genPlainFnBounded = Effect.fn(
  { this: { message: "ok" } },
  function(n: number) {
    console.log(this.message)
    return Effect.succeed(n)
  }
)

export const genPlainFnThis = Effect.fn(
  function(this: { message: string }, n: number) {
    console.log(this.message)
    return Effect.succeed(n)
  }
)
