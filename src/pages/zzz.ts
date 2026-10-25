/**
 * 4v2 — trang ẩn tại /zzz, không có trong menu hay trang chủ.
 * Chuyển từ repo messenger: biểu đồ nến Binance realtime, chấm điểm xu hướng, tín hiệu 2 kênh và backtest.
 */
import { mountLayout } from '../layout';
import '../stock/stock.css';
import { runBacktest } from '../stock/core/backtest';
import { evaluateChannels } from '../stock/core/channels';
import { buildSeries } from '../stock/core/indicators';
import { TREND_LABEL, trendAt } from '../stock/core/trend';
import {
  DEFAULT_SETTINGS,
  type BacktestResult, type Candle, type ChannelResult, type ChannelStats, type Series, type Settings, type TrendResult,
} from '../stock/core/types';
import {
  FetchError, INTERVAL_MS, LiveFeed, aggregateToDaily, fetchKlines, klinesUrl, parseRawCandles, upsertCandle,
} from '../stock/data/binance';
import { PriceChart } from '../stock/ui/chart';

mountLayout();

/* ------------------------------------------------------------------ */
/* Lưu trữ cục bộ                                                      */
/* ------------------------------------------------------------------ */
const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem('4v2:' + key);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch { return fallback; }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem('4v2:' + key, JSON.stringify(value)); } catch { /* bộ nhớ đầy hoặc bị chặn */ }
  },
};

const TF_LIST = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d'];
const LIMIT = 1000;

interface State {
  symbol: string;
  interval: string;
  intervalMs: number;
  tf: Candle[];
  d1: Candle[];
  source: 'none' | 'binance' | 'manual';
  settings: Settings;
  view: 'tf' | 'd1';
  chartType: 'candle' | 'line';
  live: boolean;
  watchlist: string[];
  bt: BacktestResult | null;
  lastReady: Record<string, boolean>;
  loading: boolean;
}

const state: State = {
  symbol: store.get('symbol', 'BTCUSDT'),
  interval: store.get('interval', '15m'),
  intervalMs: 0,
  tf: [],
  d1: [],
  source: 'none',
  settings: { ...DEFAULT_SETTINGS, ...store.get<Partial<Settings>>('settings', {}) },
  view: 'tf',
  chartType: store.get('chartType', 'candle'),
  live: store.get('live', true),
  watchlist: store.get('watchlist', ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT']),
  bt: null,
  lastReady: {},
  loading: false,
};
if (!TF_LIST.includes(state.interval)) state.interval = '15m';
state.intervalMs = INTERVAL_MS[state.interval];

/* ------------------------------------------------------------------ */
/* Tiện ích DOM                                                         */
/* ------------------------------------------------------------------ */
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const pad = (x: number) => String(x).padStart(2, '0');
const fmtTime = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtPrice = (x: number) => {
  const a = Math.abs(x);
  return x.toLocaleString('en-US', { maximumFractionDigits: a >= 1000 ? 2 : a >= 1 ? 4 : 7 });
};

const chart = new PriceChart($('chart'));
let resetZoom = true;

function setStatus(kind: 'idle' | 'loading' | 'live' | 'retrying' | 'static' | 'error', text: string) {
  const el = $('status');
  el.dataset.state = kind;
  (el.querySelector('span') as HTMLElement).textContent = text;
  el.title = text;
}

function notice(html: string | null, kind: 'error' | 'info' = 'error') {
  const el = $('notice');
  if (!html) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.dataset.kind = kind;
  el.innerHTML = html;
}

/* ------------------------------------------------------------------ */
/* Tải dữ liệu                                                          */
/* ------------------------------------------------------------------ */
async function loadFromBinance() {
  const symbol = state.symbol;
  const interval = state.interval;
  state.loading = true;
  $('reloadBtn').setAttribute('disabled', '');
  setStatus('loading', 'Đang tải');
  notice(null);
  live.stop();

  const [tfRes, d1Res] = await Promise.allSettled([
    fetchKlines(symbol, interval, LIMIT),
    fetchKlines(symbol, '1d', LIMIT),
  ]);
  state.loading = false;
  $('reloadBtn').removeAttribute('disabled');
  // Người dùng đã đổi cặp/khung trong lúc chờ: bỏ kết quả cũ
  if (symbol !== state.symbol || interval !== state.interval) return;

  if (tfRes.status === 'rejected') {
    const err = tfRes.reason as Error;
    const detail = err instanceof FetchError && err.attempts.length
      ? `<small>${err.attempts.map(esc).join('<br>')}</small>` : '';
    notice(`<b>${esc(err.message)}</b> Bạn có thể dán dữ liệu ở mục “Nhập dữ liệu thủ công” bên dưới.${detail}`);
    ($('manualPanel') as HTMLDetailsElement).open = true;
    setStatus('error', 'Lỗi tải dữ liệu');
    return;
  }

  state.tf = tfRes.value;
  if (d1Res.status === 'fulfilled') state.d1 = d1Res.value;
  else {
    state.d1 = aggregateToDaily(state.tf);
    notice('Không tải được nến ngày, hệ thống đang gộp tạm từ dữ liệu khung giao dịch (số ngày sẽ ít hơn).', 'info');
  }
  state.source = 'binance';
  state.intervalMs = INTERVAL_MS[interval];
  state.lastReady = {};
  resetZoom = true;
  analyze(true);
  if (state.live) live.start(symbol, [interval, '1d']);
  else setStatus('static', 'Dữ liệu tĩnh');
}

function inferInterval(c: Candle[]): number {
  const diffs: number[] = [];
  for (let i = 1; i < c.length; i++) diffs.push(c[i].t - c[i - 1].t);
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] || state.intervalMs;
}

