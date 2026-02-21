import type { Edit } from "codemod:ast-grep";
import { replaceNode } from "../ast-utils";
import { isAggressiveMode } from "../migration-mode";
import { CALL_REWRITE_RULES } from "../rules/call-rewrites";
import type { CallRewriteRule } from "../rules/call-rewrites";
import type { RootNode, TransformPass } from "../types";

const WARNING_MARKER = "TODO(effect-v4-codemod)";

function hasWarningPrefix(node: any): boolean {
  const rootSource = node.getRoot().source();
  const start = node.range().start.index;
  const windowStart = Math.max(0, start - 320);
  const prefix = rootSource.slice(windowStart, start);
  return prefix.includes(WARNING_MARKER);
}

function collectRuleEdits(rootNode: RootNode, rule: CallRewriteRule): Array<Edit> {
  const nodes = rootNode.findAll({
    rule: {
      pattern: rule.pattern,
    },
  });

  const edits: Array<Edit> = [];
  for (const node of nodes) {
    if (node.text().includes(WARNING_MARKER) || hasWarningPrefix(node)) {
      continue;
    }

    const replacement = rule.rewrite(node);
    if (!replacement) {
      continue;
    }

    const edit = replaceNode(node, replacement);
    if (edit) {
      edits.push(edit);
    }
  }

  return edits;
}

export const callRewritesPass: TransformPass = (rootNode) => {
  const edits: Array<Edit> = [];
  const aggressive = isAggressiveMode();

  for (const rule of CALL_REWRITE_RULES) {
    if (rule.mode === "aggressive" && !aggressive) {
      continue;
    }

    edits.push(...collectRuleEdits(rootNode, rule));
  }

  return edits;
};
