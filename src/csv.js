// RFC 4180 の範囲の CSV パーサー／シリアライザー。
// 引用符、"" のエスケープ、引用符内のカンマと改行、CRLF / LF に対応する。

/**
 * @param {string} text
 * @returns {string[][]}
 */
export function parse(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else {
      field += ch;
    }
    i++;
  }

  if (inQuotes) throw new Error('CSV の引用符が閉じられていません');
  // 末尾に改行がない最終行
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function quote(field) {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

/**
 * @param {string[][]} rows
 * @param {string} [eol]
 * @returns {string}
 */
export function stringify(rows, eol = '\r\n') {
  return rows.map((r) => r.map(quote).join(',') + eol).join('');
}