function loadManual() {
  try {
    const tf = parseRawCandles(($('manualTF') as HTMLTextAreaElement).value);
    const d1Text = ($('manualD1') as HTMLTextAreaElement).value.trim();
    const d1 = d1Text ? parseRawCandles(d1Text) : aggregateToDaily(tf);
    live.stop();
    ($('liveToggle') as HTMLInputElement).checked = false;
    state.live = false;
    state.tf = tf;
    state.d1 = d1;
    state.intervalMs = inferInterval(tf);
    state.source = 'manual';
    state.lastReady = {};
    resetZoom = true;
    notice(d1Text ? null : `Đã gộp ${d1.length} nến ngày từ dữ liệu khung giao dịch. Xu hướng D1 cần ít nhất 138 ngày để đánh giá đủ 3 tiêu chí.`, 'info');
    setStatus('static', 'Dữ liệu dán tay');
    analyze(true);
  } catch (e) {
    notice(`<b>${esc((e as Error).message)}</b>`);
  }
}

/* ------------------------------------------------------------------ */
/* Realtime                                                            */
/* ------------------------------------------------------------------ */
let renderTimer: number | undefined;
let needBacktest = false;

const live = new LiveFeed(
  (iv, candle) => {
    if (state.source !== 'binance') return;
    const target = iv === state.interval ? state.tf : iv === '1d' ? state.d1 : null;
    if (!target) return;
    const prevLast = target[target.length - 1]?.t;
    upsertCandle(target, candle, LIMIT);
    if (iv === '1d' && target === state.tf) upsertCandle(state.d1, candle, LIMIT); // khung giao dịch là 1d: D1 cũng phải cập nhật
    if (iv === state.interval && candle.t !== prevLast) needBacktest = true; // một nến vừa đóng
    if (renderTimer === undefined) {
      renderTimer = window.setTimeout(() => {
        renderTimer = undefined;
        analyze(needBacktest);
        needBacktest = false;
      }, 1000);
    }
  },
  (st) => {
    if (st === 'live') setStatus('live', 'Realtime');
    else if (st === 'connecting') setStatus('loading', 'Đang kết nối');
    else if (st === 'retrying') setStatus('retrying', 'Đang kết nối lại');
    else if (!state.loading && state.source === 'binance') setStatus('static', 'Dữ liệu tĩnh');
  },
);

