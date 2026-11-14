import { mountLayout } from '../layout';
import { $, downloadBlob, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { input, select, check, button, el, privacyNote, val, checked, onChange, showError, errorBox } from '../lib/devkit';

mountLayout({ activeTool: 'image-collage' });
const T = pageText();
// Bố cục: danh sách ô [x, y, w, h] theo tỉ lệ 0-1
const LAYOUTS: Record<string, number[][]> = {
  '2h': [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]], '2v': [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
  '3a': [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]], '3h': [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]],
  '4': [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]], '4a': [[0, 0, 1, 0.6], [0, 0.6, 1 / 3, 0.4], [1 / 3, 0.6, 1 / 3, 0.4], [2 / 3, 0.6, 1 / 3, 0.4]],
  '6': Array.from({ length: 6 }, (_, i) => [(i % 3) / 3, Math.floor(i / 3) / 2, 1 / 3, 0.5]), '9': Array.from({ length: 9 }, (_, i) => [(i % 3) / 3, Math.floor(i / 3) / 3, 1 / 3, 1 / 3]),
};

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="collage">${T('tab.collage', 'Ghép nhiều ảnh')}</button>
    <button type="button" role="tab" data-tab="meme">${T('tab.meme', 'Tạo meme / chèn chữ')}</button>
  </div>
  <div class="workspace" style="margin-top:0">
    <div class="panel">
      <label class="field"><span class="field-label">${T('pick', 'Chọn ảnh')}</span><input type="file" id="files" accept="image/*" multiple /></label>
      <div data-panel="collage">
        <div class="form-grid">
          ${select('layout', T('layout', 'Bố cục'), [['2h', T('l.2h', '2 ảnh ngang')], ['2v', T('l.2v', '2 ảnh dọc')], ['3a', T('l.3a', '3 ảnh (1 lớn + 2 nhỏ)')], ['3h', T('l.3h', '3 ảnh ngang')], ['4', T('l.4', '4 ảnh lưới')], ['4a', T('l.4a', '4 ảnh (1 lớn + 3 nhỏ)')], ['6', T('l.6', '6 ảnh')], ['9', T('l.9', '9 ảnh')]], '4')}
          ${select('size', T('size', 'Khung'), [['1080x1080', T('s.sq', 'Vuông 1080×1080 (Instagram)')], ['1080x1350', T('s.port', 'Dọc 1080×1350')], ['1920x1080', T('s.land', 'Ngang 1920×1080')], ['1080x1920', T('s.story', 'Story 1080×1920')]], '1080x1080')}
          ${input('gap', T('gap', 'Khoảng cách (px)'), { type: 'number', value: '12', attrs: 'min="0" max="80"' })}
          ${input('bg', T('bg', 'Màu nền / viền'), { type: 'color', value: '#ffffff' })}
          ${input('rad', T('rad', 'Bo góc (px)'), { type: 'number', value: '0', attrs: 'min="0" max="80"' })}
        </div>
      </div>
      <div data-panel="meme" hidden>
        ${input('top', T('top', 'Chữ phía trên'), { value: T('s.top', 'KHI CODE CHẠY NGAY LẦN ĐẦU') })}
        ${input('bottom', T('bottom', 'Chữ phía dưới'), { value: T('s.bottom', 'KHÔNG DÁM ĐỤNG VÀO NỮA') })}
        <div class="form-grid">
          ${input('fs', T('fs', 'Cỡ chữ (% chiều rộng)'), { type: 'number', value: '9', attrs: 'min="3" max="20"' })}
          ${input('fc', T('fc', 'Màu chữ'), { type: 'color', value: '#ffffff' })}
          ${check('upper', T('upper', 'Viết hoa'), true)}
        </div>
      </div>
      ${errorBox('err')}
      <div class="row">${button('dl', T('dl', 'Tải ảnh PNG'), true)}${button('dlj', T('dlj', 'Tải ảnh JPG'))}</div>
    </div>
    <div class="panel"><canvas id="cv" class="ic-canvas"></canvas><p class="note">${T('hint', 'Ảnh được cắt vừa khung tự động (giữ phần giữa). Thứ tự ảnh theo thứ tự bạn chọn file.')}</p></div>
  </div>
  ${privacyNote()}
