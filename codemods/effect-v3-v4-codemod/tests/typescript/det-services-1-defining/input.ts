interface Database {
  readonly query: (sql: string) => string
}

const Database = Context.GenericTag<Database>("Database")