/* ------------------------------------------------------------------ */
/* Phân tích + hiển thị                                                 */
/* ------------------------------------------------------------------ */
let lastSeries: { tf: Series; d1: Series } | null = null;
let lastChannels: ChannelResult[] = [];

function analyze(withBacktest: boolean) {
  if (state.tf.length < 30) {
    notice('Dữ liệu quá ít (cần tối thiểu 30 nến, khuyến nghị từ 300 nến).');
    return;
  }
  const tf = buildSeries(state.tf);
  const d1 = buildSeries(state.d1.length ? state.d1 : aggregateToDaily(state.tf));
  const i = tf.close.length - 1;
  const d1Trend = trendAt(d1, d1.close.length - 1);
  const tfTrend = trendAt(tf, i);
  const res = evaluateChannels({ d1: d1Trend, tf: tfTrend, series: tf, i, cfg: state.settings });
  lastSeries = { tf, d1 };
  lastChannels = [res.with, res.counter];

  if (withBacktest || !state.bt) state.bt = runBacktest(tf, d1, state.intervalMs, state.settings);

  renderTrend($('trendD1'), 'Biểu đồ ngày (D1)', d1Trend);
  renderTrend($('trendTF'), `Khung giao dịch (${state.source === 'manual' ? 'dữ liệu dán' : state.interval})`, tfTrend);
  renderChannel($('channelWith'), 1, res.with);
  renderChannel($('channelCounter'), 2, res.counter);
  renderBacktest(state.bt);
  renderChart();
  alertIfReady(res.with);
  alertIfReady(res.counter);
}

function renderTrend(el: HTMLElement, title: string, t: TrendResult) {
  const segs: string[] = [];
  for (let k = 0; k < t.maxScore; k++) {
    const cls = k < Math.floor(t.upScore) ? 'u' : k >= t.maxScore - Math.floor(t.downScore) ? 'd' : '';
    segs.push(`<span class="${cls}"></span>`);
  }
  const voteText = (v: number | null) => (v === 1 ? 'tăng' : v === -1 ? 'giảm' : v === 0 ? 'trung tính' : 'thiếu dữ liệu');
  el.innerHTML = `
    <h3>${esc(title)}</h3>
    <div class="trend-value" data-trend="${t.trend}">${TREND_LABEL[t.trend]}</div>
    <div class="score" title="Tăng ${t.upScore} · Giảm ${t.downScore} / ${t.maxScore} điểm">${segs.join('')}</div>
    <details>
      <summary>Tăng ${t.upScore} · Giảm ${t.downScore} trên ${t.maxScore} điểm</summary>
      <ul>${t.criteria.map((c) => `<li><b>${esc(c.label)}</b> (${c.weight}đ, ${c.weight > 1 && c.vote !== null ? `tăng ${c.up} · giảm ${c.down}` : voteText(c.vote)}): ${esc(c.note)}</li>`).join('')}</ul>
    </details>`;
}

function renderChannel(el: HTMLElement, num: number, ch: ChannelResult) {
  const dirText = ch.direction === 'BUY' ? 'Mua' : ch.direction === 'SELL' ? 'Bán' : 'Chưa có hướng';
  const rail = ch.conditions
    .map((c, k) => `<span data-s="${c.state}" title="${esc(c.label)}">${k + 1}</span>`)
    .join('') + `<span class="entry" data-s="${ch.entry.state}" title="Nến vào lệnh">Vào lệnh</span>`;
  const waiting = [...ch.conditions, ch.entry].find((c) => c.state !== 'pass');
  const verdict = ch.ready
    ? `Đủ điều kiện ${dirText.toLowerCase()}. Cắt lỗ tham khảo ${fmtPrice(ch.stopLoss as number)}.`
    : `Đạt ${ch.passed}/5. Đang chờ: ${waiting ? waiting.label.charAt(0).toLowerCase() + waiting.label.slice(1) : ''}.`;
  const items = [...ch.conditions.map((c) => ({ c, entry: false })), { c: ch.entry, entry: true }]
    .map(({ c, entry }) => `<li class="${entry ? 'entry' : ''}" data-s="${c.state}"><i class="lamp"></i><div><b>${esc(c.label)}</b><span>${esc(c.detail)}</span></div></li>`)
    .join('');
  el.dataset.ready = String(ch.ready);
  el.innerHTML = `
    <div class="channel-head">
      <h2>Kênh ${num}<small>${esc(ch.name)}</small></h2>
      <span class="side" data-dir="${ch.direction ?? ''}">${dirText}</span>
    </div>
    <div class="rail" aria-hidden="true">${rail}</div>
    <p class="verdict" data-ready="${ch.ready}">${esc(verdict)}</p>
    <ol class="conds">${items}</ol>`;
}

