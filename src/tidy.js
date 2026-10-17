// CSV の行データを整形する純粋関数。ファイル入出力はしない。
import { normalizeDate } from './date.js';

/**
 * 1 行目をヘッダーとして扱い、次の順で整形する。
 * 1. 全セルの前後の空白を削除
 * 2. 日付らしい列を判定し、YYYY-MM-DD に統一
 * 3. 完全に重複した行を削除（正規化した後に比較するので、表記だけ違う重複も消える）
 *
 * @param {string[][]} rows
 * @param {{ dateThreshold?: number }} [options]
 *   dateThreshold: 空でない値のうちこの割合以上が日付として読める列を日付列とみなす
 */
export function tidy(rows, { dateThreshold = 0.8 } = {}) {
  const stats = {
    trimmed: 0,
    datesNormalized: 0,
    duplicatesRemoved: 0,
    dateColumns: [],
    unparsedDates: [],
  };
  if (rows.length === 0) return { rows: [], stats };

  const trimmed = rows.map((r) => r.map((cell) => {
    const t = cell.trim();
    if (t !== cell) stats.trimmed++;
    return t;
  }));
  const [header, ...body] = trimmed;

  const width = Math.max(...trimmed.map((r) => r.length));
  const dateCols = [];
  for (let col = 0; col < width; col++) {
    const values = body.map((r) => r[col]).filter((v) => v !== undefined && v !== '');
    if (values.length === 0) continue;
    const parsable = values.filter((v) => normalizeDate(v) !== null).length;
    if (parsable / values.length >= dateThreshold) dateCols.push(col);
  }
  stats.dateColumns = dateCols.map((col) => header[col] ?? `列${col + 1}`);

  body.forEach((row, i) => {
    for (const col of dateCols) {
      const value = row[col];
      if (value === undefined || value === '') continue;
      const normalized = normalizeDate(value);
      if (normalized === null) {
        // ヘッダーを 1 行目として数えた行番号
        stats.unparsedDates.push({ row: i + 2, column: header[col] ?? `列${col + 1}`, value });
      } else if (normalized !== value) {
        row[col] = normalized;
        stats.datesNormalized++;
      }
    }
  });

  const seen = new Set();
  const unique = body.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      stats.duplicatesRemoved++;
      return false;
    }
    seen.add(key);
    return true;
  });

  return { rows: [header, ...unique], stats };
}
