/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import * as Result from "./Result.js"
import * as Scheduler from "./Scheduler.js"
import type * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"
import type * as SchemaParserResult from "./SchemaParserResult.js"

const defaultParseOptions: SchemaAST.ParseOptions = {}

const mergeParseOptions = (
  options: SchemaAST.ParseOptions | undefined,
  overrideOptions: SchemaAST.ParseOptions | undefined
): SchemaAST.ParseOptions => {
  if (!Predicate.isObject(overrideOptions)) {
    return options ?? defaultParseOptions
  }
  if (options === undefined) {
    return overrideOptions ?? defaultParseOptions
  }
  return { ...options, ...overrideOptions }
}

const fromAST = <A, R>(
  ast: SchemaAST.AST,
  options?: SchemaAST.ParseOptions
) => {
  const parser = goMemo<A, R>(ast)
  return (u: unknown, overrideOptions?: SchemaAST.ParseOptions): SchemaParserResult.SchemaParserResult<A, R> => {
    const oa = parser(Option.some(u), mergeParseOptions(options, overrideOptions))
    return Effect.flatMap(oa, (oa) => {
      if (Option.isNone(oa)) {
        return Effect.fail(new SchemaAST.MismatchIssue(ast, u))
      }
      return Effect.succeed(oa.value)
    })
  }
}

const runSyncResult = <A>(
  ast: SchemaAST.AST,
  actual: unknown,
  self: Effect.Effect<A, SchemaAST.Issue>
): Result.Result<A, SchemaAST.Issue> => {
  const scheduler = new Scheduler.MixedScheduler()
  const fiber = Effect.runFork(self as Effect.Effect<A, SchemaAST.Issue>, { scheduler })
  scheduler.flush()
  const exit = fiber.unsafePoll()

  if (exit) {
    if (Exit.isSuccess(exit)) {
      // If the effect successfully resolves, wrap the value in a Right
      return Result.ok(exit.value)
    }
    const cause = exit.cause
    if (cause.failures.length === 1) {
      const failure = cause.failures[0]
      if (failure._tag === "Fail") {
        // The effect executed synchronously but failed due to a ParseIssue
        return Result.err(failure.error)
      }
    }
    // The effect executed synchronously but failed due to a defect (e.g., a missing dependency)
    return Result.err(new SchemaAST.ForbiddenIssue(ast, actual, cause.failures.map(String).join("\n")))
  }

  // The effect could not be resolved synchronously, meaning it performs async work
  return Result.err(
    new SchemaAST.ForbiddenIssue(
      ast,
      actual,
      "cannot be be resolved synchronously, this is caused by using runSync on an effect that performs async work"
    )
  )
}

const fromASTSync = <A>(
  ast: SchemaAST.AST,
  options?: SchemaAST.ParseOptions
) => {
  const parser = fromAST<A, never>(ast, options)
  return (u: unknown, overrideOptions?: SchemaAST.ParseOptions): A => {
    const out = parser(u, overrideOptions)
    const res = Result.isResult(out) ? out : runSyncResult(ast, u, out)
    return Result.getOrThrow(res)
  }
}

/**
 * @category encoding
 * @since 4.0.0
 */
export const encodeUnknownParserResult = <A, I, RD, RE, RI>(
  schema: Schema.Codec<A, I, RD, RE, RI>,
  options?: SchemaAST.ParseOptions
) => fromAST<I, RE | RI>(SchemaAST.flip(schema.ast), options)

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownParserResult = <A, I, RD, RE, RI>(
  schema: Schema.Codec<A, I, RD, RE, RI>,
  options?: SchemaAST.ParseOptions
) => fromAST<A, RD | RI>(schema.ast, options)

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownSync = <A, I, RE>(
  schema: Schema.Codec<A, I, never, RE, never>,
  options?: SchemaAST.ParseOptions
) => fromASTSync<A>(schema.ast, options)

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownParserResult = <A, I, RD, RE, RI>(
  schema: Schema.Codec<A, I, RD, RE, RI>,
  options?: SchemaAST.ParseOptions
) => fromAST<A, RI>(SchemaAST.typeAST(schema.ast), options)

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownSync = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE, never>,
  options?: SchemaAST.ParseOptions
) => fromASTSync<A>(SchemaAST.typeAST(schema.ast), options)

