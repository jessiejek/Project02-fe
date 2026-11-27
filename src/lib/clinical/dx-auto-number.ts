//JJQR - AI (2026-11-27) - why: owner: "if each as own line give me lines when i type". In "Each on its own line" mode the Diagnosis / Impressions box numbers the next line by itself:
// Enter after "N) text" adds "N+1) " on the new line; Enter on a blank numbered line removes that marker instead of adding a line; typing the number yourself right after
// the automatic one ("2) 2)") keeps only yours; Enter just before a line that already has a marker adds nothing. Works on the text before/after one edit, so the web
// textarea and the desktop app use the same rules. Mirrored exactly in the desktop's ClinicNode.Core/Doctor/DxAutoNumber.cs (same test cases).
export interface DxEdit {
  text: string;
  caret: number;
}

const MARKER = /^([ \t]*)([0-9]{1,2})([.)])[ \t]*/;
const STARTS_WITH_MARKER = /^[ \t]*[0-9]{1,2}[.)]/;
const DOUBLED = /^([ \t]*)[0-9]{1,2}[.)] ([0-9]{1,2}[.)])$/;

function isNl(c: string): boolean {
  return c === "\n" || c === "\r";
}

function lineStart(s: string, i: number): number {
  let k = i;
  while (k > 0 && !isNl(s[k - 1])) k--;
  return k;
}

function lineEnd(s: string, i: number): number {
  let k = i;
  while (k < s.length && !isNl(s[k])) k++;
  return k;
}

/** The text (and caret) after automatic numbering, or null when the edit needs nothing. `prev` = before the edit, `next` = after it. */
export function dxAutoNumberEdit(prev: string, next: string): DxEdit | null {
  if (next.length !== prev.length + 1) return null; // one typed character only (not paste / delete)
  let i = 0;
  while (i < prev.length && prev[i] === next[i]) i++;
  if (prev.slice(i) !== next.slice(i + 1)) return null;
  const c = next[i];
  if (isNl(c)) {
    if (c === "\n" && i > 0 && prev[i - 1] === "\r") return null; // the "\n" of a Windows "\r\n"
    const ls = lineStart(prev, i);
    const before = prev.slice(ls, i);
    const m = MARKER.exec(before);
    if (!m) return null;
    const rest = prev.slice(i, lineEnd(prev, i));
    if (before.slice(m[0].length).trim() === "" && rest.trim() === "") {
      // blank numbered line: Enter takes the marker away (no new line)
      return { text: prev.slice(0, ls) + prev.slice(i), caret: ls };
    }
    if (STARTS_WITH_MARKER.test(rest)) return null; // the next part already has its number
    const n = parseInt(m[2], 10) + 1;
    if (n > 99) return null;
    const marker = m[1] + n + m[3] + " ";
    return { text: prev.slice(0, i) + c + marker + rest.replace(/^[ \t]+/, "") + prev.slice(i + rest.length), caret: i + 1 + marker.length };
  }
  if (c === ")" || c === ".") {
    const ls = lineStart(next, i);
    const d = DOUBLED.exec(next.slice(ls, i + 1));
    if (!d) return null;
    // "2) 2)": she typed the number herself after the automatic one; keep hers
    const keep = d[1] + d[2];
    return { text: next.slice(0, ls) + keep + next.slice(i + 1), caret: ls + keep.length };
  }
  return null;
}
//JJQR - END
