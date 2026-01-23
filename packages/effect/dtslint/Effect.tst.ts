/** @effect-diagnostics floatingEffect:skip-file */
import { Data, Effect, pipe } from "effect"
import type { Types } from "effect"
import { describe, expect, it } from "tstyche"

// Fixtures
class RateLimitError extends Data.TaggedError("RateLimitError")<{
  readonly retryAfter: number
}> {}

class QuotaExceededError extends Data.TaggedError("QuotaExceededError")<{
  readonly limit: number
}> {}

class AiError extends Data.TaggedError("AiError")<{
  readonly reason: RateLimitError | QuotaExceededError
}> {}

class OtherError extends Data.TaggedError("OtherError")<{
  readonly message: string
}> {}

class SimpleError extends Data.TaggedError("SimpleError")<{
  readonly code: number
}> {}

declare const aiEffect: Effect.Effect<string, AiError>
declare const mixedEffect: Effect.Effect<string, AiError | OtherError>
declare const simpleEffect: Effect.Effect<string, SimpleError>

describe("Types", () => {
  describe("ReasonOf", () => {
    it("extracts reason type", () => {
      expect<Types.ReasonOf<AiError>>().type.toBe<RateLimitError | QuotaExceededError>()
    })

    it("returns never for errors without reason", () => {
      expect<Types.ReasonOf<SimpleError>>().type.toBe<never>()
    })
  })

  describe("ReasonTags", () => {
    it("extracts reason tags", () => {
      expect<Types.ReasonTags<AiError> & unknown>().type.toBe<
        "RateLimitError" | "QuotaExceededError"
      >()
    })

    it("returns never for errors without reason", () => {
      expect<Types.ReasonTags<SimpleError>>().type.toBe<never>()
    })
  })

  describe("ExtractReason", () => {
    it("extracts specific reason", () => {
      expect<Types.ExtractReason<AiError, "RateLimitError">>().type.toBe<RateLimitError>()
    })

    it("returns never for invalid tag", () => {
      expect<Types.ExtractReason<AiError, "Invalid">>().type.toBe<never>()
    })
  })
})

describe("Effect.catchReason", () => {
  it("handler receives reason type", () => {
    pipe(
      aiEffect,
      Effect.catchReason("AiError", "RateLimitError", (reason) => {
        expect(reason).type.toBe<RateLimitError>()
        return Effect.succeed("ok")
      })
    )
  })

  it("error channel is E | E2", () => {
    const result = pipe(
      aiEffect,
      Effect.catchReason("AiError", "RateLimitError", () => Effect.fail(new OtherError({ message: "" })))
    )
    expect(result).type.toBe<Effect.Effect<string, AiError | OtherError>>()
  })
})

describe("Effect.catchReasons", () => {
  it("handlers receive respective reason types", () => {
    pipe(
      aiEffect,
      Effect.catchReasons("AiError", {
        RateLimitError: (r) => {
          expect(r).type.toBe<RateLimitError>()
          return Effect.succeed("")
        },
        QuotaExceededError: (r) => {
          expect(r).type.toBe<QuotaExceededError>()
          return Effect.succeed("")
        }
      })
    )
  })

  it("unifies handler return types", () => {
    const result = pipe(
      aiEffect,
      Effect.catchReasons("AiError", {
        RateLimitError: () => Effect.succeed(42),
        QuotaExceededError: () => Effect.fail(new OtherError({ message: "" }))
      })
    )
    expect(result).type.toBe<Effect.Effect<string | number, AiError | OtherError>>()
  })

  it("allows partial handlers", () => {
    const result = pipe(
      aiEffect,
      Effect.catchReasons("AiError", {
        RateLimitError: () => Effect.succeed("handled")
      })
    )
    expect(result).type.toBe<Effect.Effect<string, AiError>>()
  })
})

