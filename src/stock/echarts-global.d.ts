/**
 * ECharts được nạp qua thẻ <script> (CDN) để cả bản Vite lẫn bản standalone
 * dùng chung một cách nạp. Khai báo tối thiểu cho phần API mà dự án dùng.
 */
interface EChartsInstance {
  setOption(option: unknown, opts?: { notMerge?: boolean; replaceMerge?: string[] }): void;
  resize(): void;
  clear(): void;
  dispose(): void;
  getOption(): { dataZoom?: { start?: number; end?: number }[] };
}

declare const echarts: {
  init(el: HTMLElement, theme?: string | null, opts?: { renderer?: 'canvas' | 'svg' }): EChartsInstance;
};
