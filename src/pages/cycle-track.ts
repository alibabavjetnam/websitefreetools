import { mountLayout } from '../layout';
import { $, storage } from '../ui';
import { predictCycle } from '../calc/cycle';

type Pred = NonNullable<ReturnType<typeof predictCycle>>['predictions'];

mountLayout({ activeTool: 'cycle-track' });

interface Cfg { starts: string[]; periodLen: number }
const store = storage<Cfg>('cycle', { starts: [], periodLen: 5 });

const todayKey = () => new Date().toLocaleDateString('en-CA');
const fmt = (k: string) => k.split('-').reverse().join('/');
const MONTHS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace">
    <div class="panel">
      <div class="panel-title">Ghi ngày bắt đầu kỳ kinh</div>
      <div class="field-row">
        <label class="field"><span class="field-label">Ngày bắt đầu</span><input type="date" id="start" max="${todayKey()}" value="${todayKey()}" /></label>
        <label class="field"><span class="field-label">Số ngày hành kinh</span><input type="number" id="plen" min="2" max="10" /></label>
        <div class="actions" style="align-self:flex-end"><button type="button" class="btn btn-primary" id="add">Ghi lại</button></div>
      </div>
      <div id="history" style="margin-top:12px"></div>
    </div>
    <section class="preview">
      <div class="panel" id="predict"></div>
    </section>
  </div>
  <div class="panel" id="calendar" style="margin-top:20px"></div>
  <p class="note"><b>Lưu ý:</b> dự đoán chỉ mang tính tham khảo dựa trên chu kỳ trung bình, không dùng để tránh thai hay chẩn đoán y tế. Dữ liệu <b>chỉ lưu trên trình duyệt của bạn</b>, không gửi đi đâu.</p>
`;

function render(): void {
  const cfg = store.get();
  const starts = [...cfg.starts].sort().reverse();
  $('#history').innerHTML = starts.length
    ? `<div class="chip-list">${starts.map((s) => `<span class="chip">${fmt(s)}<button type="button" data-del="${s}" aria-label="Xoá">✕</button></span>`).join('')}</div>`
    : '<p class="note">Chưa có dữ liệu. Ghi lại ngày bắt đầu kỳ gần nhất để bắt đầu dự đoán.</p>';

  const pred = predictCycle(cfg.starts, 28, cfg.periodLen, 3);
  if (!pred) {
    $('#predict').innerHTML = '<p class="note">Ghi ít nhất một kỳ để xem dự đoán. Ghi từ 2 kỳ trở lên sẽ chính xác hơn.</p>';
    $('#calendar').innerHTML = '';
    return;
  }
  const next = pred.predictions.find((p) => p.start >= todayKey()) ?? pred.predictions[0];
  $('#predict').innerHTML = `
    <div class="panel-title">Dự đoán</div>
    <div class="stat-grid">
      <div class="stat stat--main"><span class="stat-label">Kỳ tiếp theo</span><span class="stat-value">${fmt(pred.nextStart)}</span></div>
      <div class="stat"><span class="stat-label">Còn</span><span class="stat-value">${pred.daysToNext} ngày</span></div>
      <div class="stat"><span class="stat-label">Chu kỳ trung bình</span><span class="stat-value">${pred.avgCycle} ngày</span></div>
      <div class="stat"><span class="stat-label">Hôm nay</span><span class="stat-value">${pred.phaseToday}</span></div>
    </div>
    <p class="note" style="margin-top:10px">Khoảng dễ thụ thai sắp tới: <b>${fmt(next.fertileStart)} – ${fmt(next.fertileEnd)}</b>, rụng trứng ~<b>${fmt(next.ovulation)}</b>.</p>`;

  renderCalendar(pred.predictions);
}

function renderCalendar(preds: Pred): void {
  // Tô màu các loại ngày cho 2 tháng tới
  const period = new Set<string>();
  const fertile = new Set<string>();
  const ovu = new Set<string>();
  const addRange = (set: Set<string>, from: string, to: string) => {
    let [y, m, d] = from.split('-').map(Number);
    const end = to;
    let cur = from;
    while (cur <= end) { set.add(cur); d++; const x = new Date(y, m - 1, d); y = x.getFullYear(); m = x.getMonth() + 1; d = x.getDate(); cur = x.toLocaleDateString('en-CA'); }
  };
  for (const p of preds) {
    addRange(period, p.start, p.periodEnd);
    addRange(fertile, p.fertileStart, p.fertileEnd);
    ovu.add(p.ovulation);
  }
  const today = new Date();
  const months = [0, 1].map((off) => {
    const base = new Date(today.getFullYear(), today.getMonth() + off, 1);
    const y = base.getFullYear(), m = base.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const cells: string[] = [];
    for (let i = 0; i < first; i++) cells.push('<span class="cal-cell cal-empty"></span>');
    for (let d = 1; d <= days; d++) {
      const key = new Date(y, m, d).toLocaleDateString('en-CA');
      const cls = ovu.has(key) ? 'is-ovu' : period.has(key) ? 'is-period' : fertile.has(key) ? 'is-fertile' : '';
      const todayCls = key === todayKey() ? ' is-today' : '';
      cells.push(`<span class="cal-cell ${cls}${todayCls}">${d}</span>`);
    }
    return `<div class="cal-month"><div class="cal-title">${MONTHS[m]} ${y}</div><div class="cal-grid">${DOW.map((x) => `<span class="cal-dow">${x}</span>`).join('')}${cells.join('')}</div></div>`;
  }).join('');
  $('#calendar').innerHTML = `<div class="cal-wrap">${months}</div>
    <div class="cal-legend"><span><i class="lg is-period"></i>Hành kinh</span><span><i class="lg is-fertile"></i>Dễ thụ thai</span><span><i class="lg is-ovu"></i>Rụng trứng</span></div>`;
}

$('#add').addEventListener('click', () => {
  const s = $<HTMLInputElement>('#start').value;
  if (!s) return;
  const cfg = store.get();
  const plen = Math.max(2, Math.min(10, Number($<HTMLInputElement>('#plen').value) || 5));
  store.set({ starts: [...new Set([...cfg.starts, s])], periodLen: plen });
  render();
});
$('#history').addEventListener('click', (e) => {
  const s = (e.target as HTMLElement).closest<HTMLElement>('[data-del]')?.dataset.del;
  if (!s) return;
  const cfg = store.get();
  store.set({ ...cfg, starts: cfg.starts.filter((x) => x !== s) });
  render();
});
$<HTMLInputElement>('#plen').value = String(store.get().periodLen);
render();