function statCard(title: string, s: ChannelStats) {
  return `
    <div class="stat">
      <h3>${esc(title)}</h3>
      <div class="stat-main"><span class="stat-rate">${s.winRate.toFixed(1)}%</span><span class="stat-sub">tỉ lệ thắng</span></div>
      <div class="bar"><i style="width:${s.total ? s.winRate : 0}%"></i></div>
      <dl>
        <dt>Lệnh</dt><dt>Thắng</dt><dt>Thua</dt><dt>Lãi/lỗ</dt>
        <dd>${s.total}${s.open ? ` <span class="stat-sub">+${s.open} mở</span>` : ''}</dd><dd>${s.wins}</dd><dd>${s.losses}</dd>
        <dd>${s.netR >= 0 ? '+' : ''}${s.netR.toFixed(1)}R</dd>
      </dl>
    </div>`;
}

function renderBacktest(bt: BacktestResult) {
  $('stats').innerHTML = statCard('Kênh 1, cùng xu hướng', bt.byChannel.with)
    + statCard('Kênh 2, ngược xu hướng', bt.byChannel.counter)
    + statCard('Tổng hợp', bt.all);
  $('btHint').textContent = `Vào lệnh ở giá đóng cửa nến tín hiệu, cắt lỗ tại râu nến N/M (hoặc đáy/đỉnh 2), chốt lời ${state.settings.rr}R. Nến chạm cả cắt lỗ và chốt lời được tính là thua.`;
  const rows = [...bt.trades].reverse().slice(0, 200).map((t) => {
    const res = t.result === 'win' ? '<td class="win">Thắng</td>' : t.result === 'loss' ? '<td class="loss">Thua</td>' : '<td>Đang mở</td>';
    return `<tr><td>${fmtTime(t.entryTime)}</td><td>${t.channel === 'with' ? 'Kênh 1' : 'Kênh 2'}</td>
      <td class="${t.direction === 'BUY' ? 'win' : 'loss'}">${t.direction === 'BUY' ? 'Mua' : 'Bán'}</td>
      <td>${fmtPrice(t.entry)}</td><td>${fmtPrice(t.stopLoss)}</td><td>${fmtPrice(t.takeProfit)}</td>${res}</tr>`;
  });
  $('tradeRows').innerHTML = rows.length ? rows.join('') : '<tr><td colspan="7" class="empty">Chưa có lệnh nào thỏa đủ điều kiện trong dữ liệu đang xem.</td></tr>';
}

function renderChart() {
  if (!lastSeries) return;
  const isTF = state.view === 'tf';
  const series = isTF ? lastSeries.tf : lastSeries.d1;
  const label = state.source === 'manual' ? 'dữ liệu dán' : state.symbol;
  chart.render({
    series,
    intervalMs: isTF ? state.intervalMs : INTERVAL_MS['1d'],
    title: `${label} · ${isTF ? (state.source === 'manual' ? 'khung giao dịch' : state.interval) : '1D'}`,
    type: state.chartType,
    marks: isTF ? lastChannels.flatMap((c) => c.marks) : [],
    channels: isTF ? lastChannels : [],
    trades: isTF && state.bt ? state.bt.trades : [],
    resetZoom,
  });
  resetZoom = false;
}

