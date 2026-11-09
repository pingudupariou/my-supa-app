/** Copy a table to the clipboard as tab-separated values so Ctrl+V in Excel gives one row and one column per cell. */

export type Cell = string | number | null | undefined;

/** French-friendly number: comma decimal separator, no thousands separator, no trailing zeros — Excel reads it as a number. */
export const num = (v: Cell, dp = 2): string => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '';
  let s = v.toFixed(dp).replace('.', ',');
  if (s.includes(',')) s = s.replace(/0+$/, '').replace(/,$/, '');
  return s;
};

/** Text cell: tabs and line breaks would shift the pasted grid, so they become spaces. */
export const txt = (v: Cell): string => String(v ?? '').replace(/[\t\n\r]+/g, ' ').trim();

export function toTSV(headers: string[], body: Cell[][]): string {
  return [
    headers.map(txt).join('\t'),
    ...body.map((r) => r.map((c) => (typeof c === 'number' ? num(c) : txt(c))).join('\t')),
  ].join('\n');
}

/** Copy a table; returns false when the browser refuses (then the user can still select the cells by hand). */
export async function copyTable(headers: string[], body: Cell[][]): Promise<boolean> {
  const text = toTSV(headers, body);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path below */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
