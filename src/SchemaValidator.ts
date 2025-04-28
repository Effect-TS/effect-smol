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
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaResult from "./SchemaResult.js"

/** @internal */
export const runSyncSchemaResult = <A, R>(
  sr: SchemaResult.SchemaResult<A, R>
): Result.Result<A, SchemaIssue.Issue> => {
  if (Result.isResult(sr)) {
    return sr
  }
  const scheduler = new Scheduler.MixedScheduler()
  const fiber = Effect.runFork(sr as Effect.Effect<A, SchemaIssue.Issue>, { scheduler })
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
    return Result.err(new SchemaIssue.ForbiddenIssue(Option.none(), cause.failures.map(String).join("\n")))
  }

  // The effect could not be resolved synchronously, meaning it performs async work
  return Result.err(
    new SchemaIssue.ForbiddenIssue(
      Option.none(),
      "cannot be be resolved synchronously, this is caused by using runSync on an effect that performs async work"
    )
  )
}

const defaultParseOptions: SchemaAST.ParseOptions = {}

/** @internal */
export const fromASTSchemaResult = <A, R>(ast: SchemaAST.AST) => {
  const parser = goMemo<A, R>(ast)
  return (u: unknown, options?: SchemaAST.ParseOptions): SchemaResult.SchemaResult<A, R> => {
    const oinput = Option.some(u)
    const oa = parser(oinput, options ?? defaultParseOptions)
    return Effect.flatMap(oa, (oa) => {
      if (Option.isNone(oa)) {
        return Effect.fail(new SchemaIssue.MismatchIssue(ast, oinput))
      }
      return Effect.succeed(oa.value)
    })
  }
}

const fromASTSync = <A>(ast: SchemaAST.AST) => {
  const parser = fromASTSchemaResult<A, never>(ast)
  return (u: unknown, options?: SchemaAST.ParseOptions): A => {
    return Result.getOrThrow(runSyncSchemaResult(parser(u, options)))
  }
}

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownSchemaResult = <T, E, RD, RE, RI>(codec: Schema.Codec<T, E, RD, RE, RI>) =>
  fromASTSchemaResult<T, RD | RI>(codec.ast)

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknown = <T, E, RD, RE, RI>(codec: Schema.Codec<T, E, RD, RE, RI>) => {
  const parser = decodeUnknownSchemaResult(codec)
  return (u: unknown, options?: SchemaAST.ParseOptions) => {
    return SchemaResult.asEffect(parser(u, options))
  }
}

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownSync = <T, E, RE>(codec: Schema.Codec<T, E, never, RE, never>) => fromASTSync<T>(codec.ast)

/**
 * @category encoding
 * @since 4.0.0
 */
export const encodeUnknownSchemaResult = <T, E, RD, RE, RI>(codec: Schema.Codec<T, E, RD, RE, RI>) =>
  fromASTSchemaResult<E, RE | RI>(SchemaAST.flip(codec.ast))

/**
 * @category encoding
 * @since 4.0.0
 */
export const encodeUnknown = <T, E, RD, RE, RI>(codec: Schema.Codec<T, E, RD, RE, RI>) => {
  const parser = encodeUnknownSchemaResult(codec)
  return (u: unknown, options?: SchemaAST.ParseOptions) => {
    return SchemaResult.asEffect(parser(u, options))
  }
}

/**
 * @category encoding
 * @since 4.0.0
 */
export const encodeUnknownSync = <T, E, RD>(codec: Schema.Codec<T, E, RD, never, never>) =>
  fromASTSync<E>(SchemaAST.flip(codec.ast))

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownParserResult = <T, E, RD, RE, RI>(codec: Schema.Codec<T, E, RD, RE, RI>) =>
  fromASTSchemaResult<T, RI>(SchemaAST.typeAST(codec.ast))

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownSync = <T, E, RD, RE>(codec: Schema.Codec<T, E, RD, RE, never>) =>
  fromASTSync<T>(SchemaAST.typeAST(codec.ast))

interface Parser<A, R = any> {
  (i: Option.Option<unknown>, options: SchemaAST.ParseOptions): Effect.Effect<Option.Option<A>, SchemaIssue.Issue, R>
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

    let srou: SchemaResult.SchemaResult<Option.Option<unknown>, unknown> = SchemaResult.succeed(ou)
    if (encoding) {
      const links = encoding.links
      const len = links.length
      for (let i = len - 1; i >= 0; i--) {
        const link = links[i]
        const to = link.to
        if (i === len - 1 || to.modifiers || to !== SchemaAST.typeAST(to)) {
          const parser = goMemo<unknown, any>(to)
          srou = SchemaResult.flatMap(srou, (ou) => parser(ou, options))
        }
        const parser = link.transformation.decode
        srou = SchemaResult.flatMap(
          srou,
          (ou) =>
            SchemaResult.mapError(parser.run(ou, ast, options), (e) => new SchemaIssue.TransformationIssue(parser, e))
        )
      }
      srou = SchemaResult.mapError(
        srou,
        (e) => new SchemaIssue.CompositeIssue(ast, ou, [e])
      )
    }

