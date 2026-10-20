/** Chuyển đổi màu và tạo bảng màu */

export interface RGB { r: number; g: number; b: number }
export interface HSL { h: number; s: number; l: number }

export function parseHex(input: string): RGB | null {
  let h = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100, ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

export const rgbText = ({ r, g, b }: RGB) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
export const hslText = ({ h, s, l }: HSL) => `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;

function luminance({ r, g, b }: RGB): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Tỷ lệ tương phản WCAG giữa hai màu (1 đến 21) */
export function contrastRatio(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Chữ trắng hay đen đọc rõ hơn trên nền màu này */
export function readableOn(bg: RGB): '#ffffff' | '#16233a' {
  const white = contrastRatio(bg, { r: 255, g: 255, b: 255 });
  const dark = contrastRatio(bg, { r: 22, g: 35, b: 58 });
  return white >= dark ? '#ffffff' : '#16233a';
}

const rotate = (hsl: HSL, deg: number): HSL => ({ ...hsl, h: (hsl.h + deg + 360) % 360 });

export type Harmony = 'complementary' | 'analogous' | 'triadic' | 'split' | 'tetradic' | 'monochrome';

export const HARMONY_LABELS: Record<Harmony, string> = {
  complementary: 'Bổ túc',
  analogous: 'Tương đồng',
  triadic: 'Bộ ba',
  split: 'Bổ túc tách',
  tetradic: 'Bộ bốn',
  monochrome: 'Đơn sắc',
};

export function harmony(base: RGB, kind: Harmony): RGB[] {
  const hsl = rgbToHsl(base);
  const hues: Record<Harmony, number[]> = {
    complementary: [0, 180],
    analogous: [-30, 0, 30],
    triadic: [0, 120, 240],
    split: [0, 150, 210],
    tetradic: [0, 90, 180, 270],
    monochrome: [],
  };
  if (kind === 'monochrome') {
    return [20, 35, 50, 65, 80].map((l) => hslToRgb({ ...hsl, l }));
  }
  return hues[kind].map((d) => hslToRgb(rotate(hsl, d)));
}

/** Thang sắc độ 50–900 kiểu design system, giữ màu gốc ở giữa */
export function shadeScale(base: RGB): { step: number; color: RGB }[] {
  const hsl = rgbToHsl(base);
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  const lightness = [96, 90, 80, 68, 57, hsl.l, Math.max(hsl.l - 10, 8), Math.max(hsl.l - 20, 6), Math.max(hsl.l - 30, 4), Math.max(hsl.l - 38, 3)];
  return steps.map((step, i) => ({ step, color: hslToRgb({ ...hsl, l: i < 5 ? Math.max(lightness[i], hsl.l) : lightness[i] }) }));
}
