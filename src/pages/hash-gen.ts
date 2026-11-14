import { mountLayout } from '../layout';
import { $, copyText, escapeHtml, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { area, check, type Bytes, dk, el, privacyNote, val, checked, onChange, utf8, toHex, toB64, fmtBytes, input } from '../lib/devkit';
import { md5, crc32 } from '../calc/encoding';

mountLayout({ activeTool: 'hash-gen' });
const T = pageText();
const ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512', 'CRC32'] as const;
type Algo = (typeof ALGOS)[number];

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="text">${T('tab.text', 'Băm văn bản')}</button>
    <button type="button" role="tab" data-tab="file">${T('tab.file', 'Băm file')}</button>
  </div>
  <div class="tool-body">
    <div class="panel" data-panel="text">
      ${area('in', T('text', 'Văn bản cần băm'), { rows: 6, mono: false, value: 'WFTools' })}
    </div>
    <div class="panel" data-panel="file" hidden>
      <label class="field"><span class="field-label">${dk.chooseFile()}</span><input type="file" id="file" /></label>
      <p class="note" id="file-stat">${T('fileNote', 'Dùng để kiểm tra file tải về có đúng mã băm mà nhà phát hành công bố hay không.')}</p>
    </div>
  </div>
  <div class="panel" style="margin-top:16px">
    <div class="row">${check('upper', T('upper', 'Chữ in hoa'))}${check('b64', T('base64', 'Hiện dạng Base64'))}</div>
    <table class="data-table"><tbody id="res"></tbody></table>
    ${input('cmp', T('compare', 'Dán mã băm cần so sánh (không bắt buộc)'), { mono: true })}
    <p class="note" id="cmp-res"></p>
  </div>
  ${privacyNote()}
`;
let bytes: Bytes = utf8('WFTools');
let mode: 'text' | 'file' = 'text';
let result: Record<Algo, Uint8Array | string> = {} as Record<Algo, string>;

async function digest(a: Algo, b: Bytes): Promise<Uint8Array | string> {
  if (a === 'MD5') return md5(b);
  if (a === 'CRC32') return crc32(b);
  return new Uint8Array(await crypto.subtle.digest(a, b));
}
function show(v: Uint8Array | string): string {
  if (checked('b64')) {
    const raw = typeof v === 'string' ? new Uint8Array(v.match(/../g)!.map((h) => parseInt(h, 16))) : v;
    return toB64(raw);
  }
  const h = typeof v === 'string' ? v : toHex(v);
  return checked('upper') ? h.toUpperCase() : h;
}
async function run(): Promise<void> {
  const active = $<HTMLElement>('[data-panel="file"]').hidden ? 'text' : 'file';
  if (active === 'text') { bytes = utf8(val('in')); mode = 'text'; }
  else if (mode !== 'file') return;
  for (const a of ALGOS) result[a] = await digest(a, bytes);
  el('res').innerHTML = ALGOS.map((a) => `<tr><th style="width:90px">${a}</th><td class="mono" style="word-break:break-all">${escapeHtml(show(result[a]))}</td><td style="width:1%"><button type="button" class="btn btn-sm" data-copy="${a}">${dk.copy()}</button></td></tr>`).join('');
  compare();
}
function compare(): void {
  const c = val('cmp').trim().toLowerCase();
  const out = el('cmp-res');
  if (!c) { out.textContent = ''; return; }
  const hit = ALGOS.find((a) => show(result[a]).toLowerCase() === c || (typeof result[a] !== 'string' && toHex(result[a] as Uint8Array) === c) || result[a] === c);
  out.className = hit ? 'note ok-text' : 'note error-text';
  out.textContent = hit ? T('match', 'Khớp với {a}. File/văn bản đúng như công bố.').replace('{a}', hit) : T('noMatch', 'Không khớp với thuật toán nào. Dữ liệu đã bị thay đổi hoặc bạn đang so sai thuật toán.');
}
el('res').addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]')?.dataset.copy as Algo | undefined;
  if (a) void copyText(show(result[a]));
});
el('file').addEventListener('change', async () => {
  const f = el<HTMLInputElement>('file').files?.[0];
  if (!f) return;
  el('file-stat').textContent = `${f.name} · ${fmtBytes(f.size)}`;
  bytes = new Uint8Array(await f.arrayBuffer()) as Bytes;
  mode = 'file';
  void run();
});
onChange(['in', 'upper', 'b64'], () => void run(), 80);
onChange(['cmp'], compare, 50);
setupTabs($('#tool-root'), () => void run());
void run();
