export declare const fn: <T, Args extends Array<any>, Ret>(
  self: T,
  body: (this: T, ...args: Args) => Generator<any, Ret, never>
) => (...args: Args) => Ret

export const ok = fn({ message: "foo" }, function*(n: number) {
  console.log(this.message, n) // ok
})

export const no = fn({ message: "foo" }, function*<N>(n: N) {
  console.log(this.message, n) // error
})
