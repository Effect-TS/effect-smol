import type { Edit } from "codemod:ast-grep";
import { getMatchText, replaceNode } from "../ast-utils";
import { isAggressiveMode } from "../migration-mode";
import type { RootNode, TransformPass } from "../types";

type YieldableKind = "ref" | "deferred" | "fiber";

const DECLARATION_PATTERNS: Record<YieldableKind, ReadonlyArray<string>> = {
  ref: [
    "const $NAME = yield* Ref.make($$$ARGS)",
    "const $NAME = yield* Ref.make<$TYPE>($$$ARGS)",
  ],
  deferred: [
    "const $NAME = yield* Deferred.make($$$ARGS)",
    "const $NAME = yield* Deferred.make<$TYPE>($$$ARGS)",
  ],
  fiber: [
    "const $NAME = yield* Effect.fork($$$ARGS)",
    "const $NAME = yield* Effect.forkChild($$$ARGS)",
    "const $NAME = yield* Effect.forkDetach($$$ARGS)",
    "const $NAME = yield* Effect.forkScoped($$$ARGS)",
    "const $NAME = yield* Effect.forkIn($$$ARGS)",
  ],
};

function declarationMatchesIdentifier(definitionNode: any, pattern: string, name: string): boolean {
  const matched = definitionNode.inside({
    rule: {
      pattern,
    },
  });
  if (!matched) {
    return false;
  }

  const statement = definitionNode.find({
    rule: {
      pattern,
    },
  });
  if (!statement) {
    return false;
  }

  const matchedName = getMatchText(statement, "NAME");
  return matchedName === name;
}

function kindFromDefinitionNode(definitionNode: any, name: string): YieldableKind | null {
  const matchedKinds: Array<YieldableKind> = [];

  for (const kind of ["ref", "deferred", "fiber"] as const) {
    const matched = DECLARATION_PATTERNS[kind].some((pattern) =>
      declarationMatchesIdentifier(definitionNode, pattern, name),
    );
    if (matched) {
      matchedKinds.push(kind);
    }
  }

  if (matchedKinds.length !== 1) {
    return null;
  }

  return matchedKinds[0] ?? null;
}

function kindFromDefinition(rootNode: RootNode, identifierNode: any): YieldableKind | null {
  if (!identifierNode.is("identifier")) {
    return null;
  }

  const name = identifierNode.text();

  const definition = identifierNode.definition({ resolveExternal: false });
  if (!definition || definition.kind !== "local") {
    return null;
  }

  if (definition.root.filename() !== rootNode.getRoot().filename()) {
    return null;
  }

  return kindFromDefinitionNode(definition.node, name);
}

interface BindingSummary {
  readonly kindsByName: Map<string, Set<YieldableKind>>;
  readonly occurrencesByName: Map<string, number>;
}

function collectBindingSummary(rootNode: RootNode): BindingSummary {
  const kindsByName = new Map<string, Set<YieldableKind>>();
  const occurrencesByName = new Map<string, number>();

  for (const kind of ["ref", "deferred", "fiber"] as const) {
    for (const pattern of DECLARATION_PATTERNS[kind]) {
      const nodes = rootNode.findAll({
        rule: {
          pattern,
        },
      });

      for (const node of nodes) {
        const nameNode = node.getMatch("NAME");
        if (!nameNode || !nameNode.is("identifier")) {
          continue;
        }
        const name = nameNode.text();

        const currentKinds = kindsByName.get(name) ?? new Set<YieldableKind>();
        currentKinds.add(kind);
        kindsByName.set(name, currentKinds);

        const currentCount = occurrencesByName.get(name) ?? 0;
        occurrencesByName.set(name, currentCount + 1);
      }
    }
  }

  return { kindsByName, occurrencesByName };
}

function kindFromFallbackSummary(summary: BindingSummary, name: string): YieldableKind | null {
  const kinds = summary.kindsByName.get(name);
  const occurrences = summary.occurrencesByName.get(name) ?? 0;

  if (!kinds || kinds.size !== 1 || occurrences !== 1) {
    return null;
  }

  const [kind] = Array.from(kinds);
  return kind ?? null;
}

function replacementFor(kind: YieldableKind, identifier: string): string {
  switch (kind) {
    case "ref":
      return `yield* Ref.get(${identifier})`;
    case "deferred":
      return `yield* Deferred.await(${identifier})`;
    case "fiber":
      return `yield* Fiber.join(${identifier})`;
  }
}

export const yieldableRewritesPass: TransformPass = (rootNode) => {
  const edits: Array<Edit> = [];
  const aggressive = isAggressiveMode();
  const fallbackSummary = aggressive ? collectBindingSummary(rootNode) : null;
  const yieldNodes = rootNode.findAll({
    rule: {
      pattern: "yield* $VALUE",
    },
  });

  for (const node of yieldNodes) {
    const valueNode = node.getMatch("VALUE");
    if (!valueNode || !valueNode.is("identifier")) {
      continue;
    }
    const value = valueNode.text();

    const kindFromSemantics = kindFromDefinition(rootNode, valueNode);
    const kindFromFallback =
      aggressive && fallbackSummary ? kindFromFallbackSummary(fallbackSummary, value) : null;
    const kind = kindFromSemantics ?? kindFromFallback;
    if (!kind) {
      continue;
    }

    const replacement = replacementFor(kind, value);
    const edit = replaceNode(node, replacement);
    if (edit) {
      edits.push(edit);
    }
  }

  return edits;
};
