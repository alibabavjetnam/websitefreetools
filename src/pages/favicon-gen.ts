import { mountLayout } from '../layout';
import { $, downloadBlob, setupTabs, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { area, input, button, bindCopy, dk, el, privacyNote, val, setVal, showError, errorBox, onChange } from '../lib/devkit';
import { loadImage, canvasToBlob, icoBytes, type LoadedImage } from '../lib/image';
import { makeZip } from '../lib/zipstore';

mountLayout({ activeTool: 'favicon-gen' });
const T = pageText();
const SIZES = [16, 32, 48, 180, 192, 512];

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="img">${T('tab.img', 'Từ ảnh / logo')}</button>
    <button type="button" role="tab" data-tab="text">${T('tab.text', 'Từ chữ hoặc emoji')}</button>
  </div>
  <div class="workspace" style="margin-top:0">
    <div class="panel">
      <div data-panel="img"><label class="field"><span class="field-label">${T('pick', 'Chọn ảnh vuông (PNG, SVG, JPG; nên từ 512×512)')}</span><input type="file" id="file" accept="image/*" /></label></div>
      <div data-panel="text" hidden>
        <div class="form-grid">
          ${input('txt', T('txt', 'Chữ (1-2 ký tự) hoặc emoji'), { value: 'W' })}
          ${input('fg', T('fg', 'Màu chữ'), { type: 'color', value: '#ffffff' })}
          ${input('bg', T('bg', 'Màu nền'), { type: 'color', value: '#0d6efd' })}
          ${input('radius', T('radius', 'Bo góc (%)'), { type: 'number', value: '22', attrs: 'min="0" max="50"' })}
        </div>
      </div>
      <div class="form-grid">
        ${input('appName', T('appName', 'Tên ứng dụng (manifest)'), { value: 'WFTools' })}
        ${input('theme', T('theme', 'Màu chủ đề'), { type: 'color', value: '#0d6efd' })}
      </div>
      ${errorBox('err')}
      <div class="row">${button('zip', T('zip', 'Tải trọn bộ (.zip)'), true)}${button('ico', T('ico', 'Chỉ tải favicon.ico'))}</div>
    </div>
    <div class="panel">
      <span class="field-label">${T('preview', 'Xem trước')}</span>
      <div class="row fv-prev" id="prev"></div>
      ${area('code', escapeHtml(T('code', 'Mã HTML dán vào <head>')), { rows: 9, ro: true })}
      <div class="row">${button('copy', dk.copy())}</div>
    </div>
  </div>
  ${privacyNote()}
`;
let img: LoadedImage | null = null;
const mode = () => ($<HTMLElement>('[data-panel="text"]').hidden ? 'img' : 'text');
function draw(s: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  if (mode() === 'img' && img) {
    const k = Math.min(s / img.width, s / img.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img.source, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k);
  } else {
    const r = (Math.min(50, Math.max(0, Number(val('radius')) || 0)) / 100) * s;
    g.fillStyle = val('bg');
    g.beginPath();
    g.roundRect(0, 0, s, s, r);
    g.fill();
    const t = [...(val('txt') || 'W')].slice(0, 2).join('');
    g.fillStyle = val('fg');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${s * ([...t].length > 1 ? 0.5 : 0.66)}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    g.fillText(t, s / 2, s / 2 + s * 0.04);
  }
  return c;
}
const png = async (s: number) => new Uint8Array(await (await canvasToBlob(draw(s), 'image/png')).arrayBuffer());
function snippet(): string {
  return `<link rel="icon" href="/favicon.ico" sizes="48x48" />\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />\n<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />\n<link rel="manifest" href="/site.webmanifest" />\n<meta name="theme-color" content="${val('theme')}" />`;
}
function manifest(): string {
  return JSON.stringify({ name: val('appName'), short_name: val('appName'), icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }, { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }], theme_color: val('theme'), background_color: '#ffffff', display: 'standalone' }, null, 2);
}
async function render(): Promise<void> {
  el('prev').innerHTML = '';
  for (const s of [16, 32, 48, 180]) {
    const c = draw(s);
    c.title = `${s}×${s}`;
    c.style.width = c.style.height = `${Math.min(s, 96)}px`;
    el('prev').appendChild(c);
  }
  setVal('code', snippet());
}
el('file').addEventListener('change', async () => {
  showError('err', '');
  const f = el<HTMLInputElement>('file').files?.[0];
  if (!f) return;
  try { img?.close(); img = await loadImage(f); void render(); }
  catch (e) { showError('err', (e as Error).message); }
});
const need = () => { if (mode() === 'img' && !img) { showError('err', T('noImg', 'Hãy chọn ảnh trước, hoặc chuyển sang tab "Từ chữ hoặc emoji".')); return true; } showError('err', ''); return false; };
async function ico(): Promise<Uint8Array> { return new Uint8Array(icoBytes([16, 32, 48], [await png(16), await png(32), await png(48)])); }
el('ico').addEventListener('click', async () => { if (!need()) downloadBlob(new Blob([await ico()] as BlobPart[], { type: 'image/x-icon' }), 'favicon.ico'); });
el('zip').addEventListener('click', async () => {
  if (need()) return;
  const enc = new TextEncoder();
  const files = [
    { name: 'favicon.ico', data: await ico() }, { name: 'favicon-16x16.png', data: await png(16) }, { name: 'favicon-32x32.png', data: await png(32) },
    { name: 'apple-touch-icon.png', data: await png(180) }, { name: 'android-chrome-192x192.png', data: await png(192) }, { name: 'android-chrome-512x512.png', data: await png(512) },
    { name: 'site.webmanifest', data: enc.encode(manifest()) }, { name: 'head.html', data: enc.encode(snippet() + '\n') },
  ];
  downloadBlob(makeZip(files), 'favicon.zip');
});
onChange(['txt', 'fg', 'bg', 'radius', 'theme'], () => void render(), 80);
bindCopy('copy', () => val('code'));
void SIZES;
setupTabs($('#tool-root'), () => void render());
void render();