    let sroa = SchemaResult.flatMap(srou, (ou) => go<A>(ast)(ou, options))

    if (ast.modifiers) {
      const issues: Array<SchemaIssue.Issue> = []
      let bail = false
      for (const m of ast.modifiers) {
        if (m._tag === "Filter") {
          sroa = SchemaResult.asEffect(sroa).pipe(Effect.flatMap((oa) => {
            if (bail && Arr.isNonEmptyArray(issues)) {
              return Effect.fail(new SchemaIssue.CompositeIssue(ast, ou, issues))
            }
            return Effect.gen(function*() {
              if (Option.isSome(oa)) {
                const res = m.run(oa.value, ast, options)
                const iu = Effect.isEffect(res) ? yield* res : res
                if (iu) {
                  bail = m.bail
                  issues.push(new SchemaIssue.FilterIssue(m, iu, m.bail))
                }
              }
              return oa
            })
          }))
        } else {
          sroa = SchemaResult.mapError(
            m.decode.run(sroa, ast, options),
            (e) => new SchemaIssue.MiddlewareIssue(m.decode, e)
          )
        }
      }
      sroa = SchemaResult.asEffect(sroa).pipe(
        Effect.flatMap((oa) => {
          if (Arr.isNonEmptyArray(issues)) {
            return Effect.fail(new SchemaIssue.CompositeIssue(ast, ou, issues))
          }
          return Effect.succeed(oa)
        })
      )
    }

    return yield* (Result.isResult(sroa) ? Effect.fromResult(sroa) : sroa)
  })

  memoMap.set(ast, parser)

  return parser
}

