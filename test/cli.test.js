import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

test('--report で Markdown のレポートを出力する', () => {
  withTempCopy((input, dir) => {
    const report = path.join(dir, 'report.md');
    const r = run(input, '--report', report);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /レポート: /);

    const md = readFileSync(report, 'utf8');
    assert.match(md, /Shift_JIS、データ 25 行/);
    assert.match(md, /\| 前後の空白を削除 \| 8 \| セル \|/);
    assert.match(md, /\| 日付を YYYY-MM-DD に統一 \| 21 \| セル \|/);
    assert.match(md, /\| 完全に重複した行を削除 \| 5 \| 行 \|/);
  });
});

test('レポートの出力先が入力・出力と同じなら拒否し、何も書き出さない', () => {
  withTempCopy((input, dir) => {
    const before = readFileSync(input);
    const out = path.join(dir, 'out.csv');

    const sameAsInput = run(input, '-o', out, '-r', input);
    assert.equal(sameAsInput.status, 1);
    assert.match(sameAsInput.stderr, /入力ファイルと同じパス/);

    const sameAsOutput = run(input, '-o', out, '-r', out);
    assert.equal(sameAsOutput.status, 1);
    assert.match(sameAsOutput.stderr, /出力先と同じパス/);

    assert.equal(existsSync(out), false);
    assert.deepEqual(readFileSync(input), before);
  });
});

test('既存のレポートがあれば --force なしでは CSV も書き出さない', () => {
  withTempCopy((input, dir) => {
    const report = path.join(dir, 'report.md');
    writeFileSync(report, 'old');
    const r = run(input, '-r', report);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /レポートが既に存在/);
    assert.equal(existsSync(path.join(dir, 'customers.tidy.csv')), false);
    assert.equal(readFileSync(report, 'utf8'), 'old');

    assert.equal(run(input, '-r', report, '--force').status, 0);
    assert.notEqual(readFileSync(report, 'utf8'), 'old');
  });
});

test('--bom で UTF-8 BOM を付ける', () => {
  withTempCopy((input, dir) => {
    const out = path.join(dir, 'out.csv');
    assert.equal(run(input, '-o', out, '--bom').status, 0);
    assert.deepEqual([...readFileSync(out).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  });
});
