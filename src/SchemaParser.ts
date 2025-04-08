/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import { memoizeThunk } from "./internal/schema/util.js"
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
  const parser = goMemo<A>(ast)
  return (u: unknown, overrideOptions?: SchemaAST.ParseOptions): SchemaParserResult.SchemaParserResult<A, R> => {
    const out = parser(Option.some(u), mergeParseOptions(options, overrideOptions))
    if (Result.isErr(out)) {
      return Result.err(out.err)
    }
    if (Option.isNone(out.ok)) {
      return Result.err(new SchemaAST.MismatchIssue(ast, u))
    }
    return Result.ok(out.ok.value)
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

interface Parser<A> {
  (i: Option.Option<unknown>, options: SchemaAST.ParseOptions): Result.Result<Option.Option<A>, SchemaAST.Issue>
}

function handleModifiers<A>(parser: Parser<A>, ast: SchemaAST.AST): Parser<A> {
  if (ast.modifiers.length === 0) {
    return parser
  }
  return (i, options) => {
    const r = parser(i, options)
    if (Result.isErr(r)) {
      return r
    }
    if (Option.isNone(r.ok)) {
      return r
    }
    let ok = r.ok.value
    for (const modifier of ast.modifiers) {
      switch (modifier._tag) {
        case "Refinement": {
          const issue = modifier.filter(ok, options)
          if (issue !== undefined) {
            return Result.err(
              new SchemaAST.CompositeIssue(ast, i, [new SchemaAST.RefinementIssue(modifier, issue)], Option.some(ok))
            )
          }
          break
        }
        case "Ctor": {
          const out = modifier.decode(ok)
          if (Result.isErr(out)) {
            return Result.err(new SchemaAST.MismatchIssue(ast, ok))
          }
          ok = out.ok
          break
        }
      }
    }
    return Result.ok(Option.some(ok))
  }
}

function handleEncoding<A>(
  parser: Parser<A>,
  ast: SchemaAST.AST
): Parser<A> {
  const encoding = ast.encoding
  if (encoding === undefined) {
    return parser
  }
  return (o, options) => {
    let i = encoding.transformations.length - 1
    const from = goMemo<A>(encoding.to)
    const r = from(o, options)
    if (Result.isErr(r)) {
      return r
    }
    o = r.ok
    for (; i >= 0; i--) {
      const wrapper = encoding.transformations[i]
      switch (wrapper._tag) {
        case "EncodeWrapper": {
          if (Option.isNone(o)) {
            break
          }
          const parser = wrapper.transformation.decode
          const r = parser(o.value, options)
          if (Result.isResult(r)) {
            if (Result.isErr(r)) {
              return Result.err(
                new SchemaAST.CompositeIssue(ast, i, [new SchemaAST.EncodingIssue(encoding, r.err)], o)
              )
            }
            o = Option.some(r.ok)
          } else {
            throw new Error(`TODO: handle effects`)
          }
          break
        }
        case "ContextWrapper": {
          const parser = wrapper.transformation.decode
          const r = parser(o, options)
          if (Result.isResult(r)) {
            if (Result.isErr(r)) {
              return Result.err(
                new SchemaAST.CompositeIssue(ast, i, [new SchemaAST.EncodingIssue(encoding, r.err)], o)
              )
            }
            o = r.ok
            if (Option.isNone(o) && !wrapper.isOptional) {
              return Result.err(new SchemaAST.InvalidIssue(o))
            }
          } else {
            throw new Error(`TODO: handle effects`)
          }
          break
        }
        default:
          wrapper satisfies never // TODO: remove this
      }
    }
    return parser(o, options)
  }
}

const memoMap = new WeakMap<SchemaAST.AST, Parser<any>>()

function goMemo<A>(ast: SchemaAST.AST): Parser<A> {
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
      return (oi, options) => {
        if (Option.isNone(oi)) {
          return okNone
        }
        const i = oi.value
        const parser = ast.parser(ast.typeParameters)
        const r = parser(i, ast, options)
        if (Result.isResult(r)) {
          return Result.map(r, (u) => Option.some(u))
        } else {
          throw new Error(`TODO: handle effects`)
        }
      }
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
      return (o, options) => {
        if (Option.isNone(o)) {
          return okNone
        }
        const input = o.value
        // If the input is not a record, return early with an error
        if (!Predicate.isRecord(input)) {
          return Result.err(new SchemaAST.MismatchIssue(ast, input))
        }
        const output: Record<PropertyKey, unknown> = {}
        const issues: Array<SchemaAST.Issue> = []
        const allErrors = options?.errors === "all"
        for (const ps of ast.propertySignatures) {
          const name = ps.name
          const type = ps.type
          const encodedKey = type.context?.encodedKey ?? name
          const value = Object.prototype.hasOwnProperty.call(input, encodedKey)
            ? Option.some(input[encodedKey])
            : type.context !== undefined && type.context.defaults !== undefined
            ? type.context.defaults.decode
            : Option.none()
          if (Effect.isEffect(value)) {
            throw new Error("TODO: handle effectful defaults")
          }
          const parser = goMemo(type)
          const r = parser(value, options)
          if (Result.isErr(r)) {
            const issue = new SchemaAST.PointerIssue([name], r.err)
            if (allErrors) {
              issues.push(issue)
              continue
            } else {
              return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
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
                  return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
                }
              }
            }
          }
        }
        return Arr.isNonEmptyArray(issues) ?
          Result.err(new SchemaAST.CompositeIssue(ast, input, issues, Option.some(output))) :
          Result.ok(Option.some(output as A))
      }
    }
    case "TupleType": {
      return (o, options) => {
        if (Option.isNone(o)) {
          return okNone
        }
        const input = o.value
        if (!Arr.isArray(input)) {
          return Result.err(new SchemaAST.MismatchIssue(ast, input))
        }
        const output: Array<unknown> = []
        const issues: Array<SchemaAST.Issue> = []
        const allErrors = options?.errors === "all"
        let i = 0
        for (; i < ast.elements.length; i++) {
          const element = ast.elements[i]
          const value = i < input.length ? Option.some(input[i]) : Option.none()
          const parser = goMemo(element.ast)
          const r = parser(value, options)
          if (Result.isErr(r)) {
            const issue = new SchemaAST.PointerIssue([i], r.err)
            if (allErrors) {
              issues.push(issue)
              continue
            } else {
              return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
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
                  return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
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
            const r = parser(Option.some(input[i]), options)
            if (Result.isErr(r)) {
              const issue = new SchemaAST.PointerIssue([i], r.err)
              if (allErrors) {
                issues.push(issue)
                continue
              } else {
                return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
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
                  return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], Option.some(output)))
                }
              }
            }
          }
        }
        return Arr.isNonEmptyArray(issues) ?
          Result.err(new SchemaAST.CompositeIssue(ast, input, issues, Option.some(output))) :
          Result.ok(Option.some(output as A))
      }
    }
    case "Suspend": {
      // TODO: why in v3 there is:
      // const get = util_.memoizeThunk(() => goMemo(AST.annotations(ast.f(), ast.annotations), isDecoding))
      const get = memoizeThunk(() => goMemo<A>(ast.thunk()))
      return (a, options) => get()(a, options)
    }
  }
}

const okNone = Result.ok(Option.none())

const fromPredicate = <A>(ast: SchemaAST.AST, predicate: (u: unknown) => boolean): Parser<A> => (o) => {
  if (Option.isNone(o)) {
    return okNone
  }
  const u = o.value
  return predicate(u) ? Result.ok(Option.some(u as A)) : Result.err(new SchemaAST.MismatchIssue(ast, u))
}
