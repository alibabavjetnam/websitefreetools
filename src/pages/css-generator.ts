import { mountLayout } from '../layout';
import { $, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { input, select, check, button, bindCopy, el, privacyNote, val, checked, onChange } from '../lib/devkit';

mountLayout({ activeTool: 'css-generator' });
const T = pageText();
const range = (id: string, label: string, v: number, min: number, max: number, unit = 'px') =>
  `<label class="field"><span class="field-label">${label}: <output id="${id}-o">${v}${unit}</output></span><input type="range" id="${id}" min="${min}" max="${max}" value="${v}" data-unit="${unit}" /></label>`;

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="shadow">${T('tab.shadow', 'Đổ bóng (box-shadow)')}</button>
    <button type="button" role="tab" data-tab="grad">${T('tab.grad', 'Màu chuyển (gradient)')}</button>
    <button type="button" role="tab" data-tab="radius">${T('tab.radius', 'Bo góc (border-radius)')}</button>
    <button type="button" role="tab" data-tab="glass">${T('tab.glass', 'Kính mờ (glassmorphism)')}</button>
  </div>
  <div class="workspace" style="margin-top:0">
    <div class="panel">
      <div data-panel="shadow">
        ${range('sx', T('sx', 'Lệch ngang'), 0, -50, 50)}${range('sy', T('sy', 'Lệch dọc'), 10, -50, 50)}${range('sb', T('sb', 'Độ nhoè'), 30, 0, 100)}${range('ss', T('ss', 'Độ lan'), -5, -50, 50)}
        ${range('so', T('so', 'Độ đậm'), 25, 0, 100, '%')}
        <div class="form-grid">${input('sc', T('color', 'Màu'), { type: 'color', value: '#16233a' })}${check('si', T('inset', 'Bóng vào trong (inset)'))}</div>
      </div>
      <div data-panel="grad" hidden>
        ${select('gt', T('gtype', 'Kiểu'), [['linear', T('g.linear', 'Thẳng (linear)')], ['radial', T('g.radial', 'Toả tròn (radial)')], ['conic', T('g.conic', 'Xoay vòng (conic)')]], 'linear')}
        ${range('ga', T('angle', 'Góc'), 135, 0, 360, 'deg')}
        <div class="form-grid">${input('g1', T('c1', 'Màu 1'), { type: 'color', value: '#0d6efd' })}${input('g2', T('c2', 'Màu 2'), { type: 'color', value: '#b9000e' })}${input('g3', T('c3', 'Màu 3 (không bắt buộc)'), { type: 'color', value: '#ffc107' })}${check('g3on', T('use3', 'Dùng màu 3'))}</div>
      </div>
      <div data-panel="radius" hidden>
        ${check('rlink', T('link', 'Bốn góc bằng nhau'), true)}
        ${range('r1', T('r.tl', 'Trên trái'), 24, 0, 150)}${range('r2', T('r.tr', 'Trên phải'), 24, 0, 150)}${range('r3', T('r.br', 'Dưới phải'), 24, 0, 150)}${range('r4', T('r.bl', 'Dưới trái'), 24, 0, 150)}
      </div>
      <div data-panel="glass" hidden>
        ${range('gb', T('blur', 'Độ mờ nền'), 12, 0, 40)}${range('gop', T('opacity', 'Độ trong'), 25, 0, 100, '%')}${range('gbo', T('border', 'Viền sáng'), 30, 0, 100, '%')}
        ${input('gcol', T('color', 'Màu'), { type: 'color', value: '#ffffff' })}
      </div>
    </div>
    <div class="panel">
      <div class="cg-stage" id="stage"><div class="cg-box" id="box">WFTools</div></div>
      <pre class="output" id="css"></pre>
      <div class="row">${button('copy', T('copy', 'Sao chép CSS'), true)}</div>
    </div>
  </div>
  ${privacyNote()}
`;
let tab = 'shadow';
const n = (id: string) => Number(val(id));
const rgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${+a.toFixed(2)})`;
function run(): void {
  document.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((r) => { const o = document.getElementById(r.id + '-o'); if (o) o.textContent = r.value + (r.dataset.unit ?? ''); });
  const box = el('box'), stage = el('stage');
  box.removeAttribute('style'); stage.removeAttribute('style');
  let css = '';
  if (tab === 'shadow') {
    css = `box-shadow: ${checked('si') ? 'inset ' : ''}${n('sx')}px ${n('sy')}px ${n('sb')}px ${n('ss')}px ${rgba(val('sc'), n('so') / 100)};`;
  } else if (tab === 'grad') {
    const cols = [val('g1'), val('g2'), ...(checked('g3on') ? [val('g3')] : [])].join(', ');
    const g = val('gt') === 'linear' ? `linear-gradient(${n('ga')}deg, ${cols})` : val('gt') === 'radial' ? `radial-gradient(circle, ${cols})` : `conic-gradient(from ${n('ga')}deg, ${cols}${checked('g3on') ? '' : ', ' + val('g1')})`;
    css = `background: ${g};`;
  } else if (tab === 'radius') {
    if (checked('rlink')) for (const id of ['r2', 'r3', 'r4']) (el<HTMLInputElement>(id)).value = val('r1');
    const v = [n('r1'), n('r2'), n('r3'), n('r4')];
    css = `border-radius: ${v.every((x) => x === v[0]) ? v[0] + 'px' : v.map((x) => x + 'px').join(' ')};`;
  } else {
    stage.style.background = 'linear-gradient(135deg, #0d6efd, #b9000e)';
    css = `background: ${rgba(val('gcol'), n('gop') / 100)};\nbackdrop-filter: blur(${n('gb')}px);\n-webkit-backdrop-filter: blur(${n('gb')}px);\nborder: 1px solid ${rgba(val('gcol'), n('gbo') / 100)};\nborder-radius: 16px;`;
  }
  box.setAttribute('style', css.replace(/\n/g, ' '));
  if (tab === 'radius' || tab === 'grad') box.style.color = tab === 'grad' ? '#fff' : '';
  el('css').textContent = css;
}
el('tool-root').addEventListener('input', run);
onChange(['gt', 'si', 'g3on', 'rlink'], run, 10);
bindCopy('copy', () => el('css').textContent || '');
setupTabs($('#tool-root'), (t) => { tab = t; run(); });
run();
