#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { detectAndDecode } from '../src/encoding.js';
import { parse, stringify } from '../src/csv.js';
import { tidy } from '../src/tidy.js';

const USAGE = `使い方: csv-tidy <input.csv> [-o <output.csv>] [--force] [--bom]

  -o, --output  出力先（既定: <入力ファイル名>.tidy.csv）
  --force       出力先が既にあれば上書きする
  --bom         UTF-8 BOM を付けて出力する（Excel で開く場合）
  -h, --help    この説明を表示する

元の CSV は上書きしません。出力先に入力と同じファイルは指定できません。`;

function defaultOutput(input) {
  const { dir, name, ext } = path.parse(input);
  return path.join(dir, `${name}.tidy${ext || '.csv'}`);
}

function samePath(a, b) {
  const resolve = (p) => (existsSync(p) ? realpathSync.native(p) : path.resolve(p));
  const ra = resolve(a);
  const rb = resolve(b);
  return process.platform === 'win32' ? ra.toLowerCase() === rb.toLowerCase() : ra === rb;
}

function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      force: { type: 'boolean', default: false },
      bom: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(USAGE);
    return;
  }
  if (positionals.length !== 1) throw new Error(`入力ファイルを 1 つ指定してください\n\n${USAGE}`);

  const input = positionals[0];
  const output = values.output ?? defaultOutput(input);
  if (!existsSync(input)) throw new Error(`入力ファイルが見つかりません: ${input}`);
  if (samePath(input, output)) throw new Error('出力先に入力ファイルと同じパスは指定できません（元の CSV は上書きしません）');

  const { text, encoding } = detectAndDecode(readFileSync(input));
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const rows = parse(text);
  const { rows: result, stats } = tidy(rows);

  const csv = (values.bom ? '﻿' : '') + stringify(result, eol);
  try {
    writeFileSync(output, csv, { encoding: 'utf8', flag: values.force ? 'w' : 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') throw new Error(`出力先が既に存在します: ${output}（上書きするには --force）`);
    throw err;
  }

  const dataRows = (n) => Math.max(n - 1, 0);
  const dateCols = stats.dateColumns.length ? `（列: ${stats.dateColumns.join(', ')}）` : '（日付列なし）';
  const lines = [
    `入力: ${input} (${encoding}, データ ${dataRows(rows.length)} 行)`,
    `出力: ${output} (UTF-8${values.bom ? ' BOM 付き' : ''}, データ ${dataRows(result.length)} 行)`,
    `空白を削除したセル: ${stats.trimmed} 件`,
    `日付を統一したセル: ${stats.datesNormalized} 件${dateCols}`,
    `削除した重複行: ${stats.duplicatesRemoved} 件`,
    `変換できなかった日付: ${stats.unparsedDates.length} 件`,
    ...stats.unparsedDates.map((u) => `  ${u.row} 行目 ${u.column}: ${u.value}`),
  ];
  console.error(lines.join('\n'));
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(`csv-tidy: ${err.message}`);
  process.exitCode = 1;
}
