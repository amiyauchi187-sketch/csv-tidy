import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectAndDecode } from '../src/encoding.js';
import { parse } from '../src/csv.js';
import { tidy } from '../src/tidy.js';

test('前後の空白（全角含む）を削除して件数を数える', () => {
  const { rows, stats } = tidy([['名前', 'メモ'], ['  山田 ', '　a　'], ['佐藤', 'b']]);
  assert.deepEqual(rows, [['名前', 'メモ'], ['山田', 'a'], ['佐藤', 'b']]);
  assert.equal(stats.trimmed, 2);
});

test('日付列だけを変換し、電話番号の列は触らない', () => {
  const { rows, stats } = tidy([
    ['電話', '日付'],
    ['03-1234-5678', '2023/4/5'],
    ['052-345-6789', 'R5.6.3'],
  ]);
  assert.deepEqual(stats.dateColumns, ['日付']);
  assert.deepEqual(rows.slice(1), [['03-1234-5678', '2023-04-05'], ['052-345-6789', '2023-06-03']]);
  assert.equal(stats.datesNormalized, 2);
});

test('日付列の中の変換できない値は残して報告する', () => {
  const rows = [['日付'], ['2023-01-01'], ['2023-01-02'], ['2023-01-03'], ['2023-01-04'], ['不明']];
  const { rows: out, stats } = tidy(rows);
  assert.equal(out[5][0], '不明');
  assert.deepEqual(stats.unparsedDates, [{ row: 6, column: '日付', value: '不明' }]);
});

test('日付として読める値が少ない列は日付列にしない', () => {
  const { stats } = tidy([['x'], ['2023-01-01'], ['abc'], ['def']]);
  assert.deepEqual(stats.dateColumns, []);
});

test('正規化した後に完全一致する行を削除し、最初の行を残す', () => {
  const { rows, stats } = tidy([
    ['id', '日付'],
    ['1', '2023/4/5'],
    [' 1', '2023-04-05'],
    ['2', '2023-04-05'],
  ]);
  assert.deepEqual(rows, [['id', '日付'], ['1', '2023-04-05'], ['2', '2023-04-05']]);
  assert.equal(stats.duplicatesRemoved, 1);
});

test('サンプル CSV を整形する', () => {
  const { text } = detectAndDecode(readFileSync(new URL('../samples/customers_dirty.csv', import.meta.url)));
  const { rows, stats } = tidy(parse(text));

  assert.equal(rows.length - 1, 20);
  assert.equal(stats.duplicatesRemoved, 5);
  assert.deepEqual(stats.dateColumns, ['登録日']);
  assert.deepEqual(stats.unparsedDates, []);

  const ids = rows.slice(1).map((r) => r[0]);
  assert.equal(new Set(ids).size, 20);
  for (const row of rows.slice(1)) {
    assert.match(row[5], /^\d{4}-\d{2}-\d{2}$/);
    for (const cell of row) assert.equal(cell, cell.trim());
  }
  const byId = Object.fromEntries(rows.slice(1).map((r) => [r[0], r]));
  assert.equal(byId.C004[1], '田中 美咲');
  assert.equal(byId.C009[5], '2019-04-30');
  assert.equal(byId.C010[5], '2019-05-01');
  assert.equal(byId.C013[5], '2024-02-29');
  assert.equal(byId.C019[5], '2024-08-01');
});
