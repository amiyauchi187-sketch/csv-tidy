// 外部ライブラリを使わずに文字コードを判定する。
// TextDecoder の fatal モードで「エラーなくデコードできるか」を試す。

const BOMS = [
  { bytes: [0xef, 0xbb, 0xbf], label: 'utf-8', name: 'UTF-8 (BOM)' },
  { bytes: [0xff, 0xfe], label: 'utf-16le', name: 'UTF-16LE (BOM)' },
  { bytes: [0xfe, 0xff], label: 'utf-16be', name: 'UTF-16BE (BOM)' },
];

const CANDIDATES = [
  { label: 'shift_jis', name: 'Shift_JIS' },
  { label: 'euc-jp', name: 'EUC-JP' },
];

function tryDecode(buf, label) {
  try {
    return new TextDecoder(label, { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}

// EUC-JP のバイト列は Shift_JIS としてもデコードできてしまうことが多い。
// その場合は半角カナ（U+FF61-FF9F）だらけになるので、半角カナが少ないほうを選ぶ。
function halfWidthKanaCount(text) {
  let n = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c >= 0xff61 && c <= 0xff9f) n++;
  }
  return n;
}

/**
 * @param {Uint8Array} buf
 * @returns {{ text: string, encoding: string }}
 */
export function detectAndDecode(buf) {
  for (const bom of BOMS) {
    if (bom.bytes.every((b, i) => buf[i] === b)) {
      const text = new TextDecoder(bom.label).decode(buf.subarray(bom.bytes.length));
      return { text, encoding: bom.name };
    }
  }

  const utf8 = tryDecode(buf, 'utf-8');
  if (utf8 !== null) return { text: utf8, encoding: 'UTF-8' };

  const decoded = CANDIDATES
    .map((c) => ({ ...c, text: tryDecode(buf, c.label) }))
    .filter((c) => c.text !== null);
  if (decoded.length === 0) {
    throw new Error('文字コードを判定できませんでした（UTF-8 / Shift_JIS / EUC-JP のいずれでもありません）');
  }
  decoded.sort((a, b) => halfWidthKanaCount(a.text) - halfWidthKanaCount(b.text));
  return { text: decoded[0].text, encoding: decoded[0].name };
}
