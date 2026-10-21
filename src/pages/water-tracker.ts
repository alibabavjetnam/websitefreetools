import { mountLayout } from '../layout';
import { $, storage } from '../ui';
import { waterTarget } from '../calc/health';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'water-tracker' });
const T = pageText();
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN' } as Record<string, string>)[currentLang()] || 'en-US';

type Logs = Record<string, number>; // YYYY-MM-DD -> ml
const store = storage<Logs>('water', {});
const cfg = storage<{ target: number; weight: number }>('water-cfg', { target: 2000, weight: 60 });

const todayKey = () => new Date().toLocaleDateString('en-CA');
const vi = (n: number) => n.toLocaleString(LOCALE);
const CUPS = [100, 200, 330, 500];

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace">
    <div class="panel">
      <div class="panel-title">${T('today','Hôm nay')}</div>
      <div class="ring-wrap ring-wrap--lg"><svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg ring-fg--water" id="ring"/></svg>
        <div class="ring-center"><b id="amount">0</b><span id="of">/ 2000 ml</span></div></div>
      <div class="actions water-cups" id="cups">
        ${CUPS.map((c) => `<button type="button" class="btn" data-add="${c}">+${c} ml</button>`).join('')}
        <button type="button" class="btn" data-add="-200">− 200 ml</button>
      </div>
      <p class="note" id="status"></p>
    </div>
    <div class="panel">
      <div class="panel-title">${T('settings','Thiết lập')}</div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('weight','Cân nặng (kg)')}</span><input type="number" id="weight" min="20" max="200" /></label>
        <label class="field"><span class="field-label">${T('target','Mục tiêu (ml/ngày)')}</span><input type="number" id="target" min="500" max="6000" step="50" /></label>
      </div>
      <div class="actions"><button type="button" class="btn btn-sm" id="suggest">${T('suggest','Gợi ý theo cân nặng')}</button></div>
      <div class="panel-title" style="margin-top:18px">${T('last7','7 ngày gần đây')}</div>
      <div id="history"></div>
    </div>
  </div>
  <p class="note">${T('note','Lượng nước gợi ý ~35 ml/kg cân nặng, là mức tham khảo; nhu cầu thực tế thay đổi theo thời tiết, vận động và sức khoẻ. Dữ liệu lưu trên trình duyệt của bạn.')}</p>
`;

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return x.toLocaleDateString('en-CA');
}

function render(): void {
  const logs = store.get();
  const { target } = cfg.get();
  const today = todayKey();
  const amount = logs[today] ?? 0;
  const pct = Math.min(1, target ? amount / target : 0);
  $<HTMLElement>('#ring').style.strokeDasharray = `${pct * 326.7} 326.7`;
  $('#amount').textContent = vi(amount);
  $('#of').textContent = `/ ${vi(target)} ml`;
  $('#status').textContent = amount >= target ? T('reached','🎉 Đã đạt mục tiêu hôm nay!') : `${T('remain1','Còn')} ${vi(target - amount)} ${T('remain2','ml nữa là đạt mục tiêu.')}`;

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const max = Math.max(target, ...days.map((d) => logs[d] ?? 0), 1);
  $('#history').innerHTML = `<div class="water-history">${days.map((d) => {
    const v = logs[d] ?? 0;
    const h = Math.round((v / max) * 100);
    const [, mm, dd] = d.split('-');
    return `<div class="wh-col"><div class="wh-bar-wrap"><div class="wh-bar${v >= target ? ' done' : ''}" style="height:${h}%"></div></div><span class="wh-label">${dd}/${mm}</span></div>`;
  }).join('')}</div>`;
}

$('#cups').addEventListener('click', (e) => {
  const add = (e.target as HTMLElement).closest<HTMLElement>('[data-add]')?.dataset.add;
  if (!add) return;
  const logs = store.get();
  const today = todayKey();
  logs[today] = Math.max(0, (logs[today] ?? 0) + Number(add));
  if (logs[today] === 0) delete logs[today];
  store.set(logs);
  render();
});
$('#weight').addEventListener('input', () => cfg.set({ ...cfg.get(), weight: Number($<HTMLInputElement>('#weight').value) || 0 }));
$('#target').addEventListener('input', () => { cfg.set({ ...cfg.get(), target: Number($<HTMLInputElement>('#target').value) || 2000 }); render(); });
$('#suggest').addEventListener('click', () => {
  const w = Number($<HTMLInputElement>('#weight').value) || 60;
  const t = waterTarget(w);
  $<HTMLInputElement>('#target').value = String(t);
  cfg.set({ target: t, weight: w });
  render();
});

const c = cfg.get();
$<HTMLInputElement>('#weight').value = String(c.weight);
$<HTMLInputElement>('#target').value = String(c.target);
render();
