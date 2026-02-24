/**
 * @title Composing services with the Layer module
 *
 * Build focused service layers, then compose them with `Layer.provide` and
 * `Layer.provideMerge` based on what services you want to expose.
 */

import { Effect, Layer, ServiceMap } from "effect"

class AppConfig extends ServiceMap.Service<AppConfig, {
  readonly databaseUrl: string
}>()("myapp/AppConfig") {
  static layer = Layer.succeed(AppConfig)({
    databaseUrl: "postgres://localhost:5432/app"
  })
}

class Logger extends ServiceMap.Service<Logger, {
  readonly log: (message: string) => Effect.Effect<void>
}>()("myapp/Logger") {
  static layer = Layer.succeed(Logger)({
    log: (message) => Effect.log(`[sql] ${message}`)
  })
}

class Database extends ServiceMap.Service<Database, {
  readonly query: (sql: string) => Effect.Effect<string>
}>()("myapp/Database") {
  static layer = Layer.effect(
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
}

class UserRepository extends ServiceMap.Service<UserRepository, {
  readonly findById: (id: string) => Effect.Effect<{ readonly id: string; readonly name: string }>
}>()("myapp/UserRepository") {
  static layer = Layer.effect(
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
}

const sharedDependencies = Layer.mergeAll(AppConfig.layer, Logger.layer)
const databaseWithDependencies = Database.layer.pipe(Layer.provide(sharedDependencies))

// `Layer.provide` wires dependencies but keeps only the left layer outputs.
const repositoryOnly = UserRepository.layer.pipe(
  Layer.provide(databaseWithDependencies)
)

// `Layer.provideMerge` wires dependencies and keeps outputs from both sides.
const repositoryAndDatabase = UserRepository.layer.pipe(
  Layer.provideMerge(databaseWithDependencies)
)

export type RepositoryOnlyOutput = Layer.Success<typeof repositoryOnly>
export type RepositoryOnlyInput = Layer.Services<typeof repositoryOnly>

export type RepositoryAndDatabaseOutput = Layer.Success<typeof repositoryAndDatabase>
export type RepositoryAndDatabaseInput = Layer.Services<typeof repositoryAndDatabase>
