import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { button, el, privacyNote, showError, errorBox } from '../lib/devkit';
import { readExif, stripMeta, type ExifInfo } from '../lib/exif';
import { makeZip } from '../lib/zipstore';
import { fmtSize } from '../lib/files';

mountLayout({ activeTool: 'exif-remove' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <label class="field"><span class="field-label">${T('pick', 'Chọn một hoặc nhiều ảnh (JPG, PNG, WebP, HEIC…)')}</span><input type="file" id="files" accept="image/*" multiple /></label>
    ${errorBox('err')}
    <div class="row">${button('clean', T('clean', 'Xoá thông tin và tải về'), true)}</div>
    <p class="note">${T('how', 'Ảnh JPG và PNG được bóc phần thông tin ẩn mà không nén lại nên giữ nguyên chất lượng. Định dạng khác được vẽ lại thành JPG chất lượng cao.')}</p>
  </div>
  <div id="list"></div>
  ${privacyNote()}
`;
const LABEL: Record<string, string> = {
  Make: T('t.make', 'Hãng máy'), Model: T('t.model', 'Đời máy'), Software: T('t.soft', 'Phần mềm'), DateTime: T('t.date', 'Ngày sửa'), DateTimeOriginal: T('t.orig', 'Ngày chụp'),
  Artist: T('t.artist', 'Tác giả'), Copyright: T('t.copy', 'Bản quyền'), ExposureTime: T('t.exp', 'Tốc độ chụp'), FNumber: T('t.f', 'Khẩu độ'), ISO: 'ISO', FocalLength: T('t.focal', 'Tiêu cự'),
  LensModel: T('t.lens', 'Ống kính'), PixelXDimension: T('t.w', 'Chiều rộng'), PixelYDimension: T('t.h', 'Chiều cao'), Orientation: T('t.orient', 'Hướng ảnh'), BodySerialNumber: T('t.serial', 'Số seri máy'), ImageDescription: T('t.desc', 'Mô tả'),
};
let files: { f: File; b: Uint8Array; info: ExifInfo }[] = [];
el('files').addEventListener('change', async () => {
  showError('err', '');
  files = [];
  for (const f of el<HTMLInputElement>('files').files ?? []) {
    const b = new Uint8Array(await f.arrayBuffer());
    files.push({ f, b, info: readExif(b) });
  }
  el('list').innerHTML = files.map(({ f, info }) => {
    const rows = Object.entries(info.tags).map(([k, v]) => `<tr><th>${LABEL[k] ?? k}</th><td>${escapeHtml(v)}</td></tr>`).join('');
    const gps = info.gps ? `<tr><th class="error-text">${T('gps', 'Vị trí GPS')}</th><td class="error-text"><b>${info.gps.lat.toFixed(6)}, ${info.gps.lon.toFixed(6)}</b> — <a href="https://www.openstreetmap.org/?mlat=${info.gps.lat}&mlon=${info.gps.lon}#map=16/${info.gps.lat}/${info.gps.lon}" target="_blank" rel="noopener">${T('map', 'xem bản đồ')}</a></td></tr>` : '';
    const status = info.gps ? `<b class="error-text">${T('hasGps', 'Ảnh có toạ độ GPS: người nhận biết được nơi chụp!')}</b>` : info.hasMeta || rows ? `<b>${T('hasMeta', 'Ảnh có thông tin ẩn.')}</b>` : `<span class="ok-text">${T('clean0', 'Không thấy thông tin ẩn.')}</span>`;
    return `<div class="panel" style="margin-top:12px"><b>${escapeHtml(f.name)}</b> <span class="note">${fmtSize(f.size)}</span><p style="margin:4px 0">${status}</p>${rows || gps ? `<table class="data-table data-table--compact"><tbody>${gps}${rows}</tbody></table>` : ''}</div>`;
  }).join('');
});
async function reencode(f: File): Promise<Uint8Array> {
  const bmp = await createImageBitmap(f);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  (c.getContext('2d') as CanvasRenderingContext2D).drawImage(bmp, 0, 0);
  const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b as Blob), 'image/jpeg', 0.95));
  return new Uint8Array(await blob.arrayBuffer());
}
el('clean').addEventListener('click', async () => {
  showError('err', '');
  if (!files.length) return showError('err', T('noFile', 'Hãy chọn ảnh trước.'));
  const out: { name: string; data: Uint8Array }[] = [];
  for (const { f, b } of files) {
    try {
      const s = stripMeta(b);
      const data = s ?? (await reencode(f));
      const name = s ? f.name.replace(/(\.[^.]+)$/, '-clean$1') : f.name.replace(/\.[^.]+$/, '') + '-clean.jpg';
      out.push({ name, data });
    } catch { showError('err', T('fail', 'Không xử lý được "{n}". Trình duyệt có thể không đọc được định dạng này.').replace('{n}', f.name)); }
  }
  if (out.length === 1) downloadBlob(new Blob([out[0].data] as BlobPart[]), out[0].name);
  else if (out.length) downloadBlob(makeZip(out), 'images-clean.zip');
});
