import { mountLayout } from '../layout';
import { $, fmtDec, fmtInt, storage } from '../ui';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'cps-test' });
const T = pageText();

const DURS = [1, 5, 10, 15, 30, 60];
const st = storage<{ dur: number; mode: 'click' | 'space'; best: Record<string, number>; hist: { cps: number; dur: number; mode: string }[] }>('cps-test', { dur: 5, mode: 'click', best: {}, hist: [] });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <section class="panel">
      <div class="row" style="justify-content:space-between">
        <div class="segmented" role="radiogroup" aria-label="${T('duration', 'Thời gian')}">
          ${DURS.map((d) => `<label><input type="radio" name="dur" value="${d}" /><span>${d}s</span></label>`).join('')}
        </div>
        <div class="segmented" role="radiogroup" aria-label="${T('mode', 'Kiểu')}">
          <label><input type="radio" name="mode" value="click" /><span>${T('click', 'Chuột / chạm')}</span></label>
          <label><input type="radio" name="mode" value="space" /><span>${T('space', 'Phím cách')}</span></label>
        </div>
      </div>
      <button type="button" class="click-pad" id="pad"><span id="pad-main"></span><b id="pad-count"></b><span class="note" id="pad-sub"></span></button>
      <div class="stat-grid">
        <div class="stat"><span class="stat-label">${T('time', 'Thời gian còn lại')}</span><span class="stat-value" id="left">—</span></div>
        <div class="stat"><span class="stat-label">${T('clicks', 'Số lần bấm')}</span><span class="stat-value" id="clicks">0</span></div>
        <div class="stat stat--main"><span class="stat-label">CPS</span><span class="stat-value" id="cps">0</span></div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-title" style="margin:0">${T('best', 'Kỷ lục của bạn')}</div>
      <div class="stat-grid" id="best"></div>
      <div class="panel-title" style="margin:0">${T('recent', 'Lần gần đây')}</div>
      <ol class="plain-list" id="hist"></ol>
      <p class="note">${T('info', 'CPS (clicks per second) là số lần bấm mỗi giây. Người bình thường đạt khoảng 6–7 CPS, game thủ luyện kỹ thuật jitter/butterfly có thể đạt 10–14 CPS. Kỷ lục chỉ lưu trên máy bạn.')}</p>
    </section>
  </div>
`;

const pad = $<HTMLButtonElement>('#pad');
let state: 'idle' | 'run' | 'cool' = 'idle';
let count = 0;
let t0 = 0;
let raf = 0;
const dur = () => Number(document.querySelector<HTMLInputElement>('input[name=dur]:checked')?.value || 5);
const mode = () => (document.querySelector<HTMLInputElement>('input[name=mode]:checked')?.value || 'click') as 'click' | 'space';

function idleUi(): void {
  state = 'idle';
  count = 0;
  pad.classList.remove('is-running');
  $('#pad-main').textContent = mode() === 'space' ? T('startSpace', 'Bấm phím cách để bắt đầu') : T('startClick', 'Bấm vào đây để bắt đầu');
  $('#pad-count').textContent = '';
  $('#pad-sub').textContent = `${dur()} ${T('seconds', 'giây')}`;
  $('#left').textContent = `${dur()}s`;
  $('#clicks').textContent = '0';
  $('#cps').textContent = '0';
}

function hit(): void {
  if (state === 'cool') return;
  if (state === 'idle') {
    state = 'run';
    t0 = performance.now();
    pad.classList.add('is-running');
    $('#pad-main').textContent = T('go', 'Bấm liên tục!');
    $('#pad-sub').textContent = '';
    loop();
  }
  count++;
  $('#pad-count').textContent = String(count);
  $('#clicks').textContent = fmtInt(count);
}

function loop(): void {
  const el = (performance.now() - t0) / 1000;
  const left = Math.max(0, dur() - el);
  $('#left').textContent = `${left.toFixed(1)}s`;
  $('#cps').textContent = fmtDec(count / Math.max(el, 0.1));
  if (left <= 0) { end(); return; }
  raf = requestAnimationFrame(loop);
}

function end(): void {
  cancelAnimationFrame(raf);
  state = 'cool';
  const cps = count / dur();
  $('#cps').textContent = fmtDec(cps);
  const key = `${mode()}-${dur()}`;
  const isBest = cps > (s.best[key] ?? 0);
  if (isBest) s.best[key] = Math.round(cps * 100) / 100;
  s.hist.unshift({ cps: Math.round(cps * 100) / 100, dur: dur(), mode: mode() });
  s.hist = s.hist.slice(0, 12);
  st.set(s);
  pad.classList.remove('is-running');
  $('#pad-main').textContent = isBest ? T('newBest', '🏆 Kỷ lục mới!') : T('finished', 'Hết giờ!');
  $('#pad-count').textContent = `${fmtDec(cps)} CPS`;
  $('#pad-sub').textContent = `${fmtInt(count)} ${T('clicksIn', 'lần bấm trong')} ${dur()} ${T('seconds', 'giây')} · ${T('restartIn', 'bấm lại sau 1 giây để chơi tiếp')}`;
  renderSide();
  // Nghỉ một chút để cú bấm thừa không bắt đầu ván mới ngay
  setTimeout(() => { if (state === 'cool') state = 'idle'; count = 0; }, 1000);
}

function renderSide(): void {
  $('#best').innerHTML = DURS.map((d) => {
    const b = s.best[`${mode()}-${d}`];
    return `<div class="stat"><span class="stat-label">${d}s</span><span class="stat-value">${b ? fmtDec(b) : '—'}</span></div>`;
  }).join('');
  $('#hist').innerHTML = s.hist.length
    ? s.hist.map((h) => `<li>${fmtDec(h.cps)} CPS · ${h.dur}s · ${h.mode === 'space' ? T('space', 'Phím cách') : T('click', 'Chuột / chạm')}</li>`).join('')
    : `<li class="note" style="list-style:none">${T('noHist', 'Chưa có lần nào.')}</li>`;
}

pad.addEventListener('pointerdown', (e) => {
  if (mode() !== 'click') return;
  e.preventDefault();
  hit();
});
pad.addEventListener('click', (e) => e.preventDefault());
pad.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (mode() !== 'space' || e.code !== 'Space' || e.repeat) return;
  const tag = (document.activeElement as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' && (document.activeElement as HTMLInputElement).type !== 'radio') return;
  e.preventDefault();
  hit();
});
document.querySelectorAll<HTMLInputElement>('input[name=dur]').forEach((r) => {
  r.checked = Number(r.value) === s.dur;
  r.addEventListener('change', () => { s.dur = Number(r.value); st.set(s); cancelAnimationFrame(raf); idleUi(); });
});
document.querySelectorAll<HTMLInputElement>('input[name=mode]').forEach((r) => {
  r.checked = r.value === s.mode;
  r.addEventListener('change', () => { s.mode = r.value as 'click' | 'space'; st.set(s); cancelAnimationFrame(raf); idleUi(); renderSide(); r.blur(); });
});
idleUi();
renderSide();
