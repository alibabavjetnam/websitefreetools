import { mountLayout } from '../layout';
import { $, storage } from '../ui';
import { pageText } from '../i18n';
import { detectPitch, freqToMidi, midiToFreq, noteName, TUNINGS } from '../calc/pitch';

mountLayout({ activeTool: 'guitar-tuner' });
const T = pageText();

const INSTR: Record<string, string> = { guitar: T('guitar', 'Guitar'), ukulele: T('ukulele', 'Ukulele'), bass: T('bass', 'Bass (4 dây)'), violin: T('violin', 'Violin') };
const TUNING_NAMES: Record<string, string> = {
  standard: T('tStandard', 'Chuẩn'), dropD: 'Drop D', halfDown: T('tHalf', 'Hạ nửa cung (Eb)'), openG: 'Open G', dadgad: 'DADGAD',
};
const st = storage<{ instr: string; tuning: string; a4: number }>('guitar-tuner', { instr: 'guitar', tuning: 'standard', a4: 440 });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <section class="panel">
      <div class="tuner">
        <div class="tuner-note" id="note">—</div>
        <div class="note" id="freq">${T('idle', 'Bấm Bật micro rồi gảy một dây')}</div>
        <div class="tuner-gauge">
          <svg viewBox="0 0 300 170" aria-hidden="true">
            <path d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke="#d5dbe3" stroke-width="14" stroke-linecap="round"/>
            <path d="M134 32 A120 120 0 0 1 166 32" fill="none" stroke="#16a34a" stroke-width="14"/>
            ${[-50, -25, 0, 25, 50].map((c) => {
              const a = (c / 50) * 75 * (Math.PI / 180);
              const x1 = 150 + Math.sin(a) * 100, y1 = 150 - Math.cos(a) * 100, x2 = 150 + Math.sin(a) * 88, y2 = 150 - Math.cos(a) * 88;
              const lx = 150 + Math.sin(a) * 74, ly = 150 - Math.cos(a) * 74 + 4;
              return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5b6779" stroke-width="2"/><text x="${lx}" y="${ly}" font-size="11" text-anchor="middle" fill="#5b6779">${c > 0 ? '+' : ''}${c}</text>`;
            }).join('')}
            <g id="needle" style="transition:transform 120ms linear;transform-origin:150px 150px">
              <line x1="150" y1="150" x2="150" y2="40" stroke="#b9000e" stroke-width="4" stroke-linecap="round"/>
            </g>
            <circle cx="150" cy="150" r="8" fill="#16233a"/>
          </svg>
        </div>
        <div id="hint" class="note" aria-live="polite">&nbsp;</div>
      </div>
      <div class="actions" style="justify-content:center">
        <button type="button" class="btn btn-primary" id="mic">${T('micOn', 'Bật micro')}</button>
      </div>
      <p class="error" id="err" hidden></p>
    </section>
    <section class="panel">
      <div class="field-row">
        <label class="field"><span class="field-label">${T('instrument', 'Nhạc cụ')}</span><select id="instr">${Object.keys(TUNINGS).map((k) => `<option value="${k}">${INSTR[k]}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">${T('tuning', 'Cách lên dây')}</span><select id="tuning"></select></label>
      </div>
      <div class="field-label">${T('strings', 'Dây đàn (bấm để nghe âm mẫu)')}</div>
      <div class="tuner-strings" id="strings"></div>
      <label class="field"><span class="field-label">${T('a4', 'Tần số chuẩn A4')}: <output id="a4-out"></output> Hz</span><input type="range" id="a4" min="430" max="450" step="1" /></label>
      <p class="note">${T('tips', 'Mẹo: gảy từng dây một, để dây rung tự nhiên và giữ đàn gần micro. Kim lệch trái là dây đang chùng (cần vặn căng thêm), lệch phải là dây đang căng quá. Trong khoảng ±5 cent là đã chuẩn.')}</p>
    </section>
  </div>
`;

const instrSel = $<HTMLSelectElement>('#instr');
const tuningSel = $<HTMLSelectElement>('#tuning');
const a4El = $<HTMLInputElement>('#a4');
instrSel.value = s.instr;
a4El.value = String(s.a4);

const label = (m: number) => { const n = noteName(m); return `${n.name}<sub>${n.octave}</sub>`; };
const strings = () => (TUNINGS[instrSel.value].find((t) => t.id === tuningSel.value) ?? TUNINGS[instrSel.value][0]).midi;

function fillTunings(): void {
  tuningSel.innerHTML = TUNINGS[instrSel.value].map((t) => `<option value="${t.id}">${TUNING_NAMES[t.id] ?? t.id} (${t.midi.map((m) => noteName(m).name).join(' ')})</option>`).join('');
  if (TUNINGS[instrSel.value].some((t) => t.id === s.tuning)) tuningSel.value = s.tuning;
  renderStrings(-1);
}
function renderStrings(near: number): void {
  $('#strings').innerHTML = strings().map((m, i) => `<button type="button" class="btn${i === near ? ' is-near' : ''}" data-m="${m}">${i + 1} · ${label(m)}</button>`).join('');
}
function save(): void {
  s.instr = instrSel.value;
  s.tuning = tuningSel.value;
  s.a4 = Number(a4El.value);
  st.set(s);
  $('#a4-out').textContent = a4El.value;
}

const needleEl = () => document.getElementById('needle') as unknown as SVGGElement;
let ctx: AudioContext | null = null;
let stream: MediaStream | null = null;
let raf = 0;
let smooth: number | null = null;
let lastSeen = 0;

async function startMic(): Promise<void> {
  const err = $('#err');
  err.hidden = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    err.textContent = (e as DOMException).name === 'NotAllowedError'
      ? T('errDenied', 'Micro bị chặn. Bấm biểu tượng ổ khoá cạnh địa chỉ trang, cho phép Micro rồi thử lại.')
      : T('errMic', 'Không mở được micro. Kiểm tra micro đã cắm và không bị ứng dụng khác dùng.');
    err.hidden = false;
    return;
  }
  ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 4096;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  $('#mic').textContent = T('micOff', 'Tắt micro');
  $('#freq').textContent = T('listening', 'Đang nghe… hãy gảy một dây');
  const loop = () => {
    an.getFloatTimeDomainData(buf);
    const f = detectPitch(buf, (ctx as AudioContext).sampleRate, 25, 1500);
    const now = performance.now();
    if (f) {
      smooth = smooth && Math.abs(freqToMidi(f) - freqToMidi(smooth)) < 0.5 ? smooth * 0.7 + f * 0.3 : f;
      lastSeen = now;
      show(smooth);
    } else if (now - lastSeen > 1200) {
      smooth = null;
      $('#note').textContent = '—';
      needleEl().style.transform = 'rotate(0deg)';
      $('#hint').innerHTML = '&nbsp;';
    }
    raf = requestAnimationFrame(loop);
  };
  loop();
}
function stopMic(): void {
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop());
  void ctx?.close();
  ctx = null;
  stream = null;
  $('#mic').textContent = T('micOn', 'Bật micro');
  $('#freq').textContent = T('idle', 'Bấm Bật micro rồi gảy một dây');
}

