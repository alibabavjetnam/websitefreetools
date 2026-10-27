/**
 * ffmpeg.wasm chạy trong worker cùng tên miền (public/vendor/ffmpeg-worker.js).
 * Lõi ffmpeg (~31 MB) tải từ CDN một lần, có báo tiến độ tải; trình duyệt lưu đệm cho lần sau.
 */
import { t } from '../i18n';

const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class FFmpeg {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private loaded: Promise<void> | null = null;
  onProgress?: (ratio: number, timeUs: number) => void;
  onLog?: (line: string) => void;

  private call<T>(type: string, payload: Record<string, unknown> = {}, transfer: Transferable[] = []): Promise<T> {
    if (!this.worker) throw new Error('ffmpeg not loaded');
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker!.postMessage({ id, type, ...payload }, transfer);
    });
  }

  /** Tải lõi ffmpeg; onDownload báo số byte đã tải của file .wasm */
  load(onDownload?: (loaded: number, total: number) => void): Promise<void> {
    this.loaded ??= (async () => {
      const wasmURL = await fetchWithProgress(`${CORE}/ffmpeg-core.wasm`, 'application/wasm', onDownload);
      const coreURL = await fetchWithProgress(`${CORE}/ffmpeg-core.js`, 'text/javascript');
      this.worker = new Worker('/vendor/ffmpeg-worker.js');
      this.worker.onmessage = ({ data }) => {
        if (data.type === 'progress') { this.onProgress?.(data.progress, data.time); return; }
        if (data.type === 'log') { this.onLog?.(data.message); return; }
        const p = this.pending.get(data.id);
        if (!p) return;
        this.pending.delete(data.id);
        if (data.ok) p.resolve(data.data);
        else p.reject(new Error(data.error));
      };
      this.worker.onerror = () => {
        for (const p of this.pending.values()) p.reject(new Error(t('lib.ffmpeg.crash', 'Bộ xử lý video bị dừng (có thể do thiếu bộ nhớ). Hãy thử file nhỏ hơn hoặc độ phân giải thấp hơn.')));
        this.pending.clear();
      };
      await this.call('load', { coreURL, wasmURL });
    })().catch((e) => {
      this.loaded = null;
      this.worker?.terminate();
      this.worker = null;
      throw new Error(/fetch|network|load/i.test(String((e as Error).message)) ? t('lib.ffmpeg.load', 'Không tải được bộ xử lý video. Kiểm tra kết nối mạng rồi thử lại.') : (e as Error).message);
    });
    return this.loaded;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    await this.call('write', { path, data }, [data.buffer]);
  }
  readFile(path: string): Promise<Uint8Array> {
    return this.call<Uint8Array>('read', { path });
  }
  deleteFile(path: string): Promise<void> {
    return this.call('delete', { path });
  }
  /** Chạy lệnh ffmpeg, trả mã thoát (0 = thành công) */
  exec(args: string[]): Promise<number> {
    return this.call<number>('exec', { args });
  }
  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.loaded = null;
  }
}

/** Tải file thành blob URL (cùng gốc với trang) kèm tiến độ */
async function fetchWithProgress(url: string, type: string, onProgress?: (l: number, t: number) => void): Promise<string> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`fetch ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }
  return URL.createObjectURL(new Blob(chunks as BlobPart[], { type }));
}

/** Thời lượng (giây) từ log ffmpeg "Duration: 00:01:02.34" */
export function parseDuration(line: string): number | null {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/** Đọc thời lượng, kích thước video bằng thẻ <video> (nhanh, không cần ffmpeg) */
export function probeVideo(file: File): Promise<{ duration: number; width: number; height: number; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, url });
    v.onerror = () => resolve({ duration: 0, width: 0, height: 0, url }); // định dạng trình duyệt không xem được vẫn xử lý bằng ffmpeg
    v.src = url;
    setTimeout(() => reject(new Error('timeout')), 15000);
  });
}

export const fmtTime = (sec: number): string => {
  if (!Number.isFinite(sec)) return '—';
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${ss.toFixed(1).padStart(4, '0')}`;
};
/** "1:23.5", "83.5", "0:01:23" → giây */
export function parseTime(s: string): number {
  const parts = s.trim().split(':').map(Number);
  if (parts.some((x) => !Number.isFinite(x))) return NaN;
  return parts.reduce((a, b) => a * 60 + b, 0);
}
