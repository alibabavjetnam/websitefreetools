/** Đọc và ghi CSV theo RFC 4180 (dấu ngoặc kép, xuống dòng trong ô, nhiều kiểu dấu phân cách) */

/** Đoán dấu phân cách từ vài dòng đầu: chọn dấu xuất hiện đều đặn nhất (bỏ qua phần trong ngoặc kép) */
export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 20000);
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestScore = -1;
  for (const d of candidates) {
    const counts: number[] = [];
    let inQ = false;
    let c = 0;
    for (let i = 0; i < sample.length && counts.length < 20; i++) {
      const ch = sample[i];
      if (ch === '"') inQ = !inQ;
      else if (!inQ && ch === d) c++;
      else if (!inQ && ch === '\n') {
        counts.push(c);
        c = 0;
      }
    }
    if (c) counts.push(c);
    if (!counts.length || !counts[0]) continue;
    const same = counts.filter((x) => x === counts[0]).length;
    const score = same * 1000 + counts[0];
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let inQuotes = false;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else field += ch;
    i++;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][], delimiter = ','): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v === null || v === undefined ? '' : String(v);
          return /["\r\n]/.test(s) || s.includes(delimiter) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(delimiter),
    )
    .join('\r\n');
}
