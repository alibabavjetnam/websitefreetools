/**
 * Âm thanh cho nhóm Game giải trí — tổng hợp bằng Web Audio (không cần file âm thanh).
 * Cố ý để to, dày tiếng: mỗi tiếng gồm nhiều lớp (sóng vuông/răng cưa + nhiễu), đi qua bộ nén
 * để không vỡ tiếng, âm lượng tổng cao. Bật/tắt bằng nút loa trong khung game (lưu localStorage).
 */
export type Sfx =
  | 'tap' | 'select' | 'move' | 'capture' | 'place' | 'flip' | 'deal' | 'error' | 'coin' | 'eat' | 'pop'
  | 'line' | 'clear' | 'drop' | 'bounce' | 'brick' | 'tick' | 'whoosh' | 'boom' | 'check' | 'roll'
  | 'win' | 'lose' | 'draw' | 'levelup' | 'shoot' | 'hit' | 'jump' | 'combo' | 'warn';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
try { muted = localStorage.getItem('wft:sfx') === 'off'; } catch { /* bỏ qua */ }

const AC = (): typeof AudioContext | undefined =>
  window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

function ensure(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const C = AC();
    if (!C) return null;
    try { ctx = new C(); } catch { return null; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.18;
    master = ctx.createGain();
    master.gain.value = 1.9; // to: bộ nén giữ cho không méo
    master.connect(comp); comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

const noise = (c: AudioContext): AudioBuffer => {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
};

interface Tone { f: number; t?: number; d: number; type?: OscillatorType; v?: number; to?: number; det?: number }

/** Một nốt: tần số f (Hz) bắt đầu sau t giây, kéo dài d giây, có thể trượt đến `to` Hz */
function tone(c: AudioContext, o: Tone): void {
  const t0 = c.currentTime + (o.t ?? 0);
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.d);
  if (o.det) osc.detune.value = o.det;
  const v = o.v ?? 0.5;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
  osc.connect(g); g.connect(master as GainNode);
  osc.start(t0); osc.stop(t0 + o.d + 0.03);
}

/** Tiếng ồn lọc (nổ, xì, vỗ tay) */
function hiss(c: AudioContext, d: number, v: number, f0: number, f1: number, t = 0, type: BiquadFilterType = 'lowpass'): void {
  const t0 = c.currentTime + t;
  const src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noise(c); src.loop = true;
  fl.type = type;
  fl.frequency.setValueAtTime(f0, t0);
  fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  src.connect(fl); fl.connect(g); g.connect(master as GainNode);
  src.start(t0); src.stop(t0 + d + 0.03);
}

const N = (n: number): number => 440 * Math.pow(2, (n - 69) / 12); // số nốt MIDI → Hz
const arp = (c: AudioContext, notes: number[], step: number, d: number, type: OscillatorType, v: number, t = 0): void =>
  notes.forEach((n, i) => { tone(c, { f: N(n), t: t + i * step, d, type, v }); tone(c, { f: N(n) * 2, t: t + i * step, d: d * 0.8, type: 'triangle', v: v * 0.6 }); });

const SOUNDS: Record<Sfx, (c: AudioContext) => void> = {
  tap: (c) => { tone(c, { f: 880, to: 520, d: 0.07, type: 'square', v: 0.45 }); },
  select: (c) => { tone(c, { f: 660, d: 0.06, type: 'square', v: 0.5 }); tone(c, { f: 990, t: 0.05, d: 0.09, type: 'square', v: 0.45 }); },
  move: (c) => { tone(c, { f: 220, to: 120, d: 0.12, type: 'triangle', v: 0.9 }); hiss(c, 0.06, 0.5, 2200, 600); },
  capture: (c) => { tone(c, { f: 180, to: 70, d: 0.22, type: 'sawtooth', v: 0.7 }); hiss(c, 0.16, 0.9, 3500, 300); tone(c, { f: 330, to: 110, d: 0.18, type: 'square', v: 0.4 }); },
  place: (c) => { tone(c, { f: 150, to: 90, d: 0.1, type: 'triangle', v: 1 }); hiss(c, 0.05, 0.6, 3000, 900); },
  flip: (c) => { hiss(c, 0.09, 0.7, 5000, 1200, 0, 'bandpass'); tone(c, { f: 500, to: 300, d: 0.06, type: 'triangle', v: 0.35 }); },
  deal: (c) => { hiss(c, 0.07, 0.6, 6000, 2500, 0, 'bandpass'); tone(c, { f: 320, to: 200, d: 0.05, type: 'triangle', v: 0.3 }); },
  error: (c) => { tone(c, { f: 160, d: 0.16, type: 'sawtooth', v: 0.7 }); tone(c, { f: 150, t: 0.12, d: 0.2, type: 'sawtooth', v: 0.7 }); },
  coin: (c) => { tone(c, { f: N(83), d: 0.09, type: 'square', v: 0.5 }); tone(c, { f: N(88), t: 0.08, d: 0.4, type: 'square', v: 0.5 }); tone(c, { f: N(95), t: 0.08, d: 0.3, type: 'triangle', v: 0.35 }); },
  eat: (c) => { tone(c, { f: 420, to: 1100, d: 0.12, type: 'square', v: 0.55 }); tone(c, { f: 840, to: 1500, t: 0.05, d: 0.1, type: 'triangle', v: 0.4 }); },
  pop: (c) => { tone(c, { f: 300, to: 1200, d: 0.09, type: 'sine', v: 1 }); hiss(c, 0.05, 0.5, 6000, 2000, 0, 'highpass'); },
  line: (c) => { arp(c, [72, 76, 79, 84], 0.06, 0.18, 'square', 0.45); hiss(c, 0.3, 0.6, 7000, 800, 0, 'highpass'); },
  clear: (c) => { arp(c, [67, 72, 76, 79, 84, 88], 0.055, 0.22, 'square', 0.5); hiss(c, 0.5, 0.8, 8000, 600, 0, 'highpass'); tone(c, { f: 90, to: 50, d: 0.4, type: 'sawtooth', v: 0.7 }); },
  drop: (c) => { tone(c, { f: 130, to: 45, d: 0.16, type: 'sawtooth', v: 1 }); hiss(c, 0.1, 0.9, 1500, 200); },
  bounce: (c) => { tone(c, { f: 300, to: 520, d: 0.07, type: 'square', v: 0.55 }); },
  brick: (c) => { tone(c, { f: 700 + Math.random() * 500, to: 300, d: 0.09, type: 'square', v: 0.6 }); hiss(c, 0.08, 0.6, 5000, 1500); },
  tick: (c) => { tone(c, { f: 1200, to: 900, d: 0.03, type: 'square', v: 0.3 }); },
  whoosh: (c) => { hiss(c, 0.3, 0.8, 400, 4000, 0, 'bandpass'); },
  boom: (c) => { hiss(c, 0.9, 1.4, 2500, 60); tone(c, { f: 110, to: 28, d: 0.8, type: 'sawtooth', v: 1.2 }); tone(c, { f: 70, to: 30, d: 0.9, type: 'sine', v: 1.2 }); },
  check: (c) => { tone(c, { f: N(76), d: 0.12, type: 'square', v: 0.55 }); tone(c, { f: N(76), t: 0.15, d: 0.22, type: 'square', v: 0.55 }); tone(c, { f: N(64), d: 0.3, type: 'sawtooth', v: 0.4 }); },
  roll: (c) => { for (let i = 0; i < 7; i++) { tone(c, { f: 180 + Math.random() * 220, t: i * 0.055, d: 0.05, type: 'triangle', v: 0.8 }); hiss(c, 0.04, 0.5, 2500, 900, i * 0.055); } },
  shoot: (c) => { tone(c, { f: 1400, to: 200, d: 0.16, type: 'sawtooth', v: 0.55 }); hiss(c, 0.1, 0.4, 6000, 1500, 0, 'highpass'); },
  hit: (c) => { tone(c, { f: 220, to: 60, d: 0.25, type: 'sawtooth', v: 0.9 }); hiss(c, 0.2, 1, 3000, 200); },
  jump: (c) => { tone(c, { f: 260, to: 760, d: 0.16, type: 'square', v: 0.55 }); tone(c, { f: 520, to: 1100, d: 0.14, type: 'triangle', v: 0.35 }); },
  combo: (c) => { arp(c, [76, 79, 83, 88], 0.045, 0.2, 'square', 0.5); tone(c, { f: N(52), d: 0.3, type: 'sawtooth', v: 0.4 }); },
  warn: (c) => { for (let i = 0; i < 3; i++) tone(c, { f: i % 2 ? 700 : 940, t: i * 0.11, d: 0.1, type: 'square', v: 0.5 }); },
  levelup: (c) => { arp(c, [60, 64, 67, 72, 76, 79, 84], 0.07, 0.25, 'square', 0.5); tone(c, { f: N(48), d: 0.6, type: 'sawtooth', v: 0.5 }); },
  // Khải hoàn: dàn kèn + trống + vỗ tay — cố ý dài và to
  win: (c) => {
    const seq = [[60, 0], [64, 0.12], [67, 0.24], [72, 0.36], [67, 0.52], [72, 0.64], [76, 0.78]];
    seq.forEach(([n, t]) => { tone(c, { f: N(n), t, d: 0.2, type: 'sawtooth', v: 0.55 }); tone(c, { f: N(n + 12), t, d: 0.2, type: 'square', v: 0.3 }); });
    [[72, 76, 79, 84]].forEach((ch) => ch.forEach((n) => { tone(c, { f: N(n), t: 0.95, d: 1.3, type: 'sawtooth', v: 0.5 }); tone(c, { f: N(n - 12), t: 0.95, d: 1.3, type: 'triangle', v: 0.5 }); }));
    tone(c, { f: 90, to: 45, t: 0, d: 0.3, type: 'sine', v: 1.2 }); tone(c, { f: 90, to: 45, t: 0.95, d: 0.5, type: 'sine', v: 1.3 });
    hiss(c, 0.4, 0.8, 9000, 3000, 0.95, 'highpass');
    for (let i = 0; i < 16; i++) hiss(c, 0.1, 0.5, 4500, 1500, 1.1 + i * 0.07, 'bandpass'); // vỗ tay
  },
  lose: (c) => {
    [[64, 0], [62, 0.28], [60, 0.56], [55, 0.84]].forEach(([n, t]) => { tone(c, { f: N(n), t, d: 0.34, type: 'sawtooth', v: 0.6 }); tone(c, { f: N(n - 12), t, d: 0.34, type: 'square', v: 0.35 }); });
    tone(c, { f: 100, to: 35, t: 1.0, d: 0.9, type: 'sawtooth', v: 1 });
  },
  draw: (c) => { arp(c, [64, 62, 64, 60], 0.2, 0.26, 'triangle', 0.7); },
};

/** Phát một tiếng. An toàn khi trình duyệt chặn/không hỗ trợ. */
export let lastSfxAt = 0;
export function sfx(name: Sfx): void {
  try {
    lastSfxAt = performance.now();
    const c = ensure();
    if (c) SOUNDS[name](c);
  } catch { /* âm thanh chỉ là phần thêm, không làm hỏng game */ }
}

export const isMuted = (): boolean => muted;
export function setMuted(v: boolean): void {
  muted = v;
  try { localStorage.setItem('wft:sfx', v ? 'off' : 'on'); } catch { /* bỏ qua */ }
  if (!v) sfx('select');
}

/** Mở khoá âm thanh ở cú chạm đầu tiên (trình duyệt di động bắt buộc) */
let armed = false;
export function armAudio(): void {
  if (armed) return;
  armed = true;
  const go = (): void => { ensure(); };
  document.addEventListener('pointerdown', go, { once: true, capture: true });
  document.addEventListener('keydown', go, { once: true, capture: true });
}

/** Phát một nốt nhạc theo tần số (Simon, nhạc cụ nhỏ) */
export function noteSfx(freq: number, d = 0.35, type: OscillatorType = 'square'): void {
  try { const c = ensure(); if (c) { lastSfxAt = performance.now(); tone(c, { f: freq, d, type, v: 0.9 }); tone(c, { f: freq * 2, d: d * 0.8, type: 'triangle', v: 0.5 }); } } catch { /* bỏ qua */ }
}
