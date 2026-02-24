/**
 * @title Composing services with the Layer module
 *
 * Build focused service layers, then compose them with `Layer.provide` and
 * `Layer.provideMerge` based on what services you want to expose.
 */

import { Effect, Layer, ServiceMap } from "effect"

class AppConfig extends ServiceMap.Service<AppConfig, {
  readonly databaseUrl: string
}>()("myapp/AppConfig") {}

class Logger extends ServiceMap.Service<Logger, {
  readonly log: (message: string) => Effect.Effect<void>
}>()("myapp/Logger") {}

class Database extends ServiceMap.Service<Database, {
  readonly query: (sql: string) => Effect.Effect<string>
}>()("myapp/Database") {}

class UserRepository extends ServiceMap.Service<UserRepository, {
  readonly findById: (id: string) => Effect.Effect<{ readonly id: string; readonly name: string }>
}>()("myapp/UserRepository") {}

const configLayer = Layer.succeed(AppConfig)({
  databaseUrl: "postgres://localhost:5432/app"
})

const loggerLayer = Layer.succeed(Logger)({
  log: (message) => Effect.log(`[sql] ${message}`)
})

// Database needs AppConfig + Logger.
const databaseLayer = Layer.effect(
  Database,
  Effect.gen(function*() {
    const config = yield* AppConfig
    const logger = yield* Logger

    const query = Effect.fnUntraced(function*(sql: string) {
      yield* logger.log(`${config.databaseUrl} :: ${sql}`)
      return `result for: ${sql}`
    })

    return Database.of({ query })
  })
)

// UserRepository needs Database.
const userRepositoryLayer = Layer.effect(
  UserRepository,
  Effect.gen(function*() {
    const database = yield* Database

    const findById = Effect.fnUntraced(function*(id: string) {
      yield* database.query(`SELECT * FROM users WHERE id = '${id}'`)
      return { id, name: "Ada Lovelace" } as const
    })

    return UserRepository.of({ findById })
  })
)

const sharedDependencies = Layer.mergeAll(configLayer, loggerLayer)
const databaseWithDependencies = databaseLayer.pipe(Layer.provide(sharedDependencies))

// `Layer.provide` wires dependencies but keeps only the left layer outputs.
const repositoryOnly = userRepositoryLayer.pipe(
  Layer.provide(databaseWithDependencies)
)

// `Layer.provideMerge` wires dependencies and keeps outputs from both sides.
const repositoryAndDatabase = userRepositoryLayer.pipe(
  Layer.provideMerge(databaseWithDependencies)
)

export const repositoryProgram = Effect.gen(function*() {
  const repository = yield* UserRepository
  return yield* repository.findById("42")
}).pipe(Effect.provide(repositoryOnly))

export const repositoryAndSqlProgram = Effect.gen(function*() {
  const repository = yield* UserRepository
  const database = yield* Database

  const user = yield* repository.findById("42")
  const sqlResult = yield* database.query("SELECT 1")

  return { user, sqlResult }
}).pipe(Effect.provide(repositoryAndDatabase))
