//JJQR - AI (Nov 19, 2026) - new file: insert a phrase into a textarea value at the caret, on its own line
export interface InsertResult {
  value: string;
  /** Caret position right after the inserted phrase. */
  caret: number;
}

/**
 * Inserts `text` at the caret on a new line. Existing text is never replaced:
 * a selection is collapsed to its end. If the caret is unknown/out of range
 * (e.g. the textarea was never focused), the phrase goes at the end.
 */
export function insertAtCaret(value: string, text: string, selStart?: number | null, selEnd?: number | null): InsertResult {
  const phrase = text.trim();
  if (!phrase) return { value, caret: value.length };
  const end = typeof selEnd === "number" ? selEnd : typeof selStart === "number" ? selStart : null;
  const pos = end === null || !Number.isFinite(end) || end < 0 || end > value.length ? value.length : end;
  const before = value.slice(0, pos);
  const after = value.slice(pos);
  const lead = before === "" || before.endsWith("\n") ? "" : "\n";
  const trail = after === "" || after.startsWith("\n") ? "" : "\n";
  const inserted = `${lead}${phrase}${trail}`;
  const next = `${before}${inserted}${after}`;
  return { value: next, caret: before.length + lead.length + phrase.length };
}
//JJQR - END
