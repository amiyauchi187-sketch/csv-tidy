import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/csv-tidy.js', import.meta.url));
const SAMPLE = fileURLToPath(new URL('../samples/customers_dirty.csv', import.meta.url));

function run(...args) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
}

function withTempCopy(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'csv-tidy-'));
  try {
    const input = path.join(dir, 'customers.csv');
    copyFileSync(SAMPLE, input);
    fn(input, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('別ファイルに UTF-8 で出力し、元ファイルは変えない', () => {
  withTempCopy((input, dir) => {
    const before = readFileSync(input);
    const r = run(input);
    assert.equal(r.status, 0, r.stderr);

    const out = readFileSync(path.join(dir, 'customers.tidy.csv'));
    const text = new TextDecoder('utf-8', { fatal: true }).decode(out);
    assert.ok(text.startsWith('顧客ID,'));
    assert.ok(text.includes('\r\n'));
    assert.deepEqual(readFileSync(input), before);

    assert.match(r.stderr, /Shift_JIS, データ 25 行/);
    assert.match(r.stderr, /データ 20 行/);
    assert.match(r.stderr, /削除した重複行: 5 件/);
  });
});

test('入力と同じパスへの出力は拒否する', () => {
  withTempCopy((input) => {
    const before = readFileSync(input);
    const r = run(input, '-o', input);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /同じパス/);
    assert.deepEqual(readFileSync(input), before);
  });
});

test('既存の出力先は --force なしでは上書きしない', () => {
  withTempCopy((input) => {
    assert.equal(run(input).status, 0);
    const second = run(input);
    assert.equal(second.status, 1);
    assert.match(second.stderr, /既に存在/);
    assert.equal(run(input, '--force').status, 0);
  });
});

test('--bom で UTF-8 BOM を付ける', () => {
  withTempCopy((input, dir) => {
    const out = path.join(dir, 'out.csv');
    assert.equal(run(input, '-o', out, '--bom').status, 0);
    assert.deepEqual([...readFileSync(out).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  });
});
