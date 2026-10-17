import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectAndDecode } from '../src/encoding.js';

const SAMPLE = new URL('../samples/customers_dirty.csv', import.meta.url);

test('UTF-8 を判定する', () => {
  const r = detectAndDecode(Buffer.from('顧客,登録日\n', 'utf8'));
  assert.equal(r.encoding, 'UTF-8');
  assert.equal(r.text, '顧客,登録日\n');
});

test('UTF-8 BOM を取り除く', () => {
  const r = detectAndDecode(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('あ', 'utf8')]));
  assert.equal(r.encoding, 'UTF-8 (BOM)');
  assert.equal(r.text, 'あ');
});

test('Shift_JIS のサンプルを判定する', () => {
  const r = detectAndDecode(readFileSync(SAMPLE));
  assert.equal(r.encoding, 'Shift_JIS');
  assert.ok(r.text.startsWith('顧客ID,氏名,メールアドレス,電話番号,都道府県,登録日'));
});

test('Shift_JIS としても読める EUC-JP を EUC-JP と判定する', () => {
  // EUC-JP の「テスト」。Shift_JIS としても半角カナとしてデコードできてしまう
  const r = detectAndDecode(Buffer.from([0xa5, 0xc6, 0xa5, 0xb9, 0xa5, 0xc8]));
  assert.equal(r.encoding, 'EUC-JP');
  assert.equal(r.text, 'テスト');
});
