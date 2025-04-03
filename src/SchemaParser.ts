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

/**
 * @category model
 * @since 4.0.0
 */
export type SchemaParserResult<A, R> = Result.Result<A, SchemaAST.Issue> | Effect.Effect<A, SchemaAST.Issue, R>

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
  isDecoding: boolean,
  options?: SchemaAST.ParseOptions
) => {
  const parser = goMemo<A>(ast, isDecoding)
  return (u: unknown, overrideOptions?: SchemaAST.ParseOptions): SchemaParserResult<A, R> => {
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

const runSyncResult = <A, R>(
  ast: SchemaAST.AST,
  actual: unknown,
  self: Effect.Effect<A, SchemaAST.Issue, R>
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

const fromASTSync = <A, R>(
  ast: SchemaAST.AST,
  isDecoding: boolean,
  options?: SchemaAST.ParseOptions
) => {
  const parser = fromAST<A, R>(ast, isDecoding, options)
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
export const encodeUnknownParserResult = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  options?: SchemaAST.ParseOptions
) => fromAST<I, R>(schema.ast, false, options)

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownParserResult = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  options?: SchemaAST.ParseOptions
) => fromAST<A, R>(schema.ast, true, options)

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownSync = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  options?: SchemaAST.ParseOptions
) => fromASTSync<A, R>(schema.ast, true, options)

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownParserResult = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  options?: SchemaAST.ParseOptions
) => fromAST<A, R>(SchemaAST.typeAST(schema.ast), true, options)

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownSync = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  options?: SchemaAST.ParseOptions
) => fromASTSync<A, R>(SchemaAST.typeAST(schema.ast), true, options)

/**
 * @since 4.0.0
 */
export function map<A, B, R>(spr: SchemaParserResult<A, R>, f: (a: A) => B): SchemaParserResult<B, R> {
  return Result.isResult(spr) ? Result.map(spr, f) : Effect.map(spr, f)
}

/**
 * @since 4.0.0
 */
export function flatMap<A, B, R>(
  spr: SchemaParserResult<A, R>,
  f: (a: A) => SchemaParserResult<B, R>
): SchemaParserResult<B, R> {
  if (Result.isResult(spr)) {
    if (Result.isOk(spr)) {
      const out = f(spr.ok)
      if (Result.isResult(out)) {
        return Result.isOk(out) ? Effect.succeed(out.ok) : Effect.fail(out.err)
      }
      return out
    }
    return Result.err(spr.err)
  }
  return Effect.flatMap(spr, (a) => {
    const out = f(a)
    if (Result.isResult(out)) {
      return Result.isOk(out) ? Effect.succeed(out.ok) : Effect.fail(out.err)
    }
    return out
  })
}

const catch_ = <A, B, R, E, R2>(
  spr: SchemaParserResult<A, R>,
  f: (issue: SchemaAST.Issue) => Result.Result<B, E> | Effect.Effect<B, E, R2>
): Result.Result<A | B, E> | Effect.Effect<A | B, E, R | R2> => {
  if (Result.isResult(spr)) {
    return Result.isErr(spr) ? f(spr.err) : Result.ok(spr.ok)
  }
  return Effect.catch(spr, (issue) => {
    const out = f(issue)
    if (Result.isResult(out)) {
      return Result.isOk(out) ? Effect.succeed(out.ok) : Effect.fail(out.err)
    }
    return out
  })
}

export {
  /**
   * @since 4.0.0
   */
  catch_ as catch
}

interface ParserOption<A> {
  (i: Option.Option<unknown>, options: SchemaAST.ParseOptions): Result.Result<Option.Option<A>, SchemaAST.Issue>
}

function handleModifiers<A>(parser: ParserOption<A>, ast: SchemaAST.AST, isDecoding: boolean): ParserOption<A> {
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
              new SchemaAST.CompositeIssue(ast, i, [new SchemaAST.RefinementIssue(modifier, issue)], ok)
            )
          }
          break
        }
        case "Ctor":
          if (isDecoding) {
            ok = new modifier.ctor(ok)
          } else {
            if (!(ok instanceof modifier.ctor)) {
              return Result.err(new SchemaAST.MismatchIssue(ast, ok))
            }
          }
          break
      }
    }
    return Result.ok(Option.some(ok))
  }
}

