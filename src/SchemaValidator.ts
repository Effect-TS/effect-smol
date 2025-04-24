/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import { ownKeys } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import * as Result from "./Result.js"
import * as Scheduler from "./Scheduler.js"
import type * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"
import type * as SchemaParserResult from "./SchemaParserResult.js"

const defaultParseOptions: SchemaAST.ParseOptions = {}

const fromAST = <A, R>(ast: SchemaAST.AST) => {
  const parser = goMemo<A, R>(ast)
  return (u: unknown, options?: SchemaAST.ParseOptions): SchemaParserResult.SchemaParserResult<A, R> => {
    const oinput = Option.some(u)
    const oa = parser(oinput, options ?? defaultParseOptions)
    return Effect.flatMap(oa, (oa) => {
      if (Option.isNone(oa)) {
        return Effect.fail(new SchemaAST.MismatchIssue(ast, oinput))
      }
      return Effect.succeed(oa.value)
    })
  }
}

/**
 * @since 4.0.0
 */
export const runSyncResult = <A, R>(
  spr: SchemaParserResult.SchemaParserResult<A, R>
): Result.Result<A, SchemaAST.Issue> => {
  if (Result.isResult(spr)) {
    return spr
  }
  const scheduler = new Scheduler.MixedScheduler()
  const fiber = Effect.runFork(spr as Effect.Effect<A, SchemaAST.Issue>, { scheduler })
  scheduler.flush()
  const exit = fiber.unsafePoll()

  if (exit) {
    if (Exit.isSuccess(exit)) {
      // If the effect successfully resolves, wrap the value in an Ok
      return Result.ok(exit.value)
    }
    const cause = exit.cause
    if (cause.failures.length === 1) {
      const failure = cause.failures[0]
      if (failure._tag === "Fail") {
        // The effect executed synchronously but failed due to an `Issue`
        return Result.err(failure.error)
      }
    }
    // The effect executed synchronously but failed due to a defect (e.g., a missing dependency)
    return Result.err(new SchemaAST.ForbiddenIssue(Option.none(), cause.failures.map(String).join("\n")))
  }

  // The effect could not be resolved synchronously, meaning it performs async work
  return Result.err(
    new SchemaAST.ForbiddenIssue(
      Option.none(),
      "cannot be be resolved synchronously, this is caused by using runSync on an effect that performs async work"
    )
  )
}

const fromASTSync = <A>(ast: SchemaAST.AST) => {
  const parser = fromAST<A, never>(ast)
  return (u: unknown, options?: SchemaAST.ParseOptions): A => {
    return Result.getOrThrow(runSyncResult(parser(u, options)))
  }
}

/**
 * @category encoding
 * @since 4.0.0
 */
export const encodeUnknownSchemaParserResult = <A, I, RD, RE, RI>(schema: Schema.Codec<A, I, RD, RE, RI>) =>
  fromAST<I, RE | RI>(SchemaAST.flip(schema.ast))

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownSchemaParserResult = <A, I, RD, RE, RI>(schema: Schema.Codec<A, I, RD, RE, RI>) =>
  fromAST<A, RD | RI>(schema.ast)

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownSync = <A, I, RE, RI>(schema: Schema.Codec<A, I, never, RE, RI>) => fromASTSync<A>(schema.ast)

/**
 * @category encoding
 * @since 4.0.0
 */
export const encodeUnknownSync = <A, I, RD, RI>(schema: Schema.Codec<A, I, RD, never, RI>) =>
  fromASTSync<I>(SchemaAST.flip(schema.ast))

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownParserResult = <A, I, RD, RE, RI>(schema: Schema.Codec<A, I, RD, RE, RI>) =>
  fromAST<A, RI>(SchemaAST.typeAST(schema.ast))

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownSync = <A, I, RD, RE>(schema: Schema.Codec<A, I, RD, RE, never>) =>
  fromASTSync<A>(SchemaAST.typeAST(schema.ast))

interface Parser<A, R = any> {
  (i: Option.Option<unknown>, options: SchemaAST.ParseOptions): Effect.Effect<Option.Option<A>, SchemaAST.Issue, R>
}

