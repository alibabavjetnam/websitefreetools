import { mountLayout } from '../layout';
import { $, escapeHtml, fmtInt } from '../ui';
import { pageText } from '../i18n';
import { area, button, bindCopy, el, privacyNote, val, setVal, onChange, utf8 } from '../lib/devkit';
import { charInfo, cpHex, removeInvisible } from '../calc/encoding';

mountLayout({ activeTool: 'unicode-inspect' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    ${area('in', T('text', 'Dán văn bản cần kiểm tra'), { rows: 6, mono: false, value: T('sample', 'Xin chào\u200B thế giới 👋') })}
    <div class="stat-grid" id="stats"></div>
    <p class="note" id="warn"></p>
    <div class="row">${button('clean', T('clean', 'Xoá ký tự ẩn'), true)}${button('nfc', T('nfc', 'Chuẩn hoá dấu (NFC)'))}${button('copy', T('copy', 'Sao chép văn bản'))}</div>
    <div style="max-height:420px;overflow:auto"><table class="data-table data-table--compact"><thead><tr><th>${T('col.ch', 'Ký tự')}</th><th>${T('col.cp', 'Mã Unicode')}</th><th>UTF-8</th><th>UTF-16</th><th>${T('col.kind', 'Loại')}</th></tr></thead><tbody id="rows"></tbody></table></div>
  </div>
  ${privacyNote()}
`;
const KIND: Record<string, string> = {
  normal: '', space: T('k.space', 'khoảng trắng'), invisible: T('k.invisible', 'ký tự ẩn'), control: T('k.control', 'ký tự điều khiển'),
  mark: T('k.mark', 'dấu kết hợp'), astral: T('k.astral', 'emoji / ký tự ngoài BMP'),
};
function graphemes(s: string): number {
  const Seg = (Intl as unknown as { Segmenter?: new () => { segment(t: string): Iterable<unknown> } }).Segmenter;
  return Seg ? [...new Seg().segment(s)].length : [...s].length;
}
function run(): void {
  const s = val('in');
  const info = charInfo(s);
  const bytes = utf8(s).length;
  const inv = info.filter((c) => c.kind === 'invisible' || c.kind === 'control').length;
  const stat = (l: string, v: string) => `<div class="stat"><span class="stat-label">${l}</span><span class="stat-value">${v}</span></div>`;
  el('stats').innerHTML = stat(T('s.chars', 'Ký tự (code point)'), fmtInt(info.length)) + stat(T('s.utf16', 'Độ dài JavaScript (UTF-16)'), fmtInt(s.length)) +
    stat(T('s.bytes', 'Số byte UTF-8'), fmtInt(bytes)) + stat(T('s.graph', 'Ký tự hiển thị'), fmtInt(graphemes(s))) + stat(T('s.inv', 'Ký tự ẩn'), fmtInt(inv));
  const w = el('warn');
  w.className = inv ? 'note error-text' : 'note';
  w.textContent = inv ? T('warnInv', 'Phát hiện ký tự ẩn có thể làm sai so sánh chuỗi, tên đăng nhập hoặc mã nguồn.') : s !== s.normalize('NFC') ? T('warnNfc', 'Văn bản có chữ dấu dạng tách rời (NFD), nên chuẩn hoá về NFC.') : '';
  el('rows').innerHTML = info.slice(0, 2000).map((c) => `<tr><td style="font-size:1.1rem">${c.kind === 'normal' || c.kind === 'astral' ? escapeHtml(c.ch) : '·'}</td><td class="mono">${cpHex(c.cp)}</td><td>${c.utf8}</td><td>${c.utf16}</td><td>${KIND[c.kind] ?? ''}</td></tr>`).join('');
}
onChange(['in'], run, 100);
el('clean').addEventListener('click', () => { setVal('in', removeInvisible(val('in'))); run(); });
el('nfc').addEventListener('click', () => { setVal('in', val('in').normalize('NFC')); run(); });
bindCopy('copy', () => val('in'));
run();
