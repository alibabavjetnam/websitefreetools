import { mountLayout } from '../layout';
import { $, downloadBlob, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { input, select, button, el, privacyNote, val, showError, errorBox } from '../lib/devkit';
import { loadPdf, pdfLib, pdfBlob, type PdfDoc, type PdfPage } from '../lib/pdflib';
import { parseRanges, rangesToIndices } from '../lib/ranges';
import { baseName, fmtSize } from '../lib/files';

mountLayout({ activeTool: 'pdf-pages' });
const T = pageText();
type Doc = PdfDoc & { removePage(i: number): void; getPages(): PdfPage[] };

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <label class="field"><span class="field-label">${T('pick', 'Chọn file PDF')}</span><input type="file" id="file" accept="application/pdf,.pdf" /></label>
    <p class="note" id="info"></p>
  </div>
  <div class="tabs" role="tablist" style="margin-top:16px">
    <button type="button" role="tab" data-tab="rotate">${T('tab.rotate', 'Xoay trang')}</button>
    <button type="button" role="tab" data-tab="number">${T('tab.number', 'Đánh số trang')}</button>
    <button type="button" role="tab" data-tab="delete">${T('tab.delete', 'Xoá trang')}</button>
  </div>
  <div class="tool-body">
    <div class="panel" data-panel="rotate">
      <div class="form-grid">
        ${input('rpages', T('pages', 'Trang cần xử lý (để trống = tất cả)'), { ph: '1, 3-5, 8' })}
        ${select('angle', T('angle', 'Góc xoay'), [['90', T('a.90', '90° theo chiều kim đồng hồ')], ['180', '180°'], ['270', T('a.270', '90° ngược chiều kim đồng hồ')]], '90')}
      </div>
      <div class="row">${button('rot', T('doRotate', 'Xoay và tải về'), true)}</div>
    </div>
    <div class="panel" data-panel="number" hidden>
      <div class="form-grid">
        ${select('pos', T('pos', 'Vị trí'), [['bc', T('p.bc', 'Giữa, cuối trang')], ['br', T('p.br', 'Góc phải, cuối trang')], ['bl', T('p.bl', 'Góc trái, cuối trang')], ['tc', T('p.tc', 'Giữa, đầu trang')], ['tr', T('p.tr', 'Góc phải, đầu trang')]], 'bc')}
        ${select('fmt', T('fmt', 'Kiểu số'), [['n', '1, 2, 3'], ['nt', '1 / 10'], ['page', T('f.page', 'Trang 1 / 10')], ['dash', '- 1 -']], 'n')}
        ${input('start', T('startNo', 'Bắt đầu từ số'), { type: 'number', value: '1', attrs: 'min="0"' })}
        ${input('skip', T('skip', 'Bỏ qua số trang đầu (trang bìa)'), { type: 'number', value: '0', attrs: 'min="0"' })}
        ${input('size', T('size', 'Cỡ chữ (pt)'), { type: 'number', value: '11', attrs: 'min="6" max="36"' })}
        ${input('color', T('color', 'Màu chữ'), { type: 'color', value: '#333333' })}
      </div>
      <div class="row">${button('num', T('doNumber', 'Đánh số và tải về'), true)}</div>
    </div>
    <div class="panel" data-panel="delete" hidden>
      ${input('dpages', T('delPages', 'Trang cần xoá'), { ph: '2, 5-7' })}
      <div class="row">${button('del', T('doDelete', 'Xoá và tải về'), true)}</div>
    </div>
  </div>
  ${errorBox('err')}
  ${privacyNote()}
`;
setupTabs($('#tool-root'));
let file: File | null = null;
let bytes: ArrayBuffer | null = null;
el('file').addEventListener('change', async () => {
  showError('err', '');
  file = el<HTMLInputElement>('file').files?.[0] ?? null;
  if (!file) return;
  bytes = await file.arrayBuffer();
  try { const d = await loadPdf(bytes.slice(0), file.name); el('info').textContent = `${file.name} · ${fmtSize(file.size)} · ${T('nPages', '{n} trang').replace('{n}', String(d.getPageCount()))}`; }
  catch (e) { showError('err', (e as Error).message); file = null; }
});
async function open(): Promise<Doc | null> {
  showError('err', '');
  if (!file || !bytes) { showError('err', T('noFile', 'Hãy chọn file PDF trước.')); return null; }
  try { return (await loadPdf(bytes.slice(0), file.name)) as Doc; } catch (e) { showError('err', (e as Error).message); return null; }
}
function indices(s: string, total: number): number[] | null {
  if (!s.trim()) return Array.from({ length: total }, (_, i) => i);
  try { return rangesToIndices(parseRanges(s, total)); } catch { showError('err', T('badRange', 'Danh sách trang chưa đúng. Ví dụ: 1, 3-5, 8 (trang phải nằm trong khoảng 1 đến {n}).').replace('{n}', String(total))); return null; }
}
const save = async (d: Doc, suffix: string) => downloadBlob(pdfBlob(await d.save()), `${baseName(file!.name)}-${suffix}.pdf`);
el('rot').addEventListener('click', async () => {
  const d = await open(); if (!d) return;
  const idx = indices(val('rpages'), d.getPageCount()); if (!idx) return;
  const lib = await pdfLib();
  const pages = d.getPages();
  for (const i of idx) pages[i].setRotation(lib.degrees((pages[i].getRotation().angle + Number(val('angle'))) % 360));
  await save(d, 'rotated');
});
el('del').addEventListener('click', async () => {
  const d = await open(); if (!d) return;
  if (!val('dpages').trim()) return showError('err', T('needDel', 'Nhập số trang cần xoá.'));
  const idx = indices(val('dpages'), d.getPageCount()); if (!idx) return;
  if (idx.length >= d.getPageCount()) return showError('err', T('allDel', 'Không thể xoá hết mọi trang. Hãy giữ lại ít nhất một trang.'));
  for (const i of [...new Set(idx)].sort((a, b) => b - a)) d.removePage(i);
  await save(d, 'edited');
});
async function label(text: string, pt: number, color: string): Promise<{ png: Uint8Array; w: number; h: number }> {
  const scale = 4;
  const c = document.createElement('canvas');
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const font = `${pt * scale}px "Be Vietnam Pro", system-ui, sans-serif`;
  g.font = font;
  c.width = Math.ceil(g.measureText(text).width) + 8; c.height = Math.ceil(pt * scale * 1.4);
  g.font = font; g.fillStyle = color; g.textBaseline = 'middle';
  g.fillText(text, 4, c.height / 2);
  const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b as Blob), 'image/png'));
  return { png: new Uint8Array(await blob.arrayBuffer()), w: c.width / scale, h: c.height / scale };
}
el('num').addEventListener('click', async () => {
  const d = await open(); if (!d) return;
  const lib0 = await pdfLib();
  const pages = d.getPages();
  const skip = Math.max(0, Number(val('skip')) || 0), start = Number(val('start')) || 1, pt = Number(val('size')) || 11;
  const total = pages.length - skip + start - 1;
  for (let i = skip; i < pages.length; i++) {
    const n = i - skip + start;
    const f = val('fmt');
    const text = f === 'nt' ? `${n} / ${total}` : f === 'page' ? T('pageOf', 'Trang {n} / {t}').replace('{n}', String(n)).replace('{t}', String(total)) : f === 'dash' ? `- ${n} -` : String(n);
    const { png, w, h } = await label(text, pt, val('color'));
    const img = await d.embedPng(png);
    const p = pages[i];
    const { width, height } = p.getSize();
    const rot = p.getRotation().angle % 360;
    // Trang bị xoay: tính theo khổ hiển thị rồi đổi về toạ độ gốc
    const [W, H] = rot === 90 || rot === 270 ? [height, width] : [width, height];
    const m = 28;
    const pos = val('pos');
    const x = pos.endsWith('c') ? (W - w) / 2 : pos.endsWith('r') ? W - w - m : m;
    const y = pos.startsWith('b') ? m - h / 2 + 4 : H - m - h / 2;
    const place = rot === 90 ? { x: width - y, y: x, w, h } : rot === 180 ? { x: width - x, y: height - y, w, h } : rot === 270 ? { x: y, y: height - x, w, h } : { x, y, w, h };
    (p as PdfPage & { drawImage(i: unknown, o: Record<string, unknown>): void }).drawImage(img, { x: place.x, y: place.y, width: w, height: h, rotate: lib0.degrees(rot) });
  }
  await save(d, 'numbered');
});
