/**
 * @since 4.0.0
 */
import { hasProperty } from "../../data/Predicate.ts"
import * as Effect from "../../Effect.ts"
import type * as Fiber from "../../Fiber.ts"
import { constUndefined } from "../../Function.ts"
import type { Inspectable } from "../../interfaces/Inspectable.ts"
import type { Pipeable } from "../../interfaces/Pipeable.ts"
import { PipeInspectableProto, YieldableProto } from "../../internal/core.ts"
import type * as Tracer from "../../observability/Tracer.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Stream from "../../stream/Stream.ts"
import type { Acquirer, Connection, Row } from "./SqlConnection.ts"
import type { SqlError } from "./SqlError.ts"

/**
 * @category type id
 * @since 4.0.0
 */
export const FragmentTypeId: FragmentTypeId = "~effect/sql/Fragment"

/**
 * @category type id
 * @since 4.0.0
 */
export type FragmentTypeId = "~effect/sql/Fragment"

/**
 * @category model
 * @since 4.0.0
 */
export interface Fragment {
  readonly [FragmentTypeId]: FragmentTypeId
  readonly segments: ReadonlyArray<Segment>
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const fragment = (
  segments: ReadonlyArray<Segment>
): Fragment => ({
  [FragmentTypeId]: FragmentTypeId,
  segments
})

/**
 * @category model
 * @since 4.0.0
 */
export type Dialect = "sqlite" | "pg" | "mysql" | "mssql" | "clickhouse"

/**
 * @category model
 * @since 4.0.0
 */
export interface Statement<A>
  extends Fragment, Effect.Yieldable<Statement<A>, ReadonlyArray<A>, SqlError>, Pipeable, Inspectable
{
  readonly raw: Effect.Effect<unknown, SqlError>
  readonly withoutTransform: Effect.Effect<ReadonlyArray<A>, SqlError>
  readonly stream: Stream.Stream<A, SqlError>
  readonly values: Effect.Effect<ReadonlyArray<ReadonlyArray<Primitive>>, SqlError>
  readonly unprepared: Effect.Effect<ReadonlyArray<A>, SqlError>
  readonly compile: (withoutTransform?: boolean | undefined) => readonly [
    sql: string,
    params: ReadonlyArray<Primitive>
  ]
}

/**
 * @category model
 * @since 4.0.0
 */
export type Transformer = (
  self: Statement<unknown>,
  sql: Constructor,
  fiber: Fiber.Fiber<unknown, unknown>,
  span: Tracer.Span
) => Effect.Effect<Statement<unknown>>

/**
 * @category transformer
 * @since 4.0.0
 */
export const CurrentTransformer = ServiceMap.Reference<Transformer | undefined>("effect/sql/CurrentTransformer", {
  defaultValue: constUndefined
})

/**
 * @category guard
 * @since 4.0.0
 */
export const isFragment = (u: unknown): u is Fragment => hasProperty(u, FragmentTypeId)

/**
 * @category guard
 * @since 4.0.0
 */
export const isCustom = <A extends Custom<any, any, any, any>>(
  kind: A["kind"]
) =>
(u: Segment): u is A => u._tag === "Custom" && u.kind === kind

/**
 * @category model
 * @since 4.0.0
 */
export type Segment =
  | Literal
  | Identifier
  | Parameter
  | ArrayHelper
  | RecordInsertHelper
  | RecordUpdateHelper
  | RecordUpdateHelperSingle
  | Custom

/**
 * @category model
 * @since 4.0.0
 */
export interface Literal {
  readonly _tag: "Literal"
  readonly value: string
  readonly params?: ReadonlyArray<Primitive> | undefined
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const literal = (value: string, params?: ReadonlyArray<Primitive> | undefined): Literal => ({
  _tag: "Literal",
  value,
  params
})

/**
 * @category model
 * @since 4.0.0
 */
export interface Identifier {
  readonly _tag: "Identifier"
  readonly value: string
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const identifier = (value: string): Identifier => ({
  _tag: "Identifier",
  value
})

/**
 * @category model
 * @since 4.0.0
 */
export interface Parameter {
  readonly _tag: "Parameter"
  readonly value: Primitive
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const parameter = (value: Primitive): Parameter => ({
  _tag: "Parameter",
  value
})

/**
 * @category model
 * @since 4.0.0
 */
export interface ArrayHelper {
  readonly _tag: "ArrayHelper"
  readonly value: ReadonlyArray<Primitive | Fragment>
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const arrayHelper = (value: ReadonlyArray<Primitive | Fragment>): ArrayHelper => ({
  _tag: "ArrayHelper",
  value
})

/**
 * @category model
 * @since 4.0.0
 */
export interface RecordInsertHelper {
  readonly _tag: "RecordInsertHelper"
  readonly value: ReadonlyArray<Record<string, Primitive | Fragment | undefined>>
  /** @internal */
  readonly returningIdentifier: string | Fragment | undefined
  readonly returning: (sql: string | Identifier | Fragment) => RecordInsertHelper
}

const RecordInsertHelperProto = {
  _tag: "RecordInsertHelper" as const,
  returning(this: RecordInsertHelper, sql: string | Identifier | Fragment) {
    const self = Object.create(RecordInsertHelperProto)
    Object.assign(self, this, {
      returningIdentifier: sql
    })
    return self
  }
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const recordInsertHelper = (
  value: ReadonlyArray<Record<string, Primitive | Fragment | undefined>>
): RecordInsertHelper =>
  Object.assign(Object.create(RecordInsertHelperProto), {
    value,
    returningIdentifier: undefined
  })

/**
 * @category model
 * @since 4.0.0
 */
export interface RecordUpdateHelper {
  readonly _tag: "RecordUpdateHelper"
  readonly value: ReadonlyArray<Record<string, Primitive | Fragment | undefined>>
  readonly alias: string
  /** @internal */
  readonly returningIdentifier: string | Fragment | undefined
  readonly returning: (sql: string | Identifier | Fragment) => RecordUpdateHelper
}

const RecordUpdateHelperProto = {
  ...RecordInsertHelperProto,
  _tag: "RecordUpdateHelper" as const
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const recordUpdateHelper = (
  value: ReadonlyArray<Record<string, Primitive | Fragment | undefined>>,
  alias: string
): RecordUpdateHelper =>
  Object.assign(Object.create(RecordUpdateHelperProto), {
    value,
    alias,
    returningIdentifier: undefined
  })

/**
 * @category model
 * @since 4.0.0
 */
export interface RecordUpdateHelperSingle {
  readonly _tag: "RecordUpdateHelperSingle"
  readonly value: Record<string, Primitive | Fragment | undefined>
  readonly omit: ReadonlyArray<string>
  /** @internal */
  readonly returningIdentifier: string | Fragment | undefined
  readonly returning: (sql: string | Identifier | Fragment) => RecordUpdateHelperSingle
}

const RecordUpdateHelperSingleProto = {
  ...RecordInsertHelperProto,
  _tag: "RecordUpdateHelperSingle" as const
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const recordUpdateHelperSingle = (
  value: ReadonlyArray<Record<string, Primitive | Fragment | undefined>>,
  alias: string
): RecordUpdateHelperSingle =>
  Object.assign(Object.create(RecordUpdateHelperSingleProto), {
    value,
    alias,
    returningIdentifier: undefined
  })

/**
 * @category model
 * @since 4.0.0
 */
export interface Custom<
  T extends string = string,
  A = void,
  B = void,
  C = void
> {
  readonly _tag: "Custom"
  readonly kind: T
  readonly paramA: A
  readonly paramB: B
  readonly paramC: C
}

/**
 * @category constructor
 * @since 4.0.0
 */
export const custom = <C extends Custom<any, any, any, any>>(
  kind: C["kind"]
) =>
(
  paramA: C["paramA"],
  paramB: C["paramB"],
  paramC: C["paramC"]
): C => ({ _tag: "Custom", kind, paramA, paramB, paramC } as C)

/**
 * @category model
 * @since 4.0.0
 */
export type Primitive =
  | string
  | number
  | bigint
  | boolean
  | Date
  | null
  | Int8Array
  | Uint8Array

/**
 * @category model
 * @since 4.0.0
 */
export type PrimitiveKind =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "Date"
  | "null"
  | "Int8Array"
  | "Uint8Array"

/**
 * @category model
 * @since 4.0.0
 */
export type Helper =
  | ArrayHelper
  | RecordInsertHelper
  | RecordUpdateHelper
  | RecordUpdateHelperSingle
  | Identifier
  | Custom

/**
 * @category model
 * @since 4.0.0
 */
export type Argument = Primitive | Helper | Fragment

/**
 * @category model
 * @since 4.0.0
 */
export interface Constructor {
  <A extends object = Row>(
    strings: TemplateStringsArray,
    ...args: Array<Argument>
  ): Statement<A>

  (value: string): Identifier

  /**
   * Create unsafe SQL query
   */
  readonly unsafe: <A extends object>(
    sql: string,
    params?: ReadonlyArray<Primitive> | undefined
  ) => Statement<A>

  readonly literal: (sql: string) => Fragment

  readonly in: {
    (value: ReadonlyArray<Primitive>): ArrayHelper
    (column: string, value: ReadonlyArray<Primitive>): Fragment
  }

  readonly insert: {
    (
      value: ReadonlyArray<Record<string, Primitive | Fragment | undefined>>
    ): RecordInsertHelper
    (value: Record<string, Primitive | Fragment | undefined>): RecordInsertHelper
  }

  /** Update a single row */
  readonly update: <A extends Record<string, Primitive | Fragment | undefined>>(
    value: A,
    omit?: ReadonlyArray<keyof A>
  ) => RecordUpdateHelperSingle

  /**
   * Update multiple rows
   *
   * **Note:** Not supported in sqlite
   */
  readonly updateValues: (
    value: ReadonlyArray<Record<string, Primitive | Fragment | undefined>>,
    alias: string
  ) => RecordUpdateHelper

  /**
   * Create an `AND` chain for a where clause
   */
  readonly and: (clauses: ReadonlyArray<string | Fragment>) => Fragment

  /**
   * Create an `OR` chain for a where clause
   */
  readonly or: (clauses: ReadonlyArray<string | Fragment>) => Fragment

  /**
   * Create comma seperated values, with an optional prefix
   *
   * Useful for `ORDER BY` and `GROUP BY` clauses
   */
  readonly csv: {
    (values: ReadonlyArray<string | Fragment>): Fragment
    (prefix: string, values: ReadonlyArray<string | Fragment>): Fragment
  }

  readonly join: (
    literal: string,
    addParens?: boolean,
    fallback?: string
  ) => (clauses: ReadonlyArray<string | Fragment>) => Fragment

  readonly onDialect: <A, B, C, D, E>(options: {
    readonly sqlite: () => A
    readonly pg: () => B
    readonly mysql: () => C
    readonly mssql: () => D
    readonly clickhouse: () => E
  }) => A | B | C | D | E

  readonly onDialectOrElse: <A, B = never, C = never, D = never, E = never, F = never>(options: {
    readonly orElse: () => A
    readonly sqlite?: () => B
    readonly pg?: () => C
    readonly mysql?: () => D
    readonly mssql?: () => E
    readonly clickhouse?: () => F
  }) => A | B | C | D | E | F
}

/**
 * @category constructor
 * @since 4.0.0
 */
export const make = (
  acquirer: Acquirer,
  compiler: Compiler,
  spanAttributes: ReadonlyArray<readonly [string, unknown]>,
  transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
): Constructor => {
  const cache = transformRows === undefined ? constructorCache.noTransforms : constructorCache.transforms
  if (cache.has(acquirer)) {
    return cache.get(acquirer)!
  }
  const self = Object.assign(
    function sql(strings: unknown, ...args: Array<any>): any {
      if (typeof strings === "string") {
        return identifier(strings)
      } else if (Array.isArray(strings) && "raw" in strings) {
        return statement(
          acquirer,
          compiler,
          strings as TemplateStringsArray,
          args,
          spanAttributes,
          transformRows
        )
      }

      throw "absurd"
    },
    {
      unsafe<A extends object = Row>(
        sql: string,
        params?: ReadonlyArray<Primitive>
      ) {
        return unsafeMake<A>(
          [literal(sql, params)],
          acquirer,
          compiler,
          spanAttributes,
          transformRows
        )
      },
      literal(sql: string) {
        return fragment([literal(sql)])
      },
      in: in_,
      insert(value: any) {
        return recordInsertHelper(
          Array.isArray(value) ? value : [value]
        )
      },
      update(value: any, omit: any) {
        return recordUpdateHelperSingle(value, omit ?? [])
      },
      updateValues(value: any, alias: any) {
        return recordUpdateHelper(value, alias)
      },
      and,
      or,
      csv,
      join,
      onDialect(options: Record<Dialect, any>) {
        return options[compiler.dialect]()
      },
      onDialectOrElse(options: any) {
        return options[compiler.dialect] !== undefined ? options[compiler.dialect]() : options.orElse()
      }
    }
  )

  cache.set(acquirer, self)

  return self
}

const constructorCache = {
  transforms: new WeakMap<Acquirer, Constructor>(),
  noTransforms: new WeakMap<Acquirer, Constructor>()
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const statement = <A = Row>(
  acquirer: Acquirer,
  compiler: Compiler,
  strings: TemplateStringsArray,
  args: Array<Argument>,
  spanAttributes: ReadonlyArray<readonly [string, unknown]>,
  transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
): Statement<A> => {
  const segments: Array<Segment> = strings[0].length > 0 ? [literal(strings[0])] : []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (isFragment(arg)) {
      for (const segment of arg.segments) {
        segments.push(segment)
      }
    } else if (isHelper(arg)) {
      segments.push(arg)
    } else {
      segments.push(parameter(arg))
    }

    if (strings[i + 1].length > 0) {
      segments.push(literal(strings[i + 1]))
    }
  }

  return unsafeMake(segments, acquirer, compiler, spanAttributes, transformRows)
}

/**
 * @category constructor
 * @since 4.0.0
 */
export function join(lit: string, addParens = true, fallback = "") {
  const literalStatement = literal(lit)
  const fallbackFragment = fragment([literal(fallback)])

  return (clauses: ReadonlyArray<string | Fragment>): Fragment => {
    if (clauses.length === 0) {
      return fallbackFragment
    } else if (clauses.length === 1) {
      return fragment(convertLiteralOrFragment(clauses[0]))
    }

    const segments: Array<Segment> = []

    if (addParens) {
      segments.push(literal("("))
    }

    segments.push.apply(segments, convertLiteralOrFragment(clauses[0]))

    for (let i = 1; i < clauses.length; i++) {
      segments.push(literalStatement)
      segments.push.apply(segments, convertLiteralOrFragment(clauses[i]))
    }

    if (addParens) {
      segments.push(literal(")"))
    }

    return fragment(segments)
  }
}

/**
 * @category constructor
 * @since 4.0.0
 */
export const and: (clauses: ReadonlyArray<string | Fragment>) => Fragment = join(" AND ", true, "1=1")

/**
 * @category constructor
 * @since 4.0.0
 */
export const or: (clauses: ReadonlyArray<string | Fragment>) => Fragment = join(" OR ", true, "1=1")

/**
 * @category constructor
 * @since 4.0.0
 */
export const csv: {
  (values: ReadonlyArray<string | Fragment>): Fragment
  (prefix: string, values: ReadonlyArray<string | Fragment>): Fragment
} = function(
  ...args:
    | [values: ReadonlyArray<string | Fragment>]
    | [prefix: string, values: ReadonlyArray<string | Fragment>]
) {
  if (args[args.length - 1].length === 0) {
    return emptyFragment
  }

  if (args.length === 1) {
    return csvRaw(args[0])
  }

  return fragment([
    literal(`${args[0]} `),
    ...csvRaw(args[1]).segments
  ])
}

const csvRaw = join(",", false)
const emptyFragment = fragment([literal("")])

/**
 * @category compiler
 * @since 4.0.0
 */
export interface Compiler {
  readonly dialect: Dialect
  readonly compile: (
    statement: Fragment,
    withoutTransform: boolean
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>]
  readonly withoutTransform: this
}

/**
 * @category compiler
 * @since 4.0.0
 */
export type CompilerOptions<C extends Custom<any, any, any, any> = any> = {
  readonly dialect: Dialect
  readonly placeholder: (index: number, value: unknown) => string
  readonly onIdentifier: (value: string, withoutTransform: boolean) => string
  readonly onRecordUpdate: (
    placeholders: string,
    alias: string,
    columns: string,
    values: ReadonlyArray<ReadonlyArray<Primitive>>,
    returning: readonly [sql: string, params: ReadonlyArray<Primitive>] | undefined
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>]
  readonly onCustom: (
    type: C,
    placeholder: (u: unknown) => string,
    withoutTransform: boolean
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>]
  readonly onInsert?: (
    columns: ReadonlyArray<string>,
    placeholders: string,
    values: ReadonlyArray<ReadonlyArray<Primitive>>,
    returning: readonly [sql: string, params: ReadonlyArray<Primitive>] | undefined
  ) => readonly [sql: string, binds: ReadonlyArray<Primitive>]
  readonly onRecordUpdateSingle?: (
    columns: ReadonlyArray<string>,
    values: ReadonlyArray<Primitive>,
    returning: readonly [sql: string, params: ReadonlyArray<Primitive>] | undefined
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>]
}

/**
 * @category compiler
 * @since 4.0.0
 */
export const makeCompiler = <C extends Custom<any, any, any, any> = any>(
  options: CompilerOptions<C>
): Compiler => {
  const self = Object.create(CompilerProto)
  self.options = options
  self.dialect = options.dialect
  self.disableTransforms = false
  return self
}

interface CompilerImpl extends Compiler {
  readonly options: CompilerOptions
  readonly disableTransforms: boolean
  compile(
    statement: Fragment,
    withoutTransform?: boolean,
    placeholderOverride?: (u: unknown) => string
  ): readonly [sql: string, binds: ReadonlyArray<Primitive>]
}

const statementCacheSymbol = Symbol.for("@effect/sql/Statement/statementCache")
const statementCacheNoTransformSymbol = Symbol.for("@effect/sql/Statement/statementCacheNoTransform")

const CompilerProto = {
  compile(
    this: CompilerImpl,
    statement: Fragment,
    withoutTransform = false,
    placeholderOverride?: (u: unknown) => string
  ): readonly [sql: string, binds: ReadonlyArray<Primitive>] {
    const opts = this.options
    withoutTransform = withoutTransform || this.disableTransforms
    const cacheSymbol = withoutTransform ? statementCacheNoTransformSymbol : statementCacheSymbol
    if (cacheSymbol in statement) {
      return (statement as any)[cacheSymbol]
    }

    const segments = statement.segments
    const len = segments.length

    let sql = ""
    const binds: Array<Primitive> = []
    let placeholderCount = 0
    const placeholder = placeholderOverride ?? ((u: unknown) => opts.placeholder(++placeholderCount, u))
    const placeholderNoIncrement = (u: unknown) => opts.placeholder(placeholderCount, u)
    const placeholders = makePlaceholdersArray(placeholder)

    for (let i = 0; i < len; i++) {
      const segment = segments[i]

      switch (segment._tag) {
        case "Literal": {
          sql += segment.value
          if (segment.params) {
            binds.push.apply(binds, segment.params as any)
          }
          break
        }

        case "Identifier": {
          sql += opts.onIdentifier(segment.value, withoutTransform)
          break
        }

        case "Parameter": {
          sql += placeholder(segment.value)
          binds.push(segment.value)
          break
        }

        case "ArrayHelper": {
          sql += `(${placeholders(segment.value)})`
          binds.push.apply(binds, segment.value as any)
          break
        }

        case "RecordInsertHelper": {
          const keys = Object.keys(segment.value[0])

          if (opts.onInsert) {
            const values: Array<ReadonlyArray<Primitive>> = new Array(segment.value.length)
            let placeholders = ""
            for (let i = 0; i < segment.value.length; i++) {
              const row: Array<Primitive> = new Array(keys.length)
              values[i] = row
              placeholders += i === 0 ? "(" : ",("
              for (let j = 0; j < keys.length; j++) {
                const key = keys[j]
                const value = segment.value[i][key]
                const primitive = extractPrimitive(value, opts.onCustom, placeholderNoIncrement, withoutTransform)
                row[j] = primitive
                placeholders += j === 0 ? placeholder(value) : `,${placeholder(value)}`
              }
              placeholders += ")"
            }
            const [s, b] = opts.onInsert(
              keys.map((_) => opts.onIdentifier(_, withoutTransform)),
              placeholders,
              values,
              typeof segment.returningIdentifier === "string"
                ? [segment.returningIdentifier, []]
                : segment.returningIdentifier
                ? this.compile(segment.returningIdentifier, withoutTransform, placeholder)
                : undefined
            )
            sql += s
            binds.push.apply(binds, b as any)
          } else {
            let placeholders = ""
            for (let i = 0; i < segment.value.length; i++) {
              placeholders += i === 0 ? "(" : ",("
              for (let j = 0; j < keys.length; j++) {
                const value = segment.value[i][keys[j]]
                const primitive = extractPrimitive(value, opts.onCustom, placeholderNoIncrement, withoutTransform)
                binds.push(primitive)
                placeholders += j === 0 ? placeholder(value) : `,${placeholder(value)}`
              }
              placeholders += ")"
            }
            sql += `${
              generateColumns(
                keys,
                opts.onIdentifier,
                withoutTransform
              )
            } VALUES ${placeholders}`

            if (typeof segment.returningIdentifier === "string") {
              sql += ` RETURNING ${segment.returningIdentifier}`
            } else if (segment.returningIdentifier) {
              sql += " RETURNING "
              const [s, b] = this.compile(segment.returningIdentifier, withoutTransform, placeholder)
              sql += s
              binds.push.apply(binds, b as any)
            }
          }
          break
        }

        case "RecordUpdateHelperSingle": {
          let keys = Object.keys(segment.value)
          if (segment.omit.length > 0) {
            keys = keys.filter((key) => !segment.omit.includes(key))
          }
          if (opts.onRecordUpdateSingle) {
            const [s, b] = opts.onRecordUpdateSingle(
              keys.map((_) => opts.onIdentifier(_, withoutTransform)),
              keys.map((key) =>
                extractPrimitive(
                  segment.value[key],
                  opts.onCustom,
                  placeholderNoIncrement,
                  withoutTransform
                )
              ),
              typeof segment.returningIdentifier === "string"
                ? [segment.returningIdentifier, []]
                : segment.returningIdentifier
                ? this.compile(segment.returningIdentifier, withoutTransform, placeholder)
                : undefined
            )
            sql += s
            binds.push.apply(binds, b as any)
          } else {
            for (let i = 0, len = keys.length; i < len; i++) {
              const column = opts.onIdentifier(keys[i], withoutTransform)
              if (i === 0) {
                sql += `${column} = ${placeholder(segment.value[keys[i]])}`
              } else {
                sql += `, ${column} = ${placeholder(segment.value[keys[i]])}`
              }
              binds.push(
                extractPrimitive(
                  segment.value[keys[i]],
                  opts.onCustom,
                  placeholderNoIncrement,
                  withoutTransform
                )
              )
            }
            if (typeof segment.returningIdentifier === "string") {
              if (this.dialect === "mssql") {
                sql += ` OUTPUT ${segment.returningIdentifier === "*" ? "INSERTED.*" : segment.returningIdentifier}`
              } else {
                sql += ` RETURNING ${segment.returningIdentifier}`
              }
            } else if (segment.returningIdentifier) {
              sql += this.dialect === "mssql" ? " OUTPUT " : " RETURNING "
              const [s, b] = this.compile(segment.returningIdentifier, withoutTransform, placeholder)
              sql += s
              binds.push.apply(binds, b as any)
            }
          }
          break
        }

        case "RecordUpdateHelper": {
          const keys = Object.keys(segment.value[0])
          const values: Array<ReadonlyArray<Primitive>> = new Array(segment.value.length)
          let placeholders = ""
          for (let i = 0; i < segment.value.length; i++) {
            const row: Array<Primitive> = new Array(keys.length)
            values[i] = row
            placeholders += i === 0 ? "(" : ",("
            for (let j = 0; j < keys.length; j++) {
              const key = keys[j]
              const value = segment.value[i][key]
              row[j] = extractPrimitive(value, opts.onCustom, placeholderNoIncrement, withoutTransform)
              placeholders += j === 0 ? placeholder(value) : `,${placeholder(value)}`
            }
            placeholders += ")"
          }
          const [s, b] = opts.onRecordUpdate(
            placeholders,
            segment.alias,
            generateColumns(keys, opts.onIdentifier, withoutTransform),
            values,
            typeof segment.returningIdentifier === "string"
              ? [segment.returningIdentifier, []]
              : segment.returningIdentifier
              ? this.compile(segment.returningIdentifier, withoutTransform, placeholder)
              : undefined
          )
          sql += s
          binds.push.apply(binds, b as any)
          break
        }

        case "Custom": {
          const [s, b] = opts.onCustom(segment, placeholder, withoutTransform)
          sql += s
          binds.push.apply(binds, b as any)
          break
        }
      }
    }

    const result = [sql, binds] as const
    if (placeholderOverride !== undefined) {
      return result
    }
    return (statement as any)[cacheSymbol] = result
  },

  get withoutTransform() {
    const self = Object.create(CompilerProto)
    Object.assign(self, this, {
      disableTransforms: true
    })
    return self
  }
}

/**
 * @category compiler
 * @since 4.0.0
 */
export const makeCompilerSqlite = (transform?: ((_: string) => string) | undefined): Compiler =>
  makeCompiler({
    dialect: "sqlite",
    placeholder(_) {
      return "?"
    },
    onIdentifier: transform ?
      function(value, withoutTransform) {
        return withoutTransform ? escapeSqlite(value) : escapeSqlite(transform(value))
      } :
      escapeSqlite,
    onRecordUpdate() {
      return ["", []]
    },
    onCustom() {
      return ["", []]
    }
  })

/**
 * @since 4.0.0
 */
export function defaultEscape(c: string) {
  const re = new RegExp(c, "g")
  const double = c + c
  const dot = c + "." + c
  return function(str: string): string {
    return c + str.replace(re, double).replace(/\./g, dot) + c
  }
}

/**
 * @since 4.0.0
 */
export const primitiveKind = (value: Primitive): PrimitiveKind => {
  switch (typeof value) {
    case "string":
      return "string"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
    case "bigint":
      return "bigint"
    case "undefined":
      return "null"
  }

  if (value === null) {
    return "null"
  } else if (value instanceof Date) {
    return "Date"
  } else if (value instanceof Uint8Array) {
    return "Uint8Array"
  } else if (value instanceof Int8Array) {
    return "Int8Array"
  }

  return "string"
}

/**
 * @since 4.0.0
 */
export const defaultTransforms = (
  transformer: (str: string) => string,
  nested = true
) => {
  const transformValue = (value: any) => {
    if (Array.isArray(value)) {
      if (value.length === 0 || value[0].constructor !== Object) {
        return value
      }
      return array(value)
    } else if (value?.constructor === Object) {
      return transformObject(value)
    }
    return value
  }

  const transformObject = (obj: Record<string, any>): any => {
    const newObj: Record<string, any> = {}
    for (const key in obj) {
      newObj[transformer(key)] = transformValue(obj[key])
    }
    return newObj
  }

  const transformArrayNested = <A extends object>(
    rows: ReadonlyArray<A>
  ): ReadonlyArray<A> => {
    const newRows: Array<A> = new Array(rows.length)
    for (let i = 0, len = rows.length; i < len; i++) {
      const row = rows[i]
      if (Array.isArray(row)) {
        newRows[i] = transformArrayNested(row) as any
      } else {
        const obj: any = {}
        for (const key in row) {
          obj[transformer(key)] = transformValue(row[key])
        }
        newRows[i] = obj
      }
    }
    return newRows
  }

  const transformArray = <A extends object>(
    rows: ReadonlyArray<A>
  ): ReadonlyArray<A> => {
    const newRows: Array<A> = new Array(rows.length)
    for (let i = 0, len = rows.length; i < len; i++) {
      const row = rows[i]
      if (Array.isArray(row)) {
        newRows[i] = transformArray(row) as any
      } else {
        const obj: any = {}
        for (const key in row) {
          obj[transformer(key)] = row[key]
        }
        newRows[i] = obj
      }
    }
    return newRows
  }

  const array = nested ? transformArrayNested : transformArray

  return {
    value: transformValue,
    object: transformObject,
    array
  } as const
}

// internal

const ATTR_DB_OPERATION_NAME = "db.operation.name"
const ATTR_DB_QUERY_TEXT = "db.query.text"

interface StatementImpl<A> extends Statement<A> {
  readonly segments: ReadonlyArray<Segment>
  readonly acquirer: Acquirer
  readonly compiler: Compiler
  readonly spanAttributes: ReadonlyArray<readonly [string, unknown]>
  readonly transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined

  withConnection<XA, E>(
    operation: string,
    f: (
      connection: Connection,
      sql: string,
      params: ReadonlyArray<Primitive>
    ) => Effect.Effect<XA, E>,
    withoutTransform?: boolean | undefined
  ): Effect.Effect<XA, E | SqlError>
}

const unsafeMake = <A = Row>(
  segments: ReadonlyArray<Segment>,
  acquirer: Acquirer,
  compiler: Compiler,
  spanAttributes: ReadonlyArray<readonly [string, unknown]>,
  transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
): StatementImpl<A> => {
  const self = Object.create(StatementProto)
  self.segments = segments
  self.acquirer = acquirer
  self.compiler = compiler
  self.spanAttributes = spanAttributes
  self.transformRows = transformRows
  return self
}

const StatementProto: Omit<
  StatementImpl<any>,
  "segments" | "acquirer" | "compiler" | "spanAttributes" | "transformRows"
> = {
  ...PipeInspectableProto,
  ...YieldableProto,
  [FragmentTypeId]: FragmentTypeId,
  withConnection<XA, E>(
    this: StatementImpl<any>,
    operation: string,
    f: (
      connection: Connection,
      sql: string,
      params: ReadonlyArray<Primitive>
    ) => Effect.Effect<XA, E>,
    withoutTransform = false
  ): Effect.Effect<XA, E | SqlError> {
    return Effect.useSpan(
      "sql.execute",
      { kind: "client", captureStackTrace: false },
      (span) =>
        withStatement(this, span, (statement) => {
          const [sql, params] = statement.compile(withoutTransform)
          for (const [key, value] of this.spanAttributes) {
            span.attribute(key, value)
          }
          span.attribute(ATTR_DB_OPERATION_NAME, operation)
          span.attribute(ATTR_DB_QUERY_TEXT, sql)
          return Effect.scoped(Effect.flatMap(this.acquirer, (_) => f(_, sql, params)))
        })
    )
  },

  get withoutTransform(): Effect.Effect<ReadonlyArray<any>, SqlError> {
    return this.withConnection(
      "executeWithoutTransform",
      (connection, sql, params) => connection.execute(sql, params, undefined),
      true
    )
  },

  get raw(): Effect.Effect<unknown, SqlError> {
    return this.withConnection(
      "executeRaw",
      (connection, sql, params) => connection.executeRaw(sql, params),
      true
    )
  },

  get stream(): Stream.Stream<any, SqlError> {
    const self = this as StatementImpl<any>
    return Stream.unwrap(Effect.flatMap(
      Effect.makeSpanScoped("sql.execute", { kind: "client", captureStackTrace: false }),
      (span) =>
        withStatement(self, span, (statement) => {
          const [sql, params] = statement.compile()
          for (const [key, value] of self.spanAttributes) {
            span.attribute(key, value)
          }
          span.attribute(ATTR_DB_OPERATION_NAME, "executeStream")
          span.attribute(ATTR_DB_QUERY_TEXT, sql)
          return Effect.map(self.acquirer, (_) => _.executeStream(sql, params, self.transformRows))
        })
    ))
  },

  get values(): Effect.Effect<
    ReadonlyArray<ReadonlyArray<Primitive>>,
    SqlError
  > {
    return this.withConnection("executeValues", (connection, sql, params) => connection.executeValues(sql, params))
  },

  get unprepared(): Effect.Effect<ReadonlyArray<any>, SqlError> {
    const self = this as StatementImpl<any>
    return self.withConnection(
      "executeUnprepared",
      (connection, sql, params) => connection.executeUnprepared(sql, params, self.transformRows)
    )
  },

  compile(
    this: StatementImpl<any>,
    withoutTransform?: boolean | undefined
  ) {
    return this.compiler.compile(this, withoutTransform ?? false)
  },
  asEffect(this: StatementImpl<any>): Effect.Effect<ReadonlyArray<any>, SqlError> {
    return this.withConnection(
      "execute",
      (connection, sql, params) => connection.execute(sql, params, this.transformRows)
    )
  },
  toJSON(this: StatementImpl<any>) {
    const [sql, params] = this.compile()
    return {
      _id: "Statement",
      segments: this.segments,
      sql,
      params
    }
  }
}

const withStatement = <A, X, E, R>(
  self: StatementImpl<A>,
  span: Tracer.Span,
  f: (statement: StatementImpl<A>) => Effect.Effect<X, E, R>
) =>
  Effect.withFiber<X, E, R>((fiber) => {
    const transform = fiber.getRef(CurrentTransformer)
    if (transform === undefined) {
      return f(self)
    }
    return Effect.flatMap(
      transform(
        self,
        make(self.acquirer, self.compiler, self.spanAttributes, self.transformRows),
        fiber,
        span
      ) as Effect.Effect<StatementImpl<A>>,
      f
    )
  })

const isHelper = (u: unknown): u is Helper =>
  hasProperty(u, "_tag") && (
    u._tag === "ArrayHelper" ||
    u._tag === "RecordInsertHelper" ||
    u._tag === "RecordUpdateHelper" ||
    u._tag === "RecordUpdateHelperSingle"
  )

function convertLiteralOrFragment(clause: string | Fragment): Array<Segment> {
  if (typeof clause === "string") {
    return [literal(clause)]
  }
  return clause.segments as Array<Segment>
}

const makePlaceholdersArray = (evaluate: (u: unknown) => string) => (values: ReadonlyArray<unknown>): string => {
  if (values.length === 0) {
    return ""
  }

  let result = evaluate(values[0])
  for (let i = 1; i < values.length; i++) {
    result += `,${evaluate(values[i])}`
  }

  return result
}

const generateColumns = (
  keys: ReadonlyArray<string>,
  escape: (_: string, withoutTransform: boolean) => string,
  withoutTransform: boolean
) => {
  if (keys.length === 0) {
    return "()"
  }

  let str = `(${escape(keys[0], withoutTransform)}`
  for (let i = 1; i < keys.length; i++) {
    str += `,${escape(keys[i], withoutTransform)}`
  }
  return str + ")"
}

const extractPrimitive = (
  value: Primitive | Fragment | undefined,
  onCustom: (
    type: Custom<string, unknown, unknown>,
    placeholder: (u: unknown) => string,
    withoutTransform: boolean
  ) => readonly [sql: string, binds: ReadonlyArray<Primitive>],
  placeholder: (u: unknown) => string,
  withoutTransform: boolean
): Primitive => {
  if (value === undefined) {
    return null
  } else if (isFragment(value)) {
    const head = value.segments[0]
    if (head._tag === "Custom") {
      const compiled = onCustom(head, placeholder, withoutTransform)
      return compiled[1][0] ?? null
    } else if (head._tag === "Parameter") {
      return head.value
    }
    return null
  }
  return value
}

const escapeSqlite = defaultEscape("\"")

function in_(values: ReadonlyArray<Primitive>): ArrayHelper
function in_(column: string, values: ReadonlyArray<Primitive>): Fragment
function in_(): Fragment | ArrayHelper {
  if (arguments.length === 1) {
    return arrayHelper(arguments[0])
  }
  const column = arguments[0]
  const values = arguments[1]
  return values.length === 0 ? neverFragment : fragment([
    identifier(column),
    literal(" IN "),
    arrayHelper(values)
  ])
}

const neverFragment = fragment([literal("1=0")])