const memoMap = new WeakMap<SchemaAST.AST, Parser<any>>()

function goMemo<A, R>(ast: SchemaAST.AST): Parser<A, R> {
  const memo = memoMap.get(ast)
  if (memo) {
    return memo
  }
  const parser: Parser<A, R> = Effect.fnUntraced(function*(ou, options) {
    const encoding = options?.variant === "make" && ast.context && ast.context.constructorDefault
      ? new SchemaAST.Encoding([new SchemaAST.Link(ast.context.constructorDefault, SchemaAST.unknownKeyword)])
      : ast.encoding

    if (encoding) {
      const len = encoding.links.length
      for (let i = len - 1; i >= 0; i--) {
        const link = encoding.links[i]
        const to = link.to
        if (i === len - 1 || to.filters || to !== SchemaAST.typeAST(to)) {
          ou = yield* goMemo<A, any>(to)(ou, options)
        }
        const parser = link.transformation.decode
        const spr = parser.parse(ou, options)
        const r = Result.isResult(spr) ? spr : yield* Effect.result(spr)
        if (Result.isErr(r)) {
          return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, ou, [new SchemaAST.EncodingIssue(r.err)]))
        }
        ou = r.ok
      }
    }

    let oa = yield* go<A>(ast)(ou, options)

    if (ast.filters) {
      if (Option.isSome(oa)) {
        const a = oa.value

        const issues: Array<SchemaAST.Issue> = []
        for (const filter of ast.filters) {
          const res = filter.filter(a, options)
          const iu = Effect.isEffect(res) ? yield* res : res
          if (iu) {
            const issue = new SchemaAST.FilterIssue(filter, iu)
            if (!filter.isTerminal) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, oa, [issue]))
            }
          }
        }
        if (Arr.isNonEmptyArray(issues)) {
          return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, oa, issues))
        }

        oa = Option.some(a)
      }
    }

    return oa
  })

  memoMap.set(ast, parser)

  return parser
}

