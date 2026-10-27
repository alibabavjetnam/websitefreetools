import { mountLayout } from '../layout';
import { $, escapeHtml, storage } from '../ui';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'spin-wheel' });
const T = pageText();

const PALETTE = ['#0d6efd', '#b9000e', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569'];
const st = storage<{ text: string; removeWinner: boolean; duration: number; sound: boolean; history: string[] }>('spin-wheel', {
  text: '', removeWinner: false, duration: 5, sound: true, history: [],
});
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace is-fullscreen-host" id="host">
    <section class="panel" style="align-items:center">
      <div class="wheel-wrap">
        <canvas id="wheel" width="1040" height="1040" aria-label="${T('wheel', 'Vòng quay')}"></canvas>
        <div class="wheel-pointer" aria-hidden="true"></div>
        <button type="button" class="wheel-center" id="spin">${T('spin', 'QUAY')}</button>
      </div>
      <div class="winner" id="winner" hidden aria-live="assertive"></div>
      <div class="row">
        <button type="button" class="btn btn-primary" id="spin2">${T('spinBtn', 'Quay ngay')}</button>
        <button type="button" class="btn" id="fs">${T('fullscreen', 'Toàn màn hình')}</button>
      </div>
    </section>
    <section class="panel">
      <label class="field"><span class="field-label">${T('entries', 'Danh sách (mỗi dòng một mục)')} · <span id="count"></span></span>
        <textarea id="items" rows="12"></textarea>
      </label>
      <div class="row">
        <button type="button" class="btn btn-sm" id="shuffle">${T('shuffle', 'Xáo trộn')}</button>
        <button type="button" class="btn btn-sm" id="sort">${T('sort', 'Sắp xếp A-Z')}</button>
        <button type="button" class="btn btn-sm" id="sample">${T('sampleBtn', 'Danh sách mẫu')}</button>
        <button type="button" class="btn btn-sm" id="clear">${T('clear', 'Xoá hết')}</button>
      </div>
      <label class="check"><input type="checkbox" id="remove" /><span>${T('removeWinner', 'Tự loại mục đã trúng khỏi vòng quay')}</span></label>
      <label class="check"><input type="checkbox" id="sound" /><span>${T('sound', 'Âm thanh tích tắc')}</span></label>
      <label class="field"><span class="field-label">${T('duration', 'Thời gian quay')}: <output id="dur-out"></output> ${T('sec', 'giây')}</span><input type="range" id="duration" min="2" max="15" step="1" /></label>
      <div><div class="panel-title" style="margin:0 0 6px">${T('history', 'Kết quả đã quay')}</div><ol class="plain-list" id="hist"></ol>
        <button type="button" class="btn btn-sm" id="clear-hist" style="margin-top:6px">${T('clearHist', 'Xoá kết quả')}</button></div>
      <p class="note">${T('fair', 'Kết quả chọn bằng bộ sinh số ngẫu nhiên an toàn của trình duyệt (crypto), mỗi mục có cơ hội như nhau. Muốn một mục có cơ hội gấp đôi, hãy nhập mục đó hai lần.')}</p>
    </section>
  </div>
`;

const canvas = $<HTMLCanvasElement>('#wheel');
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const itemsEl = $<HTMLTextAreaElement>('#items');
const SAMPLE = T('sample', 'An\nBình\nChi\nDũng\nGiang\nHà\nKhánh\nLinh');
itemsEl.value = s.text || SAMPLE;
$<HTMLInputElement>('#remove').checked = s.removeWinner;
$<HTMLInputElement>('#sound').checked = s.sound;
$<HTMLInputElement>('#duration').value = String(s.duration);

let angle = 0; // góc quay hiện tại (radian), kim chỉ nằm ở phía phải (0 rad)
let spinning = false;

const items = () => itemsEl.value.split('\n').map((x) => x.trim()).filter(Boolean);
function save(): void {
  s.text = itemsEl.value;
  s.removeWinner = $<HTMLInputElement>('#remove').checked;
  s.sound = $<HTMLInputElement>('#sound').checked;
  s.duration = Number($<HTMLInputElement>('#duration').value);
  st.set(s);
  $('#dur-out').textContent = String(s.duration);
  $('#count').textContent = `${items().length} ${T('items', 'mục')}`;
}

function draw(): void {
  const list = items();
  const n = Math.max(1, list.length);
  const W = canvas.width;
  const R = W / 2 - 8;
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.translate(W / 2, W / 2);
  ctx.rotate(angle);
  const seg = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, i * seg, (i + 1) * seg);
    ctx.closePath();
    // Tránh hai ô cạnh nhau (đầu và cuối) cùng màu
    let ci = i % PALETTE.length;
    if (i === n - 1 && n > 1 && ci === 0) ci = 1;
    ctx.fillStyle = list.length ? PALETTE[ci] : '#d5dbe3';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    if (!list.length) continue;
    ctx.save();
    ctx.rotate(i * seg + seg / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    const size = Math.max(14, Math.min(44, (seg * R) / 2.2, 600 / Math.max(6, n)));
    ctx.font = `600 ${size}px 'Be Vietnam Pro', system-ui, sans-serif`;
    let label = list[i];
    const maxW = R * 0.72;
    while (ctx.measureText(label).width > maxW && label.length > 1) label = label.slice(0, -2) + '…';
    ctx.fillText(label, R - 24, 0);
    ctx.restore();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(W / 2, W / 2, R, 0, 2 * Math.PI);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#16233a';
  ctx.stroke();
}

/** Số ngẫu nhiên an toàn trong [0, 1) */
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

let audio: AudioContext | null = null;
function tick(): void {
  if (!$<HTMLInputElement>('#sound').checked) return;
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = 1400;
    g.gain.setValueAtTime(0.08, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.04);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.05);
  } catch { /* trình duyệt chặn âm thanh: bỏ qua */ }
}

function spin(): void {
  const list = items();
  if (spinning) return;
  if (list.length < 2) { showWinner(T('needTwo', 'Cần ít nhất 2 mục để quay.'), ''); return; }
  spinning = true;
  $('#winner').hidden = true;
  const n = list.length;
  const seg = (2 * Math.PI) / n;
  const win = Math.floor(rand() * n);
  // Kim ở góc 0: cần (angle + tâm ô thắng) ≡ 0, thêm lệch ngẫu nhiên trong ô và vài vòng quay
  const within = (rand() - 0.5) * seg * 0.8;
  const targetMod = -(win * seg + seg / 2 + within);
  const start = angle;
  const turns = 5 + Math.floor(rand() * 3);
  let end = targetMod - turns * 2 * Math.PI;
  while (end > start - turns * 2 * Math.PI) end -= 2 * Math.PI;
  const dur = s.duration * 1000;
  const t0 = performance.now();
  let lastSeg = -1;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frame = (now: number) => {
    const p = reduce ? 1 : Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 4); // chậm dần
    angle = start + (end - start) * e;
    draw();
    const cur = Math.floor((((-angle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / seg);
    if (cur !== lastSeg) { if (lastSeg >= 0) tick(); lastSeg = cur; }
    if (p < 1) requestAnimationFrame(frame);
    else {
      angle = ((end % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      spinning = false;
      const name = list[win];
      showWinner(name, T('winnerIs', 'Kết quả'));
      s.history.unshift(name);
      s.history = s.history.slice(0, 30);
      if ($<HTMLInputElement>('#remove').checked) {
        const lines = itemsEl.value.split('\n');
        const idx = lines.findIndex((l) => l.trim() === name);
        if (idx >= 0) lines.splice(idx, 1);
        itemsEl.value = lines.join('\n');
        setTimeout(draw, 1200);
      }
      save();
      renderHist();
    }
  };
  requestAnimationFrame(frame);
}

function showWinner(text: string, label: string): void {
  const w = $('#winner');
  w.innerHTML = `${label ? `<small>${escapeHtml(label)}</small>` : ''}${escapeHtml(text)}`;
  w.hidden = false;
}
function renderHist(): void {
  $('#hist').innerHTML = s.history.length ? s.history.map((h) => `<li>${escapeHtml(h)}</li>`).join('') : `<li class="note" style="list-style:none">${T('noHist', 'Chưa quay lần nào.')}</li>`;
}

function shuffleLines(): void {
  const list = items();
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  itemsEl.value = list.join('\n');
}

$('#spin').addEventListener('click', spin);
$('#spin2').addEventListener('click', spin);
canvas.addEventListener('click', spin);
itemsEl.addEventListener('input', () => { if (!spinning) { save(); draw(); } });
$('#shuffle').addEventListener('click', () => { shuffleLines(); save(); draw(); });
$('#sort').addEventListener('click', () => { itemsEl.value = items().sort((a, b) => a.localeCompare(b)).join('\n'); save(); draw(); });
$('#sample').addEventListener('click', () => { itemsEl.value = SAMPLE; save(); draw(); });
$('#clear').addEventListener('click', () => { itemsEl.value = ''; save(); draw(); itemsEl.focus(); });
$('#clear-hist').addEventListener('click', () => { s.history = []; save(); renderHist(); });
['remove', 'sound', 'duration'].forEach((id) => $('#' + id).addEventListener('input', save));
$('#fs').addEventListener('click', () => {
  const host = $('#host');
  if (document.fullscreenElement) void document.exitFullscreen();
  else void host.requestFullscreen?.().catch(() => undefined);
});
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement === document.body) { e.preventDefault(); spin(); }
});
// Vẽ lại khi phông chữ tải xong để chữ trên vòng quay đúng phông
void document.fonts?.ready.then(draw);
save();
renderHist();
draw();
