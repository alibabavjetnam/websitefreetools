import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, storage } from '../ui';
import { pageText } from '../i18n';
import { LOGO_ICONS } from '../lib/logoicons';
import { loadGoogleFonts } from '../lib/sketch';
import { safeFilename } from '../lib/download';

mountLayout({ activeTool: 'logo-maker' });
const T = pageText();

const FONTS: [string, number][] = [
  ['Montserrat', 700], ['Poppins', 600], ['Be Vietnam Pro', 700], ['Playfair Display', 700], ['Lobster', 400], ['Oswald', 600],
  ['Raleway', 700], ['Merriweather', 700], ['Pacifico', 400], ['Roboto Slab', 700], ['Dancing Script', 700], ['Nunito', 800],
  ['Josefin Sans', 700], ['Comfortaa', 700], ['Lexend', 700], ['Quicksand', 700],
];
type Layout = 'left' | 'top' | 'badge' | 'text';
type Shape = 'none' | 'circle' | 'square';
interface S {
  name: string; slogan: string; icon: string; layout: Layout; shape: Shape; font: string; upper: boolean; spacing: number;
  cIcon: string; cShape: string; cName: string; cSlogan: string; bg: string; transparent: boolean;
}
const PALETTES: Pick<S, 'cIcon' | 'cShape' | 'cName' | 'cSlogan' | 'bg'>[] = [
  { cIcon: '#ffffff', cShape: '#0d6efd', cName: '#16233a', cSlogan: '#5b6779', bg: '#ffffff' },
  { cIcon: '#ffffff', cShape: '#b9000e', cName: '#1f1f1f', cSlogan: '#6b6b6b', bg: '#ffffff' },
  { cIcon: '#16a34a', cShape: '#e6f6ef', cName: '#14532d', cSlogan: '#4d7c0f', bg: '#ffffff' },
  { cIcon: '#f59e0b', cShape: '#1c1917', cName: '#ffffff', cSlogan: '#d6d3d1', bg: '#1c1917' },
  { cIcon: '#ffffff', cShape: '#7c3aed', cName: '#4c1d95', cSlogan: '#7c3aed', bg: '#faf5ff' },
  { cIcon: '#0e7490', cShape: '#cffafe', cName: '#0f172a', cSlogan: '#0e7490', bg: '#ffffff' },
];

const st = storage<S>('logo-maker', {
  name: '', slogan: '', icon: 'leaf', layout: 'left', shape: 'circle', font: 'Montserrat', upper: false, spacing: 0,
  ...PALETTES[0], transparent: true,
});
const s = st.get();
if (!s.name) { s.name = T('sampleName', 'Lá Xanh'); s.slogan = T('sampleSlogan', 'Cà phê & trà'); }

$('#tool-root').innerHTML = `
  <div class="workspace">
    <section class="panel">
      <div class="logo-stage" id="stage"></div>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-dl="png">${T('dlPng', 'Tải PNG')}</button>
        <button type="button" class="btn" data-dl="png2">${T('dlPngBig', 'Tải PNG cỡ lớn (×4)')}</button>
        <button type="button" class="btn" data-dl="svg">${T('dlSvg', 'Tải SVG')}</button>
      </div>
      <div class="field-label">${T('variants', 'Gợi ý phối màu')}</div>
      <div class="logo-variants" id="variants"></div>
      <p class="note">${T('svgNote', 'File SVG dùng phông Google Fonts qua mạng; khi chèn vào phần mềm thiết kế nên cài cùng phông, hoặc dùng PNG cỡ lớn. Logo tạo ra là của bạn, nhưng hãy kiểm tra không trùng nhãn hiệu đã đăng ký trước khi dùng cho kinh doanh.')}</p>
    </section>
    <section class="panel">
      <div class="field-row">
        <label class="field"><span class="field-label">${T('name', 'Tên thương hiệu')}</span><input type="text" id="name" class="input-inline" maxlength="40" /></label>
        <label class="field"><span class="field-label">${T('slogan', 'Khẩu hiệu (không bắt buộc)')}</span><input type="text" id="slogan" class="input-inline" maxlength="60" /></label>
      </div>
      <div class="field-label">${T('icon', 'Biểu tượng')}</div>
      <div class="icon-pick" id="icons"></div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('layout', 'Bố cục')}</span>
          <select id="layout"><option value="left">${T('lLeft', 'Biểu tượng bên trái')}</option><option value="top">${T('lTop', 'Biểu tượng phía trên')}</option><option value="badge">${T('lBadge', 'Huy hiệu tròn')}</option><option value="text">${T('lText', 'Chỉ chữ')}</option></select>
        </label>
        <label class="field"><span class="field-label">${T('shape', 'Nền biểu tượng')}</span>
          <select id="shape"><option value="none">${T('sNone', 'Không nền')}</option><option value="circle">${T('sCircle', 'Hình tròn')}</option><option value="square">${T('sSquare', 'Vuông bo góc')}</option></select>
        </label>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('font', 'Phông chữ')}</span><select id="font">${FONTS.map(([f]) => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">${T('spacing', 'Giãn chữ')}</span><input type="range" id="spacing" min="-2" max="20" step="1" /></label>
      </div>
      <label class="check"><input type="checkbox" id="upper" /><span>${T('upper', 'Viết hoa toàn bộ tên')}</span></label>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('cIcon', 'Màu biểu tượng')}</span><input type="color" id="cIcon" /></label>
        <label class="field"><span class="field-label">${T('cShape', 'Màu nền biểu tượng')}</span><input type="color" id="cShape" /></label>
        <label class="field"><span class="field-label">${T('cName', 'Màu tên')}</span><input type="color" id="cName" /></label>
        <label class="field"><span class="field-label">${T('cSlogan', 'Màu khẩu hiệu')}</span><input type="color" id="cSlogan" /></label>
        <label class="field"><span class="field-label">${T('bg', 'Màu nền')}</span><input type="color" id="bg" /></label>
      </div>
      <label class="check"><input type="checkbox" id="transparent" /><span>${T('transparent', 'Nền trong suốt khi tải về')}</span></label>
    </section>
  </div>
`;

