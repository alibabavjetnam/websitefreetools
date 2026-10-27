/**
 * Nạp Transformers.js (Hugging Face) từ CDN để chạy mô hình AI ngay trên trình duyệt.
 * Ưu tiên WebGPU nếu máy hỗ trợ, nếu không chạy bằng WASM (CPU). Mô hình tải một lần, trình duyệt lưu đệm cho lần sau.
 */
import { t } from '../i18n';

const TRANSFORMERS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2';

/* Kiểu tối thiểu của phần Transformers.js đang dùng */
export interface RawImageT { data: Uint8Array | Uint8ClampedArray; width: number; height: number; channels: number; resize(w: number, h: number): Promise<RawImageT> }
export interface TensorT { sigmoid(): TensorT; mul(n: number): TensorT; to(type: string): TensorT; [i: number]: TensorT }
export interface TransformersT {
  env: { allowLocalModels: boolean; useBrowserCache: boolean };
  RawImage: { new (data: Uint8ClampedArray, w: number, h: number, c: number): RawImageT; fromTensor(t: TensorT): RawImageT };
  AutoModel: { from_pretrained(id: string, o?: Record<string, unknown>): Promise<(inputs: Record<string, unknown>) => Promise<Record<string, TensorT>>> };
  AutoProcessor: { from_pretrained(id: string, o?: Record<string, unknown>): Promise<(img: RawImageT) => Promise<{ pixel_values: unknown }>> };
  pipeline(task: string, model: string, o?: Record<string, unknown>): Promise<(input: RawImageT) => Promise<RawImageT>>;
}

let lib: Promise<TransformersT> | null = null;
export function loadTransformers(): Promise<TransformersT> {
  lib ??= (import(/* @vite-ignore */ TRANSFORMERS) as Promise<TransformersT>)
    .then((m) => {
      m.env.allowLocalModels = false;
      m.env.useBrowserCache = true;
      return m;
    })
    .catch(() => {
      lib = null;
      throw new Error(t('lib.ai.load', 'Không tải được bộ chạy AI. Kiểm tra kết nối mạng rồi thử lại.'));
    });
  return lib;
}

export const hasWebGpu = (): boolean => !!(navigator as unknown as { gpu?: unknown }).gpu;

export interface LoadProgress { (loadedBytes: number, totalBytes: number, file: string): void }

/** Gom tiến độ tải nhiều file của một mô hình thành một con số */
export function progressAdapter(onProgress?: LoadProgress): (p: { status: string; file?: string; loaded?: number; total?: number }) => void {
  const files = new Map<string, [number, number]>();
  return (p) => {
    if (!onProgress || !p.file) return;
    if (p.status === 'progress' || p.status === 'done') {
      const prev = files.get(p.file) ?? [0, 0];
      files.set(p.file, [p.loaded ?? prev[1], p.total ?? prev[1]]);
      let l = 0, tt = 0;
      for (const [a, b] of files.values()) { l += a; tt += b; }
      onProgress(l, tt, p.file);
    }
  };
}

/** Thử chạy bằng WebGPU, lỗi thì quay về WASM */
export async function withDevice<T>(fn: (device: 'webgpu' | 'wasm') => Promise<T>): Promise<T> {
  if (hasWebGpu()) {
    try {
      return await fn('webgpu');
    } catch {
      /* WebGPU không dùng được với mô hình / máy này */
    }
  }
  return fn('wasm');
}

/** Canvas → RawImage RGB */
export function canvasToRaw(T: TransformersT, c: HTMLCanvasElement): RawImageT {
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const rgb = new Uint8ClampedArray(c.width * c.height * 3);
  for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { rgb[j] = d[i]; rgb[j + 1] = d[i + 1]; rgb[j + 2] = d[i + 2]; }
  return new T.RawImage(rgb, c.width, c.height, 3);
}

/** RawImage (1, 3 hoặc 4 kênh) → ImageData RGBA */
export function rawToImageData(r: RawImageT): ImageData {
  const out = new ImageData(r.width, r.height);
  const n = r.width * r.height;
  const c = r.channels;
  for (let i = 0; i < n; i++) {
    const s = i * c;
    out.data[i * 4] = r.data[s];
    out.data[i * 4 + 1] = c >= 3 ? r.data[s + 1] : r.data[s];
    out.data[i * 4 + 2] = c >= 3 ? r.data[s + 2] : r.data[s];
    out.data[i * 4 + 3] = c === 4 ? r.data[s + 3] : 255;
  }
  return out;
}
