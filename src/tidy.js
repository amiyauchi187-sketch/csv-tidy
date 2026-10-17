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
    trimmedByColumn: {},
    datesNormalized: 0,
    datesNormalizedByColumn: {},
    duplicatesRemoved: 0,
    duplicateRows: [],
    dateColumns: [],
    unparsedDates: [],
  };
  if (rows.length === 0) return { rows: [], stats };

  const columnName = (col) => rows[0][col]?.trim() || `列${col + 1}`;
  const countUp = (counts, col) => {
    const name = columnName(col);
    counts[name] = (counts[name] ?? 0) + 1;
  };

  const trimmed = rows.map((r) => r.map((cell, col) => {
    const t = cell.trim();
    if (t !== cell) {
      stats.trimmed++;
      countUp(stats.trimmedByColumn, col);
    }
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
  stats.dateColumns = dateCols.map(columnName);

  // 行番号はヘッダーを 1 行目として数える
  body.forEach((row, i) => {
    for (const col of dateCols) {
      const value = row[col];
      if (value === undefined || value === '') continue;
      const normalized = normalizeDate(value);
      if (normalized === null) {
        stats.unparsedDates.push({ row: i + 2, column: columnName(col), value });
      } else if (normalized !== value) {
        row[col] = normalized;
        stats.datesNormalized++;
        countUp(stats.datesNormalizedByColumn, col);
      }
    }
  });

  const firstRowByKey = new Map();
  const unique = body.filter((row, i) => {
    const key = JSON.stringify(row);
    if (firstRowByKey.has(key)) {
      stats.duplicatesRemoved++;
      stats.duplicateRows.push({ row: i + 2, duplicateOf: firstRowByKey.get(key) });
      return false;
    }
    firstRowByKey.set(key, i + 2);
    return true;
  });

  // 列ごとの件数はヘッダーの列順に並べる
  const byHeaderOrder = (counts) => Object.fromEntries(
    Array.from({ length: width }, (_, col) => columnName(col))
      .filter((name) => name in counts)
      .map((name) => [name, counts[name]]),
  );
  stats.trimmedByColumn = byHeaderOrder(stats.trimmedByColumn);
  stats.datesNormalizedByColumn = byHeaderOrder(stats.datesNormalizedByColumn);

  return { rows: [header, ...unique], stats };
}
