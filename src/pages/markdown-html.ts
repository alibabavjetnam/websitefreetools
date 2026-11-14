import { mountLayout } from '../layout';
import { $, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { area, button, check, bindCopy, bindDownload, dk, el, privacyNote, val, setVal, checked, onChange, showError, errorBox } from '../lib/devkit';
import { CDN, loadScript, global } from '../lib/cdn';

mountLayout({ activeTool: 'markdown-html' });
const T = pageText();
interface Marked { parse(s: string, o?: Record<string, unknown>): string }
interface Purify { sanitize(s: string): string }
type Turndown = new (o?: Record<string, unknown>) => { turndown(html: string): string };
const SAMPLE = T('sample', `# Tiêu đề lớn

Đoạn văn có **chữ đậm**, *chữ nghiêng* và [liên kết](https://websitefreetools.com).

## Danh sách
- Mục một
- Mục hai
  - Mục con

1. Bước một
2. Bước hai

> Trích dẫn ngắn.

| Công cụ | Miễn phí |
|---|---|
| QR | Có |

\`\`\`js
console.log('Xin chào');
\`\`\`
`);

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="md">${T('tab.md', 'Markdown → HTML')}</button>
    <button type="button" role="tab" data-tab="html">${T('tab.html', 'HTML → Markdown')}</button>
  </div>
  <div class="tool-body">
    <div class="panel" data-panel="md">
      <div class="workspace" style="margin-top:0">
        ${area('md', 'Markdown', { rows: 20, value: SAMPLE })}
        <div class="field"><span class="field-label">${T('preview', 'Xem trước')}</span><div id="preview" class="md-preview"></div></div>
      </div>
      ${check('gfm', T('gfm', 'Kiểu GitHub (bảng, gạch ngang, xuống dòng)'), true)}
      ${area('htmlOut', T('htmlCode', 'Mã HTML'), { rows: 8, ro: true })}
      ${errorBox('err')}
      <div class="row">${button('copyHtml', T('copyHtml', 'Sao chép HTML'), true)}${button('dlHtml', T('dlHtml', 'Tải file .html'))}</div>
    </div>
    <div class="panel" data-panel="html" hidden>
      <div class="workspace" style="margin-top:0">
        ${area('htmlIn', 'HTML', { rows: 16, value: '<h2>Ví dụ</h2>\n<p>Chữ <strong>đậm</strong> và <a href="https://websitefreetools.com">liên kết</a>.</p>\n<ul><li>Một</li><li>Hai</li></ul>' })}
        ${area('mdOut', 'Markdown', { rows: 16, ro: true })}
      </div>
      ${errorBox('err2')}
      <div class="row">${button('toMd', T('toMd', 'Chuyển sang Markdown'), true)}${button('copyMd', dk.copy())}${button('dlMd', T('dlMd', 'Tải file .md'))}</div>
    </div>
  </div>
  <p class="note" style="margin-top:12px">${T('note', 'Mã HTML trong phần xem trước được lọc bỏ script và thuộc tính nguy hiểm để an toàn.')}</p>
  ${privacyNote()}
`;
setupTabs($('#tool-root'));
async function libs(): Promise<[Marked, Purify]> {
  await Promise.all([loadScript(CDN.marked, 'marked'), loadScript(CDN.dompurify, 'DOMPurify')]);
  return [global<Marked>('marked'), global<Purify>('DOMPurify')];
}
async function render(): Promise<void> {
  showError('err', '');
  try {
    const [m, p] = await libs();
    const html = m.parse(val('md'), { gfm: checked('gfm'), breaks: checked('gfm') });
    setVal('htmlOut', html);
    el('preview').innerHTML = p.sanitize(html);
  } catch (e) { showError('err', (e as Error).message); }
}
async function toMd(): Promise<void> {
  showError('err2', '');
  try {
    await loadScript(CDN.turndown, 'TurndownService');
    const Td = global<Turndown>('TurndownService');
    setVal('mdOut', new Td({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' }).turndown(val('htmlIn')));
  } catch (e) { showError('err2', (e as Error).message); }
}
onChange(['md', 'gfm'], () => void render(), 200);
onChange(['htmlIn'], () => void toMd(), 300);
el('toMd').addEventListener('click', () => void toMd());
bindCopy('copyHtml', () => val('htmlOut'));
bindDownload('dlHtml', () => `<!doctype html>\n<html><head><meta charset="utf-8"><title>Document</title></head><body>\n${val('htmlOut')}\n</body></html>`, () => 'document.html', 'text/html');
bindCopy('copyMd', () => val('mdOut'));
bindDownload('dlMd', () => val('mdOut'), () => 'document.md', 'text/markdown');
void render();
void toMd();
