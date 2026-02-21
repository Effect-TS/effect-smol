import type { Edit } from "codemod:ast-grep";
import { MEMBER_RENAME_RULES } from "../rules/member-renames";
import type { MemberRenameRule } from "../rules/member-renames";
import type { RootNode, TransformPass } from "../types";

function buildReplacement(objectName: string, methodName: string): string {
  return `${objectName}.${methodName}`;
}

function collectRenamesForRule(rootNode: RootNode, rule: MemberRenameRule): Array<Edit> {
  const nodes = rootNode.findAll({
    rule: {
      pattern: `${rule.object}.${rule.from}`,
    },
  });

  const replacement = buildReplacement(rule.toObject ?? rule.object, rule.to);
  return nodes.map((node: any) => node.replace(replacement));
}

export const memberRenamesPass: TransformPass = (rootNode) => {
  const edits: Array<Edit> = [];

  for (const rule of MEMBER_RENAME_RULES) {
    edits.push(...collectRenamesForRule(rootNode, rule));
  }

  return edits;
};
