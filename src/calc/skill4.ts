/** Lõi thuần cho các game kỹ năng đợt 4: đập chuột, Simon, tập ngắm, toán nhanh, phản xạ. */
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const ri = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1));

/** Đập chuột: lưới, số cú cần đạt, thời gian, thời gian chuột nhô lên, xác suất bom */
export interface WhackCfg { cols: number; rows: number; need: number; secs: number; up: number; every: number; bomb: number }
export const whackCfg = (l: number): WhackCfg => {
  l = clamp(l, 1, 10);
  return { cols: l <= 3 ? 3 : l <= 6 ? 4 : 4, rows: l <= 3 ? 3 : l <= 6 ? 3 : 4, need: 8 + l * 3, secs: 30, up: Math.max(380, 1200 - l * 85), every: Math.max(320, 780 - l * 45), bomb: l >= 4 ? 0.12 + (l - 4) * 0.03 : 0 };
};

/** Simon: số nút, độ dài cần nhớ, tốc độ phát (ms mỗi nốt) */
export interface SimonCfg { pads: number; need: number; step: number }
export const simonCfg = (l: number): SimonCfg => {
  l = clamp(l, 1, 10);
  return { pads: l <= 6 ? 4 : 6, need: 4 + l, step: Math.round(720 - l * 46) };
};
export const SIMON_FREQ = [262, 330, 392, 523, 659, 784];

/** Tập ngắm: số bia phải trúng, cỡ bia (% bề rộng sân), thời gian tồn tại, số lần trượt cho phép */
export interface AimCfg { need: number; size: number; life: number; misses: number }
export const aimCfg = (l: number): AimCfg => { l = clamp(l, 1, 10); return { need: 12 + l * 2, size: 15 - l * 1.0, life: 1700 - l * 105, misses: 5 }; };

/** Toán nhanh */
export interface MathQ { text: string; answer: number }
export interface MathCfg { need: number; secs: number; lives: number }
export const mathCfg = (l: number): MathCfg => { l = clamp(l, 1, 10); return { need: 8 + l * 2, secs: Math.round((14 - l * 0.9) * 10) / 10, lives: 3 }; };
export function mathQuestion(level: number): MathQ {
  const l = clamp(level, 1, 10);
  let a: number, b: number, c: number;
  if (l <= 2) { a = ri(1, 9 + l * 5); b = ri(1, 9 + l * 5); return Math.random() < 0.6 ? { text: `${a} + ${b}`, answer: a + b } : { text: `${a + b} − ${b}`, answer: a }; }
  if (l <= 4) { a = ri(10, 60 + l * 10); b = ri(10, 40 + l * 10); return Math.random() < 0.5 ? { text: `${a} + ${b}`, answer: a + b } : { text: `${a + b} − ${b}`, answer: a }; }
  if (l <= 6) { a = ri(2, 9 + (l - 5) * 3); b = ri(2, 9 + (l - 5) * 3); if (Math.random() < 0.7) return { text: `${a} × ${b}`, answer: a * b }; return { text: `${a * b} ÷ ${b}`, answer: a }; }
  if (l <= 8) { a = ri(2, 12); b = ri(2, 12); c = ri(5, 60); return Math.random() < 0.5 ? { text: `${a} × ${b} + ${c}`, answer: a * b + c } : { text: `${a * b + c} − ${a} × ${b}`, answer: c }; }
  a = ri(12, 25); b = ri(3, 15); c = ri(20, 99);
  const k = Math.random();
  if (k < 0.34) return { text: `${a} × ${b} − ${c}`, answer: a * b - c };
  if (k < 0.67) { const m = ri(2, 9); return { text: `(${a} + ${c}) × ${m}`, answer: (a + c) * m }; }
  return { text: `${a * b} ÷ ${b} + ${c}`, answer: a + c };
}

/** Phản xạ: số lượt, ngưỡng trung bình (ms) để qua cấp, số lần bấm sớm cho phép */
export interface ReactCfg { rounds: number; limit: number; fouls: number }
export const reactCfg = (l: number): ReactCfg => { l = clamp(l, 1, 10); return { rounds: 5, limit: Math.round(640 - (l - 1) * 40), fouls: 3 }; };
