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
  if (ast.type.refinements.length === 0) {
    return parser
  }
  return (i, options) => {
    const r = parser(i, options)
    if (Result.isErr(r)) {
      return r
    }
    const ok = r.ok
    for (const refinement of ast.type.refinements) {
      const o = refinement.filter(ok, ast, options)
      if (o !== undefined) {
        return Result.err(new SchemaAST.RefinementIssue(ast, i, refinement, o))
      }
    }
    return Result.ok(ok)
    // return flatMap(parser(i, options), (a) => {
    //   for (const refinement of ast.refinements) {
    //     const o = refinement.filter(a, ast, options)
    //     if (Option.isSome(o)) {
    //       return Result.err(new SchemaAST.RefinementIssue(ast, i, refinement, o.value))
    //     }
    //   }
    //   return Result.ok(a)
    // })
  }
}

function handleTransformations(parser: Parser, ast: SchemaAST.AST, isDecoding: boolean): Parser {
  if (ast.transformations.length === 0) {
    return parser
  }
  return (i, options) => {
    if (ast.transformations.every((t) => t.transformation._tag === "FinalTransform")) {
      if (isDecoding) {
        // TODO: reverse the transformations (decoding should be more frequent)
        const transformations = ast.transformations.toReversed()
        const from = goMemo(transformations[0].to, true)
        const r = from(i, options)
        if (Result.isErr(r)) {
          return r
        }
        let out = r.ok
        for (const transformation of transformations) {
          out = transformation.transformation.decode(out, ast, options)
        }
        return parser(out, options)
      } else {
        const r = parser(i, options)
        if (Result.isErr(r)) {
          return r
        }
        let out = r.ok
        for (const transformation of ast.transformations) {
          out = transformation.transformation.encode(out, ast, options)
        }
        return Result.ok(out)
      }
    } else if (
      ast.transformations.every((t) =>
        t.transformation._tag === "FinalTransform" || t.transformation._tag === "FinalTransformOrFail"
      )
    ) {
      if (isDecoding) {
        const transformations = ast.transformations.toReversed()
        const from = goMemo(transformations[0].to, true)
        const r = from(i, options)
        if (Result.isErr(r)) {
          return r
        }
        let out: Result.Result<any, any> = Result.ok(r.ok)
        for (const transformation of transformations) {
          if (Result.isErr(out)) {
            return out
          }
          const r = transformation.transformation.decode(out.ok, ast, options)
          out = Result.isResult(r) ? r : Result.ok(r)
        }
        if (Result.isErr(out)) {
          return out
        }
        return parser(out.ok, options)
      } else {
        const r = parser(i, options)
        if (Result.isErr(r)) {
          return r
        }
        let out: Result.Result<any, any> = Result.ok(r.ok)
        for (const transformation of ast.transformations) {
          if (Result.isErr(out)) {
            return out
          }
          const r = transformation.transformation.decode(out.ok, ast, options)
          out = Result.isResult(r) ? r : Result.ok(r)
        }
        return out
      }
    }
    // There is at least one effectful transformation
    throw new Error("TODO: handle effectful transformations")
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
  const node = ast.type.node
  switch (node._tag) {
    case "Declaration":
      throw new Error(`go: unimplemented Declaration`)
    case "Literal":
      return fromPredicate(ast, (u) => u === node.literal)
    case "NeverKeyword":
      return fromPredicate(ast, Predicate.isNever)
    case "StringKeyword":
      return fromPredicate(ast, Predicate.isString)
    case "NumberKeyword":
      return fromPredicate(ast, Predicate.isNumber)
    case "TypeLiteral": {
      // Handle empty Struct({}) case
      if (node.propertySignatures.length === 0 && node.indexSignatures.length === 0) {
        return fromPredicate(ast, Predicate.isNotNullable)
      }
      return (input, options) => {
        // If the input is not a record, return early with an error
        if (!Predicate.isRecord(input)) {
          return Result.err(new SchemaAST.ValidationIssue(ast, input))
        }
        const output: Record<PropertyKey, unknown> = {}
        const issues: Array<SchemaAST.Issue> = []
        const allErrors = options?.errors === "all"
        for (const ps of node.propertySignatures) {
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
    case "Suspend": {
      // TODO: why in v3 there is:
      // const get = util_.memoizeThunk(() => goMemo(AST.annotations(ast.f(), ast.annotations), isDecoding))
      const get = memoizeThunk(() => goMemo(node.f(), isDecoding))
      return (a, options) => get()(a, options)
    }
  }
}

const fromPredicate = (ast: SchemaAST.AST, predicate: (u: unknown) => boolean): Parser => (u) =>
  predicate(u) ? Result.ok(u) : Result.err(new SchemaAST.ValidationIssue(ast, u))
