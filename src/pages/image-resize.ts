import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, fmtInt, storage } from '../ui';
import { pageText } from '../i18n';
import { loadImage, canvasToBlob, MAX_IMAGE_BYTES } from '../lib/image';
import { bindDropzone, fmtSize, makeZip, baseName } from '../lib/files';

mountLayout({ activeTool: 'image-resize' });
const T = pageText();

type Mode = 'percent' | 'pixels' | 'preset';
type Fit = 'contain' | 'cover' | 'stretch';
const PRESETS: { id: string; w: number; h: number; label: string }[] = [
  { id: 'ig-square', w: 1080, h: 1080, label: T('pIgSquare', 'Instagram vuông') },
  { id: 'ig-portrait', w: 1080, h: 1350, label: T('pIgPortrait', 'Instagram dọc 4:5') },
  { id: 'story', w: 1080, h: 1920, label: T('pStory', 'Story / Reels / TikTok 9:16') },
  { id: 'fb-post', w: 1200, h: 630, label: T('pFbPost', 'Ảnh chia sẻ Facebook') },
  { id: 'fb-cover', w: 1640, h: 624, label: T('pFbCover', 'Ảnh bìa Facebook') },
  { id: 'yt-thumb', w: 1280, h: 720, label: T('pYtThumb', 'Ảnh thu nhỏ YouTube') },
  { id: 'x-post', w: 1600, h: 900, label: T('pXPost', 'Ảnh bài đăng X (Twitter)') },
  { id: 'li-cover', w: 1584, h: 396, label: T('pLiCover', 'Ảnh bìa LinkedIn') },
  { id: 'avatar', w: 400, h: 400, label: T('pAvatar', 'Ảnh đại diện') },
  { id: 'hd', w: 1920, h: 1080, label: 'Full HD 1920×1080' },
  { id: 'a4', w: 2480, h: 3508, label: T('pA4', 'Khổ A4 300 dpi') },
  { id: 'id-4x6', w: 472, h: 709, label: T('pId46', 'Ảnh thẻ 4×6 cm (300 dpi)') },
];

