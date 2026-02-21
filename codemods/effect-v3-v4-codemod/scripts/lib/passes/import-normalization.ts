import type { Edit } from "codemod:ast-grep";
import { replaceNode } from "../ast-utils";
import { isAggressiveMode } from "../migration-mode";
import { MEMBER_RENAME_RULES } from "../rules/member-renames";
import type { RootNode, TransformPass } from "../types";

function isEffectImport(node: any): boolean {
  const source = node.getMatch("SOURCE");
  if (!source) {
    return false;
  }

  const text = source.text().trim();
  return text === '"effect"' || text === "'effect'";
}

function collectActiveObjectRenames(rootNode: RootNode): Map<string, string> {
  const active = new Map<string, string>();

  for (const rule of MEMBER_RENAME_RULES) {
    if (!rule.toObject || rule.toObject === rule.object) {
      continue;
    }

    const found = rootNode.find({
      rule: {
        pattern: `${rule.object}.${rule.from}`,
      },
    });

    if (found) {
      active.set(rule.object, rule.toObject);
    }
  }

  const contextToServiceMapPatterns = [
    "Context.Tag($$$ARGS)",
    "Context.Reference($$$ARGS)",
    "Context.Reference<$TYPE>()($$$ARGS)",
    "Context.GenericTag($$$ARGS)",
  ];
  for (const pattern of contextToServiceMapPatterns) {
    const found = rootNode.find({
      rule: {
        pattern,
      },
    });
    if (found) {
      active.set("Context", "ServiceMap");
      break;
    }
  }

  return active;
}

