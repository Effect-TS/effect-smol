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
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaResult from "./SchemaResult.js"

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownSchemaResult = <T, E, RD, RE>(codec: Schema.Codec<T, E, RD, RE>) =>
  fromASTSchemaResult<T, RD>(codec.ast)

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknown = <T, E, RD, RE>(codec: Schema.Codec<T, E, RD, RE>) => {
  const parser = decodeUnknownSchemaResult(codec)
  return (u: unknown, options?: SchemaAST.ParseOptions) => {
    return SchemaResult.asEffect(parser(u, options))
  }
}

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decode: <T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
) => (e: E, options?: SchemaAST.ParseOptions) => Effect.Effect<T, SchemaIssue.Issue, RD> = decodeUnknown

/**
 * @category Decoding
 * @since 4.0.0
 */
export const decodeUnknownSync = <T, E, RE>(codec: Schema.Codec<T, E, never, RE>) => fromASTSync<T>(codec.ast)

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownSchemaResult = <T, E, RD, RE>(codec: Schema.Codec<T, E, RD, RE>) =>
  fromASTSchemaResult<E, RE>(SchemaAST.flip(codec.ast))

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknown = <T, E, RD, RE>(codec: Schema.Codec<T, E, RD, RE>) => {
  const parser = encodeUnknownSchemaResult(codec)
  return (u: unknown, options?: SchemaAST.ParseOptions) => {
    return SchemaResult.asEffect(parser(u, options))
  }
}

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encode: <T, E, RD, RE>(
  codec: Schema.Codec<T, E, RD, RE>
) => (t: T, options?: SchemaAST.ParseOptions) => Effect.Effect<E, SchemaIssue.Issue, RE> = encodeUnknown

/**
 * @category Encoding
 * @since 4.0.0
 */
export const encodeUnknownSync = <T, E, RD>(codec: Schema.Codec<T, E, RD, never>) =>
  fromASTSync<E>(SchemaAST.flip(codec.ast))

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownParserResult = <T, E, RD, RE>(codec: Schema.Codec<T, E, RD, RE>) =>
  fromASTSchemaResult<T, never>(SchemaAST.typeAST(codec.ast))

/**
 * @category validating
 * @since 4.0.0
 */
export const validateUnknownSync = <T, E, RD, RE>(codec: Schema.Codec<T, E, RD, RE>) =>
  fromASTSync<T>(SchemaAST.typeAST(codec.ast))

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

/** @internal */
export interface Parser<A, R> {
  (i: Option.Option<unknown>, options: SchemaAST.ParseOptions): Effect.Effect<Option.Option<A>, SchemaIssue.Issue, R>
}

const memoMap = new WeakMap<SchemaAST.AST, Parser<any, any>>()

function goMemo<A, R>(ast: SchemaAST.AST): Parser<A, R> {
  const memo = memoMap.get(ast)
  if (memo) {
    return memo
  }
  const parser: Parser<A, R> = Effect.fnUntraced(function*(ou, options) {
    const encoding = options["~variant"] === "make" && ast.context && ast.context.constructorDefault
      ? [new SchemaAST.Link(SchemaAST.unknownKeyword, ast.context.constructorDefault)]
      : ast.encoding

    let srou: SchemaResult.SchemaResult<Option.Option<unknown>, unknown> = SchemaResult.succeed(ou)
    if (encoding) {
      const links = encoding
      const len = links.length
      for (let i = len - 1; i >= 0; i--) {
        const link = links[i]
        const to = link.to
        const shouldValidateToSchema = true
        if (shouldValidateToSchema) {
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
      for (const modifier of ast.modifiers) {
        if (modifier._tag !== "Middleware") {
          const filters = modifier._tag === "Filter" ? [modifier] : modifier.filters
          for (const filter of filters) {
            sroa = SchemaResult.asEffect(sroa).pipe(Effect.flatMap((oa) => {
              if (bail && Arr.isNonEmptyArray(issues)) {
                return Effect.fail(new SchemaIssue.CompositeIssue(ast, ou, issues))
              }
              return Effect.gen(function*() {
                if (Option.isSome(oa)) {
                  const res = filter.run(oa.value, ast, options)
                  const iu = Effect.isEffect(res) ? yield* res : res
                  if (iu) {
                    bail = filter.bail
                    issues.push(new SchemaIssue.FilterIssue(filter, iu, filter.bail))
                  }
                }
                return oa
              })
            }))
          }
        } else {
          sroa = SchemaResult.mapError(
            modifier.decode.run(sroa, ast, options),
            (e) => new SchemaIssue.MiddlewareIssue(modifier.decode, e)
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
    case "LiteralType":
      return SchemaAST.fromPredicate(ast, (u) => u === ast.literal)
    case "NeverKeyword":
      return SchemaAST.fromPredicate(ast, Predicate.isNever)
    case "AnyKeyword":
    case "UnknownKeyword":
    case "VoidKeyword":
      return SchemaAST.fromPredicate(ast, Predicate.isUnknown)
    case "NullKeyword":
      return SchemaAST.fromPredicate(ast, Predicate.isNull)
    case "UndefinedKeyword":
      return SchemaAST.fromPredicate(ast, Predicate.isUndefined)
    case "StringKeyword":
      return SchemaAST.fromPredicate(ast, Predicate.isString)
    case "NumberKeyword":
      return SchemaAST.fromPredicate(ast, Predicate.isNumber)
    case "BooleanKeyword":
      return SchemaAST.fromPredicate(ast, Predicate.isBoolean)
    case "SymbolKeyword":
      return SchemaAST.fromPredicate(ast, Predicate.isSymbol)
    case "BigIntKeyword":
      return SchemaAST.fromPredicate(ast, Predicate.isBigInt)
    case "UniqueSymbol":
      return SchemaAST.fromPredicate(ast, (u) => u === ast.symbol)
    case "ObjectKeyword":
      return SchemaAST.fromPredicate(ast, Predicate.isObject)
    case "Declaration":
    case "TemplateLiteral":
    case "TypeLiteral":
    case "TupleType":
    case "UnionType":
      return ast.parser(goMemo)
    case "Suspend":
      return goMemo<A, any>(ast.thunk())
  }
  ast satisfies never // TODO: remove this
}