// ---------- Mô hình bố cục → SVG / canvas
type El =
  | { k: 'circle'; cx: number; cy: number; r: number; fill: string }
  | { k: 'rect'; x: number; y: number; w: number; h: number; r: number; fill: string }
  | { k: 'ring'; cx: number; cy: number; r: number; stroke: string; sw: number }
  | { k: 'icon'; x: number; y: number; size: number; color: string; d: string; fill: boolean }
  | { k: 'mono'; x: number; y: number; size: number; color: string; text: string; font: string; weight: number }
  | { k: 'text'; x: number; y: number; size: number; color: string; text: string; font: string; weight: number; anchor: 'start' | 'middle'; spacing: number };

const measureCtx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
function textW(text: string, font: string, weight: number, size: number, spacing: number): number {
  measureCtx.font = `${weight} ${size}px "${font}"`;
  return measureCtx.measureText(text).width + Math.max(0, [...text].length - 1) * spacing;
}

function model(st: S): { w: number; h: number; els: El[] } {
  const weight = (FONTS.find(([f]) => f === st.font) ?? FONTS[0])[1];
  const name = st.upper ? st.name.toLocaleUpperCase() : st.name;
  const icon = LOGO_ICONS.find((i) => i.id === st.icon);
  const els: El[] = [];
  const P = 24;
  const nameSize = 64;
  const sloSize = 22;
  const nameW = textW(name, st.font, weight, nameSize, st.spacing);
  const sloW = st.slogan ? textW(st.slogan, 'Be Vietnam Pro', 500, sloSize, 1) : 0;
  const iconBox = st.shape === 'none' ? 96 : 110;
  const addIcon = (x: number, y: number, box: number) => {
    if (st.shape === 'circle') els.push({ k: 'circle', cx: x + box / 2, cy: y + box / 2, r: box / 2, fill: st.cShape });
    if (st.shape === 'square') els.push({ k: 'rect', x, y, w: box, h: box, r: box * 0.22, fill: st.cShape });
    const inner = st.shape === 'none' ? box : box * 0.58;
    if (icon) els.push({ k: 'icon', x: x + (box - inner) / 2, y: y + (box - inner) / 2, size: inner, color: st.cIcon, d: icon.d, fill: !!icon.fill });
    else els.push({ k: 'mono', x: x + box / 2, y: y + box / 2, size: box * 0.5, color: st.cIcon, text: [...(name.trim() || 'W')][0].toLocaleUpperCase(), font: st.font, weight });
  };
  const hasIcon = st.layout !== 'text';
  if (st.layout === 'left') {
    const textH = nameSize + (st.slogan ? sloSize + 8 : 0);
    const h = Math.max(iconBox, textH) + P * 2;
    addIcon(P, (h - iconBox) / 2, iconBox);
    const tx = P + iconBox + 22;
    const top = (h - textH) / 2;
    els.push({ k: 'text', x: tx, y: top + nameSize * 0.8, size: nameSize, color: st.cName, text: name, font: st.font, weight, anchor: 'start', spacing: st.spacing });
    if (st.slogan) els.push({ k: 'text', x: tx + 2, y: top + nameSize + 8 + sloSize * 0.8, size: sloSize, color: st.cSlogan, text: st.slogan, font: 'Be Vietnam Pro', weight: 500, anchor: 'start', spacing: 1 });
    return { w: Math.ceil(tx + Math.max(nameW, sloW) + P), h: Math.ceil(h), els };
  }
  if (st.layout === 'top' || !hasIcon) {
    const w = Math.max(nameW, sloW, hasIcon ? iconBox : 0) + P * 2;
    let y = P;
    if (hasIcon) { addIcon((w - iconBox) / 2, y, iconBox); y += iconBox + 16; }
    els.push({ k: 'text', x: w / 2, y: y + nameSize * 0.8, size: nameSize, color: st.cName, text: name, font: st.font, weight, anchor: 'middle', spacing: st.spacing });
    y += nameSize;
    if (st.slogan) { els.push({ k: 'text', x: w / 2, y: y + 8 + sloSize * 0.8, size: sloSize, color: st.cSlogan, text: st.slogan, font: 'Be Vietnam Pro', weight: 500, anchor: 'middle', spacing: 1 }); y += sloSize + 8; }
    return { w: Math.ceil(w), h: Math.ceil(y + P), els };
  }
  // Huy hiệu tròn: vòng tròn lớn, biểu tượng ở trên, tên ở giữa, khẩu hiệu ở dưới
  const inner = Math.max(nameW * 0.92, sloW, 200);
  const R = inner / 2 + 46;
  const D = R * 2 + P * 2;
  const c = D / 2;
  els.push({ k: 'circle', cx: c, cy: c, r: R, fill: st.cShape });
  els.push({ k: 'ring', cx: c, cy: c, r: R - 10, stroke: st.cIcon, sw: 3 });
  const ib = R * 0.5;
  if (icon) els.push({ k: 'icon', x: c - ib / 2, y: c - R * 0.72, size: ib, color: st.cIcon, d: icon.d, fill: !!icon.fill });
  const ns = Math.min(nameSize, ((R * 1.6) / Math.max(nameW, 1)) * nameSize);
  els.push({ k: 'text', x: c, y: c + ns * 0.45, size: ns, color: st.cIcon, text: name, font: st.font, weight, anchor: 'middle', spacing: st.spacing });
  if (st.slogan) els.push({ k: 'text', x: c, y: c + R * 0.5, size: sloSize, color: st.cIcon, text: st.slogan, font: 'Be Vietnam Pro', weight: 500, anchor: 'middle', spacing: 1 });
  return { w: Math.ceil(D), h: Math.ceil(D), els };
}