interface Parser<A, R = any> {
  (
    i: Option.Option<unknown>,
    options: SchemaAST.ParseOptions
  ): Effect.Effect<Option.Option<A>, SchemaAST.Issue, R>
}

function handleModifiers<A>(parser: Parser<A>, ast: SchemaAST.AST): Parser<A> {
  if (ast.modifiers.length === 0) {
    return parser
  }
  return Effect.fnUntraced(function*(input, options) {
    const oa = yield* parser(input, options)
    if (Option.isNone(oa)) {
      return oa
    }
    let a = oa.value
    for (const modifier of ast.modifiers) {
      switch (modifier._tag) {
        case "Refinement": {
          const issue = modifier.filter(a, options)
          if (issue !== undefined) {
            return yield* Effect.fail(
              new SchemaAST.CompositeIssue(
                ast,
                input,
                [new SchemaAST.RefinementIssue(modifier, issue)],
                Option.some(a)
              )
            )
          }
          break
        }
        case "Ctor": {
          const r = modifier.decode(a)
          if (Result.isErr(r)) {
            return yield* Effect.fail(new SchemaAST.MismatchIssue(ast, a))
          }
          a = r.ok
          break
        }
      }
    }
    return Option.some(a)
  })
}

function handleEncoding<A>(parser: Parser<A>, ast: SchemaAST.AST): Parser<A> {
  const encoding = ast.encoding
  if (encoding === undefined) {
    return parser
  }
  return Effect.fnUntraced(function*(input, options) {
    let i = encoding.transformations.length - 1
    const from = goMemo<A, any>(encoding.to)
    let oa = yield* from(input, options)
    for (; i >= 0; i--) {
      const wrapper = encoding.transformations[i]
      switch (wrapper._tag) {
        case "EncodeWrapper": {
          if (Option.isNone(oa)) {
            break
          }
          const parser = wrapper.transformation.decode
          const spr = parser(oa.value, options)
          const r = Result.isResult(spr) ? spr : yield* Effect.result(spr)
          if (Result.isErr(r)) {
            return yield* Effect.fail(
              new SchemaAST.CompositeIssue(ast, i, [new SchemaAST.EncodingIssue(encoding, r.err)], oa)
            )
          }
          oa = Option.some(r.ok)
          break
        }
        case "ContextWrapper": {
          const parser = wrapper.transformation.decode
          const spr = parser(oa, options)
          const r = Result.isResult(spr) ? spr : yield* Effect.result(spr)
          if (Result.isErr(r)) {
            return yield* Effect.fail(
              new SchemaAST.CompositeIssue(ast, i, [new SchemaAST.EncodingIssue(encoding, r.err)], oa)
            )
          }
          oa = r.ok
          if (Option.isNone(oa) && !wrapper.isOptional) {
            return yield* Effect.fail(new SchemaAST.InvalidIssue(oa))
          }
          break
        }
        default:
          wrapper satisfies never // TODO: remove this
      }
    }
    return yield* parser(oa, options)
  })
}

const memoMap = new WeakMap<SchemaAST.AST, Parser<any>>()

