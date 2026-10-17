# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

csv-tidy is a Node.js CLI (ESM, Node >= 18) that cleans a dirty CSV:

- Detects the encoding and writes UTF-8
- Trims every cell
- Normalizes date-like columns to `YYYY-MM-DD`
- Removes exact duplicate rows
- Prints how many fixes it made, and with `--report` writes per-rule fix counts as Markdown

It has **no dependencies by design**: encoding detection uses `TextDecoder`, and the CSV parser is hand-written. Don't add packages without a clear reason.

## Commands

- `npm test` runs all tests (`node --test`, built-in runner, files in `test/`)
- `node --test --test-name-pattern="<test name>"` runs a single test
- `node bin/csv-tidy.js samples/customers_dirty.csv [-o out.csv] [-r report.md] [--force] [--bom]` runs the CLI. The default output is `<name>.tidy.csv`, which is gitignored.

## Architecture

`bin/csv-tidy.js` handles I/O, argument parsing and the summary, which goes to stderr. Its pipeline: `detectAndDecode` → `parse` → `tidy` → `stringify`, plus `renderReport` when `--report` is given.

- `src/encoding.js`
  - Checks for a BOM first.
  - Otherwise tries strict decoding in the order UTF-8, Shift_JIS, EUC-JP.
  - EUC-JP bytes often also decode as Shift_JIS. When both succeed, it picks the result with fewer half-width katakana.
- `src/csv.js`: RFC 4180 parse/stringify. It quotes only the fields that need it. The CLI keeps the input's line endings.
- `src/date.js`: `normalizeDate` returns `YYYY-MM-DD` or `null`.
  - Applies NFKC and strips all whitespace before matching.
  - Era (和暦) offsets live in `ERA_OFFSETS`.
  - Checks that the date exists with a `Date.UTC` round-trip.
- `src/tidy.js`: a pure function with no I/O, in this fixed order:
  1. Trim every cell.
  2. Detect date columns: at least 80% of non-empty values parse as dates.
  3. Normalize the dates. Values that don't parse are kept as-is and reported in `stats.unparsedDates`.
  4. Dedup. It must run last so that rows differing only in whitespace or date format are caught.

  `stats` also carries per-column counts (`trimmedByColumn`, `datesNormalizedByColumn`, in header order) and `duplicateRows` (`{ row, duplicateOf }`). Row numbers count the header as row 1.
- `src/report.js`: `renderReport` is a pure function that turns `stats` into the Markdown report. It escapes `|` and newlines in table cells.

The CLI refuses an output or report path equal to the input path, and a report path equal to the output (compared via realpath, case-insensitively on Windows). Without `--force`, it checks that neither the output nor the report exists *before* writing anything, so it never leaves one written without the other. Writes also use the `wx` flag.

## Sample data: `samples/customers_dirty.csv`

This customer list is deliberately dirty. Use it to test the cleanup logic.

- **Encoding:** Shift_JIS (CP932), no BOM, CRLF line endings. Read it with an explicit `cp932` / `shift_jis` decoder, not UTF-8. When editing it, re-encode to CP932 so you don't silently convert it to UTF-8. Editor tools such as Write/Edit save UTF-8, so write a UTF-8 copy and convert it, e.g. with PowerShell `[Text.Encoding]::GetEncoding(932)`.
- **Columns:** 顧客ID, 氏名, メールアドレス, 電話番号, 都道府県, 登録日
- **Planted problems the cleanup should handle:**
  - Leading/trailing whitespace, both half-width and full-width (`　`), in any column
  - 登録日 written many ways:
    - ISO format (`2023-04-01`)
    - Slash dates, with and without zero padding (`2023/4/5`)
    - `YYYY年M月D日`, compact `20230802`, dotted `2023.8.19`, two-digit year `24/9/15`
    - Japanese era dates (和暦) in kanji (`令和5年5月20日`, `令和元年`) and abbreviated (`R5.6.3`, `H30/12/3`)
  - Edge cases:
    - `平成31年4月30日`, the day before the era change
    - `R6/2/29`, a leap day
    - A quoted date containing inner spaces (`"2024年 8月 1日"`)
  - Exact duplicate rows (C001, C005, C008)
  - Rows that are duplicates only after normalization (C002, C004). Their whitespace and date format differ, so dedup has to run *after* trimming and date normalization to catch them.

## Rules

- 元のCSVファイルは絶対に上書きしない。結果は別ファイルに出力する
