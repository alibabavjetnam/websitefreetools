import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText } from '../i18n';
import { area, select, button, bindCopy, bindDownload, dk, el, privacyNote, val, setVal, onChange, showError, errorBox } from '../lib/devkit';
import { CDN, loadScript, loadModule, global } from '../lib/cdn';

mountLayout({ activeTool: 'yaml-json-toml' });
const T = pageText();
type Fmt = 'yaml' | 'json' | 'toml';
interface JsYaml { load(s: string): unknown; dump(v: unknown, o?: Record<string, unknown>): string }
interface Toml { parse(s: string): unknown; stringify(v: unknown): string }
const SAMPLE = `# Cấu hình mẫu
app:
  name: WFTools
  port: 8080
  debug: false
database:
  host: localhost
  users: [admin, editor]
features:
  - name: qr
    enabled: true
  - name: pdf
    enabled: false
`;

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <div class="form-grid">
      ${select('from', T('from', 'Từ định dạng'), [['yaml', 'YAML'], ['json', 'JSON'], ['toml', 'TOML']], 'yaml')}
      ${select('to', T('to', 'Sang định dạng'), [['json', 'JSON'], ['yaml', 'YAML'], ['toml', 'TOML']], 'json')}
    </div>
    <div class="workspace" style="margin-top:0">
      ${area('in', dk.input(), { rows: 18, value: SAMPLE })}
      ${area('out', dk.output(), { rows: 18, ro: true })}
    </div>
    ${errorBox('err')}
    <div class="row">${button('run', T('convert', 'Chuyển đổi'), true)}${button('swap', dk.swap())}${button('copy', dk.copy())}${button('dl', dk.download())}</div>
    <p class="note">${T('note', 'TOML chỉ chứa được bảng (đối tượng) ở cấp ngoài cùng và không có giá trị null; dữ liệu không phù hợp sẽ báo lỗi kèm lý do. Chú thích (#) không được giữ lại khi đổi định dạng.')}</p>
  </div>
  ${privacyNote()}
`;
async function yaml(): Promise<JsYaml> { await loadScript(CDN.jsyaml, 'jsyaml'); return global<JsYaml>('jsyaml'); }
let toml: Toml | null = null;
async function getToml(): Promise<Toml> { return (toml ??= await loadModule<Toml>(CDN.smolToml)); }
async function parse(s: string, f: Fmt): Promise<unknown> {
  if (f === 'json') return JSON.parse(s);
  if (f === 'yaml') return (await yaml()).load(s);
  return (await getToml()).parse(s);
}
async function dump(v: unknown, f: Fmt): Promise<string> {
  if (f === 'json') return JSON.stringify(v, null, 2);
  if (f === 'yaml') return (await yaml()).dump(v, { lineWidth: 120, noRefs: true });
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(T('tomlRoot', 'TOML cần dữ liệu gốc là một đối tượng (bảng), không phải mảng hay giá trị đơn.'));
  return (await getToml()).stringify(JSON.parse(JSON.stringify(v, (_k, x) => (x === null ? undefined : x))));
}
async function run(): Promise<void> {
  showError('err', '');
  const from = val('from') as Fmt, to = val('to') as Fmt;
  if (!val('in').trim()) { setVal('out', ''); return; }
  try { setVal('out', await dump(await parse(val('in'), from), to)); }
  catch (e) { setVal('out', ''); showError('err', T('bad', 'Không chuyển được: ') + (e as Error).message); }
}
el('run').addEventListener('click', () => void run());
el('swap').addEventListener('click', () => {
  const f = val('from'), t2 = val('to');
  setVal('from', t2); setVal('to', f); setVal('in', val('out')); void run();
});
onChange(['in', 'from', 'to'], () => void run(), 300);
bindCopy('copy', () => val('out'));
bindDownload('dl', () => val('out'), () => `data.${val('to') === 'yaml' ? 'yml' : val('to')}`);
void run();
