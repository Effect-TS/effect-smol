import type { SqlStorage } from "@cloudflare/workers-types"
import Database from "better-sqlite3"

/**
 * Creates a real SQLite-backed mock of DurableObjectStorage with sql and
 * transactionSync. Uses better-sqlite3 for actual SQLite transactions.
 */
export function makeDurableObjectStorage() {
  const sqlite = new Database(":memory:")

  const sql: SqlStorage = {
    exec(query: string, ...bindings: any[]) {
      const stmt = sqlite.prepare(query)
      const isSelect = query.trimStart().toUpperCase().startsWith("SELECT")
      if (isSelect) {
        const rows = stmt.all(...bindings)
        const columns = rows.length > 0 ? Object.keys(rows[0] as any) : stmt.columns().map((c) => c.name)
        return {
          columnNames: columns,
          raw: () => rows.map((r: any) => columns.map((c) => r[c])),
          rowsRead: rows.length,
          rowsWritten: 0
        } as any
      } else {
        const result = stmt.run(...bindings)
        return {
          columnNames: [],
          raw: () => [],
          rowsRead: 0,
          rowsWritten: result.changes
        } as any
      }
    },
    get databaseSize() {
      return 0
    }
  } as any

  const storage = {
    sql,
    transactionSync<T>(closure: () => T): T {
      const tx = sqlite.transaction(closure)
      return tx()
    }
  }

  const close = () => sqlite.close()

  return { storage, close }
}
