import { getMatchText, getMultipleMatchTexts } from "../ast-utils";
import type { AnyNode } from "../ast-utils";
import { MEMBER_RENAME_RULES } from "./member-renames";

export interface CallRewriteRule {
  readonly id: string;
  readonly pattern: string;
  readonly rewrite: (node: AnyNode) => string | null;
  readonly mode?: "aggressive";
}

function rewriteParseJson(node: AnyNode): string | null {
  const args = getMultipleMatchTexts(node, "ARGS");

  if (args.length === 0) {
    return "Schema.UnknownFromJsonString";
  }

  if (args.length === 1) {
    return `Schema.fromJsonString(${args[0]})`;
  }

  return null;
}

function rewriteWithArrayConstructor(
  node: AnyNode,
  name: "Union" | "Tuple" | "TemplateLiteral",
): string | null {
  const args = getMultipleMatchTexts(node, "ARGS");

  if (args.length < 2) {
    return null;
  }

  return `Schema.${name}([${args.join(", ")}])`;
}

function rewriteSchemaPattern(node: AnyNode): string | null {
  const pattern = getMatchText(node, "PATTERN");
  if (!pattern) {
    return null;
  }

  return `Schema.check(Schema.isPattern(${pattern}))`;
}

function rewriteSchemaTransformLiteral(node: AnyNode): string | null {
  const from = getMatchText(node, "FROM");
  const to = getMatchText(node, "TO");
  if (!from || !to) {
    return null;
  }

  return `Schema.Literal(${from}).transform(${to})`;
}

function rewriteSchemaTemplateLiteralParser(node: AnyNode): string | null {
  const args = getMultipleMatchTexts(node, "ARGS");
  if (args.length < 2) {
    return null;
  }

  return `Schema.TemplateLiteralParser([${args.join(", ")}])`;
}

function rewriteSchemaTemplateLiteralParserFromBinding(node: AnyNode): string | null {
  const argNode = node.getMatch("ARG");
  if (!argNode || !argNode.is("identifier")) {
    return null;
  }

  const name = argNode.text();
  const templateLiteralPatterns = [
    "const $NAME = Schema.TemplateLiteral($$$ARGS)",
    "const $NAME = Schema.TemplateLiteral([$$$ARGS])",
  ];

  if (typeof argNode.definition === "function") {
    const definition = argNode.definition({ resolveExternal: false });
    if (definition && definition.kind === "local" && definition.root.filename() === node.getRoot().filename()) {
      for (const pattern of templateLiteralPatterns) {
        const statement = definition.node.find({
          rule: {
            pattern,
          },
        });
        if (!statement) {
          continue;
        }

        const matchedName = getMatchText(statement, "NAME");
        if (matchedName === name) {
          return `Schema.TemplateLiteralParser(${name}.parts)`;
        }
      }
    }
  }

  const root = node.getRoot();
  if (typeof root.source !== "function") {
    return null;
  }

  const source = root.source();
  const needle = `const ${name} = Schema.TemplateLiteral(`;
  const fallbackMatches = source.split(needle).length - 1;
  if (fallbackMatches !== 1) {
    return null;
  }

  return `Schema.TemplateLiteralParser(${name}.parts)`;
}

function rewriteSchemaOptionalWithExact(node: AnyNode): string | null {
  const schema = getMatchText(node, "SCHEMA");
  if (!schema) {
    return null;
  }

  return `Schema.optionalKey(${schema})`;
}

function rewriteCatchSomeToCatchFilter(node: AnyNode): string | null {
  const error = getMatchText(node, "ERROR");
  const condition = getMatchText(node, "CONDITION");
  const handler = getMatchText(node, "HANDLER");
  if (!error || !condition || !handler) {
    return null;
  }

  return `Effect.catchFilter(Filter.fromPredicate((${error}) => ${condition}), (${error}) => ${handler})`;
}

function rewriteCatchSomeToCatchFilterNegated(node: AnyNode): string | null {
  const error = getMatchText(node, "ERROR");
  const condition = getMatchText(node, "CONDITION");
  const handler = getMatchText(node, "HANDLER");
  if (!error || !condition || !handler) {
    return null;
  }

  return `Effect.catchFilter(Filter.fromPredicate((${error}) => !(${condition})), (${error}) => ${handler})`;
}

