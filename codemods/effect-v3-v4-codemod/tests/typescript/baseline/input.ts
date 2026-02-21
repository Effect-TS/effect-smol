import { Cause, Context, Deferred, Effect, Equal, FiberRef, Ref, Schema, Scope } from "effect"


const program = Effect.fail("error").pipe(
  Effect.catchAll((error) => Effect.succeed(error))
)

const child = Effect.fork(program)
const provided = Scope.extend(program, {} as any)
const eq = Equal.equivalence<number>()
const timeout = Cause.TimeoutException

const empty = Cause.isEmptyType(cause)
const failures = Cause.failures(cause)
const defects = Cause.defects(cause)

const parsedJson = Schema.parseJson()
const parsedStruct = Schema.parseJson(Schema.Struct({ a: Schema.Number }))
const union = Schema.Union(Schema.String, Schema.Number)
const tuple = Schema.Tuple(Schema.String, Schema.Number)
const template = Schema.TemplateLiteral(Schema.String, ".", Schema.String)
const record = Schema.Record({ key: Schema.String, value: Schema.Number })
const literalNull = Schema.Literal(null)
const literalUnion = Schema.Literal("a", "b")
const composed = Schema.Trim.pipe(Schema.compose(Schema.FiniteFromString))
const annotated = Schema.Struct({ a: Schema.String }).pipe(
  Schema.annotations({ description: "x" })
)

const tag = Context.GenericTag("Database")
const levelRef = FiberRef.currentLogLevel

class Database extends Context.Tag("Database")<Database, {
  readonly query: (sql: string) => string
}>() {}

class Notifications extends Effect.Tag("Notifications")<Notifications, {
  readonly notify: (message: string) => Effect.Effect<void>
}>() {}

const LogLevel = Context.Reference<"info" | "warn" | "error">()("LogLevel", {
  defaultValue: () => "info" as const
})

const yieldProgram = Effect.gen(function*() {
  const ref = yield* Ref.make(0)
  const refValue = yield* ref
  const deferred = yield* Deferred.make<string>()
  const deferredValue = yield* deferred
  const fiber = yield* Effect.fork(program)
  const joined = yield* fiber
  return [refValue, deferredValue, joined]
})

const removedFork = Effect.forkAll([program])
const manualCatchSome = Effect.catchSome((error: unknown) => Effect.succeed(error))
const removedCause = Cause.isSequentialType(cause)
