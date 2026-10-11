/** Trailing arithmetic mean of seven actual, consecutive daily values.
 * Missing dates, null ratios and incomplete days leave a gap, never an invented zero.
 */
export function withMovingAverage(rows: Record<string, any>[], keys: string[]) {
  return rows.map((row, index) => {
    const window = rows.slice(Math.max(0, index - 6), index + 1);
    const end = Date.parse(row.b + 'T00:00:00Z');
    const complete = window.length === 7 && window.every((item, offset) =>
      !item.partial && Date.parse(item.b + 'T00:00:00Z') === end - (6 - offset) * 86400000);
    return { ...row, ...Object.fromEntries(keys.map(key => [
      'ma7_' + key,
      complete && window.every(item => typeof item[key] === 'number' && Number.isFinite(item[key]))
        ? window.reduce((sum, item) => sum + item[key], 0) / 7 : null,
    ])) };
  });
}