function rewriteCatchSomeDefectToCatchDefect(node: AnyNode): string | null {
  const defect = getMatchText(node, "DEFECT");
  const condition = getMatchText(node, "CONDITION");
  const handler = getMatchText(node, "HANDLER");
  if (!defect || !condition || !handler) {
    return null;
  }

  return `Effect.catchDefect((${defect}) => ${condition} ? ${handler} : Effect.die(${defect}))`;
}

function rewriteCatchSomeDefectToCatchDefectNegated(node: AnyNode): string | null {
  const defect = getMatchText(node, "DEFECT");
  const condition = getMatchText(node, "CONDITION");
  const handler = getMatchText(node, "HANDLER");
  if (!defect || !condition || !handler) {
    return null;
  }

  return `Effect.catchDefect((${defect}) => !(${condition}) ? ${handler} : Effect.die(${defect}))`;
}

function rewriteSchemaOptionalWithDefault(node: AnyNode): string | null {
  const schema = getMatchText(node, "SCHEMA");
  if (!schema) {
    return null;
  }

  return `Schema.optional(${schema})`;
}

function rewriteSchemaOptionalToOptional(node: AnyNode): string | null {
  const from = getMatchText(node, "FROM");
  const to = getMatchText(node, "TO");
  const options = getMatchText(node, "OPTIONS");
  if (!from || !to || !options) {
    return null;
  }

  return `Schema.optionalKey(${from}).pipe(Schema.decodeTo(Schema.optionalKey(${to}), { decode: SchemaGetter.transformOptional(${options}.decode), encode: SchemaGetter.transformOptional(${options}.encode) }))`;
}

function rewriteSchemaOptionalToRequired(node: AnyNode): string | null {
  const from = getMatchText(node, "FROM");
  const to = getMatchText(node, "TO");
  const options = getMatchText(node, "OPTIONS");
  if (!from || !to || !options) {
    return null;
  }

  return `Schema.optionalKey(${from}).pipe(Schema.decodeTo(${to}, { decode: SchemaGetter.transformOptional(${options}.decode), encode: SchemaGetter.transformOptional(${options}.encode) }))`;
}

function rewriteSchemaRequiredToOptional(node: AnyNode): string | null {
  const from = getMatchText(node, "FROM");
  const to = getMatchText(node, "TO");
  const options = getMatchText(node, "OPTIONS");
  if (!from || !to || !options) {
    return null;
  }

  return `${from}.pipe(Schema.decodeTo(Schema.optionalKey(${to}), { decode: SchemaGetter.transformOptional(${options}.decode), encode: SchemaGetter.transformOptional(${options}.encode) }))`;
}

function rewriteSchemaRename(node: AnyNode): string | null {
  const mapping = getMatchText(node, "MAPPING");
  if (!mapping) {
    return null;
  }

  return `Schema.encodeKeys(${mapping})`;
}

function rewriteSchemaTransform(node: AnyNode): string | null {
  const from = getMatchText(node, "FROM");
  const to = getMatchText(node, "TO");
  const options = getMatchText(node, "OPTIONS");
  if (!from || !to || !options) {
    return null;
  }

  return `${from}.pipe(Schema.decodeTo(${to}, SchemaTransformation.transform({ decode: ${options}.decode, encode: ${options}.encode })))`;
}

function rewriteSchemaTransformOrFail(node: AnyNode): string | null {
  const from = getMatchText(node, "FROM");
  const to = getMatchText(node, "TO");
  const options = getMatchText(node, "OPTIONS");
  if (!from || !to || !options) {
    return null;
  }

  return `${from}.pipe(Schema.decodeTo(${to}, SchemaTransformation.transformOrFail({ decode: ${options}.decode, encode: ${options}.encode })))`;
}

function rewriteSchemaTransformLiterals(node: AnyNode): string | null {
  const pairs = getMultipleMatchTexts(node, "PAIRS");
  if (pairs.length === 0) {
    return null;
  }

  const from = pairs.map((pair) => `${pair}[0]`).join(", ");
  const to = pairs.map((pair) => `${pair}[1]`).join(", ");
  return `Schema.Literals([${from}]).transform([${to}])`;
}