function alertIfReady(ch: ChannelResult) {
  const was = state.lastReady[ch.id];
  state.lastReady[ch.id] = ch.ready;
  if (ch.ready && was === false) {
    notice(`<b>Kênh ${ch.id === 'with' ? 1 : 2} vừa đủ điều kiện ${ch.direction === 'BUY' ? 'mua' : 'bán'}</b> trên ${esc(state.symbol)} ${state.interval}.`, 'info');
  }
  const anyReady = lastChannels.some((c) => c.ready);
  document.title = `${anyReady ? '● ' : ''}${state.symbol} · 4v2`;
}

/* ------------------------------------------------------------------ */
/* Điều khiển                                                           */
/* ------------------------------------------------------------------ */
function updateRawLink() {
  const a = $('rawLink') as HTMLAnchorElement;
  a.href = klinesUrl('https://api.binance.com', state.symbol, state.interval, LIMIT);
  a.textContent = `Mở link dữ liệu ${state.symbol} ${state.interval}`;
}

function renderTfGroup() {
  $('tfGroup').innerHTML = TF_LIST.map(
    (tf) => `<button type="button" role="radio" aria-checked="${tf === state.interval}" data-tf="${tf}">${tf}</button>`,
  ).join('');
}

function renderWatchlist() {
  $('watchlist').innerHTML = state.watchlist.map((s) => `
    <span class="chip" aria-current="${s === state.symbol}">
      <button type="button" data-pick="${esc(s)}">${esc(s)}</button>
      <button type="button" class="chip-x" data-remove="${esc(s)}" aria-label="Bỏ ${esc(s)} khỏi danh sách">×</button>
    </span>`).join('');
  $('saveSymbol').setAttribute('aria-pressed', String(state.watchlist.includes(state.symbol)));
  $('saveSymbol').textContent = state.watchlist.includes(state.symbol) ? '★' : '☆';
}

function setSymbol(sym: string) {
  sym = sym.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!sym) return;
  state.symbol = sym;
  ($('symbolInput') as HTMLInputElement).value = sym;
  store.set('symbol', sym);
  renderWatchlist();
  updateRawLink();
  void loadFromBinance();
}

const SETTING_FIELDS: { key: keyof Settings; label: string; step: number; min: number; max: number }[] = [
  { key: 'rr', label: 'Tỉ lệ chốt lời (R:R)', step: 0.1, min: 0.5, max: 10 },
  { key: 'lookbackWith', label: 'Số nến quét, kênh 1', step: 1, min: 10, max: 300 },
  { key: 'lookbackCounter', label: 'Số nến quét, kênh 2', step: 1, min: 20, max: 400 },
  { key: 'minGap', label: 'Khoảng cách tối thiểu đáy/đỉnh 1 và 2 (nến)', step: 1, min: 2, max: 100 },
  { key: 'pivotLeft', label: 'Độ rộng đáy/đỉnh, bên trái', step: 1, min: 1, max: 20 },
  { key: 'pivotRight', label: 'Độ rộng đáy/đỉnh, bên phải', step: 1, min: 1, max: 20 },
  { key: 'rsiLow', label: 'Ngưỡng RSI quá bán', step: 1, min: 5, max: 50 },
  { key: 'rsiHigh', label: 'Ngưỡng RSI quá mua', step: 1, min: 50, max: 95 },
];

function renderSettings() {
  $('settingsForm').innerHTML = SETTING_FIELDS.map((f) => `
    <label>${esc(f.label)}
      <input type="number" name="${f.key}" value="${state.settings[f.key]}" step="${f.step}" min="${f.min}" max="${f.max}" inputmode="decimal" />
    </label>`).join('') + '<div class="row-actions"><button class="btn" type="button" id="resetSettings">Khôi phục mặc định</button></div>';
}

