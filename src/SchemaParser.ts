/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import { memoizeThunk } from "./internal/schema/util.js"
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
  const parser = goMemo(ast, isDecoding)
  return (u: unknown, overrideOptions?: SchemaAST.ParseOptions): SchemaParserResult<A, R> =>
    parser(u, mergeParseOptions(options, overrideOptions))
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
) => fromAST<A, R>(schema.ast, false, options)

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

interface Parser {
  (i: unknown, options: SchemaAST.ParseOptions): Result.Result<any, SchemaAST.Issue> // SchemaParserResult<any, any>
}

const decodeMemoMap = new WeakMap<SchemaAST.AST, Parser>()

const encodeMemoMap = new WeakMap<SchemaAST.AST, Parser>()

function handleRefinements(parser: Parser, ast: SchemaAST.AST): Parser {
  if (ast.refinements.length === 0) {
    return parser
  }
  return (i, options) => {
    const r = parser(i, options)
    if (Result.isErr(r)) {
      return r
    }
    const ok = r.ok
    for (const refinement of ast.refinements) {
      const issue = refinement.filter(ok, options)
      if (issue !== undefined) {
        return Result.err(new SchemaAST.CompositeIssue(ast, i, [new SchemaAST.RefinementIssue(refinement, issue)], ok))
      }
    }
    return Result.ok(ok)
  }
}

function handleTransformations(
  parser: Parser,
  ast: SchemaAST.AST,
  isDecoding: boolean
): Parser {
  if (ast.transformations.length === 0) {
    return parser
  }
  return (input, options) => {
    if (isDecoding) {
      let i = ast.transformations.length - 1
      const last = ast.transformations[i]
      const from = goMemo(last.from, true)
      const r = from(input, options)
      if (Result.isErr(r)) {
        return r
      }
      let a = r.ok
      for (; i >= 0; i--) {
        const transformation = ast.transformations[i]
        switch (transformation.transformation._tag) {
          case "FinalTransform": {
            a = transformation.transformation.decode(a, options)
            break
          }
          case "FinalTransformOrFail": {
            const r = transformation.transformation.decode(a, options)
            if (Result.isErr(r)) {
              return Result.err(
                new SchemaAST.CompositeIssue(ast, i, [
                  new SchemaAST.TransformationIssue(isDecoding, transformation, r.err)
                ], a)
              )
            }
            a = r.ok
            break
          }
          case "FinalTransformOrFailEffect":
            throw new Error("TODO: handle effectful transformations")
        }
      }
      return parser(a, options)
    } else {
      const r = parser(input, options)
      if (Result.isErr(r)) {
        return r
      }
      let a = r.ok
      let i = 0
      for (; i < ast.transformations.length - 1; i++) {
        const transformation = ast.transformations[i]
        switch (transformation.transformation._tag) {
          case "FinalTransform": {
            a = transformation.transformation.encode(a, options)
            break
          }
          case "FinalTransformOrFail": {
            const r = transformation.transformation.encode(a, options)
            if (Result.isErr(r)) {
              return Result.err(
                new SchemaAST.CompositeIssue(ast, i, [
                  new SchemaAST.TransformationIssue(isDecoding, transformation, r.err)
                ], a)
              )
            }
            a = r.ok
            break
          }
          case "FinalTransformOrFailEffect":
            throw new Error("TODO: handle effectful transformations")
        }
      }
      const from = goMemo(ast.transformations[i].from, false)
      return from(a, options)
    }
  }
}

function goMemo(ast: SchemaAST.AST, isDecoding: boolean): Parser {
  const memoMap = isDecoding ? decodeMemoMap : encodeMemoMap
  const memo = memoMap.get(ast)
  if (memo) {
    return memo
  }
  const unrefined = go(ast, isDecoding)
  const refined = handleRefinements(unrefined, ast)
  const transformed = handleTransformations(refined, ast, isDecoding)
  memoMap.set(ast, transformed)
  return transformed
}

function go(ast: SchemaAST.AST, isDecoding: boolean): Parser {
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
      return (input, options) => {
        // If the input is not a record, return early with an error
        if (!Predicate.isRecord(input)) {
          return Result.err(new SchemaAST.MismatchIssue(ast, input))
        }
        const output: Record<PropertyKey, unknown> = {}
        const issues: Array<SchemaAST.Issue> = []
        const allErrors = options?.errors === "all"
        for (const ps of ast.propertySignatures) {
          const key = ps.name
          const parser = go(ps.type, isDecoding)
          const r = parser(input[key], options)
          if (Result.isErr(r)) {
            const issue = new SchemaAST.PointerIssue([key], r.err)
            if (allErrors) {
              issues.push(issue)
              continue
            } else {
              return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], output))
            }
          } else {
            output[key] = r.ok
          }
        }
        return Arr.isNonEmptyArray(issues) ?
          Result.err(new SchemaAST.CompositeIssue(ast, input, issues, output)) :
          Result.ok(output)
      }
    }
    case "TupleType": {
      return (input, options) => {
        if (!Arr.isArray(input)) {
          return Result.err(new SchemaAST.MismatchIssue(ast, input))
        }
        const output: Array<unknown> = []
        const issues: Array<SchemaAST.Issue> = []
        const allErrors = options?.errors === "all"
        let i = 0
        for (; i < ast.elements.length; i++) {
          const element = ast.elements[i]
          const parser = go(element, isDecoding)
          const r = parser(input[i], options)
          if (Result.isErr(r)) {
            const issue = new SchemaAST.PointerIssue([i], r.err)
            if (allErrors) {
              issues.push(issue)
              continue
            } else {
              return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], output))
            }
          } else {
            output[i] = r.ok
          }
        }
        const len = input.length
        if (Arr.isNonEmptyReadonlyArray(ast.rest)) {
          const [head, ...tail] = ast.rest
          const parser = go(head, isDecoding)
          for (; i < len - tail.length; i++) {
            const r = parser(input[i], options)
            if (Result.isErr(r)) {
              const issue = new SchemaAST.PointerIssue([i], r.err)
              if (allErrors) {
                issues.push(issue)
                continue
              } else {
                return Result.err(new SchemaAST.CompositeIssue(ast, input, [issue], output))
              }
            } else {
              output[i] = r.ok
            }
          }
        }
        return Arr.isNonEmptyArray(issues) ?
          Result.err(new SchemaAST.CompositeIssue(ast, input, issues, output)) :
          Result.ok(output)
      }
    }
    case "Suspend": {
      // TODO: why in v3 there is:
      // const get = util_.memoizeThunk(() => goMemo(AST.annotations(ast.f(), ast.annotations), isDecoding))
      const get = memoizeThunk(() => goMemo(ast.f(), isDecoding))
      return (a, options) => get()(a, options)
    }
  }
}

const fromPredicate = (ast: SchemaAST.AST, predicate: (u: unknown) => boolean): Parser => (u) =>
  predicate(u) ? Result.ok(u) : Result.err(new SchemaAST.MismatchIssue(ast, u))
