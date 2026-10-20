import type { Candle } from '../core/types';

export const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
};

/** Các máy chủ REST công khai, thử lần lượt nếu máy chủ trước lỗi hoặc bị chặn. */
const REST_HOSTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];
const WS_HOSTS = ['wss://stream.binance.com:9443', 'wss://data-stream.binance.vision'];

export class FetchError extends Error {
  constructor(message: string, public readonly attempts: string[]) {
    super(message);
  }
}

function rowToCandle(r: unknown[]): Candle | null {
  const t = Number(r[0]);
  const o = parseFloat(String(r[1]));
  const h = parseFloat(String(r[2]));
  const l = parseFloat(String(r[3]));
  const c = parseFloat(String(r[4]));
  const v = parseFloat(String(r[5] ?? 0));
  if (![t, o, h, l, c].every(Number.isFinite)) return null;
  return { t, o, h, l, c, v: Number.isFinite(v) ? v : 0 };
}

export function klinesUrl(host: string, symbol: string, interval: string, limit: number) {
  return `${host}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
}

/** Tải nến từ Binance, tự chuyển máy chủ khi gặp lỗi. */
export async function fetchKlines(symbol: string, interval: string, limit = 1000, timeoutMs = 9000): Promise<Candle[]> {
  const attempts: string[] = [];
  for (const host of REST_HOSTS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(klinesUrl(host, symbol, interval, limit), { signal: ctrl.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        // Mã cặp không tồn tại: không cần thử máy chủ khác
        if (res.status === 400 && body.includes('Invalid symbol')) {
          throw new FetchError(`Binance không có cặp ${symbol}.`, [`${host}: ${res.status}`]);
        }
        attempts.push(`${host}: HTTP ${res.status}`);
        continue;
      }
      const raw = (await res.json()) as unknown[][];
      const candles = raw.map(rowToCandle).filter((c): c is Candle => c !== null);
      if (candles.length === 0) { attempts.push(`${host}: không có dữ liệu`); continue; }
      return candles;
    } catch (err) {
      if (err instanceof FetchError) throw err;
      attempts.push(`${host}: ${(err as Error).name === 'AbortError' ? 'hết thời gian chờ' : (err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FetchError('Không tải được dữ liệu từ Binance.', attempts);
}

/**
 * Đọc dữ liệu dán tay. Chấp nhận:
 *  - JSON klines của Binance: [[openTime,"o","h","l","c","v",...], ...]
 *  - Văn bản lẫn lộn có chứa các mảng nến như trên
 *  - CSV: time,open,high,low,close[,volume] (time là ms, giây hoặc chuỗi ngày)
 */
export function parseRawCandles(text: string): Candle[] {
  const src = text.trim();
  if (!src) throw new Error('Ô dữ liệu đang trống.');

  try {
    const json = JSON.parse(src);
    if (Array.isArray(json)) {
      const out = json.map((r) => (Array.isArray(r) ? rowToCandle(r) : null)).filter((c): c is Candle => c !== null);
      if (out.length) return normalize(out);
    }
  } catch { /* thử cách khác */ }

  const matches = src.match(/\[\s*"?\d{10,15}"?\s*,[^[\]]+\]/g);
  if (matches && matches.length) {
    const out = matches
      .map((m) => { try { return rowToCandle(JSON.parse(m)); } catch { return null; } })
      .filter((c): c is Candle => c !== null);
    if (out.length) return normalize(out);
  }

  const lines = src.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const csv: Candle[] = [];
  for (const line of lines) {
    const p = line.split(/[,;\t]/).map((x) => x.trim().replace(/^"|"$/g, ''));
    if (p.length < 5) continue;
    let t = Number(p[0]);
    if (!Number.isFinite(t)) t = Date.parse(p[0]);
    else if (t < 1e11) t *= 1000; // giây → ms
    const c = rowToCandle([t, p[1], p[2], p[3], p[4], p[5] ?? 0]);
    if (c) csv.push(c);
  }
  if (csv.length) return normalize(csv);
  throw new Error('Không nhận ra định dạng. Hãy dán JSON klines của Binance hoặc CSV time,open,high,low,close,volume.');
}

function normalize(c: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const x of c) map.set(x.t, x);
  return [...map.values()].sort((a, b) => a.t - b.t);
}

/** Gộp nến khung nhỏ thành nến ngày (dùng khi chỉ có dữ liệu dán tay khung nhỏ). */
export function aggregateToDaily(c: Candle[]): Candle[] {
  const DAY = INTERVAL_MS['1d'];
  const out: Candle[] = [];
  for (const x of c) {
    const t = Math.floor(x.t / DAY) * DAY;
    const last = out[out.length - 1];
    if (last && last.t === t) {
      last.h = Math.max(last.h, x.h);
      last.l = Math.min(last.l, x.l);
      last.c = x.c;
      last.v += x.v;
    } else out.push({ t, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v });
  }
  return out;
}

/** Ghép một nến realtime vào chuỗi: cập nhật nến cuối hoặc thêm nến mới. */
export function upsertCandle(list: Candle[], k: Candle, max = 1000) {
  const last = list[list.length - 1];
  if (!last || k.t > last.t) {
    list.push(k);
    if (list.length > max) list.splice(0, list.length - max);
  } else if (k.t === last.t) list[list.length - 1] = k;
}

type LiveHandler = (interval: string, candle: Candle) => void;
type StatusHandler = (status: 'connecting' | 'live' | 'retrying' | 'off') => void;

/** Luồng nến realtime cho nhiều khung (ví dụ 15m + 1d), tự kết nối lại khi rớt mạng. */
export class LiveFeed {
  private ws: WebSocket | null = null;
  private hostIdx = 0;
  private retry = 0;
  private timer: number | undefined;
  private stopped = true;

  constructor(private onCandle: LiveHandler, private onStatus: StatusHandler) {}

  start(symbol: string, intervals: string[]) {
    this.stop();
    this.stopped = false;
    const streams = [...new Set(intervals)].map((iv) => `${symbol.toLowerCase()}@kline_${iv}`).join('/');
    const connect = () => {
      if (this.stopped) return;
      this.onStatus(this.retry ? 'retrying' : 'connecting');
      const ws = new WebSocket(`${WS_HOSTS[this.hostIdx]}/stream?streams=${streams}`);
      this.ws = ws;
      ws.onopen = () => { this.retry = 0; this.onStatus('live'); };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string);
          const k = msg?.data?.k;
          if (!k) return;
          this.onCandle(k.i, { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v });
        } catch { /* bỏ qua gói lỗi */ }
      };
      ws.onclose = () => {
        if (this.stopped) return;
        this.retry++;
        this.hostIdx = (this.hostIdx + 1) % WS_HOSTS.length;
        this.onStatus('retrying');
        this.timer = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(this.retry, 5)));
      };
      ws.onerror = () => ws.close();
    };
    connect();
  }

  stop() {
    this.stopped = true;
    window.clearTimeout(this.timer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.retry = 0;
    this.onStatus('off');
  }
}
