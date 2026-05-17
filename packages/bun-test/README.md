# @effect/bun-test

A set of helpers for testing [Effect](https://effect.website) programs with
Bun's native [`bun:test`](https://bun.sh/docs/cli/test) runner.

The API mirrors [`@effect/vitest`](https://www.npmjs.com/package/@effect/vitest)
(`it.effect`, `it.live`, `it.layer`, `it.prop`, `flakyTest`, …) but runs under
Bun's built-in test runner — useful when you already use Bun as your runtime
and want to avoid pulling in Vitest.

## Installation

```sh
bun add -d @effect/bun-test
```

## Usage

```ts
import { describe, expect, it, layer } from "@effect/bun-test"
import { Context, Effect, Layer } from "effect"

class Foo extends Context.Service<Foo, "foo">()("Foo") {
  static Live = Layer.succeed(Foo)("foo")
}

it.effect("plain effect test", () =>
  Effect.sync(() => expect(1).toEqual(1))
)

describe("with a shared layer", () => {
  layer(Foo.Live)((it) => {
    it.effect("has Foo in context", () =>
      Effect.gen(function* () {
        const foo = yield* Foo
        expect(foo).toEqual("foo")
      })
    )
  })
})
```

Run with:

```sh
bun test
```

## Differences from `@effect/vitest`

- **`addEqualityTesters`** is a no-op — `bun:test`'s `expect` does not yet
  expose `addEqualityTesters`. Use Effect's `Equal.equals` directly (or the
  helpers in `@effect/bun-test/utils`).
- **`TestContext`** — Vitest passes a `TestContext` to each test fn (with
  `signal`, `onTestFailed`, etc.). `bun:test` doesn't, so the context passed
  to your Effect tests is a minimal stub.

## License

MIT