function go<A>(ast: SchemaAST.AST): Parser<A> {
  switch (ast._tag) {
    case "Declaration": {
      return Effect.fnUntraced(function*(oinput, options) {
        if (Option.isNone(oinput)) {
          return Option.none()
        }
        const parser = ast.parser(ast.typeParameters)
        const spr = parser(oinput.value, ast, options)
        if (Result.isResult(spr)) {
          if (Result.isErr(spr)) {
            return yield* Effect.fail(spr.err)
          }
          return Option.some(spr.ok)
        } else {
          return Option.some(yield* spr)
        }
      })
    }
    case "LiteralType":
      return fromPredicate(ast, (u) => u === ast.literal)
    case "NeverKeyword":
      return fromPredicate(ast, Predicate.isNever)
    case "UnknownKeyword":
      return fromPredicate(ast, Predicate.isUnknown)
    case "NullKeyword":
      return fromPredicate(ast, Predicate.isNull)
    case "UndefinedKeyword":
      return fromPredicate(ast, Predicate.isUndefined)
    case "StringKeyword":
      return fromPredicate(ast, Predicate.isString)
    case "NumberKeyword":
      return fromPredicate(ast, Predicate.isNumber)
    case "BooleanKeyword":
      return fromPredicate(ast, Predicate.isBoolean)
    case "SymbolKeyword":
      return fromPredicate(ast, Predicate.isSymbol)
    case "TypeLiteral": {
      // Handle empty Struct({}) case
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        return fromPredicate(ast, Predicate.isNotNullable)
      }
      const hasSymbolKeys = false // TODO: Implement this
      const getOwnKeys = hasSymbolKeys ? ownKeys : Object.keys
      return Effect.fnUntraced(function*(oinput, options) {
        if (Option.isNone(oinput)) {
          return Option.none()
        }
        const input = oinput.value

        // If the input is not a record, return early with an error
        if (!Predicate.isRecord(input)) {
          return yield* Effect.fail(new SchemaAST.MismatchIssue(ast, oinput))
        }

        const output: Record<PropertyKey, unknown> = {}
        const issues: Array<SchemaAST.Issue> = []
        const errorsAllOption = options?.errors === "all"

        for (const ps of ast.propertySignatures) {
          const name = ps.name
          const type = ps.type
          let value: Option.Option<unknown> = Option.none()
          if (Object.prototype.hasOwnProperty.call(input, name)) {
            value = Option.some(input[name])
          }
          const parser = goMemo(type)
          const r = yield* Effect.result(parser(value, options))
          if (Result.isErr(r)) {
            const issue = new SchemaAST.PointerIssue([name], r.err)
            if (errorsAllOption) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(
                new SchemaAST.CompositeIssue(ast, oinput, [issue])
              )
            }
          } else {
            if (Option.isSome(r.ok)) {
              output[name] = r.ok.value
            } else {
              if (!ps.type.context?.isOptional) {
                const issue = new SchemaAST.PointerIssue([name], SchemaAST.MissingIssue.instance)
                if (errorsAllOption) {
                  issues.push(issue)
                  continue
                } else {
                  return yield* Effect.fail(
                    new SchemaAST.CompositeIssue(ast, oinput, [issue])
                  )
                }
              }
            }
          }
        }

        for (const is of ast.indexSignatures) {
          const keys = getOwnKeys(input)
          for (const key of keys) {
            const parserKey = goMemo(is.parameter)
            const rKey = (yield* Effect.result(parserKey(Option.some(key), options))) as Result.Result<
              Option.Option<PropertyKey>,
              SchemaAST.Issue
            >
            if (Result.isErr(rKey)) {
              const issue = new SchemaAST.PointerIssue([key], rKey.err)
              if (errorsAllOption) {
                issues.push(issue)
                continue
              } else {
                return yield* Effect.fail(
                  new SchemaAST.CompositeIssue(ast, oinput, [issue])
                )
              }
            }

            const value: Option.Option<unknown> = Option.some(input[key])
            const parserValue = goMemo(is.type)
            const rValue = yield* Effect.result(parserValue(value, options))
            if (Result.isErr(rValue)) {
              const issue = new SchemaAST.PointerIssue([key], rValue.err)
              if (errorsAllOption) {
                issues.push(issue)
                continue
              } else {
                return yield* Effect.fail(
                  new SchemaAST.CompositeIssue(ast, oinput, [issue])
                )
              }
            } else {
              if (Option.isSome(rKey.ok) && Option.isSome(rValue.ok)) {
                const k2 = rKey.ok.value
                const v2 = rValue.ok.value
                if (is.merge && is.merge.decode && Object.prototype.hasOwnProperty.call(output, k2)) {
                  const [k, v] = is.merge.decode([k2, output[k2]], [k2, v2])
                  output[k] = v
                } else {
                  output[k2] = v2
                }
              }
            }
          }
        }

        if (Arr.isNonEmptyArray(issues)) {
          return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, oinput, issues))
        }
        return Option.some(output as A)
      })
    }
    case "TupleType": {
      return Effect.fnUntraced(function*(oinput, options) {
        if (Option.isNone(oinput)) {
          return Option.none()
        }
        const input = oinput.value

        // If the input is not an array, return early with an error
        if (!Arr.isArray(input)) {
          return yield* Effect.fail(new SchemaAST.MismatchIssue(ast, oinput))
        }

        const output: Array<unknown> = []
        const issues: Array<SchemaAST.Issue> = []
        const errorsAllOption = options?.errors === "all"

        let i = 0
        for (; i < ast.elements.length; i++) {
          const element = ast.elements[i]
          const value = i < input.length ? Option.some(input[i]) : Option.none()
          const parser = goMemo(element)
          const r = yield* Effect.result(parser(value, options))
          if (Result.isErr(r)) {
            const issue = new SchemaAST.PointerIssue([i], r.err)
            if (errorsAllOption) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, oinput, [issue]))
            }
          } else {
            if (Option.isSome(r.ok)) {
              output[i] = r.ok.value
            } else {
              if (!element.context?.isOptional) {
                const issue = new SchemaAST.PointerIssue([i], SchemaAST.MissingIssue.instance)
                if (errorsAllOption) {
                  issues.push(issue)
                  continue
                } else {
                  return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, oinput, [issue]))
                }
              }
            }
          }
        }
        const len = input.length
        if (Arr.isNonEmptyReadonlyArray(ast.rest)) {
          const [head, ...tail] = ast.rest
          const parser = goMemo(head)
          for (; i < len - tail.length; i++) {
            const r = yield* Effect.result(parser(Option.some(input[i]), options))
            if (Result.isErr(r)) {
              const issue = new SchemaAST.PointerIssue([i], r.err)
              if (errorsAllOption) {
                issues.push(issue)
                continue
              } else {
                return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, oinput, [issue]))
              }
            } else {
              if (Option.isSome(r.ok)) {
                output[i] = r.ok.value
              } else {
                const issue = new SchemaAST.PointerIssue([i], SchemaAST.MissingIssue.instance)
                if (errorsAllOption) {
                  issues.push(issue)
                  continue
                } else {
                  return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, oinput, [issue]))
                }
              }
            }
          }
        }
        if (Arr.isNonEmptyArray(issues)) {
          return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, oinput, issues))
        }
        return Option.some(output as A)
      })
    }
    case "UnionType": {
      return Effect.fnUntraced(function*(oinput, options) {
        if (Option.isNone(oinput)) {
          return Option.none()
        }
        const input = oinput.value

        const candidates = getCandidates(input, ast.types)
        const issues: Array<SchemaAST.Issue> = []

        for (const candidate of candidates) {
          const parser = goMemo<A, any>(candidate)
          const r = yield* Effect.result(parser(Option.some(input), options))
          if (Result.isErr(r)) {
            issues.push(r.err)
            continue
          } else {
            return r.ok
          }
        }

        if (Arr.isNonEmptyArray(issues)) {
          if (candidates.length === 1) {
            return yield* Effect.fail(issues[0])
          } else {
            return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, oinput, issues))
          }
        } else {
          return yield* Effect.fail(new SchemaAST.MismatchIssue(ast, oinput))
        }
      })
    }
    case "Suspend":
      return goMemo<A, any>(ast.thunk())
  }
}