const st = storage<{ mode: Mode; pct: number; w: string; h: string; keep: boolean; preset: string; fit: Fit; format: string; quality: number; bg: string }>('image-resize', {
  mode: 'pixels', pct: 50, w: '1200', h: '', keep: true, preset: 'ig-square', fit: 'contain', format: 'keep', quality: 90, bg: '#ffffff',
});
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace tool-body">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="files" accept="image/*" multiple />
        <b>${T('dropTitle', 'Chọn ảnh hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'JPG, PNG, WebP, GIF, BMP, SVG. Nhiều ảnh cùng lúc, mỗi ảnh dưới 40 MB.')}</span>
      </label>
      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="mode" value="pixels" /><span>${T('mPixels', 'Theo pixel')}</span></label>
        <label><input type="radio" name="mode" value="percent" /><span>${T('mPercent', 'Theo phần trăm')}</span></label>
        <label><input type="radio" name="mode" value="preset" /><span>${T('mPreset', 'Cỡ có sẵn')}</span></label>
      </div>
      <div data-m="pixels" class="fields">
        <div class="field-row">
          <label class="field"><span class="field-label">${T('width', 'Chiều rộng (px)')}</span><input type="number" id="w" min="1" max="20000" placeholder="${T('auto', 'Tự động')}" /></label>
          <label class="field"><span class="field-label">${T('height', 'Chiều cao (px)')}</span><input type="number" id="h" min="1" max="20000" placeholder="${T('auto', 'Tự động')}" /></label>
        </div>
        <label class="check"><input type="checkbox" id="keep" /><span>${T('keep', 'Giữ đúng tỉ lệ ảnh (bỏ trống một ô để tự tính)')}</span></label>
      </div>
      <div data-m="percent"><label class="field"><span class="field-label">${T('scale', 'Tỉ lệ')}: <output id="pct-out"></output>%</span><input type="range" id="pct" min="5" max="400" step="5" /></label></div>
      <div data-m="preset"><label class="field"><span class="field-label">${T('preset', 'Kích thước')}</span><select id="preset">${PRESETS.map((p) => `<option value="${p.id}">${p.label} — ${p.w}×${p.h}</option>`).join('')}</select></label></div>
      <div class="field-row" id="fit-row">
        <label class="field"><span class="field-label">${T('fit', 'Khi khác tỉ lệ')}</span>
          <select id="fit"><option value="contain">${T('fContain', 'Giữ nguyên ảnh, thêm viền')}</option><option value="cover">${T('fCover', 'Cắt bớt cho vừa khung')}</option><option value="stretch">${T('fStretch', 'Kéo giãn cho vừa')}</option></select>
        </label>
        <label class="field"><span class="field-label">${T('bg', 'Màu viền')}</span><input type="color" id="bg" /></label>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('format', 'Định dạng xuất')}</span>
          <select id="format"><option value="keep">${T('fmtKeep', 'Giữ như ảnh gốc')}</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select>
        </label>
        <label class="field"><span class="field-label">${T('quality', 'Chất lượng')}: <output id="q-out"></output>%</span><input type="range" id="quality" min="40" max="100" step="1" /></label>
      </div>
    </div>
    <section class="preview">
      <div class="actions">
        <button type="button" class="btn btn-primary" id="run" disabled>${T('run', 'Đổi kích thước')}</button>
        <button type="button" class="btn" id="zip" disabled>${T('zip', 'Tải tất cả (.zip)')}</button>
        <button type="button" class="btn" id="clear" disabled>${T('clear', 'Xoá danh sách')}</button>
      </div>
      <p class="error" id="err" hidden></p>
      <div class="table-wrap"><table class="data-table img-table" id="list"></table></div>
    </section>
  </div>
`;

interface Item { file: File; thumb: string; w?: number; h?: number; out?: { blob: Blob; name: string; w: number; h: number }; error?: string }
let items: Item[] = [];
const $i = (id: string) => $<HTMLInputElement>('#' + id);

function load(): void {
  document.querySelectorAll<HTMLInputElement>('input[name=mode]').forEach((r) => (r.checked = r.value === s.mode));
  $i('pct').value = String(s.pct);
  $i('w').value = s.w;
  $i('h').value = s.h;
  $i('keep').checked = s.keep;
  $<HTMLSelectElement>('#preset').value = s.preset;
  $<HTMLSelectElement>('#fit').value = s.fit;
  $<HTMLSelectElement>('#format').value = s.format;
  $i('quality').value = String(s.quality);
  $i('bg').value = s.bg;
}
function read(): void {
  s.mode = (document.querySelector<HTMLInputElement>('input[name=mode]:checked')?.value ?? 'pixels') as Mode;
  s.pct = Number($i('pct').value);
  s.w = $i('w').value;
  s.h = $i('h').value;
  s.keep = $i('keep').checked;
  s.preset = $<HTMLSelectElement>('#preset').value;
  s.fit = $<HTMLSelectElement>('#fit').value as Fit;
  s.format = $<HTMLSelectElement>('#format').value;
  s.quality = Number($i('quality').value);
  s.bg = $i('bg').value;
  st.set(s);
  document.querySelectorAll<HTMLElement>('[data-m]').forEach((el) => (el.hidden = el.dataset.m !== s.mode));
  $('#pct-out').textContent = String(s.pct);
  $('#q-out').textContent = String(s.quality);
  // Chế độ khung cố định mới cần chọn cách lấp khung
  const fixedBox = s.mode === 'preset' || (s.mode === 'pixels' && !!s.w && !!s.h);
  $('#fit-row').hidden = !fixedBox;
  renderList();
}

/** Kích thước đích cho một ảnh gốc w×h, và cách vẽ (vùng nguồn → vùng đích) */
function target(w: number, h: number): { W: number; H: number; sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  let W = w, H = h;
  let box = false;
  if (s.mode === 'percent') { W = Math.round((w * s.pct) / 100); H = Math.round((h * s.pct) / 100); }
  else if (s.mode === 'preset') { const p = PRESETS.find((x) => x.id === s.preset) ?? PRESETS[0]; W = p.w; H = p.h; box = true; }
  else {
    const tw = Number(s.w) || 0, th = Number(s.h) || 0;
    if (tw && th) { W = tw; H = th; box = true; }
    else if (tw) { W = tw; H = Math.round((h * tw) / w); }
    else if (th) { H = th; W = Math.round((w * th) / h); }
  }
  W = Math.max(1, Math.min(20000, W));
  H = Math.max(1, Math.min(20000, H));
  const full = { sx: 0, sy: 0, sw: w, sh: h, dx: 0, dy: 0, dw: W, dh: H };
  if (!box || s.fit === 'stretch') return { W, H, ...full };
  const r = Math.min(W / w, H / h);
  if (s.fit === 'contain') {
    const dw = Math.round(w * r), dh = Math.round(h * r);
    // Khung pixel tự do với "giữ tỉ lệ": lấy luôn kích thước vừa khít, không thêm viền
    if (s.mode === 'pixels' && s.keep) return { W: dw, H: dh, sx: 0, sy: 0, sw: w, sh: h, dx: 0, dy: 0, dw, dh };
    return { W, H, sx: 0, sy: 0, sw: w, sh: h, dx: Math.round((W - dw) / 2), dy: Math.round((H - dh) / 2), dw, dh };
  }
  const R = Math.max(W / w, H / h);
  const sw = W / R, sh = H / R;
  return { W, H, sx: (w - sw) / 2, sy: (h - sh) / 2, sw, sh, dx: 0, dy: 0, dw: W, dh: H };
}

