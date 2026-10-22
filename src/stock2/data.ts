import type { Bar } from './core/engine';

const HOSTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];

export class DataError extends Error {
  constructor(message: string, public readonly attempts: string[] = []) { super(message); }
}

const row = (r: unknown[]): Bar | null => {
  const t = Number(r[0]);
  const o = parseFloat(String(r[1])), h = parseFloat(String(r[2])), l = parseFloat(String(r[3])), c = parseFloat(String(r[4]));
  const v = parseFloat(String(r[5] ?? 0)), tb = parseFloat(String(r[9] ?? 0)); // chỉ số 9: khối lượng taker mua
  if (![t, o, h, l, c].every(Number.isFinite)) return null;
  return { t, o, h, l, c, v: Number.isFinite(v) ? v : 0, tb: Number.isFinite(tb) ? tb : 0 };
};

async function page(symbol: string, interval: string, endTime: number | null, limit: number): Promise<Bar[]> {
  const attempts: string[] = [];
  for (const host of HOSTS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const q = `${host}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}${endTime ? `&endTime=${endTime}` : ''}`;
      const res = await fetch(q, { signal: ctrl.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        if (res.status === 400 && body.includes('Invalid symbol')) throw new DataError(`Binance không có cặp ${symbol}.`);
        attempts.push(`${host}: HTTP ${res.status}`);
        continue;
      }
      return ((await res.json()) as unknown[][]).map(row).filter((b): b is Bar => b !== null);
    } catch (err) {
      if (err instanceof DataError) throw err;
      attempts.push(`${host}: ${(err as Error).name === 'AbortError' ? 'hết thời gian chờ' : (err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new DataError('Không tải được dữ liệu từ Binance. Hãy kiểm tra mạng rồi bấm chạy lại.', attempts);
}

/** Tải `count` nến gần nhất, lật ngược từng trang 1000 nến. Bỏ nến cuối nếu chưa đóng. */
export async function fetchHistory(
  symbol: string, interval: string, count: number, onProgress?: (done: number, total: number) => void,
): Promise<Bar[]> {
  const out: Bar[] = [];
  let end: number | null = null;
  while (out.length < count) {
    const got = await page(symbol, interval, end, Math.min(1000, count - out.length));
    if (!got.length) break;
    out.unshift(...got);
    end = got[0].t - 1;
    onProgress?.(Math.min(out.length, count), count);
    if (got.length < 2) break;
  }
  const map = new Map<number, Bar>();
  for (const b of out) map.set(b.t, b);
  return [...map.values()].sort((a, b) => a.t - b.t);
}