function handleEncoding<A>(
  parser: ParserOption<A>,
  ast: SchemaAST.AST,
  isDecoding: boolean
): ParserOption<A> {
  if (ast.encodings.length === 0) {
    return parser
  }
  return (o, options) => {
    if (isDecoding) {
      let i = ast.encodings.length - 1
      const last = ast.encodings[i]
      const from = goMemo<A>(last.to, true)
      const r = from(o, options)
      if (Result.isErr(r)) {
        return r
      }
      o = r.ok
      for (; i >= 0; i--) {
        const encoding = ast.encodings[i]
        const transformation = encoding.transformation
        switch (transformation._tag) {
          case "DefaultTransformation": {
            if (Option.isNone(o)) {
              break
            }
            const t = transformation.transformation
            switch (t._tag) {
              case "FinalTransformation": {
                o = Option.some(t.decode(o.value, options))
                break
              }
              case "FinalTransformationResult": {
                const r = t.decode(o.value, options)
                if (Result.isErr(r)) {
                  return Result.err(
                    new SchemaAST.CompositeIssue(ast, i, [
                      new SchemaAST.EncodingIssue(isDecoding, encoding, r.err)
                    ], o.value)
                  )
                }
                o = Option.some(r.ok)
                break
              }
              case "FinalTransformationEffect":
                throw new Error(`TODO: ${isDecoding} > TransformationWithoutContext > FinalTransformationEffect`)
            }
            break
          }
          case "PropertyKeyTransformation": {
            const t = transformation.transformation
            switch (t._tag) {
              case "FinalTransformation": {
                o = t.decode(o, options)
                if (Option.isNone(o) && !transformation.isOptional) {
                  return Result.err(SchemaAST.MissingPropertyKeyIssue.instance)
                }
                break
              }
              case "FinalTransformationResult":
                throw new Error(`TODO: ${isDecoding} > TransformationWithContext > FinalTransformationResult`)
              case "FinalTransformationEffect":
                throw new Error(`TODO: ${isDecoding} > TransformationWithContext > FinalTransformationEffect`)
            }
          }
        }
      }
      return parser(o, options)
    } else {
      const r = parser(o, options)
      if (Result.isErr(r)) {
        return r
      }
      let i = 0
      for (; i < ast.encodings.length; i++) {
        const encoding = ast.encodings[i]
        const transformation = encoding.transformation
        switch (transformation._tag) {
          case "DefaultTransformation": {
            if (Option.isNone(o)) {
              break
            }
            const t = transformation.transformation
            switch (t._tag) {
              case "FinalTransformation": {
                o = Option.some(t.encode(o.value, options))
                break
              }
              case "FinalTransformationResult": {
                const r = t.encode(o.value, options)
                if (Result.isErr(r)) {
                  return Result.err(
                    new SchemaAST.CompositeIssue(ast, i, [
                      new SchemaAST.EncodingIssue(isDecoding, encoding, r.err)
                    ], o.value)
                  )
                }
                o = Option.some(r.ok)
                break
              }
              case "FinalTransformationEffect":
                throw new Error(`TODO: ${isDecoding} > TransformationWithoutContext > FinalTransformationEffect`)
            }
            break
          }
          case "PropertyKeyTransformation": {
            const t = transformation.transformation
            switch (t._tag) {
              case "FinalTransformation": {
                o = t.encode(o, options)
                if (Option.isNone(o) && !transformation.isOptional) {
                  return Result.err(SchemaAST.MissingPropertyKeyIssue.instance)
                }
                break
              }
              case "FinalTransformationResult":
                throw new Error(`TODO: ${isDecoding} > TransformationWithContext > FinalTransformationResult`)
              case "FinalTransformationEffect":
                throw new Error(`TODO: ${isDecoding} > TransformationWithContext > FinalTransformationEffect`)
            }
          }
        }
      }
      const from = goMemo<A>(ast.encodings[i - 1].to, false)
      return from(o, options)
    }
  }
}

