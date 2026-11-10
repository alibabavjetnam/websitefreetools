/** Vẽ và gắn game Pinball (lõi ở calc/pinball.ts, khung ở canvasgame.ts). */
import { Af } from './arcade-ui';
import { mountCanvasGame } from './canvasgame';
import { PB_H, PB_W, PB_WALLS, pinballNew, pinballStep } from '../calc/pinball';

export function mountPinball(id: string): void {
  mountCanvasGame({
    id, W: PB_W, H: PB_H, pad: ['left', 'right'], noteKey: 'note.pinball', tapIsAction: true,
    noteFb: 'Bấm phím cách, ↑ hoặc chạm vào sân để phóng bóng. Giữ ← (hoặc chạm nửa trái sân) để nâng cần gạt trái, → (hoặc nửa phải) cho cần gạt phải; đừng giữ mãi, hãy gạt từng nhịp. Bóng chạm bumper tròn được 100 điểm. Có 3 bóng; đạt đủ điểm mục tiêu trước khi hết bóng để qua cấp.',
    init: pinballNew, step: pinballStep,
    draw: (c, s, _l, tm) => {
      const g = c.createLinearGradient(0, 0, 0, PB_H); g.addColorStop(0, '#1b1b3a'); g.addColorStop(1, '#2d1b4e');
      c.fillStyle = g; c.fillRect(0, 0, PB_W, PB_H);
      c.strokeStyle = '#8ecae6'; c.lineWidth = 6; c.lineCap = 'round';
      for (const w of PB_WALLS) { c.beginPath(); c.moveTo(w[0], w[1]); c.lineTo(w[2], w[3]); c.stroke(); }
      for (const b of s.bumpers) {
        c.fillStyle = b.pulse > 0 ? '#ffe066' : '#ff6b6b'; c.beginPath(); c.arc(b.x, b.y, b.r + b.pulse * 4, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#fff'; c.font = '700 14px sans-serif'; c.textAlign = 'center'; c.fillText('100', b.x, b.y + 5);
      }
      c.lineCap = 'round'; c.lineWidth = 12; c.strokeStyle = '#ffd43b';
      for (const f of s.fl) {
        c.beginPath(); c.moveTo(f.px, f.py); c.lineTo(f.px + f.side * Math.cos(f.a) * f.len, f.py + Math.sin(f.a) * f.len); c.stroke();
      }
      if (s.ready) { c.fillStyle = 'rgba(255,255,255,.8)'; c.font = '600 14px sans-serif'; c.textAlign = 'center'; c.fillText('▼', 360, 70 + Math.sin(tm * 6) * 4); }
      c.fillStyle = '#f1f3f5'; c.beginPath(); c.arc(s.x, s.y, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(s.x - 3, s.y - 3, 3, 0, Math.PI * 2); c.fill();
    },
    hud: (s) => [Af('pinBalls', 'Bóng: {n} · Mục tiêu: {t}', { n: s.balls, t: s.target }), String(s.score)],
    score: (s) => s.score,
  });
}
