import type { Edit } from "codemod:ast-grep";
import { WARNING_PATTERN_RULES } from "../rules/warning-patterns";
import type { WarningPatternRule } from "../rules/warning-patterns";
import { warningCommentForRule } from "../rules/warnings";
import type { RootNode, TransformPass } from "../types";

const WARNING_MARKER = "TODO(effect-v4-codemod)";

function hasWarningPrefix(node: any, ruleId: string): boolean {
  const rootSource = node.getRoot().source();
  const start = node.range().start.index;
  const windowStart = Math.max(0, start - 320);
  const prefix = rootSource.slice(windowStart, start);

  const match = prefix.match(
    /\/\*\s*TODO\(effect-v4-codemod\):\s*manual migration required for\s+([^*]+?)\s*\*\/\s*$/s,
  );
  if (!match) {
    return false;
  }

  return match[1].trim() === ruleId;
}

function isV4TemplateLiteralParserShape(node: any): boolean {
  const args = node
    .getMultipleMatches("ARGS")
    .map((match: any) => match.text().trim())
    .filter((text: string) => text.length > 0 && text !== ",");

  if (args.length !== 1) {
    return false;
  }

  const arg = args[0] ?? "";
  if (arg.startsWith("[") && arg.endsWith("]")) {
    return true;
  }

  return arg.endsWith(".parts");
}

function shouldSkipRuleAnnotation(node: any, ruleId: string): boolean {
  if (ruleId === "schema-templateLiteralParser-manual") {
    return isV4TemplateLiteralParserShape(node);
  }

  return false;
}

function annotateNode(node: any, ruleId: string): Edit | null {
  const text = node.text();
  if (text.includes(WARNING_MARKER)) {
    return null;
  }

  if (hasWarningPrefix(node, ruleId)) {
    return null;
  }

  if (shouldSkipRuleAnnotation(node, ruleId)) {
    return null;
  }

  const comment = warningCommentForRule(ruleId);
  return node.replace(`${comment} ${text}`);
}

function collectRuleEdits(rootNode: RootNode, rule: WarningPatternRule): Array<Edit> {
  const nodes = rootNode.findAll({
    rule: {
      pattern: rule.pattern,
    },
  });

  const edits: Array<Edit> = [];
  for (const node of nodes) {
    const edit = annotateNode(node, rule.id);
    if (edit) {
      edits.push(edit);
    }
  }

  return edits;
}

export const warningAnnotationsPass: TransformPass = (rootNode) => {
  const edits: Array<Edit> = [];

  for (const rule of WARNING_PATTERN_RULES) {
    edits.push(...collectRuleEdits(rootNode, rule));
  }

  return edits;
};