function outMime(f: File): string {
  if (s.format !== 'keep') return s.format;
  return ['image/png', 'image/webp', 'image/jpeg'].includes(f.type) ? f.type : f.type === 'image/svg+xml' || f.type === 'image/gif' ? 'image/png' : 'image/jpeg';
}
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function renderList(): void {
  $<HTMLButtonElement>('#run').disabled = !items.length;
  $<HTMLButtonElement>('#clear').disabled = !items.length;
  $<HTMLButtonElement>('#zip').disabled = !items.some((i) => i.out);
  if (!items.length) { $('#list').innerHTML = ''; return; }
  $('#list').innerHTML = `<thead><tr><th>${T('image', 'Ảnh')}</th><th>${T('orig', 'Gốc')}</th><th>${T('new', 'Mới')}</th><th></th></tr></thead><tbody>${items.map((it, i) => {
    const t = it.w && it.h ? target(it.w, it.h) : null;
    return `<tr><td><div class="img-cell"><img src="${it.thumb}" alt="" /><span>${escapeHtml(it.file.name)}</span></div></td>
      <td>${it.w ? `${fmtInt(it.w)}×${fmtInt(it.h as number)}` : '…'}<br><small class="note">${fmtSize(it.file.size)}</small></td>
      <td>${it.error ? `<span class="error-text">${escapeHtml(it.error)}</span>` : it.out ? `${fmtInt(it.out.w)}×${fmtInt(it.out.h)}<br><small class="note">${fmtSize(it.out.blob.size)}</small>` : t ? `<span class="note">${fmtInt(t.W)}×${fmtInt(t.H)}</span>` : ''}</td>
      <td>${it.out ? `<button type="button" class="btn btn-sm" data-dl="${i}">${T('download', 'Tải')}</button>` : ''} <button type="button" class="btn btn-sm" data-rm="${i}" aria-label="${T('remove', 'Bỏ ảnh')}">✕</button></td></tr>`;
  }).join('')}</tbody>`;
}