`;
let tab = 'collage';
let imgs: ImageBitmap[] = [];
el('files').addEventListener('change', async () => {
  showError('err', '');
  imgs.forEach((b) => b.close());
  imgs = [];
  for (const f of el<HTMLInputElement>('files').files ?? []) { try { imgs.push(await createImageBitmap(f)); } catch { showError('err', T('bad', 'Có ảnh không đọc được và đã bị bỏ qua.')); } }
  void draw();
});
function cover(g: CanvasRenderingContext2D, b: ImageBitmap, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(w / b.width, h / b.height), sw = w / k, sh = h / k;
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
  g.drawImage(b, (b.width - sw) / 2, (b.height - sh) / 2, sw, sh, x, y, w, h);
  g.restore();
}
function caption(g: CanvasRenderingContext2D, text: string, W: number, H: number, top: boolean): void {
  if (!text) return;
  const t = checked('upper') ? text.toLocaleUpperCase() : text;
  let fs = (W * (Number(val('fs')) || 9)) / 100;
  g.font = `900 ${fs}px Impact, "Arial Black", "Be Vietnam Pro", sans-serif`;
  while (g.measureText(t).width > W * 0.94 && fs > 10) { fs -= 2; g.font = `900 ${fs}px Impact, "Arial Black", "Be Vietnam Pro", sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = top ? 'top' : 'bottom';
  g.lineWidth = fs / 7; g.strokeStyle = '#000'; g.fillStyle = val('fc'); g.lineJoin = 'round';
  const y = top ? H * 0.03 : H * 0.97;
  g.strokeText(t, W / 2, y); g.fillText(t, W / 2, y);
}
async function draw(): Promise<void> {
  const c = el<HTMLCanvasElement>('cv'), g = c.getContext('2d') as CanvasRenderingContext2D;
  if (tab === 'meme') {
    const b = imgs[0];
    const W = b ? Math.min(1600, b.width) : 1000, H = b ? Math.round(W * b.height / b.width) : 700;
    c.width = W; c.height = H;
    g.fillStyle = '#444'; g.fillRect(0, 0, W, H);
    if (b) g.drawImage(b, 0, 0, W, H);
    caption(g, val('top'), W, H, true); caption(g, val('bottom'), W, H, false);
    return;
  }
  const [W, H] = val('size').split('x').map(Number);
  c.width = W; c.height = H;
  const gap = Number(val('gap')) || 0, r = Number(val('rad')) || 0;
  g.fillStyle = val('bg'); g.fillRect(0, 0, W, H);
  LAYOUTS[val('layout')].forEach(([x, y, w, h], i) => {
    const px = x * (W - gap) + gap, py = y * (H - gap) + gap, pw = w * (W - gap) - gap, ph = h * (H - gap) - gap;
    const b = imgs[i % Math.max(1, imgs.length)];
    if (b) cover(g, b, px, py, pw, ph, r);
    else { g.fillStyle = '#e3e6ea'; g.beginPath(); g.roundRect(px, py, pw, ph, r); g.fill(); g.fillStyle = '#8a94a6'; g.font = `600 ${Math.min(pw, ph) / 6}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), px + pw / 2, py + ph / 2); }
  });
}
const save = (type: string, ext: string) => el<HTMLCanvasElement>('cv').toBlob((b) => b && downloadBlob(b, `${tab === 'meme' ? 'meme' : 'collage'}.${ext}`), type, 0.92);
el('dl').addEventListener('click', () => save('image/png', 'png'));
el('dlj').addEventListener('click', () => save('image/jpeg', 'jpg'));
onChange(['layout', 'size', 'gap', 'bg', 'rad', 'top', 'bottom', 'fs', 'fc', 'upper'], () => void draw(), 60);
setupTabs($('#tool-root'), (t) => { tab = t; void draw(); });
void draw();
