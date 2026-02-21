import type { Transform } from "codemod:ast-grep";
import { dedupeAndSortEdits } from "./lib/edit-utils";
import { callRewritesPass } from "./lib/passes/call-rewrites";
import { importNormalizationPass } from "./lib/passes/import-normalization";
import { memberRenamesPass } from "./lib/passes/member-renames";
import { warningAnnotationsPass } from "./lib/passes/warning-annotations";
import { yieldableRewritesPass } from "./lib/passes/yieldable-rewrites";
import type { TransformPass } from "./lib/types";
import type JS from "codemod:ast-grep/langs/javascript";
import type TS from "codemod:ast-grep/langs/typescript";
import type TSX from "codemod:ast-grep/langs/tsx";

const transform: Transform<TS | TSX | JS> = async (root) => {
  const rootNode = root.root();
  const passes: ReadonlyArray<TransformPass> = [
    memberRenamesPass,
    warningAnnotationsPass,
    callRewritesPass,
    yieldableRewritesPass,
    importNormalizationPass,
  ];

  const edits = passes.flatMap((pass) => pass(rootNode));
  const finalEdits = dedupeAndSortEdits(edits);

  if (finalEdits.length === 0) {
    return null;
  }

  return rootNode.commitEdits(finalEdits);
};

export default transform;
