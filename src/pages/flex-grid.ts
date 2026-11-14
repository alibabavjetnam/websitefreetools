import { mountLayout } from '../layout';
import { $, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { input, select, button, bindCopy, el, privacyNote, val } from '../lib/devkit';

mountLayout({ activeTool: 'flex-grid' });
const T = pageText();
const opt = (xs: string[]) => xs.map((x) => [x, x] as [string, string]);

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="flex">Flexbox</button>
    <button type="button" role="tab" data-tab="grid">CSS Grid</button>
  </div>
  <div class="workspace" style="margin-top:0">
    <div class="panel">
      <div data-panel="flex">
        <div class="form-grid">
          ${select('fd', 'flex-direction', opt(['row', 'row-reverse', 'column', 'column-reverse']), 'row')}
          ${select('fw', 'flex-wrap', opt(['nowrap', 'wrap', 'wrap-reverse']), 'wrap')}
          ${select('jc', 'justify-content', opt(['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']), 'center')}
          ${select('ai', 'align-items', opt(['stretch', 'flex-start', 'center', 'flex-end', 'baseline']), 'center')}
          ${select('ac', 'align-content', opt(['normal', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'stretch']), 'normal')}
          ${input('fgap', 'gap (px)', { type: 'number', value: '12', attrs: 'min="0" max="80"' })}
          ${input('fn', T('items', 'Số phần tử'), { type: 'number', value: '5', attrs: 'min="1" max="24"' })}
        </div>
      </div>
      <div data-panel="grid" hidden>
        <div class="form-grid">
          ${input('cols', T('cols', 'Số cột'), { type: 'number', value: '3', attrs: 'min="1" max="12"' })}
          ${input('rows', T('rows', 'Số hàng'), { type: 'number', value: '2', attrs: 'min="1" max="12"' })}
          ${select('colw', T('colw', 'Độ rộng cột'), [['1fr', T('w.equal', 'Bằng nhau (1fr)')], ['auto', 'auto'], ['minmax(120px, 1fr)', 'minmax(120px, 1fr)'], ['fill', T('w.fill', 'Tự xuống hàng (auto-fill)')]], '1fr')}
          ${input('ggap', 'gap (px)', { type: 'number', value: '12', attrs: 'min="0" max="80"' })}
          ${select('ji', 'justify-items', opt(['stretch', 'start', 'center', 'end']), 'stretch')}
          ${select('gai', 'align-items', opt(['stretch', 'start', 'center', 'end']), 'stretch')}
          ${input('gn', T('items', 'Số phần tử'), { type: 'number', value: '6', attrs: 'min="1" max="48"' })}
        </div>
      </div>
      <p class="note">${T('note', 'Đổi các tuỳ chọn và xem ngay cách phần tử sắp xếp. Bấm vào một ô để cho nó to hơn (flex-grow hoặc chiếm 2 cột).')}</p>
    </div>
    <div class="panel">
      <div id="stage" class="fg-stage"></div>
      <pre class="output" id="css"></pre>
      <div class="row">${button('copy', T('copy', 'Sao chép CSS'), true)}</div>
    </div>
  </div>
  ${privacyNote()}
`;
let tab = 'flex';
const big = new Set<number>();
setupTabs($('#tool-root'), (t) => { tab = t; big.clear(); run(); });
function run(): void {
  const st = el('stage');
  let css: string, item = '';
  if (tab === 'flex') {
    const p = { display: 'flex', 'flex-direction': val('fd'), 'flex-wrap': val('fw'), 'justify-content': val('jc'), 'align-items': val('ai'), 'align-content': val('ac'), gap: `${Number(val('fgap')) || 0}px` };
    css = `.container {\n${Object.entries(p).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;
    if (big.size) { css += `\n\n.item.grow {\n  flex-grow: 1;\n}`; item = 'flex-grow:1'; }
    st.setAttribute('style', Object.entries(p).map(([k, v]) => `${k}:${v}`).join(';'));
    const n = Math.min(24, Math.max(1, Number(val('fn')) || 1));
    st.innerHTML = Array.from({ length: n }, (_, i) => `<div class="fg-item${big.has(i) ? ' is-big' : ''}" data-i="${i}" style="${big.has(i) ? item : ''};${i % 3 === 1 ? 'padding:22px 14px' : ''}">${i + 1}</div>`).join('');
  } else {
    const c = Math.min(12, Math.max(1, Number(val('cols')) || 1)), r = Math.min(12, Math.max(1, Number(val('rows')) || 1));
    const cw = val('colw');
    const tc = cw === 'fill' ? 'repeat(auto-fill, minmax(120px, 1fr))' : `repeat(${c}, ${cw})`;
    const p = { display: 'grid', 'grid-template-columns': tc, 'grid-template-rows': `repeat(${r}, auto)`, gap: `${Number(val('ggap')) || 0}px`, 'justify-items': val('ji'), 'align-items': val('gai') };
    css = `.container {\n${Object.entries(p).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;
    if (big.size) css += `\n\n.item.wide {\n  grid-column: span 2;\n}`;
    st.setAttribute('style', Object.entries(p).map(([k, v]) => `${k}:${v}`).join(';'));
    const n = Math.min(48, Math.max(1, Number(val('gn')) || 1));
    st.innerHTML = Array.from({ length: n }, (_, i) => `<div class="fg-item${big.has(i) ? ' is-big' : ''}" data-i="${i}" style="${big.has(i) ? 'grid-column:span 2' : ''}">${i + 1}</div>`).join('');
  }
  el('css').textContent = css;
}
el('stage').addEventListener('click', (e) => {
  const i = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')?.dataset.i;
  if (i == null) return;
  const k = Number(i);
  if (big.has(k)) big.delete(k); else big.add(k);
  run();
});
el('tool-root').addEventListener('input', run);
el('tool-root').addEventListener('change', run);
bindCopy('copy', () => el('css').textContent || '');
run();