type Type =
  | "null"
  | "array"
  | "object"
  | "string"
  | "number"
  | "boolean"
  | "symbol"
  | "undefined"
  | "bigint"
  | "function"

function getInputType(input: unknown): Type {
  if (input === null) {
    return "null"
  }
  if (Array.isArray(input)) {
    return "array"
  }
  return typeof input
}

const getCandidateTypes = SchemaAST.memoize((ast: SchemaAST.AST): ReadonlyArray<Type> | Type | null => {
  switch (ast._tag) {
    case "NullKeyword":
      return "null"
    case "UndefinedKeyword":
      return "undefined"
    case "StringKeyword":
      return "string"
    case "NumberKeyword":
      return "number"
    case "BooleanKeyword":
      return "boolean"
    case "SymbolKeyword":
      return "symbol"
    case "TypeLiteral":
      return "object"
    case "TupleType":
      return "array"
    case "Declaration":
    case "LiteralType":
    case "NeverKeyword":
    case "UnknownKeyword":
    case "UnionType":
    case "Suspend":
      return null
  }
})

function getCandidates(input: unknown, types: ReadonlyArray<SchemaAST.AST>): ReadonlyArray<SchemaAST.AST> {
  const type = getInputType(input)
  if (type) {
    return types.filter((ast) => {
      const types = getCandidateTypes(ast)
      return types === null || types === type || types.includes(type)
    })
  }
  return types
}

const fromPredicate = <A>(ast: SchemaAST.AST, predicate: (u: unknown) => boolean): Parser<A> => (oinput) => {
  if (Option.isNone(oinput)) {
    return Effect.succeedNone
  }
  const u = oinput.value
  return predicate(u) ? Effect.succeed(Option.some(u as A)) : Effect.fail(new SchemaAST.MismatchIssue(ast, oinput))
}