function show(f: number): void {
  const a4 = Number(a4El.value);
  const m = freqToMidi(f, a4);
  // Ưu tiên dây gần nhất của bộ dây đang chọn
  const list = strings();
  let best = 0;
  list.forEach((sm, i) => { if (Math.abs(sm - m) < Math.abs(list[best] - m)) best = i; });
  const useString = Math.abs(list[best] - m) < 2.5;
  const targetMidi = useString ? list[best] : Math.round(m);
  const cents = (m - targetMidi) * 100;
  $('#note').innerHTML = label(targetMidi);
  $('#freq').textContent = `${f.toFixed(1)} Hz · ${T('target', 'chuẩn')} ${midiToFreq(targetMidi, a4).toFixed(1)} Hz`;
  const c = Math.max(-50, Math.min(50, cents));
  needleEl().style.transform = `rotate(${(c / 50) * 75}deg)`;
  const hint = $('#hint');
  if (Math.abs(cents) <= 5) hint.innerHTML = `<span class="in-tune">✓ ${T('inTune', 'Đã chuẩn')}</span>`;
  else hint.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(0)} cent · ${cents < 0 ? T('tighten', 'dây chùng, vặn căng thêm') : T('loosen', 'dây căng quá, nới bớt')}`;
  renderStrings(useString ? best : -1);
}

/** Phát âm mẫu (dây đàn tổng hợp đơn giản) */
function play(midi: number): void {
  const c = ctx ?? new AudioContext();
  const f = midiToFreq(midi, Number(a4El.value));
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 2.2);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(6000, f * 6);
  [1, 2, 3].forEach((h, i) => {
    const o = c.createOscillator();
    o.type = i === 0 ? 'triangle' : 'sine';
    o.frequency.value = f * h;
    const hg = c.createGain();
    hg.gain.value = [1, 0.35, 0.15][i];
    o.connect(hg).connect(filter);
    o.start();
    o.stop(c.currentTime + 2.3);
  });
  filter.connect(g).connect(c.destination);
  if (!ctx) setTimeout(() => void c.close(), 2500);
}

$('#mic').addEventListener('click', () => (stream ? stopMic() : void startMic()));
$('#strings').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-m]');
  if (b) play(Number(b.dataset.m));
});
instrSel.addEventListener('change', () => { fillTunings(); save(); });
tuningSel.addEventListener('change', () => { renderStrings(-1); save(); });
a4El.addEventListener('input', save);
window.addEventListener('beforeunload', stopMic);
fillTunings();
save();