function collectRequiredEffectImports(rootNode: RootNode, aggressive: boolean): Set<string> {
  const required = new Set<string>();
  const needs = [
    "ServiceMap",
    "References",
    "Fiber",
    "Struct",
    "SchemaGetter",
    "SchemaTransformation",
    "Filter",
  ] as const;

  for (const symbol of needs) {
    const found = rootNode.find({
      rule: {
        pattern: `${symbol}.$$$ARGS`,
      },
    });
    if (found) {
      required.add(symbol);
    }
  }

  const serviceMapTriggerPatterns = [
    "Context.Tag($$$ARGS)",
    "Effect.Tag($$$ARGS)",
    "Context.Reference($$$ARGS)",
    "Context.Reference<$TYPE>()($$$ARGS)",
    "Context.GenericTag($$$ARGS)",
  ];
  for (const pattern of serviceMapTriggerPatterns) {
    const found = rootNode.find({
      rule: {
        pattern,
      },
    });
    if (found) {
      required.add("ServiceMap");
      break;
    }
  }

  const fiberJoinTriggerPatterns = [
    "yield* Effect.fork($$$ARGS)",
    "yield* Effect.forkChild($$$ARGS)",
    "yield* Effect.forkDetach($$$ARGS)",
    "yield* Effect.forkScoped($$$ARGS)",
    "yield* Effect.forkIn($$$ARGS)",
  ];
  for (const pattern of fiberJoinTriggerPatterns) {
    const found = rootNode.find({
      rule: {
        pattern,
      },
    });
    if (found) {
      required.add("Fiber");
      break;
    }
  }

  const triggerPatternsBySymbol: Record<string, ReadonlyArray<string>> = {};
  if (aggressive) {
    triggerPatternsBySymbol.Struct = [
      "Schema.pick($$$ARGS)",
      "Schema.omit($$$ARGS)",
      "Schema.partial",
      "Schema.partialWith({ exact: true })",
      "Schema.extend(Schema.Struct({ $$$FIELDS }))",
    ];
    triggerPatternsBySymbol.SchemaGetter = [
      "Schema.optionalToOptional($FROM, $TO, $OPTIONS)",
      "Schema.optionalToRequired($FROM, $TO, $OPTIONS)",
      "Schema.requiredToOptional($FROM, $TO, $OPTIONS)",
    ];
    triggerPatternsBySymbol.SchemaTransformation = [
      "Schema.transform($FROM, $TO, $OPTIONS)",
      "Schema.transformOrFail($FROM, $TO, $OPTIONS)",
    ];
    triggerPatternsBySymbol.Filter = [
      "Effect.catchSome(($ERROR) => $CONDITION ? Option.some($HANDLER) : Option.none())",
      "Effect.catchSome(($ERROR) => $CONDITION ? Option.none() : Option.some($HANDLER))",
    ];
    triggerPatternsBySymbol.ServiceMap = [
      "Effect.Service<$SELF>()($ID, { effect: $MAKE })",
    ];
  }

  for (const [symbol, patterns] of Object.entries(triggerPatternsBySymbol)) {
    for (const pattern of patterns) {
      const found = rootNode.find({
        rule: {
          pattern,
        },
      });
      if (!found) {
        continue;
      }

      required.add(symbol);
      break;
    }
  }

  return required;
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function splitByWhitespace(text: string): Array<string> {
  const tokens: Array<string> = [];
  let current = "";

  for (const char of text) {
    if (isWhitespace(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function isIdentifierStart(char: string): boolean {
  if (char === "_" || char === "$") {
    return true;
  }

  return (
    (char >= "a" && char <= "z") ||
    (char >= "A" && char <= "Z")
  );
}

function isIdentifierPart(char: string): boolean {
  if (isIdentifierStart(char)) {
    return true;
  }

  return char >= "0" && char <= "9";
}

function isSimpleIdentifier(text: string): boolean {
  if (text.length === 0) {
    return false;
  }

  const first = text[0];
  if (!first || !isIdentifierStart(first)) {
    return false;
  }

  for (let index = 1; index < text.length; index++) {
    const char = text[index];
    if (!char || !isIdentifierPart(char)) {
      return false;
    }
  }

  return true;
}

interface ParsedSpecifier {
  readonly typePrefix: string;
  readonly imported: string;
  readonly alias: string | null;
}

function parseImportSpecifier(rawSpec: string): ParsedSpecifier | null {
  const trimmed = rawSpec.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const typePrefix = trimmed.startsWith("type ") ? "type " : "";
  const body = typePrefix.length > 0 ? trimmed.slice(5).trim() : trimmed;
  if (body.length === 0) {
    return null;
  }

  const tokens = splitByWhitespace(body);
  if (tokens.length === 1) {
    const imported = tokens[0];
    if (!imported || !isSimpleIdentifier(imported)) {
      return null;
    }
    return { typePrefix, imported, alias: null };
  }

  if (tokens.length === 3 && tokens[1] === "as") {
    const imported = tokens[0];
    const alias = tokens[2];
    if (!imported || !alias || !isSimpleIdentifier(imported) || !isSimpleIdentifier(alias)) {
      return null;
    }
    return { typePrefix, imported, alias };
  }

  return null;
}

function rewriteEffectImport(node: any, renames: Map<string, string>, requiredImports: Set<string>): string | null {
  const source = node.getMatch("SOURCE");
  if (!source) {
    return null;
  }
  const sourceText = source.text().trim();

  const rawSpecs = node
    .getMultipleMatches("SPECS")
    .map((match: any) => match.text().trim())
    .filter((text: string) => text.length > 0 && text !== ",");

  if (rawSpecs.length === 0) {
    return null;
  }

  let changed = false;
  const importedRuntimeSymbols = new Set<string>();
  const dedupe = new Set<string>();
  const rewrittenSpecs: Array<string> = [];

  for (const rawSpec of rawSpecs) {
    const parsed = parseImportSpecifier(rawSpec);
    if (!parsed) {
      dedupe.add(rawSpec);
      rewrittenSpecs.push(rawSpec);
      continue;
    }
    const { typePrefix, imported, alias } = parsed;
    const renamed = renames.get(imported) ?? imported;

    if (renamed !== imported) {
      changed = true;
    }

    const rewritten = alias ? `${typePrefix}${renamed} as ${alias}` : `${typePrefix}${renamed}`;

    if (typePrefix === "") {
      importedRuntimeSymbols.add(alias ?? renamed);
    }

    if (!dedupe.has(rewritten)) {
      dedupe.add(rewritten);
      rewrittenSpecs.push(rewritten);
    }
  }

  const missingImports = Array.from(requiredImports).filter(
    (name) => !importedRuntimeSymbols.has(name),
  );
  if (missingImports.length > 0) {
    changed = true;
    for (const missing of missingImports.sort()) {
      if (!dedupe.has(missing)) {
        dedupe.add(missing);
        rewrittenSpecs.push(missing);
      }
    }
  }

  if (!changed) {
    return null;
  }

  const hasSemicolon = node.text().trimEnd().endsWith(";");
  return `import { ${rewrittenSpecs.join(", ")} } from ${sourceText}${hasSemicolon ? ";" : ""}`;
}

export const importNormalizationPass: TransformPass = (rootNode) => {
  const activeRenames = collectActiveObjectRenames(rootNode);
  const aggressive = isAggressiveMode();
  const requiredImports = collectRequiredEffectImports(rootNode, aggressive);

  if (activeRenames.size === 0 && requiredImports.size === 0) {
    return [];
  }

  const edits: Array<Edit> = [];
  const importNodes = rootNode.findAll({
    rule: {
      pattern: "import { $$$SPECS } from $SOURCE",
    },
  });

  for (const node of importNodes) {
    if (!isEffectImport(node)) {
      continue;
    }

    const rewritten = rewriteEffectImport(node, activeRenames, requiredImports);
    if (!rewritten) {
      continue;
    }

    const edit = replaceNode(node, rewritten);
    if (edit) {
      edits.push(edit);
    }
  }

  return edits;
};
