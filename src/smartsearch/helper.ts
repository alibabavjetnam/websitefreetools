/** Kết nối tới WFT Crawler đang chạy trên máy người dùng (Node.js, 127.0.0.1) */
import type { CrawlData, EngineId } from './urls';

export interface Ping { ok: boolean; app: string; version: string; node: string; defaultMode: 'fast' | 'browser'; browser: { available: boolean; chrome: boolean; puppeteer: boolean } }
export interface SerpItem { url: string; title: string; snippet: string; position: number }
export interface SearchPage { ok: boolean; error?: string; engine?: EngineId; mode?: string; results: SerpItem[]; blocked?: string; pageSize?: number }

const PORTS = [8787, 8788, 8789, 8790, 8791, 8792, 8793, 8794, 8795, 8796, 8797];

export class Helper {
  base = '';
  info: Ping | null = null;

  private async get<T>(base: string, path: string, ms = 2500): Promise<T> {
    const res = await fetch(base + path, { signal: AbortSignal.timeout(ms) });
    return res.json() as Promise<T>;
  }

  /** Tìm bộ chạy trên máy: thử cổng đã nhớ trước, rồi tới các cổng 8787–8797 */
  async connect(preferred?: number): Promise<Ping | null> {
    const ports = preferred ? [preferred, ...PORTS.filter((p) => p !== preferred)] : PORTS;
    for (const port of ports) {
      const base = `http://127.0.0.1:${port}`;
      try {
        const info = await this.get<Ping>(base, '/ping');
        if (info && info.app === 'wft-crawler') { this.base = base; this.info = info; return info; }
      } catch { /* thử cổng kế tiếp */ }
    }
    this.base = ''; this.info = null;
    return null;
  }

  get port(): number { return this.base ? Number(this.base.split(':').pop()) : 0; }

  private async post<T>(path: string, body: unknown, ms: number, signal?: AbortSignal): Promise<T> {
    if (!this.base) throw new Error('Chưa kết nối bộ chạy trên máy.');
    const sigs = [AbortSignal.timeout(ms), ...(signal ? [signal] : [])];
    let res: Response;
    try {
      res = await fetch(this.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any(sigs) });
    } catch (e) {
      if (signal?.aborted) throw e;
      this.info = null;
      throw new Error('Mất kết nối với bộ chạy trên máy. Hãy kiểm tra cửa sổ lệnh còn mở, rồi bấm "Kiểm tra kết nối".');
    }
    return res.json() as Promise<T>;
  }

  search(p: { engine: EngineId; query: string; offset: number; hl: string; gl: string; time: string; mode: 'auto' | 'fast' | 'browser' }, signal?: AbortSignal): Promise<SearchPage> {
    const body = { ...p, mode: p.mode === 'auto' ? undefined : p.mode };
    // chế độ trình duyệt có thể chờ người dùng giải CAPTCHA tới 3 phút
    return this.post<SearchPage>('/search', body, 200000, signal);
  }

  crawl(url: string, mode: 'quick' | 'full', signal?: AbortSignal): Promise<CrawlData> {
    return this.post<CrawlData>('/crawl', { url, mode }, 40000, signal);
  }
}