function go<A>(ast: SchemaAST.AST): Parser<A, any> {
  switch (ast._tag) {
    case "Declaration": {
      return Effect.fnUntraced(function*(oinput, options) {
        if (Option.isNone(oinput)) {
          return Option.none()
        }
        const parser = ast.run(ast.typeParameters)
        const sr = parser(oinput.value, ast, options)
        if (Result.isResult(sr)) {
          if (Result.isErr(sr)) {
            return yield* Effect.fail(sr.err)
          }
          return Option.some(sr.ok)
        } else {
          return Option.some(yield* sr)
        }
      })
    }
    case "LiteralType":
      return fromPredicate(ast, (u) => u === ast.literal)
    case "NeverKeyword":
      return fromPredicate(ast, Predicate.isNever)
    case "AnyKeyword":
    case "UnknownKeyword":
    case "VoidKeyword":
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
    case "BigIntKeyword":
      return fromPredicate(ast, Predicate.isBigInt)
    case "UniqueSymbol":
      return fromPredicate(ast, (u) => u === ast.symbol)
    case "ObjectKeyword":
      return fromPredicate(ast, Predicate.isObject)
    case "TypeLiteral": {
      // Handle empty Struct({}) case
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        return fromPredicate(ast, Predicate.isNotNullable)
      }
      const getOwnKeys = ownKeys // TODO: can be optimized?
      return Effect.fnUntraced(function*(oinput, options) {
        if (Option.isNone(oinput)) {
          return Option.none()
        }
        const input = oinput.value

        // If the input is not a record, return early with an error
        if (!Predicate.isRecord(input)) {
          return yield* Effect.fail(new SchemaIssue.MismatchIssue(ast, oinput))
        }

        const output: Record<PropertyKey, unknown> = {}
        const issues: Array<SchemaIssue.Issue> = []
        const errorsAllOption = options?.errors === "all"
        const keys = getOwnKeys(input)

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
            const issue = new SchemaIssue.PointerIssue([name], r.err)
            if (errorsAllOption) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(
                new SchemaIssue.CompositeIssue(ast, oinput, [issue])
              )
            }
          } else {
            if (Option.isSome(r.ok)) {
              output[name] = r.ok.value
            } else {
              if (!ps.type.context?.isOptional) {
                const issue = new SchemaIssue.PointerIssue([name], SchemaIssue.MissingIssue.instance)
                if (errorsAllOption) {
                  issues.push(issue)
                  continue
                } else {
                  return yield* Effect.fail(
                    new SchemaIssue.CompositeIssue(ast, oinput, [issue])
                  )
                }
              }
            }
          }
        }

        for (const is of ast.indexSignatures) {
          for (const key of keys) {
            const parserKey = goMemo(is.parameter)
            const rKey = (yield* Effect.result(parserKey(Option.some(key), options))) as Result.Result<
              Option.Option<PropertyKey>,
              SchemaIssue.Issue
            >
            if (Result.isErr(rKey)) {
              const issue = new SchemaIssue.PointerIssue([key], rKey.err)
              if (errorsAllOption) {
                issues.push(issue)
                continue
              } else {
                return yield* Effect.fail(
                  new SchemaIssue.CompositeIssue(ast, oinput, [issue])
                )
              }
            }

            const value: Option.Option<unknown> = Option.some(input[key])
            const parserValue = goMemo(is.type)
            const rValue = yield* Effect.result(parserValue(value, options))
            if (Result.isErr(rValue)) {
              const issue = new SchemaIssue.PointerIssue([key], rValue.err)
              if (errorsAllOption) {
                issues.push(issue)
                continue
              } else {
                return yield* Effect.fail(
                  new SchemaIssue.CompositeIssue(ast, oinput, [issue])
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
          return yield* Effect.fail(new SchemaIssue.CompositeIssue(ast, oinput, issues))
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
          return yield* Effect.fail(new SchemaIssue.MismatchIssue(ast, oinput))
        }

        const output: Array<unknown> = []
        const issues: Array<SchemaIssue.Issue> = []
        const errorsAllOption = options?.errors === "all"

        let i = 0
        for (; i < ast.elements.length; i++) {
          const element = ast.elements[i]
          const value = i < input.length ? Option.some(input[i]) : Option.none()
          const parser = goMemo(element)
          const r = yield* Effect.result(parser(value, options))
          if (Result.isErr(r)) {
            const issue = new SchemaIssue.PointerIssue([i], r.err)
            if (errorsAllOption) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(new SchemaIssue.CompositeIssue(ast, oinput, [issue]))
            }
          } else {
            if (Option.isSome(r.ok)) {
              output[i] = r.ok.value
            } else {
              if (!element.context?.isOptional) {
                const issue = new SchemaIssue.PointerIssue([i], SchemaIssue.MissingIssue.instance)
                if (errorsAllOption) {
                  issues.push(issue)
                  continue
                } else {
                  return yield* Effect.fail(new SchemaIssue.CompositeIssue(ast, oinput, [issue]))
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
              const issue = new SchemaIssue.PointerIssue([i], r.err)
              if (errorsAllOption) {
                issues.push(issue)
                continue
              } else {
                return yield* Effect.fail(new SchemaIssue.CompositeIssue(ast, oinput, [issue]))
              }
            } else {
              if (Option.isSome(r.ok)) {
                output[i] = r.ok.value
              } else {
                const issue = new SchemaIssue.PointerIssue([i], SchemaIssue.MissingIssue.instance)
                if (errorsAllOption) {
                  issues.push(issue)
                  continue
                } else {
                  return yield* Effect.fail(new SchemaIssue.CompositeIssue(ast, oinput, [issue]))
                }
              }
            }
          }
        }
        if (Arr.isNonEmptyArray(issues)) {
          return yield* Effect.fail(new SchemaIssue.CompositeIssue(ast, oinput, issues))
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
        const issues: Array<SchemaIssue.Issue> = []

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
            return yield* Effect.fail(new SchemaIssue.CompositeIssue(ast, oinput, issues))
          }
        } else {
          return yield* Effect.fail(new SchemaIssue.MismatchIssue(ast, oinput))
        }
      })
    }
    case "Suspend":
      return goMemo<A, any>(ast.thunk())
  }
  ast satisfies never // TODO: remove this
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
    case "VoidKeyword":
      return "undefined"
    case "StringKeyword":
      return "string"
    case "NumberKeyword":
      return "number"
    case "BooleanKeyword":
      return "boolean"
    case "SymbolKeyword":
    case "UniqueSymbol":
      return "symbol"
    case "BigIntKeyword":
      return "bigint"
    case "TypeLiteral":
    case "ObjectKeyword":
      return ["object", "array"]
    case "TupleType":
      return "array"
    case "Declaration":
    case "LiteralType":
    case "NeverKeyword":
    case "AnyKeyword":
    case "UnknownKeyword":
    case "UnionType":
    case "Suspend":
      return null
  }
  ast satisfies never // TODO: remove this
})

function getCandidates(input: unknown, types: ReadonlyArray<SchemaAST.AST>): ReadonlyArray<SchemaAST.AST> {
  const type = getInputType(input)
  if (type) {
    return types.filter((ast) => {
      const types = getCandidateTypes(SchemaAST.encodedAST(ast))
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
  return predicate(u) ? Effect.succeed(Option.some(u as A)) : Effect.fail(new SchemaIssue.MismatchIssue(ast, oinput))
}
