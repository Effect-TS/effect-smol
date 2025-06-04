import { Effect } from "effect"
import type { Yieldable } from "effect/Effect"
import type { YieldWrap } from "effect/Utils"

type FromGen<Ret, Eff extends YieldWrap<Yieldable<any, any, any>>> = Effect.Effect<
  Ret,
  [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
  [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
> extends infer Q ? Q : never

declare const unset: unique symbol
type unset = typeof unset

type Pipes<Args extends Array<any>, Inp, A, B, C, D, E, F, G, H, I, L> = [
  a?: (_: Inp, ...args: Args) => A,
  b?: (_: NoInfer<A>, ...args: Args) => B,
  c?: (_: NoInfer<B>, ...args: Args) => C,
  d?: (_: NoInfer<C>, ...args: Args) => D,
  e?: (_: NoInfer<D>, ...args: Args) => E,
  f?: (_: NoInfer<E>, ...args: Args) => F,
  g?: (_: NoInfer<F>, ...args: Args) => G,
  h?: (_: NoInfer<G>, ...args: Args) => H,
  i?: (_: NoInfer<H>, ...args: Args) => I,
  l?: (_: NoInfer<I>, ...args: Args) => L
]

export declare const gen: {
  (
    options: {
      this?: any
      untraced?: boolean
      constant?: boolean
      name?: string
      /** @deprecated */
      ಠ_ಠ: never
    }
  ): never
  <
    Args extends Array<any>,
    Ret,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    A = FromGen<Ret, Eff>,
    B = A,
    C = B,
    D = C,
    E = D,
    F = E,
    G = F,
    H = G,
    I = H,
    L = I
  >(
    options: {
      this?: never
      untraced?: boolean
      name?: string
      constant?: false
    },
    gen: (this: unset, ...args: Args) => Generator<Eff, Ret>,
    ...pipes: Pipes<Args, FromGen<Ret, Eff>, A, B, C, D, E, F, G, H, I, L>
  ): (...args: Args) => L
  <
    Args extends Array<any>,
    Ret,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    A = FromGen<Ret, Eff>,
    B = A,
    C = B,
    D = C,
    E = D,
    F = E,
    G = F,
    H = G,
    I = H,
    L = I
  >(
    gen: (this: unset, ...args: Args) => Generator<Eff, Ret>,
    ...pipes: Pipes<Args, FromGen<Ret, Eff>, A, B, C, D, E, F, G, H, I, L>
  ): (...args: Args) => L
  <
    Args extends Array<any>,
    Ret,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    This = unset,
    A = FromGen<Ret, Eff>,
    B = A,
    C = B,
    D = C,
    E = D,
    F = E,
    G = F,
    H = G,
    I = H,
    L = I
  >(
    options: {
      this?: never
      untraced?: boolean
      name?: string
      constant?: false
    },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    ...pipes: Pipes<Args, FromGen<Ret, Eff>, A, B, C, D, E, F, G, H, I, L>
  ): (this: This, ...args: Args) => L
  <
    Args extends Array<any>,
    Ret,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    This = unset,
    A = FromGen<Ret, Eff>,
    B = A,
    C = B,
    D = C,
    E = D,
    F = E,
    G = F,
    H = G,
    I = H,
    L = I
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    ...pipes: Pipes<Args, FromGen<Ret, Eff>, A, B, C, D, E, F, G, H, I, L>
  ): (this: This, ...args: Args) => L
  <
    Ret,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Bounded = unset,
    A = FromGen<Ret, Eff>,
    B = A,
    C = B,
    D = C,
    E = D,
    F = E,
    G = F,
    H = G,
    I = H,
    L = I
  >(
    options: {
      this: Bounded
      untraced?: boolean
      name?: string
      constant: true
    },
    gen: (this: NoInfer<Bounded>, ...args: []) => Generator<Eff, Ret>,
    ...pipes: Pipes<[], FromGen<Ret, Eff>, A, B, C, D, E, F, G, H, I, L>
  ): L
  <
    Ret,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    A = FromGen<Ret, Eff>,
    B = A,
    C = B,
    D = C,
    E = D,
    F = E,
    G = F,
    H = G,
    I = H,
    L = I
  >(
    options: {
      this?: never
      untraced?: boolean
      name?: string
      constant: true
    },
    gen: (...args: []) => Generator<Eff, Ret>,
    ...pipes: Pipes<[], FromGen<Ret, Eff>, A, B, C, D, E, F, G, H, I, L>
  ): L
  <
    Bounded,
    Args extends Array<any>,
    Ret,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    A = FromGen<Ret, Eff>,
    B = A,
    C = B,
    D = C,
    E = D,
    F = E,
    G = F,
    H = G,
    I = H,
    L = I
  >(
    options: {
      this: Bounded
      untraced?: boolean
      name?: string
      constant?: false
    },
    gen: (this: NoInfer<Bounded>, ...args: Args) => Generator<Eff, Ret>,
    ...pipes: Pipes<Args, FromGen<Ret, Eff>, A, B, C, D, E, F, G, H, I, L>
  ): (...args: Args) => L
}

//
// Generator Function
//

export const genNoThis = gen(
  {},
  function*<N extends number>(x: N) {
    yield* Effect.log(`Ok!`)
    return x
  },
  Effect.map((n) => n + 1)
)

genNoThis(100)

export const genNoThis3 = gen(
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
  method: gen(function*(x) {
    return x
  })
})

export const genThis = gen(
  {},
  function*<N extends number>(this: { message: string }, x: N) {
    yield* Effect.log(this.message)
    return x
  },
  Effect.map((n) => n + 1)
)

genThis.bind({ message: "Ok!" })(100)

export const genBounded = gen(
  { this: { message: "Ok!" } },
  function*<N extends number>(x: N) {
    yield* Effect.log(this.message)
    return x
  }
)

export const genBoundedOk = gen(
  { this: { message: "Ok!" } },
  function*(x: number) {
    yield* Effect.log(this.message)
    return x
  }
)

genBounded(100)

// Effect.Effect<number, never, never>
export const genConst = gen(
  { constant: true },
  function*() {
    yield* Effect.log("Ok!")
    return 100
  },
  Effect.map((n) => n + 1)
)
