import { Cause, ServiceMap, Deferred, Effect, Equal, References, Ref, Schema, Scope, Fiber } from "effect"


const program = Effect.fail("error").pipe(
  Effect.catch((error) => Effect.succeed(error))
)

const child = Effect.forkChild(program)
const provided = Scope.provide({} as any)(program)
const eq = Equal.asEquivalence<number>()
const timeout = Cause.TimeoutError

const empty = cause.reasons.length === 0
const failures = cause.reasons.filter(Cause.isFailReason)
const defects = cause.reasons.filter(Cause.isDieReason)

const parsedJson = Schema.UnknownFromJsonString
const parsedStruct = Schema.fromJsonString(Schema.Struct({ a: Schema.Number }))
const union = Schema.Union([Schema.String, Schema.Number])
const tuple = Schema.Tuple([Schema.String, Schema.Number])
const template = Schema.TemplateLiteral([Schema.String, ".", Schema.String])
const record = Schema.Record(Schema.String, Schema.Number)
const literalNull = Schema.Null
const literalUnion = Schema.Literals(["a", "b"])
const composed = Schema.Trim.pipe(Schema.decodeTo(Schema.FiniteFromString))
const annotated = Schema.Struct({ a: Schema.String }).pipe(
  Schema.annotate({ description: "x" })
)

const tag = ServiceMap.Service("Database")
const levelRef = References.CurrentLogLevel

class Database extends ServiceMap.Service<Database, {
  readonly query: (sql: string) => string
}>()("Database") {}

class Notifications extends ServiceMap.Service<Notifications, {
  readonly notify: (message: string) => Effect.Effect<void>
}>()("Notifications") {}

const LogLevel = ServiceMap.Reference<"info" | "warn" | "error">("LogLevel", {
  defaultValue: () => "info" as const
})

const yieldProgram = Effect.gen(function*() {
  const ref = yield* Ref.make(0)
  const refValue = yield* Ref.get(ref)
  const deferred = yield* Deferred.make<string>()
  const deferredValue = yield* Deferred.await(deferred)
  const fiber = yield* Effect.forkChild(program)
  const joined = yield* Fiber.join(fiber)
  return [refValue, deferredValue, joined]
})

const removedFork = /* TODO(effect-v4-codemod): manual migration required for effect-forkAll-removed */ Effect.forkAll([program])
const manualCatchSome = /* TODO(effect-v4-codemod): manual migration required for effect-catchSome */ Effect.catchSome((error: unknown) => Effect.succeed(error))
const removedCause = false
