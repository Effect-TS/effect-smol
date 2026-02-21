import type { Edit } from "codemod:ast-grep";

function toEditKey(edit: Edit): string {
  return `${edit.startPos}:${edit.endPos}:${edit.insertedText}`;
}

interface IndexedEdit {
  readonly edit: Edit;
  readonly index: number;
}

function editSpan(edit: Edit): number {
  return edit.endPos - edit.startPos;
}

function overlaps(left: Edit, right: Edit): boolean {
  return left.startPos < right.endPos && right.startPos < left.endPos;
}

function preferEdit(left: IndexedEdit, right: IndexedEdit): IndexedEdit {
  const leftSpan = editSpan(left.edit);
  const rightSpan = editSpan(right.edit);
  if (rightSpan > leftSpan) {
    return right;
  }
  if (leftSpan > rightSpan) {
    return left;
  }

  // For equally-sized overlaps, keep the later-produced edit.
  return right.index > left.index ? right : left;
}

export function dedupeAndSortEdits(edits: ReadonlyArray<Edit>): Array<Edit> {
  const unique = new Map<string, Edit>();

  for (const edit of edits) {
    unique.set(toEditKey(edit), edit);
  }

  const withIndex: Array<IndexedEdit> = Array.from(unique.values()).map((edit, index) => ({
    edit,
    index,
  }));
  withIndex.sort((left, right) => {
    if (left.edit.startPos !== right.edit.startPos) {
      return left.edit.startPos - right.edit.startPos;
    }

    const spanDiff = editSpan(right.edit) - editSpan(left.edit);
    if (spanDiff !== 0) {
      return spanDiff;
    }

    return left.index - right.index;
  });

  const selected: Array<IndexedEdit> = [];
  for (const item of withIndex) {
    const previous = selected[selected.length - 1];
    if (!previous || !overlaps(previous.edit, item.edit)) {
      selected.push(item);
      continue;
    }

    selected[selected.length - 1] = preferEdit(previous, item);
  }

  return selected.map((item) => item.edit).sort((left, right) => {
    if (left.startPos !== right.startPos) {
      return right.startPos - left.startPos;
    }

    return right.endPos - left.endPos;
  });
}
