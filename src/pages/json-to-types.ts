import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText } from '../i18n';
import { area, input, select, button, bindCopy, bindDownload, dk, privacyNote, val, setVal, onChange, showError, errorBox } from '../lib/devkit';
import { jsonToTypes, type TypeTarget } from '../calc/devconv';

mountLayout({ activeTool: 'json-to-types' });
const T = pageText();
const SAMPLE = `{
  "id": 1024,
  "name": "WFTools",
  "active": true,
  "tags": ["qr", "pdf"],
  "owner": { "email": "hello@websitefreetools.com", "score": 4.8 },
  "orders": [
    { "sku": "A-01", "qty": 2 },
    { "sku": "B-07", "qty": 1, "note": null }
  ]
}`;
const EXT: Record<TypeTarget, string> = { ts: 'ts', zod: 'ts', go: 'go', python: 'py', csharp: 'cs', jsonschema: 'json' };

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <div class="form-grid">
      ${select('target', T('target', 'Ngôn ngữ đích'), [['ts', 'TypeScript interface'], ['zod', 'Zod schema'], ['go', 'Go struct'], ['python', 'Python dataclass'], ['csharp', 'C# class'], ['jsonschema', 'JSON Schema']], 'ts')}
      ${input('root', T('root', 'Tên kiểu gốc'), { value: 'Root', mono: true })}
    </div>
    <div class="workspace" style="margin-top:0">
      ${area('in', 'JSON', { rows: 20, value: SAMPLE })}
      ${area('out', dk.output(), { rows: 20, ro: true })}
    </div>
    ${errorBox('err')}
    <div class="row">${button('copy', dk.copy(), true)}${button('dl', dk.download())}</div>
    <p class="note">${T('note', 'Trường chỉ có ở một số phần tử của mảng được đánh dấu là không bắt buộc; giá trị null làm trường đó có thể rỗng. Số nguyên và số thực được phân biệt khi ngôn ngữ đích có hai kiểu.')}</p>
  </div>
  ${privacyNote()}
`;
function run(): void {
  showError('err', '');
  try { setVal('out', jsonToTypes(val('in'), val('root') || 'Root', val('target') as TypeTarget)); }
  catch (e) { setVal('out', ''); showError('err', T('bad', 'JSON chưa hợp lệ: ') + (e as Error).message); }
}
onChange(['in', 'target', 'root'], run, 150);
bindCopy('copy', () => val('out'));
bindDownload('dl', () => val('out'), () => `${val('root') || 'types'}.${EXT[val('target') as TypeTarget]}`);
run();
