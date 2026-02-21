export interface WarningPatternRule {
  readonly id: string;
  readonly pattern: string;
}

// APIs that need manual migration logic or were removed in v4.
export const WARNING_PATTERN_RULES: ReadonlyArray<WarningPatternRule> = [
  { id: "effect-catchSome", pattern: "Effect.catchSome($$$ARGS)" },
  { id: "effect-catchSomeDefect-removed", pattern: "Effect.catchSomeDefect($$$ARGS)" },
  { id: "effect-forkAll-removed", pattern: "Effect.forkAll($$$ARGS)" },
  {
    id: "effect-forkWithErrorHandler-removed",
    pattern: "Effect.forkWithErrorHandler($$$ARGS)",
  },
  { id: "fiberref-set-manual", pattern: "FiberRef.set($$$ARGS)" },
  { id: "cause-isSequentialType-removed", pattern: "Cause.isSequentialType($$$ARGS)" },
  { id: "cause-isParallelType-removed", pattern: "Cause.isParallelType($$$ARGS)" },
  { id: "effect-service-manual", pattern: "Effect.Service($$$ARGS)" },
  { id: "effect-service-manual", pattern: "Effect.Service<$SELF>()($$$ARGS)" },
  {
    id: "services-context-reference-class-manual",
    pattern: "class $NAME extends Context.Reference<$TYPE>()($$$ARGS) {}",
  },
  { id: "schema-optionalWith-manual", pattern: "Schema.optionalWith($$$ARGS)" },
  {
    id: "schema-optionalToOptional-manual",
    pattern: "Schema.optionalToOptional($$$ARGS)",
  },
  {
    id: "schema-optionalToRequired-manual",
    pattern: "Schema.optionalToRequired($$$ARGS)",
  },
  {
    id: "schema-requiredToOptional-manual",
    pattern: "Schema.requiredToOptional($$$ARGS)",
  },
  { id: "schema-rename-manual", pattern: "Schema.rename($$$ARGS)" },
  { id: "schema-transformOrFail-manual", pattern: "Schema.transformOrFail($$$ARGS)" },
  { id: "schema-transform-manual", pattern: "Schema.transform($$$ARGS)" },
  { id: "schema-transformLiterals-manual", pattern: "Schema.transformLiterals($$$ARGS)" },
  { id: "schema-templateLiteralParser-manual", pattern: "Schema.TemplateLiteralParser($$$ARGS)" },
  { id: "schema-attachPropertySignature-manual", pattern: "Schema.attachPropertySignature($$$ARGS)" },
  { id: "schema-filter-manual", pattern: "Schema.filter($$$ARGS)" },
  { id: "schema-pick-manual", pattern: "Schema.pick($$$ARGS)" },
  { id: "schema-omit-manual", pattern: "Schema.omit($$$ARGS)" },
  { id: "schema-partial-manual", pattern: "Schema.partial" },
  { id: "schema-partialWith-manual", pattern: "Schema.partialWith($$$ARGS)" },
  { id: "schema-extend-manual", pattern: "Schema.extend($$$ARGS)" },
  {
    id: "schema-decodingFallback-manual",
    pattern: "$SCHEMA.annotations({ decodingFallback: $VALUE })",
  },
];
