import type { CreateRule, ESTree, Fixer, Visitor } from "oxlint"

const TAG_OBJECTS = new Set(["Context", "ServiceMap"])
const TAG_PROPERTIES = new Set(["Service", "Tag", "Key", "GenericTag"])
const FORBIDDEN_PREFIX = "@effect/"

// `Context.Service` / `Context.Tag` / `Context.Key` / `Context.GenericTag`
// (and the same four on `ServiceMap`) — non-computed member access only.
function isTagCallee(expr: ESTree.Expression): boolean {
  if (expr.type !== "MemberExpression") return false
  if (expr.computed) return false
  if (expr.object.type !== "Identifier") return false
  if (!TAG_OBJECTS.has(expr.object.name)) return false
  if (expr.property.type !== "Identifier") return false
  return TAG_PROPERTIES.has(expr.property.name)
}

// `StringLiteral.type === "Literal"` in oxlint's ESTree. The other "Literal"
// variants (BooleanLiteral, NullLiteral, NumericLiteral, BigIntLiteral,
// RegExpLiteral) have non-string `value`, so a type-of check narrows safely.
function asStringLiteral(arg: ESTree.Argument): ESTree.StringLiteral | undefined {
  if (arg.type !== "Literal") return undefined
  if (typeof arg.value !== "string") return undefined
  return arg
}

function reportLiteral(
  context: Parameters<CreateRule["create"]>[0],
  literal: ESTree.StringLiteral
) {
  if (!literal.value.startsWith(FORBIDDEN_PREFIX)) return

  const fixedValue = literal.value.slice(1)
  const raw = literal.raw ?? `"${literal.value}"`
  const quote = raw.charAt(0) === "'" ? "'" : "\""
  const replacement = `${quote}${fixedValue}${quote}`

  context.report({
    node: literal,
    message:
      `Tag string must not start with "@effect/" (use "${fixedValue}" instead). The "@<pkg>/" prefix is leftover from v3 package naming and breaks service identity when callers look up the tag by string.`,
    fix: (fixer: Fixer) => fixer.replaceTextRange(literal.range, replacement)
  })
}

function checkFirstArg(
  context: Parameters<CreateRule["create"]>[0],
  args: ReadonlyArray<ESTree.Argument>
) {
  const first = args[0]
  if (!first) return
  const literal = asStringLiteral(first)
  if (literal) reportLiteral(context, literal)
}

const rule: CreateRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow \"@effect/\"-prefixed tag strings in Context.{Service,Tag,Key,GenericTag} and ServiceMap.{Service,Tag,Key,GenericTag} constructors"
    },
    fixable: "code"
  },
  create(context) {
    function handleCall(node: ESTree.CallExpression) {
      const callee = node.callee

      // direct form: Context.Service("@effect/foo", ...)
      if (isTagCallee(callee)) {
        checkFirstArg(context, node.arguments)
        return
      }

      // class-extends form: Context.Service<...>()("@effect/foo")
      // AST: outer CallExpression whose callee is itself a CallExpression
      // whose callee is the Member expression.
      if (callee.type === "CallExpression" && isTagCallee(callee.callee)) {
        checkFirstArg(context, node.arguments)
      }
    }

    return {
      CallExpression: handleCall
    } as Visitor
  }
}

export default rule