function rewriteSchemaAttachPropertySignature(node: AnyNode): string | null {
  const key = getMatchText(node, "KEY");
  const value = getMatchText(node, "VALUE");
  if (!key || !value) {
    return null;
  }

  return `(schema) => schema.mapFields((fields) => ({ ...fields, ${key}: Schema.tagDefaultOmit(${value}) }))`;
}

function rewriteSchemaFilter(node: AnyNode): string | null {
  const predicate = getMatchText(node, "PREDICATE");
  if (!predicate) {
    return null;
  }

  return `Schema.check(Schema.makeFilter(${predicate}))`;
}

function rewriteSchemaPick(node: AnyNode): string | null {
  const keys = getMultipleMatchTexts(node, "KEYS");
  if (keys.length === 0) {
    return null;
  }

  return `Struct.pick([${keys.join(", ")}])`;
}

function rewriteSchemaOmit(node: AnyNode): string | null {
  const keys = getMultipleMatchTexts(node, "KEYS");
  if (keys.length === 0) {
    return null;
  }

  return `Struct.omit([${keys.join(", ")}])`;
}

function rewriteSchemaPartial(): string {
  return "Struct.map(Schema.optional)";
}

function rewriteSchemaPartialWithExact(): string {
  return "Struct.map(Schema.optionalKey)";
}

function rewriteSchemaExtendStruct(node: AnyNode): string | null {
  const fields = getMultipleMatchTexts(node, "FIELDS");
  return `Schema.fieldsAssign({ ${fields.join(", ")} })`;
}

function rewriteSchemaPickLiteralPipe(node: AnyNode): string | null {
  const first = getMatchText(node, "FIRST");
  const second = getMatchText(node, "SECOND");
  const rest = getMultipleMatchTexts(node, "REST");
  const picks = getMultipleMatchTexts(node, "PICKS");
  if (!first || !second || picks.length === 0) {
    return null;
  }

  const literalArgs = [first, second, ...rest];
  return `Schema.Literals([${literalArgs.join(", ")}]).pick([${picks.join(", ")}])`;
}

function rewriteSchemaAttachPropertySignaturePipe(node: AnyNode): string | null {
  const schema = getMatchText(node, "SCHEMA");
  const key = getMatchText(node, "KEY");
  const value = getMatchText(node, "VALUE");
  if (!schema || !key || !value) {
    return null;
  }

  return `${schema}.mapFields((fields) => ({ ...fields, ${key}: Schema.tagDefaultOmit(${value}) }))`;
}

function rewriteSchemaDecodingFallbackSucceed(node: AnyNode): string | null {
  const schema = getMatchText(node, "SCHEMA");
  const value = getMatchText(node, "VALUE");
  if (!schema || !value) {
    return null;
  }

  return `${schema}.pipe(Schema.catchDecoding(() => Effect.succeedSome(${value})))`;
}

function rewriteScopeProvideCurried(node: AnyNode): string | null {
  const effect = getMatchText(node, "EFFECT");
  const scope = getMatchText(node, "SCOPE");
  if (!effect || !scope) {
    return null;
  }

  return `Scope.provide(${scope})(${effect})`;
}

function rewriteEffectServiceEffectOnly(node: AnyNode): string | null {
  const self = getMatchText(node, "SELF");
  const id = getMatchText(node, "ID");
  const make = getMatchText(node, "MAKE");
  if (!self || !id || !make) {
    return null;
  }

  return `ServiceMap.Service<${self}>()(${id}, { make: ${make} })`;
}

const FIBER_REF_REFERENCE_MAP = new Map(
  MEMBER_RENAME_RULES.filter(
    (rule) => rule.object === "FiberRef" && rule.toObject === "References",
  ).map((rule) => [rule.from, rule.to]),
);

function rewriteFiberRefGetBuiltIn(node: AnyNode): string | null {
  const name = getMatchText(node, "NAME");
  if (!name) {
    return null;
  }

  const mapped = FIBER_REF_REFERENCE_MAP.get(name);
  if (!mapped) {
    return null;
  }

  return `References.${mapped}`;
}

function normalizeLocallyValue(value: string): string {
  const logLevelMatch = value.trim().match(/^LogLevel\.([A-Za-z_$][A-Za-z0-9_$]*)$/);
  if (logLevelMatch?.[1]) {
    return `"${logLevelMatch[1]}"`;
  }

  return value;
}

