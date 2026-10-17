// 日付らしい文字列を YYYY-MM-DD に変換する。変換できなければ null。

// 元号の開始年 - 1（西暦年 = 値 + 和暦年）
const ERA_OFFSETS = {
  令和: 2018, R: 2018,
  平成: 1988, H: 1988,
  昭和: 1925, S: 1925,
  大正: 1911, T: 1911,
  明治: 1867, M: 1867,
};

const PATTERNS = [
  // 2023-04-01 / 2023/4/1 / 2023.4.1
  { re: /^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})$/, ymd: (m) => [m[1], m[3], m[4]] },
  // 2023年4月1日
  { re: /^(\d{4})年(\d{1,2})月(\d{1,2})日$/, ymd: (m) => [m[1], m[2], m[3]] },
  // 20230401
  { re: /^(\d{4})(\d{2})(\d{2})$/, ymd: (m) => [m[1], m[2], m[3]] },
  // 24/9/15（2 桁の年は 2000 年代とみなす）
  { re: /^(\d{2})\/(\d{1,2})\/(\d{1,2})$/, ymd: (m) => [2000 + Number(m[1]), m[2], m[3]] },
  // 令和5年5月20日 / 令和元年5月1日 / R5.6.3 / H30/12/3
  {
    re: /^(令和|平成|昭和|大正|明治|[RHSTM])(元|\d{1,2})(?:年|[-/.])(\d{1,2})(?:月|[-/.])(\d{1,2})日?$/i,
    ymd: (m) => {
      const era = ERA_OFFSETS[m[1].toUpperCase()];
      const year = m[2] === '元' ? 1 : Number(m[2]);
      return [era + year, m[3], m[4]];
    },
  },
];

function pad(n, width) {
  return String(n).padStart(width, '0');
}

/**
 * @param {string} input
 * @returns {string | null}
 */
export function normalizeDate(input) {
  if (typeof input !== 'string') return null;
  // 全角数字・全角英字を半角に揃え、日付内の空白を取り除く
  const s = input.normalize('NFKC').replace(/\s+/g, '');
  if (s === '') return null;

  for (const { re, ymd } of PATTERNS) {
    const m = s.match(re);
    if (!m) continue;
    const [y, mo, d] = ymd(m).map(Number);
    // 実在する日付か確かめる（2/30 や 13 月を弾く）
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
      return null;
    }
    return `${pad(y, 4)}-${pad(mo, 2)}-${pad(d, 2)}`;
  }
  return null;
}
