import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText } from '../i18n';
import { area, input, check, button, bindCopy, bindDownload, dk, el, privacyNote, val, setVal, checked, onChange, showError, errorBox, fmtBytes, toB64, utf8 } from '../lib/devkit';
import { optimizeSvg } from '../lib/svgmin';

mountLayout({ activeTool: 'svg-optimize' });
const T = pageText();
const SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->
<svg xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" width="120.000000" height="120.000000" viewBox="0 0 120.000000 120.000000" version="1.1" inkscape:version="1.3">
  <metadata id="metadata1"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></metadata>
  <sodipodi:namedview id="base" pagecolor="#ffffff"/>
  <g id="layer1" inkscape:label="Layer 1">
    <g>
      <circle cx="60.0000000" cy="60.0000000" r="50.123456" style="fill:#0d6efd;stroke:none;-inkscape-stroke:none"/>
      <path d="M 40.000000,62.500000 L 55.333333,77.666667 L 82.000000,45.000000" style="fill:none;stroke:#ffffff;stroke-width:9.000000;stroke-linecap:round"/>
    </g>
  </g>
</svg>`;

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <label class="field"><span class="field-label">${T('pick', 'Chọn file SVG hoặc dán mã bên dưới')}</span><input type="file" id="file" accept=".svg,image/svg+xml" /></label>
    <div class="row">
      ${input('prec', T('prec', 'Số chữ số thập phân'), { type: 'number', value: '2', attrs: 'min="0" max="6" style="width:90px"' })}
      ${check('com', T('o.com', 'Bỏ chú thích'), true)}${check('meta', T('o.meta', 'Bỏ metadata'), true)}${check('ed', T('o.ed', 'Bỏ dữ liệu của Inkscape, Illustrator, Figma'), true)}${check('grp', T('o.grp', 'Gộp nhóm rỗng'), true)}${check('dims', T('o.dims', 'Bỏ width/height (co giãn theo khung)'))}
    </div>
    <div class="workspace" style="margin-top:0">
      ${area('in', T('src', 'SVG gốc'), { rows: 14, value: SAMPLE })}
      ${area('out', T('opt', 'SVG đã tối ưu'), { rows: 14, ro: true })}
    </div>
    ${errorBox('err')}
    <p id="stat"></p>
    <div class="row">${button('copy', dk.copy(), true)}${button('dl', T('dl', 'Tải file .svg'))}${button('uri', T('uri', 'Sao chép dạng data URI'))}</div>
    <div class="workspace" style="margin-top:0">
      <div class="field"><span class="field-label">${T('before', 'Trước')}</span><div class="svg-prev" id="pa"></div></div>
      <div class="field"><span class="field-label">${T('after', 'Sau')}</span><div class="svg-prev" id="pb"></div></div>
    </div>
  </div>
  ${privacyNote()}
`;
const img = (svg: string) => `<img alt="" src="data:image/svg+xml;base64,${toB64(utf8(svg))}" />`;
function run(): void {
  showError('err', '');
  const src = val('in');
  if (!src.trim()) { setVal('out', ''); return; }
  try {
    const out = optimizeSvg(src, { precision: Math.min(6, Math.max(0, Number(val('prec')) || 0)), removeComments: checked('com'), removeMeta: checked('meta'), removeEditor: checked('ed'), collapseGroups: checked('grp'), removeDims: checked('dims') });
    setVal('out', out);
    const a = utf8(src).length, b = utf8(out).length;
    el('stat').innerHTML = `<b>${fmtBytes(a)} → ${fmtBytes(b)}</b> (${T('saved', 'giảm {p}%').replace('{p}', String(Math.max(0, Math.round((1 - b / a) * 100))))})`;
    el('pa').innerHTML = img(src);
    el('pb').innerHTML = img(out);
  } catch { setVal('out', ''); showError('err', T('bad', 'Không đọc được SVG. Kiểm tra mã có bắt đầu bằng thẻ <svg> và các thẻ đã đóng đúng.')); }
}
el('file').addEventListener('change', async () => {
  const f = el<HTMLInputElement>('file').files?.[0];
  if (f) { setVal('in', await f.text()); run(); }
});
onChange(['in', 'prec', 'com', 'meta', 'ed', 'grp', 'dims'], run, 150);
bindCopy('copy', () => val('out'));
bindDownload('dl', () => val('out'), () => 'optimized.svg', 'image/svg+xml');
bindCopy('uri', () => (val('out') ? `data:image/svg+xml,${encodeURIComponent(val('out')).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/')}` : ''));
run();
