import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from '../src/csv.js';

test('CRLF / LF と末尾改行の有無を扱える', () => {
  assert.deepEqual(parse('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parse('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
});

test('引用符・エスケープ・引用符内のカンマと改行', () => {
  const text = 'name,note\r\n"山田, 太郎","彼は""OK""と言った\r\n2行目"\r\n';
  assert.deepEqual(parse(text), [
    ['name', 'note'],
    ['山田, 太郎', '彼は"OK"と言った\r\n2行目'],
  ]);
});

test('空のフィールドを保持する', () => {
  assert.deepEqual(parse('a,,c\n,,\n'), [['a', '', 'c'], ['', '', '']]);
});

test('閉じていない引用符はエラー', () => {
  assert.throws(() => parse('a,"b\n'), /引用符/);
});

test('stringify は必要なフィールドだけ引用符で囲み、parse と往復できる', () => {
  const rows = [['a', 'b,c', 'say "hi"', 'x\ny'], ['1', '', '日本語', ' sp ']];
  const text = stringify(rows, '\n');
  assert.equal(text.split('\n')[0], 'a,"b,c","say ""hi""","x');
  assert.deepEqual(parse(text), rows);
});
