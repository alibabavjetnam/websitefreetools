/** Dò cao độ âm thanh (YIN rút gọn) và quy đổi tần số ↔ nốt nhạc. Hàm thuần. */

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** Tần số (Hz) → số MIDI (thực), A4 = 69 */
export const freqToMidi = (f: number, a4 = 440): number => 69 + 12 * Math.log2(f / a4);
export const midiToFreq = (m: number, a4 = 440): number => a4 * Math.pow(2, (m - 69) / 12);
export function noteName(midi: number): { name: string; octave: number } {
  const n = Math.round(midi);
  return { name: NOTE_NAMES[((n % 12) + 12) % 12], octave: Math.floor(n / 12) - 1 };
}

/**
 * Tìm tần số cơ bản bằng thuật toán YIN (de Cheveigné & Kawahara, 2002).
 * Trả về null khi tín hiệu quá nhỏ hoặc không rõ cao độ.
 */
export function detectPitch(buf: Float32Array, sampleRate: number, minHz = 40, maxHz = 1200, threshold = 0.12): number | null {
  // Bỏ qua khi quá nhỏ (im lặng)
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return null;

  const maxTau = Math.min(Math.floor(sampleRate / minHz), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxHz));
  const W = buf.length - maxTau;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < W; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  // Hàm sai khác chuẩn hoá tích luỹ
  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    cmnd[tau] = running ? (d[tau] * tau) / running : 1;
  }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= maxTau && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // Nội suy parabol quanh cực tiểu cho chính xác hơn
  const x0 = tau > 1 ? cmnd[tau - 1] : cmnd[tau];
  const x2 = tau < maxTau ? cmnd[tau + 1] : cmnd[tau];
  const denom = 2 * (2 * cmnd[tau] - x2 - x0);
  const better = denom ? tau + (x2 - x0) / denom : tau;
  return sampleRate / better;
}

/** Bộ dây chuẩn theo nhạc cụ: số MIDI từ dây trầm đến dây cao */
export const TUNINGS: Record<string, { id: string; midi: number[] }[]> = {
  guitar: [
    { id: 'standard', midi: [40, 45, 50, 55, 59, 64] }, // E A D G B E
    { id: 'dropD', midi: [38, 45, 50, 55, 59, 64] },
    { id: 'halfDown', midi: [39, 44, 49, 54, 58, 63] },
    { id: 'openG', midi: [38, 43, 50, 55, 59, 62] },
    { id: 'dadgad', midi: [38, 45, 50, 55, 57, 62] },
  ],
  ukulele: [{ id: 'standard', midi: [67, 60, 64, 69] }], // G C E A (dây G cao)
  bass: [{ id: 'standard', midi: [28, 33, 38, 43] }], // E A D G
  violin: [{ id: 'standard', midi: [55, 62, 69, 76] }], // G D A E
};
