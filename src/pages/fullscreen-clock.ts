import { mountLayout } from '../layout';
import { $, storage } from '../ui';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'fullscreen-clock' });
const T = pageText();
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN' } as Record<string, string>)[currentLang()] || 'en-US';

type Mode = 'clock' | 'stopwatch' | 'countdown';
interface Cfg { color: string; bg: string; font: string; h24: boolean; showSeconds: boolean; showDate: boolean }
const cfg = storage<Cfg>('fsclock', { color: '#eaf2ff', bg: '#0b1324', font: 'mono', h24: true, showDate: true, showSeconds: true });

const FONTS: Record<string, string> = {
  mono: "'SF Mono', ui-monospace, Consolas, monospace",
  sans: "'Be Vietnam Pro', system-ui, sans-serif",
  seg: "'DSEG7', 'Courier New', monospace",
  round: "'Segoe UI', 'Trebuchet MS', sans-serif",
};

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel code-toolbar no-print fs-toolbar">
    <div class="tabs" role="tablist" style="margin:0">
      <button type="button" role="tab" data-mode="clock" aria-selected="true">${T('tab.clock','Đồng hồ')}</button>
      <button type="button" role="tab" data-mode="stopwatch">${T('tab.stopwatch','Bấm giờ')}</button>
      <button type="button" role="tab" data-mode="countdown">${T('tab.countdown','Đếm ngược')}</button>
    </div>
    <div class="actions">
      <button type="button" class="btn" id="fs">${T('fullscreen','Toàn màn hình')}</button>
    </div>
  </div>

  <div class="clock-stage" id="stage">
    <div class="clock-display" id="display">00:00:00</div>
    <div class="clock-sub" id="sub"></div>
    <div class="clock-controls no-print" id="controls"></div>
  </div>

  <div class="panel fs-settings no-print">
    <div class="panel-title">${T('settings','Tuỳ chỉnh hiển thị')}</div>
    <div class="field-row">
      <label class="field"><span class="field-label">${T('color','Màu số')}</span><input type="color" id="c-color" /></label>
      <label class="field"><span class="field-label">${T('bg','Màu nền')}</span><input type="color" id="c-bg" /></label>
      <label class="field"><span class="field-label">${T('font','Phông chữ')}</span><select id="c-font"><option value="mono">${T('font.mono','Đồng hồ số (mono)')}</option><option value="sans">${T('font.sans','Hiện đại')}</option><option value="round">${T('font.round','Bo tròn')}</option></select></label>
    </div>
    <div class="row" style="margin-top:8px">
      <label class="check"><input type="checkbox" id="c-24" /><span>${T('h24','24 giờ')}</span></label>
      <label class="check"><input type="checkbox" id="c-sec" /><span>${T('showSec','Hiện giây')}</span></label>
      <label class="check"><input type="checkbox" id="c-date" /><span>${T('showDate','Hiện ngày tháng')}</span></label>
    </div>
  </div>
  <p class="note">${T('note','Chế độ toàn màn hình phù hợp để trình chiếu hoặc hẹn giờ trên lớp. Khi bật, màn hình được giữ sáng (nếu trình duyệt hỗ trợ). Bấm Esc để thoát.')}</p>