function toSvg(st: S, withBg: boolean): string {
  const m = model(st);
  const parts = m.els.map((e) => {
    switch (e.k) {
      case 'circle': return `<circle cx="${e.cx}" cy="${e.cy}" r="${e.r}" fill="${e.fill}"/>`;
      case 'rect': return `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${e.r}" fill="${e.fill}"/>`;
      case 'ring': return `<circle cx="${e.cx}" cy="${e.cy}" r="${e.r}" fill="none" stroke="${e.stroke}" stroke-width="${e.sw}"/>`;
      case 'icon': {
        const k = e.size / 24;
        return `<path transform="translate(${e.x} ${e.y}) scale(${k})" d="${e.d}" ${e.fill ? `fill="${e.color}"` : `fill="none" stroke="${e.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`}/>`;
      }
      case 'mono': return `<text x="${e.x}" y="${e.y}" font-family="'${e.font}'" font-weight="${e.weight}" font-size="${e.size}" fill="${e.color}" text-anchor="middle" dominant-baseline="central">${escapeHtml(e.text)}</text>`;
      case 'text': return `<text x="${e.x}" y="${e.y}" font-family="'${e.font}'" font-weight="${e.weight}" font-size="${e.size}" fill="${e.color}" text-anchor="${e.anchor}"${e.spacing ? ` letter-spacing="${e.spacing}"` : ''}>${escapeHtml(e.text)}</text>`;
    }
  });
  const fams = [...new Set([st.font, 'Be Vietnam Pro'])].map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`).join('&');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.w} ${m.h}" width="${m.w}" height="${m.h}"><style>@import url('https://fonts.googleapis.com/css2?${fams}&amp;display=swap');</style>${withBg ? `<rect width="100%" height="100%" fill="${st.bg}"/>` : ''}${parts.join('')}</svg>`;
}

