export const WARNING_TODO_TEMPLATE =
  "/* TODO(effect-v4-codemod): manual migration required for <rule-id> */";

export function warningCommentForRule(ruleId: string): string {
  return WARNING_TODO_TEMPLATE.replace("<rule-id>", ruleId);
}
