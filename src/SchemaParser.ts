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

const fromAST = <A, R>(ast: SchemaAST.AST) => {
  const parser = goMemo<A, R>(ast)
  return (u: unknown, options?: SchemaAST.ParseOptions): SchemaParserResult.SchemaParserResult<A, R> => {
    const oa = parser(Option.some(u), options ?? defaultParseOptions)
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

const fromASTSync = <A>(ast: SchemaAST.AST) => {
  const parser = fromAST<A, never>(ast)
  return (u: unknown, options?: SchemaAST.ParseOptions): A => {
    const out = parser(u, options)
    const res = Result.isResult(out) ? out : runSyncResult(ast, u, out)
    return Result.getOrThrow(res)
  }
}

/**
 * @category encoding
 * @since 4.0.0
 */
export const encodeUnknownParserResult = <A, I, RD, RE, RI>(schema: Schema.Codec<A, I, RD, RE, RI>) =>
  fromAST<I, RE | RI>(SchemaAST.flip(schema.ast))

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownParserResult = <A, I, RD, RE, RI>(schema: Schema.Codec<A, I, RD, RE, RI>) =>
  fromAST<A, RD | RI>(schema.ast)

/**
 * @category decoding
 * @since 4.0.0
 */
export const decodeUnknownSync = <A, I, RE>(schema: Schema.Codec<A, I, never, RE, never>) => fromASTSync<A>(schema.ast)

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

const handleModifiers = Effect.fnUntraced(
  function*<A>(
    ast: SchemaAST.AST,
    modifiers: ReadonlyArray<SchemaAST.Modifier>,
    oa: Option.Option<A>,
    options: SchemaAST.ParseOptions
  ) {
    if (Option.isSome(oa) && (modifiers.length > 0)) {
      let a = oa.value

      for (const m of modifiers) {
        switch (m._tag) {
          case "FilterGroup": {
            const issues: Array<SchemaAST.Issue> = []
            for (const filter of m.filters) {
              const res = filter.filter(a, options)
              const issue = Effect.isEffect(res) ? yield* res : res
              if (issue) {
                issues.push(new SchemaAST.FilterIssue(filter, issue))
              }
            }
            if (Arr.isNonEmptyArray(issues)) {
              return yield* Effect.fail(new SchemaAST.CompositeIssue(ast, oa, issues, Option.some(a)))
            }
            break
          }
          case "Ctor": {
            const r = m.decode(a)
            if (Result.isErr(r)) {
              return yield* Effect.fail(new SchemaAST.MismatchIssue(ast, a))
            }
            a = r.ok
            break
          }
        }
      }

      return Option.some(a)
    }
    return oa
  }
)

function goMemo<A, R>(ast: SchemaAST.AST): Parser<A, R> {
  const memo = memoMap.get(ast)
  if (memo) {
    return memo
  }
  const parser: Parser<A, R> = Effect.fnUntraced(function*(input, options) {
    let ou = input
    // ---------------------------------------------
    // handle encoding
    // ---------------------------------------------
    const encoding = ast.encoding
    if (encoding) {
      const len = encoding.links.length
      for (let i = len - 1; i >= 0; i--) {
        const link = encoding.links[i]
        if (i === len - 1 || link.to.encoding || link.to.modifiers || link.to !== SchemaAST.typeAST(link.to)) {
          ou = yield* goMemo<A, any>(link.to)(ou, options)
        }
        const parser = link.transformation.decode
        const spr = parser(ou, options)
        const r = Result.isResult(spr) ? spr : yield* Effect.result(spr)
        if (Result.isErr(r)) {
          return yield* Effect.fail(
            new SchemaAST.CompositeIssue(ast, i, [new SchemaAST.EncodingIssue(encoding, r.err)], ou)
          )
        }
        ou = r.ok
      }
    }
    // ---------------------------------------------
    // handle pre modifiers
    // ---------------------------------------------
    if (ast.modifiers && ast.modifiers.isFlipped) {
      const encodedAST = SchemaAST.encodedAST(ast)

      let modifiers: Array<SchemaAST.Modifier> = []
      const tmp: Array<SchemaAST.Modifier> = []
      let hasCtor = false

      /**
       * Given
       *
       * ```
       * [F1, F2, F3, C1, F4, F5, C2, F6, F7]
       * ```
       *
       * this code will rearrange the array into:
       *
       * ```
       * [C1, F3, F2, F1, C2, F5, F4, F7, F6]
       * ```
       */

      for (const m of ast.modifiers.modifiers) {
        if (m._tag === "Ctor") {
          hasCtor = true
          modifiers.push(m.flip())
          while (tmp.length > 0) {
            modifiers.push(tmp.pop()!)
          }
        } else {
          tmp.push(m)
        }
      }
      if (hasCtor) {
        while (tmp.length > 0) {
          modifiers.push(tmp.pop()!)
        }
      } else {
        modifiers = ast.modifiers.modifiers.toReversed()
      }

      if (hasCtor) {
        ou = yield* handleModifiers(encodedAST, modifiers, ou, options)
      } else {
        ou = yield* go<A>(encodedAST)(ou, options)
        ou = yield* handleModifiers(encodedAST, ast.modifiers.modifiers, ou, options)
      }
    }
    // ---------------------------------------------
    // handle decoding
    // ---------------------------------------------
    let oa = yield* go<A>(ast)(ou, options)
    // ---------------------------------------------
    // handle post modifiers
    // ---------------------------------------------
    if (ast.modifiers && !ast.modifiers.isFlipped) {
      oa = yield* handleModifiers(ast, ast.modifiers.modifiers, oa, options)
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
          } else if (type.context && type.context.defaults) {
            const defaultValue = type.context.defaults.decode
            if (Option.isSome(defaultValue)) {
              const dv = defaultValue.value
              value = Option.some(Effect.isEffect(dv) ? yield* dv : dv())
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