describe("Effect.tapErrorTag", () => {
  it("narrows tagged errors", () => {
    const result = pipe(
      mixedEffect,
      Effect.tapErrorTag("AiError", (error) => {
        expect(error).type.toBe<AiError>()
        return Effect.succeed("ok")
      })
    )
    expect(result).type.toBe<Effect.Effect<string, AiError | OtherError>>()
  })

  it("unifies additional error types", () => {
    const result = pipe(
      mixedEffect,
      Effect.tapErrorTag("AiError", () => Effect.fail(new SimpleError({ code: 1 })))
    )
    expect(result).type.toBe<Effect.Effect<string, AiError | OtherError | SimpleError>>()
  })

  it("supports tacit pipe", () => {
    const result = pipe(
      simpleEffect,
      Effect.tapErrorTag("SimpleError", Effect.log)
    )
    expect(result).type.toBe<Effect.Effect<string, SimpleError>>()
  })
})

describe("Effect.unwrapReason", () => {
  it("replaces parent error with reasons", () => {
    const result = pipe(aiEffect, Effect.unwrapReason("AiError"))
    expect(result).type.toBe<Effect.Effect<string, RateLimitError | QuotaExceededError>>()
  })

  it("preserves other errors in union", () => {
    const result = pipe(mixedEffect, Effect.unwrapReason("AiError"))
    expect(result).type.toBe<
      Effect.Effect<string, RateLimitError | QuotaExceededError | OtherError>
    >()
  })
})

describe("Effect.fn", () => {
  it("with a span, generator", () => {
    const fn = Effect.fn("span")(function*() {
      return yield* Effect.fail("bye")
    })
    expect(fn).type.toBe<() => Effect.Effect<never, string, never>>()
  })

  it("with a span, generator with yieldable", () => {
    const fn = Effect.fn("span")(function*() {
      return yield* new RateLimitError({ retryAfter: 1 })
    })
    expect(fn).type.toBe<() => Effect.Effect<never, RateLimitError, never>>()
  })

  it("with a span, generator and pipe arguments", () => {
    const fn = Effect.fn("span")(
      function*() {
        return yield* Effect.succeed("hello")
      },
      Effect.map((x) => {
        expect(x).type.toBe<string>()
        return x.length
      })
    )
    expect(fn).type.toBe<() => Effect.Effect<number, never, never>>()
  })

  it("without a span, generator", () => {
    const fn = Effect.fn(function*() {
      return yield* Effect.fail("bye")
    })
    expect(fn).type.toBe<() => Effect.Effect<never, string, never>>()
  })

  it("without a span, generator with yieldable", () => {
    const fn = Effect.fn(function*() {
      return yield* new RateLimitError({ retryAfter: 1 })
    })
    expect(fn).type.toBe<() => Effect.Effect<never, RateLimitError, never>>()
  })

  it("without a span, generator and pipe arguments", () => {
    const fn = Effect.fn(
      function*() {
        return yield* Effect.succeed("hello")
      },
      Effect.map((x) => {
        expect(x).type.toBe<string>()
        return x.length
      })
    )
    expect(fn).type.toBe<() => Effect.Effect<number, never, never>>()
  })

  it("with a span, function", () => {
    const fn = Effect.fn("span")(function() {
      return Effect.fail("bye")
    })
    expect(fn).type.toBe<() => Effect.Effect<never, string, never>>()
  })

  it("with a span, function and pipe arguments", () => {
    const fn = Effect.fn("span")(
      function() {
        return Effect.succeed("hello")
      },
      Effect.map((x) => {
        expect(x).type.toBe<string>()
        return x.length
      })
    )
    expect(fn).type.toBe<() => Effect.Effect<number, never, never>>()
  })

  it("without a span, function", () => {
    const fn = Effect.fn(function() {
      return Effect.fail("bye")
    })
    expect(fn).type.toBe<() => Effect.Effect<never, string, never>>()
  })

  it("without a span, function and pipe arguments", () => {
    const fn = Effect.fn(
      function() {
        return Effect.succeed("hello")
      },
      Effect.map((x) => {
        expect(x).type.toBe<string>()
        return x.length
      })
    )
    expect(fn).type.toBe<() => Effect.Effect<number, never, never>>()
  })

  it("should not unwrap nested effects", () => {
    const fn = Effect.fn(function() {
      return Effect.succeed(Effect.succeed(1))
    })
    expect(fn).type.toBe<() => Effect.Effect<Effect.Effect<number, never, never>, never, never>>()
  })
})