function bind() {
  $('symbolForm').addEventListener('submit', (e) => {
    e.preventDefault();
    setSymbol(($('symbolInput') as HTMLInputElement).value);
  });
  $('symbolInput').addEventListener('change', (e) => setSymbol((e.target as HTMLInputElement).value));

  $('saveSymbol').addEventListener('click', () => {
    const sym = state.symbol;
    state.watchlist = state.watchlist.includes(sym) ? state.watchlist.filter((s) => s !== sym) : [...state.watchlist, sym];
    store.set('watchlist', state.watchlist);
    renderWatchlist();
  });

  $('watchlist').addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const pick = t.closest<HTMLElement>('[data-pick]')?.dataset.pick;
    const remove = t.closest<HTMLElement>('[data-remove]')?.dataset.remove;
    if (remove) {
      state.watchlist = state.watchlist.filter((s) => s !== remove);
      store.set('watchlist', state.watchlist);
      renderWatchlist();
    } else if (pick && pick !== state.symbol) setSymbol(pick);
  });

  $('tfGroup').addEventListener('click', (e) => {
    const tf = (e.target as HTMLElement).closest<HTMLElement>('[data-tf]')?.dataset.tf;
    if (!tf || tf === state.interval) return;
    state.interval = tf;
    state.intervalMs = INTERVAL_MS[tf];
    store.set('interval', tf);
    renderTfGroup();
    updateRawLink();
    void loadFromBinance();
  });

  $('reloadBtn').addEventListener('click', () => void loadFromBinance());

  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.addEventListener('click', () => {
    state.view = b.dataset.view as State['view'];
    document.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    resetZoom = true;
    renderChart();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-type]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.type === state.chartType));
    b.addEventListener('click', () => {
      state.chartType = b.dataset.type as State['chartType'];
      store.set('chartType', state.chartType);
      document.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      renderChart();
    });
  });

  const liveToggle = $('liveToggle') as HTMLInputElement;
  liveToggle.checked = state.live;
  liveToggle.addEventListener('change', () => {
    state.live = liveToggle.checked;
    store.set('live', state.live);
    if (state.live && state.source === 'binance') live.start(state.symbol, [state.interval, '1d']);
    else if (state.live && state.source !== 'binance') void loadFromBinance();
    else { live.stop(); setStatus('static', 'Dữ liệu tĩnh'); }
  });

  $('analyzeManual').addEventListener('click', loadManual);
  $('pasteTF').addEventListener('click', async () => {
    try {
      ($('manualTF') as HTMLTextAreaElement).value = await navigator.clipboard.readText();
    } catch {
      notice('Trình duyệt không cho đọc clipboard. Hãy nhấn vào ô dữ liệu rồi dùng Ctrl+V (hoặc giữ để dán trên điện thoại).');
    }
  });

  $('settingsForm').addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const f = SETTING_FIELDS.find((x) => x.key === input.name);
    if (!f) return;
    const v = Math.min(f.max, Math.max(f.min, Number(input.value)));
    if (!Number.isFinite(v)) return;
    state.settings = { ...state.settings, [f.key]: v };
    input.value = String(v);
    store.set('settings', state.settings);
    if (state.tf.length) analyze(true);
  });
  $('settingsForm').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id !== 'resetSettings') return;
    state.settings = { ...DEFAULT_SETTINGS };
    store.set('settings', state.settings);
    renderSettings();
    if (state.tf.length) analyze(true);
  });


  document.addEventListener('visibilitychange', () => {
    // Quay lại tab sau thời gian dài: tải lại để không bị hụt nến
    if (document.visibilityState === 'visible' && state.source === 'binance' && state.live && state.tf.length) {
      const last = state.tf[state.tf.length - 1].t;
      if (Date.now() - last > state.intervalMs * 3) void loadFromBinance();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Khởi động                                                           */
/* ------------------------------------------------------------------ */
($('symbolInput') as HTMLInputElement).value = state.symbol;
renderTfGroup();
renderWatchlist();
renderSettings();
updateRawLink();
bind();
void loadFromBinance();