async function addFiles(list: File[]): Promise<void> {
  const errs: string[] = [];
  for (const f of list) {
    if (!f.type.startsWith('image/')) { errs.push(`${f.name}: ${T('notImage', 'không phải ảnh')}`); continue; }
    if (f.size > MAX_IMAGE_BYTES) { errs.push(`${f.name}: ${T('tooBig', 'lớn hơn 40 MB')}`); continue; }
    const it: Item = { file: f, thumb: URL.createObjectURL(f) };
    items.push(it);
    loadImage(f).then((img) => { it.w = img.width; it.h = img.height; img.close(); renderList(); }).catch((e) => { it.error = (e as Error).message; renderList(); });
  }
  const box = $('#err');
  box.textContent = errs.slice(0, 5).join(' · ');
  box.hidden = !errs.length;
  renderList();
}

async function run(): Promise<void> {
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  for (const it of items) {
    if (it.error && !it.w) continue;
    try {
      const img = await loadImage(it.file);
      const t = target(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = t.W;
      c.height = t.H;
      const ctx = c.getContext('2d') as CanvasRenderingContext2D;
      const mime = outMime(it.file);
      if (mime === 'image/jpeg' || (t.dx || t.dy)) { ctx.fillStyle = mime === 'image/jpeg' && !(t.dx || t.dy) ? '#ffffff' : s.bg; ctx.fillRect(0, 0, t.W, t.H); }
      ctx.imageSmoothingQuality = 'high';
      // Thu nhỏ nhiều lần khi giảm rất mạnh để ảnh không bị răng cưa
      let src: CanvasImageSource = img.source;
      let sx = t.sx, sy = t.sy, sw = t.sw, sh = t.sh;
      while (sw / t.dw > 2.2 && sh / t.dh > 2.2) {
        const h = document.createElement('canvas');
        h.width = Math.ceil(sw / 2);
        h.height = Math.ceil(sh / 2);
        const hc = h.getContext('2d') as CanvasRenderingContext2D;
        hc.imageSmoothingQuality = 'high';
        hc.drawImage(src, sx, sy, sw, sh, 0, 0, h.width, h.height);
        src = h; sx = 0; sy = 0; sw = h.width; sh = h.height;
      }
      ctx.drawImage(src, sx, sy, sw, sh, t.dx, t.dy, t.dw, t.dh);
      img.close();
      const blob = await canvasToBlob(c, mime, s.quality / 100);
      it.out = { blob, name: `${baseName(it.file.name)}-${t.W}x${t.H}.${EXT[mime]}`, w: t.W, h: t.H };
      it.error = undefined;
    } catch (e) {
      it.error = (e as Error).message;
    }
    renderList();
  }
  btn.disabled = false;
  if (items.filter((i) => i.out).length === 1) { const o = items.find((i) => i.out)!.out!; downloadBlob(o.blob, o.name); }
}

bindDropzone($('#drop'), $i('files'), (f) => void addFiles(f));
$('#tool-root').addEventListener('input', (e) => { if ((e.target as HTMLElement).id !== 'files') { read(); items.forEach((i) => (i.out = undefined)); renderList(); } });
$('#run').addEventListener('click', () => void run());
$('#clear').addEventListener('click', () => { items.forEach((i) => URL.revokeObjectURL(i.thumb)); items = []; renderList(); });
$('#zip').addEventListener('click', async () => {
  const outs = items.filter((i) => i.out).map((i) => ({ name: i.out!.name, data: i.out!.blob }));
  downloadBlob(await makeZip(outs), `${T('zipName', 'anh-doi-kich-thuoc')}.zip`);
});
$('#list').addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const dl = el.closest<HTMLButtonElement>('[data-dl]');
  if (dl) { const o = items[Number(dl.dataset.dl)].out!; downloadBlob(o.blob, o.name); }
  const rm = el.closest<HTMLButtonElement>('[data-rm]');
  if (rm) { const [it] = items.splice(Number(rm.dataset.rm), 1); URL.revokeObjectURL(it.thumb); renderList(); }
});
load();
read();