const decodeMemoMap = new WeakMap<SchemaAST.AST, ParserOption<any>>()

const encodeMemoMap = new WeakMap<SchemaAST.AST, ParserOption<any>>()

function goMemo<A>(ast: SchemaAST.AST, isDecoding: boolean): ParserOption<A> {
  const memoMap = isDecoding ? decodeMemoMap : encodeMemoMap
  const memo = memoMap.get(ast)
  if (memo) {
    return memo
  }
  const unmodified = go<A>(ast, isDecoding)
  const modified = handleModifiers(unmodified, ast, isDecoding)
  const out = handleEncoding(modified, ast, isDecoding)
  memoMap.set(ast, out)
  return out
}

function go<A>(ast: SchemaAST.AST, isDecoding: boolean): ParserOption<A> {
  switch (ast._tag) {
    case "Declaration":
      throw new Error(`go: unimplemented Declaration`)
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
          const key = ps.name
          const hasKey = Object.prototype.hasOwnProperty.call(input, key)
          let value = hasKey ? Option.some(input[key]) : Option.none()
          if (ps.type.encodings.length > 0) {
            const last = ps.type.encodings[ps.type.encodings.length - 1]
            if (last.transformation._tag === "PropertyKeyTransformation") {
              if (last.transformation.name !== undefined) {
                value = Object.prototype.hasOwnProperty.call(input, key)
                  ? Option.some(input[last.transformation.name])
                  : Option.none()
              }
            }
          }
          const parser = goMemo(ps.type, isDecoding)
          const r = parser(value, options)
          if (Result.isErr(r)) {
            const issue = new SchemaAST.PointerIssue([key], r.err)
            if (allErrors) {
              issues.push(issue)
              continue
            } else {
              return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], output))
            }
          } else {
            if (Option.isSome(r.ok)) {
              output[key] = r.ok.value
            } else {
              if (!ps.isOptional) {
                const issue = new SchemaAST.PointerIssue([key], SchemaAST.MissingPropertyKeyIssue.instance)
                if (allErrors) {
                  issues.push(issue)
                  continue
                } else {
                  return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], output))
                }
              }
            }
          }
        }
        return Arr.isNonEmptyArray(issues) ?
          Result.err(new SchemaAST.CompositeIssue(ast, input, issues, output)) :
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
          const parser = goMemo(element.ast, isDecoding)
          const r = parser(value, options)
          if (Result.isErr(r)) {
            const issue = new SchemaAST.PointerIssue([i], r.err)
            if (allErrors) {
              issues.push(issue)
              continue
            } else {
              return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], output))
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
                  return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], output))
                }
              }
            }
          }
        }
        const len = input.length
        if (Arr.isNonEmptyReadonlyArray(ast.rest)) {
          const [head, ...tail] = ast.rest
          const parser = goMemo(head, isDecoding)
          for (; i < len - tail.length; i++) {
            const r = parser(Option.some(input[i]), options)
            if (Result.isErr(r)) {
              const issue = new SchemaAST.PointerIssue([i], r.err)
              if (allErrors) {
                issues.push(issue)
                continue
              } else {
                return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], output))
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
                  return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], output))
                }
              }
            }
          }
        }
        return Arr.isNonEmptyArray(issues) ?
          Result.err(new SchemaAST.CompositeIssue(ast, input, issues, output)) :
          Result.ok(Option.some(output as A))
      }
    }
    case "Suspend": {
      // TODO: why in v3 there is:
      // const get = util_.memoizeThunk(() => goMemo(AST.annotations(ast.f(), ast.annotations), isDecoding))
      const get = memoizeThunk(() => goMemo<A>(ast.thunk(), isDecoding))
      return (a, options) => get()(a, options)
    }
  }
}

const okNone = Result.ok(Option.none())

const fromPredicate = <A>(ast: SchemaAST.AST, predicate: (u: unknown) => boolean): ParserOption<A> => (o) => {
  if (Option.isNone(o)) {
    return okNone
  }
  const u = o.value
  return predicate(u) ? Result.ok(Option.some(u as A)) : Result.err(new SchemaAST.MismatchIssue(ast, u))
}