function toCanvas(st: S, scale: number, withBg: boolean): HTMLCanvasElement {
  const m = model(st);
  const c = document.createElement('canvas');
  c.width = Math.ceil(m.w * scale);
  c.height = Math.ceil(m.h * scale);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(scale, scale);
  if (withBg) { ctx.fillStyle = st.bg; ctx.fillRect(0, 0, m.w, m.h); }
  for (const e of m.els) {
    ctx.save();
    if (e.k === 'circle') { ctx.fillStyle = e.fill; ctx.beginPath(); ctx.arc(e.cx, e.cy, e.r, 0, Math.PI * 2); ctx.fill(); }
    if (e.k === 'rect') { ctx.fillStyle = e.fill; ctx.beginPath(); ctx.roundRect(e.x, e.y, e.w, e.h, e.r); ctx.fill(); }
    if (e.k === 'ring') { ctx.strokeStyle = e.stroke; ctx.lineWidth = e.sw; ctx.beginPath(); ctx.arc(e.cx, e.cy, e.r, 0, Math.PI * 2); ctx.stroke(); }
    if (e.k === 'icon') {
      ctx.translate(e.x, e.y);
      ctx.scale(e.size / 24, e.size / 24);
      const p = new Path2D(e.d);
      if (e.fill) { ctx.fillStyle = e.color; ctx.fill(p); }
      else { ctx.strokeStyle = e.color; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(p); }
    }
    if (e.k === 'mono' || e.k === 'text') {
      ctx.fillStyle = e.color;
      ctx.font = `${e.weight} ${e.size}px "${e.font}"`;
      if (e.k === 'mono') { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.text, e.x, e.y); }
      else {
        ctx.textBaseline = 'alphabetic';
        (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${e.spacing}px`;
        ctx.textAlign = e.anchor === 'middle' ? 'center' : 'left';
        // letterSpacing thêm khoảng sau ký tự cuối: dịch nửa khoảng khi căn giữa
        ctx.fillText(e.text, e.x + (e.anchor === 'middle' ? e.spacing / 2 : 0), e.y);
      }
    }
    ctx.restore();
  }
  return c;
}

// ---------- Giao diện
const $i = (id: string) => $<HTMLInputElement>('#' + id);
const fields = ['name', 'slogan', 'layout', 'shape', 'font', 'spacing', 'upper', 'cIcon', 'cShape', 'cName', 'cSlogan', 'bg', 'transparent'] as const;
function load(): void {
  for (const f of fields) {
    const el = $i(f);
    if (el.type === 'checkbox') el.checked = s[f] as boolean;
    else el.value = String(s[f]);
  }
}
function read(): void {
  for (const f of fields) {
    const el = $i(f);
    const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
    (s as unknown as Record<string, unknown>)[f] = v;
  }
}
function render(): void {
  st.set(s);
  const stage = $('#stage');
  stage.style.background = s.transparent ? '' : s.bg;
  stage.classList.toggle('checker', s.transparent);
  stage.innerHTML = toSvg(s, !s.transparent);
  $('#variants').innerHTML = PALETTES.map((p, i) => `<button type="button" data-pal="${i}" style="background:${p.bg}" aria-label="${T('palette', 'Phối màu')} ${i + 1}">${toSvg({ ...s, ...p }, false)}</button>`).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-icon]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.icon === s.icon)));
}
$('#icons').innerHTML = [`<button type="button" data-icon="" title="${T('monogram', 'Chữ cái đầu')}"><b>Aa</b></button>`, ...LOGO_ICONS.map((ic) => `<button type="button" data-icon="${ic.id}" title="${ic.id}"><svg viewBox="0 0 24 24" width="24" height="24"><path d="${ic.d}" ${ic.fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}/></svg></button>`)].join('');
$('#icons').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-icon]');
  if (!b) return;
  s.icon = b.dataset.icon as string;
  render();
});
$('#variants').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-pal]');
  if (!b) return;
  Object.assign(s, PALETTES[Number(b.dataset.pal)]);
  load();
  render();
});
fields.forEach((f) => $i(f).addEventListener('input', () => { read(); render(); }));
document.querySelectorAll<HTMLButtonElement>('[data-dl]').forEach((b) => b.addEventListener('click', async () => {
  const name = safeFilename(s.name, 'logo');
  if (b.dataset.dl === 'svg') { downloadBlob(new Blob([toSvg(s, !s.transparent)], { type: 'image/svg+xml' }), `${name}.svg`); return; }
  await document.fonts.ready;
  const c = toCanvas(s, b.dataset.dl === 'png2' ? 4 : 1.5, !s.transparent);
  c.toBlob((blob) => blob && downloadBlob(blob, `${name}${b.dataset.dl === 'png2' ? '-large' : ''}.png`), 'image/png');
}));
load();
render();
// Tải các phông rồi vẽ lại để đo chữ chính xác
void loadGoogleFonts(FONTS.map(([f, w]) => `${f}:wght@${w === 400 ? 400 : `400;${w}`}`).concat('Be Vietnam Pro:wght@500;700')).then(render);
