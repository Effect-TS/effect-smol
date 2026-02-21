interface Database {
  readonly query: (sql: string) => string
}

const Database = ServiceMap.Service<Database>("Database")