function goMemo<A, R>(ast: SchemaAST.AST): Parser<A, R> {
  const memo = memoMap.get(ast)
  if (memo) {
    return memo
  }
  const unmodified = go<A>(ast)
  const modified = handleModifiers(unmodified, ast)
  const out = handleEncoding(modified, ast)
  memoMap.set(ast, out)
  return out
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
    case "Literal":
      return fromPredicate(ast, (u) => u === ast.literal)
    case "NeverKeyword":
      return fromPredicate(ast, Predicate.isNever)
    case "StringKeyword":
      return fromPredicate(ast, Predicate.isString)
    case "NumberKeyword":
      return fromPredicate(ast, Predicate.isNumber)
    case "TypeLiteral": {
      // Handle empty Struct({}) case
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        return fromPredicate(ast, Predicate.isNotNullable)
      }
      return Effect.fnUntraced(function*(oinput, options) {
        if (Option.isNone(oinput)) {
          return Option.none()
        }
        const input = oinput.value
        // If the input is not a record, return early with an error
        if (!Predicate.isRecord(input)) {
          return yield* Effect.fail(new SchemaAST.MismatchIssue(ast, input))
        }
        const output: Record<PropertyKey, unknown> = {}
        const issues: Array<SchemaAST.Issue> = []
        const allErrors = options?.errors === "all"
        for (const ps of ast.propertySignatures) {
          const name = ps.name
          const type = ps.type
          const encodedKey = type.context?.encodedKey ?? name
          let value: Option.Option<unknown> = Option.none()
          if (Object.prototype.hasOwnProperty.call(input, encodedKey)) {
            value = Option.some(input[encodedKey])
          } else if (type.context !== undefined && type.context.defaults !== undefined) {
            const defaultValue = type.context.defaults.decode
            if (Option.isSome(defaultValue)) {
              const dv = defaultValue.value
              value = Option.some(
                Effect.isEffect(dv) ? yield* dv : dv()
              )
            }
          }
          const parser = goMemo(type)
          const r = yield* Effect.result(parser(value, options))
          if (Result.isErr(r)) {
            const issue = new SchemaAST.PointerIssue([name], r.err)
            if (allErrors) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
            }
          } else {
            if (Option.isSome(r.ok)) {
              output[name] = r.ok.value
            } else {
              if (!ps.isOptional) {
                const issue = new SchemaAST.PointerIssue([name], SchemaAST.MissingPropertyKeyIssue.instance)
                if (allErrors) {
                  issues.push(issue)
                  continue
                } else {
                  return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
                }
              }
            }
          }
        }
        if (Arr.isNonEmptyArray(issues)) {
          return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, input, issues, Option.some(output)))
        }
        return Option.some(output as A)
      })
    }
    case "TupleType": {
      return Effect.fnUntraced(function*(o, options) {
        if (Option.isNone(o)) {
          return Option.none()
        }
        const input = o.value
        if (!Arr.isArray(input)) {
          return yield* Effect.fail(new SchemaAST.MismatchIssue(ast, input))
        }
        const output: Array<unknown> = []
        const issues: Array<SchemaAST.Issue> = []
        const allErrors = options?.errors === "all"
        let i = 0
        for (; i < ast.elements.length; i++) {
          const element = ast.elements[i]
          const value = i < input.length ? Option.some(input[i]) : Option.none()
          const parser = goMemo(element.ast)
          const r = yield* Effect.result(parser(value, options))
          if (Result.isErr(r)) {
            const issue = new SchemaAST.PointerIssue([i], r.err)
            if (allErrors) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
            }
          } else {
            if (Option.isSome(r.ok)) {
              output[i] = r.ok.value
            } else {
              if (!element.isOptional) {
                const issue = new SchemaAST.PointerIssue([i], SchemaAST.MissingPropertyKeyIssue.instance)
                if (allErrors) {
                  issues.push(issue)
                  continue
                } else {
                  return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
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
              if (allErrors) {
                issues.push(issue)
                continue
              } else {
                return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
              }
            } else {
              if (Option.isSome(r.ok)) {
                output[i] = r.ok.value
              } else {
                const issue = new SchemaAST.PointerIssue([i], SchemaAST.MissingPropertyKeyIssue.instance)
                if (allErrors) {
                  issues.push(issue)
                  continue
                } else {
                  return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
                }
              }
            }
          }
        }
        if (Arr.isNonEmptyArray(issues)) {
          return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, input, issues, Option.some(output)))
        }
        return Option.some(output as A)
      })
    }
    case "Suspend":
      return goMemo<A, any>(ast.thunk())
  }
}

const succeedNone = Effect.succeed(Option.none())

const fromPredicate = <A>(ast: SchemaAST.AST, predicate: (u: unknown) => boolean): Parser<A> => (o) => {
  if (Option.isNone(o)) {
    return succeedNone
  }
  const u = o.value
  return predicate(u) ? Effect.succeed(Option.some(u as A)) : Effect.fail(new SchemaAST.MismatchIssue(ast, u))
}