function rewriteEffectLocallyBuiltIn(node: AnyNode): string | null {
  const effect = getMatchText(node, "EFFECT");
  const name = getMatchText(node, "NAME");
  const value = getMatchText(node, "VALUE");
  if (!effect || !name || !value) {
    return null;
  }

  const mapped = FIBER_REF_REFERENCE_MAP.get(name);
  if (!mapped) {
    return null;
  }

  const normalizedValue = normalizeLocallyValue(value);
  if (node.text().includes("\n")) {
    return `Effect.provideService(\n  ${effect},\n  References.${mapped},\n  ${normalizedValue}\n)`;
  }

  return `Effect.provideService(${effect}, References.${mapped}, ${normalizedValue})`;
}

export const CALL_REWRITE_RULES: ReadonlyArray<CallRewriteRule> = [
  {
    id: "effect-catchSome-catchFilter",
    pattern:
      "Effect.catchSome(($ERROR) => $CONDITION ? Option.some($HANDLER) : Option.none())",
    rewrite: rewriteCatchSomeToCatchFilter,
    mode: "aggressive",
  },
  {
    id: "effect-catchSome-catchFilter-negated",
    pattern:
      "Effect.catchSome(($ERROR) => $CONDITION ? Option.none() : Option.some($HANDLER))",
    rewrite: rewriteCatchSomeToCatchFilterNegated,
    mode: "aggressive",
  },
  {
    id: "effect-catchSomeDefect-catchDefect",
    pattern:
      "Effect.catchSomeDefect(($DEFECT) => $CONDITION ? Option.some($HANDLER) : Option.none())",
    rewrite: rewriteCatchSomeDefectToCatchDefect,
    mode: "aggressive",
  },
  {
    id: "effect-catchSomeDefect-catchDefect-negated",
    pattern:
      "Effect.catchSomeDefect(($DEFECT) => $CONDITION ? Option.none() : Option.some($HANDLER))",
    rewrite: rewriteCatchSomeDefectToCatchDefectNegated,
    mode: "aggressive",
  },
  {
    id: "effect-service-effect-only",
    pattern: "Effect.Service<$SELF>()($ID, { effect: $MAKE })",
    rewrite: rewriteEffectServiceEffectOnly,
    mode: "aggressive",
  },
  {
    id: "context-tag-class",
    pattern: "Context.Tag($ID)<$SELF, $SHAPE>()",
    rewrite: (node) => {
      const id = getMatchText(node, "ID");
      const self = getMatchText(node, "SELF");
      const shape = getMatchText(node, "SHAPE");
      if (!id || !self || !shape) {
        return null;
      }

      return `ServiceMap.Service<${self}, ${shape}>()(${id})`;
    },
  },
  {
    id: "effect-tag-class",
    pattern: "Effect.Tag($ID)<$SELF, $SHAPE>()",
    rewrite: (node) => {
      const id = getMatchText(node, "ID");
      const self = getMatchText(node, "SELF");
      const shape = getMatchText(node, "SHAPE");
      if (!id || !self || !shape) {
        return null;
      }

      return `ServiceMap.Service<${self}, ${shape}>()(${id})`;
    },
  },
  {
    id: "context-reference",
    pattern: "Context.Reference<$SELF>()($ID, $$$REST)",
    rewrite: (node) => {
      const self = getMatchText(node, "SELF");
      const id = getMatchText(node, "ID");
      const rest = getMultipleMatchTexts(node, "REST");
      if (!self || !id) {
        return null;
      }

      const args = [id, ...rest].join(", ");
      return `ServiceMap.Reference<${self}>(${args})`;
    },
  },
  {
    id: "context-reference-no-opts",
    pattern: "Context.Reference<$SELF>()($ID)",
    rewrite: (node) => {
      const self = getMatchText(node, "SELF");
      const id = getMatchText(node, "ID");
      if (!self || !id) {
        return null;
      }

      return `ServiceMap.Reference<${self}>(${id})`;
    },
  },
  {
    id: "cause-isEmptyType",
    pattern: "Cause.isEmptyType($CAUSE)",
    rewrite: (node) => {
      const cause = getMatchText(node, "CAUSE");
      if (!cause) {
        return null;
      }

      return `${cause}.reasons.length === 0`;
    },
  },
  {
    id: "cause-isSequentialType-removed",
    pattern: "Cause.isSequentialType($$$ARGS)",
    rewrite: () => "false",
    mode: "aggressive",
  },
  {
    id: "cause-isParallelType-removed",
    pattern: "Cause.isParallelType($$$ARGS)",
    rewrite: () => "false",
    mode: "aggressive",
  },
  {
    id: "cause-failures",
    pattern: "Cause.failures($CAUSE)",
    rewrite: (node) => {
      const cause = getMatchText(node, "CAUSE");
      if (!cause) {
        return null;
      }

      return `${cause}.reasons.filter(Cause.isFailReason)`;
    },
  },
  {
    id: "cause-defects",
    pattern: "Cause.defects($CAUSE)",
    rewrite: (node) => {
      const cause = getMatchText(node, "CAUSE");
      if (!cause) {
        return null;
      }

      return `${cause}.reasons.filter(Cause.isDieReason)`;
    },
  },
  {
    id: "scope-extend-curried",
    pattern: "Scope.extend($EFFECT, $SCOPE)",
    rewrite: rewriteScopeProvideCurried,
  },
  {
    id: "fiberref-get-built-in",
    pattern: "FiberRef.get(FiberRef.$NAME)",
    rewrite: rewriteFiberRefGetBuiltIn,
  },
  {
    id: "effect-locally-built-in",
    pattern: "Effect.locally($EFFECT, FiberRef.$NAME, $VALUE)",
    rewrite: rewriteEffectLocallyBuiltIn,
  },
  {
    id: "schema-parseJson",
    pattern: "Schema.parseJson($$$ARGS)",
    rewrite: rewriteParseJson,
  },
  {
    id: "schema-pattern-check",
    pattern: "Schema.pattern($PATTERN)",
    rewrite: rewriteSchemaPattern,
  },
  {
    id: "schema-transformLiteral",
    pattern: "Schema.transformLiteral($FROM, $TO)",
    rewrite: rewriteSchemaTransformLiteral,
  },
  {
    id: "schema-templateLiteralParser-array-args",
    pattern: "Schema.TemplateLiteralParser($$$ARGS)",
    rewrite: rewriteSchemaTemplateLiteralParser,
  },
  {
    id: "schema-templateLiteralParser-binding-to-parts",
    pattern: "Schema.TemplateLiteralParser($ARG)",
    rewrite: rewriteSchemaTemplateLiteralParserFromBinding,
    mode: "aggressive",
  },
  {
    id: "schema-optionalWith-exact",
    pattern: "Schema.optionalWith($SCHEMA, { exact: true })",
    rewrite: rewriteSchemaOptionalWithExact,
  },
  {
    id: "schema-optionalWith-default",
    pattern: "Schema.optionalWith($SCHEMA)",
    rewrite: rewriteSchemaOptionalWithDefault,
    mode: "aggressive",
  },
  {
    id: "schema-optionalToOptional",
    pattern: "Schema.optionalToOptional($FROM, $TO, $OPTIONS)",
    rewrite: rewriteSchemaOptionalToOptional,
    mode: "aggressive",
  },
  {
    id: "schema-optionalToRequired",
    pattern: "Schema.optionalToRequired($FROM, $TO, $OPTIONS)",
    rewrite: rewriteSchemaOptionalToRequired,
    mode: "aggressive",
  },
  {
    id: "schema-requiredToOptional",
    pattern: "Schema.requiredToOptional($FROM, $TO, $OPTIONS)",
    rewrite: rewriteSchemaRequiredToOptional,
    mode: "aggressive",
  },
  {
    id: "schema-rename",
    pattern: "Schema.rename($MAPPING)",
    rewrite: rewriteSchemaRename,
    mode: "aggressive",
  },
  {
    id: "schema-transformOrFail",
    pattern: "Schema.transformOrFail($FROM, $TO, $OPTIONS)",
    rewrite: rewriteSchemaTransformOrFail,
    mode: "aggressive",
  },
  {
    id: "schema-transform",
    pattern: "Schema.transform($FROM, $TO, $OPTIONS)",
    rewrite: rewriteSchemaTransform,
    mode: "aggressive",
  },
  {
    id: "schema-transformLiterals",
    pattern: "Schema.transformLiterals($$$PAIRS)",
    rewrite: rewriteSchemaTransformLiterals,
    mode: "aggressive",
  },
  {
    id: "schema-attachPropertySignature",
    pattern: "Schema.attachPropertySignature($KEY, $VALUE)",
    rewrite: rewriteSchemaAttachPropertySignature,
    mode: "aggressive",
  },
  {
    id: "schema-filter",
    pattern: "Schema.filter($PREDICATE)",
    rewrite: rewriteSchemaFilter,
    mode: "aggressive",
  },
  {
    id: "schema-pick",
    pattern: "Schema.pick($$$KEYS)",
    rewrite: rewriteSchemaPick,
    mode: "aggressive",
  },
  {
    id: "schema-omit",
    pattern: "Schema.omit($$$KEYS)",
    rewrite: rewriteSchemaOmit,
    mode: "aggressive",
  },
  {
    id: "schema-partial",
    pattern: "Schema.partial",
    rewrite: rewriteSchemaPartial,
    mode: "aggressive",
  },
  {
    id: "schema-partialWith-exact",
    pattern: "Schema.partialWith({ exact: true })",
    rewrite: rewriteSchemaPartialWithExact,
    mode: "aggressive",
  },
  {
    id: "schema-extend-struct",
    pattern: "Schema.extend(Schema.Struct({ $$$FIELDS }))",
    rewrite: rewriteSchemaExtendStruct,
    mode: "aggressive",
  },
  {
    id: "schema-pickLiteral-pipe",
    pattern: "Schema.Literal($FIRST, $SECOND, $$$REST).pipe(Schema.pickLiteral($$$PICKS))",
    rewrite: rewriteSchemaPickLiteralPipe,
  },
  {
    id: "schema-attachPropertySignature-pipe",
    pattern: "$SCHEMA.pipe(Schema.attachPropertySignature($KEY, $VALUE))",
    rewrite: rewriteSchemaAttachPropertySignaturePipe,
  },
  {
    id: "schema-decodingFallback-succeed",
    pattern: "$SCHEMA.annotations({ decodingFallback: () => Effect.succeed($VALUE) })",
    rewrite: rewriteSchemaDecodingFallbackSucceed,
  },
  {
    id: "schema-union-array-args",
    pattern: "Schema.Union($$$ARGS)",
    rewrite: (node) => rewriteWithArrayConstructor(node, "Union"),
  },
  {
    id: "schema-tuple-array-args",
    pattern: "Schema.Tuple($$$ARGS)",
    rewrite: (node) => rewriteWithArrayConstructor(node, "Tuple"),
  },
  {
    id: "schema-templateLiteral-array-args",
    pattern: "Schema.TemplateLiteral($$$ARGS)",
    rewrite: (node) => rewriteWithArrayConstructor(node, "TemplateLiteral"),
  },
  {
    id: "schema-record-positional",
    pattern: "Schema.Record({ key: $KEY, value: $VALUE })",
    rewrite: (node) => {
      const key = getMatchText(node, "KEY");
      const value = getMatchText(node, "VALUE");
      if (!key || !value) {
        return null;
      }

      return `Schema.Record(${key}, ${value})`;
    },
  },
  {
    id: "schema-record-positional-swapped",
    pattern: "Schema.Record({ value: $VALUE, key: $KEY })",
    rewrite: (node) => {
      const key = getMatchText(node, "KEY");
      const value = getMatchText(node, "VALUE");
      if (!key || !value) {
        return null;
      }

      return `Schema.Record(${key}, ${value})`;
    },
  },
  {
    id: "schema-literal-null",
    pattern: "Schema.Literal(null)",
    rewrite: () => "Schema.Null",
  },
  {
    id: "schema-literal-union",
    pattern: "Schema.Literal($FIRST, $SECOND, $$$REST)",
    rewrite: (node) => {
      const first = getMatchText(node, "FIRST");
      const second = getMatchText(node, "SECOND");
      const rest = getMultipleMatchTexts(node, "REST");

      if (!first || !second) {
        return null;
      }

      const args = [first, second, ...rest];
      return `Schema.Literals([${args.join(", ")}])`;
    },
  },
  {
    id: "schema-literal-two",
    pattern: "Schema.Literal($FIRST, $SECOND)",
    rewrite: (node) => {
      const first = getMatchText(node, "FIRST");
      const second = getMatchText(node, "SECOND");

      if (!first || !second) {
        return null;
      }

      return `Schema.Literals([${first}, ${second}])`;
    },
  },
];
