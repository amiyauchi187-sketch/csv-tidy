import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from '../src/report.js';
import { tidy } from '../src/tidy.js';

function render(rows) {
  const { rows: result, stats } = tidy(rows);
  return renderReport({
    input: 'in.csv',
    output: 'out.csv',
    encoding: 'Shift_JIS',
    inputRows: rows.length - 1,
    outputRows: result.length - 1,
    stats,
    generatedAt: new Date(2026, 9, 18, 9, 5, 3),
  });
}

test('ルールごとの修正件数の表と、列ごとの内訳を出力する', () => {
  const md = render([
    ['id', '日付'],
    [' 1', '2023/1/1'],
    ['2', 'R5.6.3'],
    ['1', '2023-01-01'],
  ]);
  assert.match(md, /^# csv-tidy 整形レポート\n/);
  assert.match(md, /- 実行日時: 2026-10-18 09:05:03/);
  assert.match(md, /- 入力: `in.csv`（Shift_JIS、データ 3 行）/);
  assert.match(md, /- 出力: `out.csv`（UTF-8、データ 2 行）/);
  assert.match(md, /\| 前後の空白を削除 \| 1 \| セル \|/);
  assert.match(md, /\| 日付を YYYY-MM-DD に統一 \| 2 \| セル \|/);
  assert.match(md, /\| 完全に重複した行を削除 \| 1 \| 行 \|/);
  assert.match(md, /日付列と判定した列: 日付/);
  assert.match(md, /\| 4 \| 2 \|/);
  assert.match(md, /変換できなかった日付はありません。/);
  assert.doesNotMatch(md, /## 変換できなかった日付/);
});

test('修正がない場合もそう書く', () => {
  const md = render([['name'], ['a'], ['b']]);
  assert.match(md, /\| 前後の空白を削除 \| 0 \| セル \|/);
  assert.match(md, /修正はありませんでした。/);
  assert.match(md, /日付列と判定した列はありませんでした。/);
  assert.match(md, /重複行はありませんでした。/);
});

test('変換できなかった日付を一覧にし、表を壊す文字をエスケープする', () => {
  const md = render([['日付'], ['2023-01-01'], ['2023-01-02'], ['2023-01-03'], ['2023-01-04'], ['不明|要確認']]);
  assert.match(md, /> \*\*注意:\*\* 日付列に変換できなかった値が 1 件あります/);
  assert.match(md, /## 変換できなかった日付/);
  assert.match(md, /\| 6 \| 日付 \| 不明\\\|要確認 \|/);
});