`;

let mode: Mode = 'clock';
// vòng lặp vẽ bằng requestAnimationFrame
let wakeLock: { release(): Promise<void> } | null = null;

const stage = $('#stage');
const display = $('#display');
const sub = $('#sub');
const two = (n: number) => String(n).padStart(2, '0');

function applyStyle(): void {
  const c = cfg.get();
  stage.style.background = c.bg;
  display.style.color = c.color;
  sub.style.color = c.color;
  display.style.fontFamily = FONTS[c.font];
}

function fmtClock(): { main: string; sub: string } {
  const c = cfg.get();
  const d = new Date();
  let h = d.getHours();
  let suffix = '';
  if (!c.h24) { suffix = h >= 12 ? ' PM' : ' AM'; h = h % 12 || 12; }
  const main = `${c.h24 ? two(h) : h}:${two(d.getMinutes())}${c.showSeconds ? ':' + two(d.getSeconds()) : ''}${suffix}`;
  const subTxt = c.showDate ? d.toLocaleDateString(LOCALE, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  return { main, sub: subTxt };
}

/* stopwatch */
let swStart = 0, swElapsed = 0, swRunning = false;
const laps: number[] = [];
function swText(ms: number): string {
  const t = Math.floor(ms / 10);
  const cs = t % 100, s = Math.floor(t / 100) % 60, m = Math.floor(t / 6000) % 60, h = Math.floor(t / 360000);
  return `${h > 0 ? two(h) + ':' : ''}${two(m)}:${two(s)}.${two(cs)}`;
}

/* countdown */
let cdEnd = 0, cdRemain = 0, cdRunning = false, cdTotal = 0;

function tick(): void {
  if (mode === 'clock') {
    const { main, sub: s } = fmtClock();
    display.textContent = main;
    sub.textContent = s;
  } else if (mode === 'stopwatch') {
    const ms = swElapsed + (swRunning ? performance.now() - swStart : 0);
    display.textContent = swText(ms);
  } else {
    const remain = cdRunning ? Math.max(0, cdEnd - performance.now()) : cdRemain;
    const secs = Math.ceil(remain / 1000);
    display.textContent = `${two(Math.floor(secs / 3600))}:${two(Math.floor(secs / 60) % 60)}:${two(secs % 60)}`;
    const pct = cdTotal ? (1 - remain / cdTotal) * 100 : 0;
    stage.style.setProperty('--cd-progress', `${pct}%`);
    if (cdRunning && remain <= 0) { cdRunning = false; onCountdownDone(); }
  }
  requestAnimationFrame(tick);
}

function onCountdownDone(): void {
  stage.classList.add('cd-done');
  beep();
  setTimeout(() => stage.classList.remove('cd-done'), 4000);
  renderControls();
}

function beep(): void {
  try {
    const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    for (let i = 0; i < 3; i++) {
      const o = ac.createOscillator(); const g = ac.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, ac.currentTime + i * 0.5);
      g.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + i * 0.5 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + i * 0.5 + 0.4);
      o.start(ac.currentTime + i * 0.5); o.stop(ac.currentTime + i * 0.5 + 0.4);
    }
  } catch { /* trình duyệt chặn âm thanh: bỏ qua */ }
}

function renderControls(): void {
  const c = $('#controls');
  if (mode === 'clock') { c.innerHTML = ''; return; }
  if (mode === 'stopwatch') {
    c.innerHTML = `<button type="button" class="btn btn-primary" data-sw="toggle">${swRunning ? T('pause','Tạm dừng') : swElapsed ? T('resume','Tiếp tục') : T('start','Bắt đầu')}</button>
      <button type="button" class="btn" data-sw="lap" ${swRunning ? '' : 'disabled'}>${T('lap','Lap')}</button>
      <button type="button" class="btn" data-sw="reset">${T('reset','Đặt lại')}</button>
      ${laps.length ? `<ol class="lap-list">${laps.map((l, i) => `<li>${T('lap','Lap')} ${i + 1}: ${swText(l)}</li>`).reverse().join('')}</ol>` : ''}`;
  } else {
    c.innerHTML = `<div class="cd-setup">
        <label class="check"><input type="radio" name="cdfmt" value="hms" checked /><span>hh:mm:ss</span></label>
        <label class="check"><input type="radio" name="cdfmt" value="ms" /><span>mm:ss</span></label>
        <label class="check"><input type="radio" name="cdfmt" value="s" /><span>ss</span></label>
        <input type="text" id="cd-input" class="cd-input mono" placeholder="00:05:00" value="00:05:00" />
        <button type="button" class="btn btn-primary" data-cd="toggle">${cdRunning ? T('pause','Tạm dừng') : T('start','Bắt đầu')}</button>
        <button type="button" class="btn" data-cd="reset">${T('reset','Đặt lại')}</button>
      </div>`;
  }
}

$('#controls').addEventListener('click', (e) => {
  const sw = (e.target as HTMLElement).closest<HTMLElement>('[data-sw]')?.dataset.sw;
  const cd = (e.target as HTMLElement).closest<HTMLElement>('[data-cd]')?.dataset.cd;
  if (sw === 'toggle') { if (swRunning) { swElapsed += performance.now() - swStart; swRunning = false; } else { swStart = performance.now(); swRunning = true; } renderControls(); }
  else if (sw === 'lap') { laps.push(swElapsed + (swRunning ? performance.now() - swStart : 0)); renderControls(); }
  else if (sw === 'reset') { swRunning = false; swElapsed = 0; laps.length = 0; renderControls(); }
  else if (cd === 'toggle') {
    if (cdRunning) { cdRemain = Math.max(0, cdEnd - performance.now()); cdRunning = false; }
    else {
      if (cdRemain <= 0) { const ms = parseDuration(); if (!ms) return; cdRemain = ms; cdTotal = ms; }
      cdEnd = performance.now() + cdRemain; cdRunning = true;
    }
    renderControls();
  } else if (cd === 'reset') { cdRunning = false; cdRemain = 0; cdTotal = 0; stage.classList.remove('cd-done'); renderControls(); }
});

function parseDuration(): number {
  const fmt = root.querySelector<HTMLInputElement>('input[name="cdfmt"]:checked')?.value ?? 'hms';
  const raw = $<HTMLInputElement>('#cd-input').value.trim();
  const parts = raw.split(':').map((x) => Number(x) || 0);
  let sec = 0;
  if (fmt === 's') sec = parts[0];
  else if (fmt === 'ms') sec = (parts[0] || 0) * 60 + (parts[1] || 0);
  else sec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  return Math.max(0, sec) * 1000;
}
$('#controls').addEventListener('change', (e) => {
  if ((e.target as HTMLElement).getAttribute('name') === 'cdfmt') {
    const f = (e.target as HTMLInputElement).value;
    $<HTMLInputElement>('#cd-input').placeholder = f === 's' ? '300' : f === 'ms' ? '05:00' : '00:05:00';
  }
});

function setMode(m: Mode): void {
  mode = m;
  root.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
  stage.classList.toggle('cd-mode', m === 'countdown');
  renderControls();
}
root.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode as Mode)));

$('#fs').addEventListener('click', async () => {
  if (!document.fullscreenElement) {
    await stage.requestFullscreen().catch(() => null);
    try { wakeLock = await (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null; } catch { /* không hỗ trợ */ }
  } else {
    await document.exitFullscreen().catch(() => null);
  }
});
document.addEventListener('fullscreenchange', () => {
  stage.classList.toggle('is-fullscreen', !!document.fullscreenElement);
  if (!document.fullscreenElement && wakeLock) { void wakeLock.release(); wakeLock = null; }
});

/* settings */
function bindSettings(): void {
  const c = cfg.get();
  $<HTMLInputElement>('#c-color').value = c.color;
  $<HTMLInputElement>('#c-bg').value = c.bg;
  $<HTMLSelectElement>('#c-font').value = c.font;
  $<HTMLInputElement>('#c-24').checked = c.h24;
  $<HTMLInputElement>('#c-sec').checked = c.showSeconds;
  $<HTMLInputElement>('#c-date').checked = c.showDate;
}
$('.fs-settings').addEventListener('input', () => {
  cfg.set({
    color: $<HTMLInputElement>('#c-color').value,
    bg: $<HTMLInputElement>('#c-bg').value,
    font: $<HTMLSelectElement>('#c-font').value,
    h24: $<HTMLInputElement>('#c-24').checked,
    showSeconds: $<HTMLInputElement>('#c-sec').checked,
    showDate: $<HTMLInputElement>('#c-date').checked,
  });
  applyStyle();
});

bindSettings();
applyStyle();
setMode('clock');
tick();
