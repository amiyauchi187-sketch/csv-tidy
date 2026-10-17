import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDate } from '../src/date.js';

test('西暦の表記揺れを YYYY-MM-DD に揃える', () => {
  const cases = {
    '2023-04-01': '2023-04-01',
    '2023/4/5': '2023-04-05',
    '2023/04/12': '2023-04-12',
    '2023.8.19': '2023-08-19',
    '2023年7月15日': '2023-07-15',
    '20230802': '2023-08-02',
    '24/9/15': '2024-09-15',
    '２０２３／４／１': '2023-04-01',
    '2024年 8月 1日': '2024-08-01',
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(normalizeDate(input), expected, input);
  }
});

test('和暦を西暦に変換する', () => {
  const cases = {
    令和5年5月20日: '2023-05-20',
    令和元年5月1日: '2019-05-01',
    平成31年4月30日: '2019-04-30',
    'R5.6.3': '2023-06-03',
    'H30/12/3': '2018-12-03',
    'r6-1-2': '2024-01-02',
    昭和64年1月7日: '1989-01-07',
    'S50.10.10': '1975-10-10',
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(normalizeDate(input), expected, input);
  }
});

test('実在しない日付は null', () => {
  assert.equal(normalizeDate('R6/2/29'), '2024-02-29');
  assert.equal(normalizeDate('2023/2/29'), null);
  assert.equal(normalizeDate('2024-02-30'), null);
  assert.equal(normalizeDate('2024-13-01'), null);
});

test('日付でない値は null', () => {
  for (const input of ['', 'C001', '03-1234-5678', '052-345-6789', 'taro@example.com', '東京都', '2023/4-5']) {
    assert.equal(normalizeDate(input), null, input);
  }
});
