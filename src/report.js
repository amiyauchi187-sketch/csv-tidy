// 整形結果を Markdown のレポートにする純粋関数。ファイル入出力はしない。

function cell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n|\r/g, '<br>');
}

function table(headers, rows, align) {
  return [
    `| ${headers.map(cell).join(' | ')} |`,
    `|${align.map((a) => (a === 'right' ? '---:' : '---')).join('|')}|`,
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
  ].join('\n');
}

function formatDateTime(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} `
    + `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

function countsByColumn(counts) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return '修正はありませんでした。';
  return table(['列', '件数'], entries, ['left', 'right']);
}

/**
 * @param {{
 *   input: string, output: string, encoding: string, bom?: boolean,
 *   inputRows: number, outputRows: number, stats: object, generatedAt?: Date,
 * }} info  inputRows / outputRows はヘッダーを除いたデータ行数
 * @returns {string}
 */
export function renderReport({ input, output, encoding, bom = false, inputRows, outputRows, stats, generatedAt = new Date() }) {
  const sections = [];

  sections.push([
    '# csv-tidy 整形レポート',
    '',
    `- 実行日時: ${formatDateTime(generatedAt)}`,
    `- 入力: \`${input}\`（${encoding}、データ ${inputRows} 行）`,
    `- 出力: \`${output}\`（UTF-8${bom ? ' BOM 付き' : ''}、データ ${outputRows} 行）`,
  ].join('\n'));

  sections.push([
    '## ルールごとの修正件数',
    '',
    table(['ルール', '修正件数', '単位'], [
      ['前後の空白を削除', stats.trimmed, 'セル'],
      ['日付を YYYY-MM-DD に統一', stats.datesNormalized, 'セル'],
      ['完全に重複した行を削除', stats.duplicatesRemoved, '行'],
    ], ['left', 'right', 'left']),
    '',
    stats.unparsedDates.length > 0
      ? `> **注意:** 日付列に変換できなかった値が ${stats.unparsedDates.length} 件あります（元の値のまま出力しています）。`
      : '変換できなかった日付はありません。',
  ].join('\n'));

  sections.push([
    '## 前後の空白を削除',
    '',
    countsByColumn(stats.trimmedByColumn),
  ].join('\n'));

  sections.push([
    '## 日付を YYYY-MM-DD に統一',
    '',
    stats.dateColumns.length > 0
      ? `日付列と判定した列: ${stats.dateColumns.join('、')}`
      : '日付列と判定した列はありませんでした。',
    ...(stats.dateColumns.length > 0 ? ['', countsByColumn(stats.datesNormalizedByColumn)] : []),
  ].join('\n'));

  sections.push([
    '## 完全に重複した行を削除',
    '',
    '行番号はヘッダーを 1 行目として数えた入力ファイルの行です。',
    '',
    stats.duplicateRows.length > 0
      ? table(['削除した行', '残した行（同じ内容）'], stats.duplicateRows.map((d) => [d.row, d.duplicateOf]), ['right', 'right'])
      : '重複行はありませんでした。',
  ].join('\n'));

  if (stats.unparsedDates.length > 0) {
    sections.push([
      '## 変換できなかった日付',
      '',
      table(['行', '列', '値'], stats.unparsedDates.map((u) => [u.row, u.column, u.value]), ['right', 'left', 'left']),
    ].join('\n'));
  }

  return `${sections.join('\n\n')}\n`;
}
