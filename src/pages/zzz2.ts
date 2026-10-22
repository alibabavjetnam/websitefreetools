/**
 * zzz2 — trang ẩn tại /zzz2 (bản thử nghiệm chiến lược, tách riêng khỏi /zzz).
 * Tải lịch sử Binance, chạy engine ở src/stock2/core/engine.ts và so sánh huấn luyện với ngoài mẫu.
 */
import { mountLayout } from '../layout';
import '../stock2/zzz2.css';
import {
  DEFAULTS, makeContextFrom, run, summarize, type Bar, type Params, type Stats, type Trade,
} from '../stock2/core/engine';
import { DataError, fetchHistory } from '../stock2/data';
import { loadModel, runNjs, scoreBars, topNodes } from '../stock2/njsModel';

mountLayout();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const num = (id: string, fb: number) => { const v = parseFloat($<HTMLInputElement>(id).value); return Number.isFinite(v) ? v : fb; };
const chk = (id: string) => $<HTMLInputElement>(id).checked;
const TF_MS: Record<string, number> = { '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000 };

function readParams(): Params {
  return {
    ...DEFAULTS,
    rr: 1, // cố định cắt lỗ : chốt lời = 1 : 1
    feePct: Math.max(0, num('fee', 0.1)), slipPct: Math.max(0, num('slip', 0.02)),
    mode: $<HTMLSelectElement>('mode').value as Params['mode'],
    breakN: Math.max(2, Math.round(num('breakN', 4))), atrStop: Math.max(0, num('atrStop', 0)), slBufAtr: Math.max(0, num('slBuf', 0.5)),
    h4Mode: $<HTMLSelectElement>('h4').value as Params['h4Mode'], counterMaxAdx: Math.max(0, num('adx', 28)),
    needBB: chk('needBB'), needRSI: chk('needRSI'), needEma: chk('needEma'), useBias: chk('useBias'),
  };
}

const fmtDate = (t: number) => new Date(t).toISOString().slice(0, 10);
const fmtTime = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');
const price = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: x >= 1000 ? 2 : x >= 1 ? 4 : 6 });
const sign = (x: number) => (x > 0 ? 'pos' : x < 0 ? 'neg' : '');

interface Eval extends Stats { avgCost: number; breakEven: number; ci: number }

function evaluate(tr: Trade[]): Eval {
  const s = summarize(tr);
  const n = tr.length;
  const avgCost = n ? tr.reduce((a, t) => a + (t.grossR - t.netR), 0) / n : 0;
  let ci = 0;
  if (n > 1) {
    const m = s.netR / n;
    const sd = Math.sqrt(tr.reduce((a, t) => a + (t.netR - m) ** 2, 0) / (n - 1));
    ci = (1.96 * sd) / Math.sqrt(n);
  }
  return { ...s, avgCost, breakEven: 50 * (1 + avgCost), ci };
}

function card(title: string, e: Eval, period: string): string {
  const row = (k: string, v: string, cls = '') => `<dt>${k}</dt><dd class="${cls}">${v}</dd>`;
  return `<div class="card2"><h3>${title}</h3><p class="hint" style="margin:0 0 8px;font-size:.8rem;color:#5b6779">${period}</p><dl>
    ${row('Số lệnh', String(e.n))}
    ${row('Thắng / thua / hết hạn', `${e.wins} / ${e.losses} / ${e.timeouts}`)}
    ${row('Tỷ lệ thắng', `${e.winRate.toFixed(1)}%`)}
    ${row('Tỷ lệ thắng hòa vốn', `${e.breakEven.toFixed(1)}%`)}
    ${row('Kỳ vọng mỗi lệnh (sau phí)', `${e.expR >= 0 ? '+' : ''}${e.expR.toFixed(3)}R ± ${e.ci.toFixed(3)}`, sign(e.expR))}
    ${row('Tổng', `${e.netR >= 0 ? '+' : ''}${e.netR.toFixed(1)}R`, sign(e.netR))}
    ${row('Hệ số lợi nhuận (PF)', Number.isFinite(e.pf) ? e.pf.toFixed(2) : '∞')}
    ${row('Sụt giảm tối đa', `${e.maxDD.toFixed(1)}R`)}
  </dl></div>`;
}

function verdict(train: Eval, test: Eval): { v: 'bad' | 'mid' | 'ok'; html: string } {
  if (test.n < 30) return { v: 'mid', html: `<b>Chưa đủ mẫu để kết luận.</b> Giai đoạn ngoài mẫu chỉ có ${test.n} lệnh (cần ít nhất 100). Hãy tăng số ngày lịch sử, hạ khung thời gian hoặc nới lỏng bộ lọc.` };
  const reliable = test.n >= 100 && test.expR - test.ci > 0;
  if (reliable && train.expR > 0) return { v: 'ok', html: `<b>Có dấu hiệu lợi thế.</b> Ngoài mẫu: ${test.n} lệnh, thắng ${test.winRate.toFixed(1)}% (hòa vốn ${test.breakEven.toFixed(1)}%), kỳ vọng ${test.expR.toFixed(3)}R, cận dưới khoảng tin cậy 95% vẫn dương. Vẫn cần thử thêm trên cặp và giai đoạn khác trước khi tin.` };
  if (test.expR > 0) return { v: 'mid', html: `<b>Chưa có bằng chứng chắc chắn.</b> Ngoài mẫu kỳ vọng dương (${test.expR.toFixed(3)}R) nhưng khoảng tin cậy 95% (± ${test.ci.toFixed(3)}) còn chứa mức 0, nên có thể chỉ là may rủi.` };
  return { v: 'bad', html: `<b>Chưa có lợi thế sau phí.</b> Ngoài mẫu thắng ${test.winRate.toFixed(1)}% so với mức hòa vốn ${test.breakEven.toFixed(1)}%, kỳ vọng ${test.expR.toFixed(3)}R mỗi lệnh.${train.expR > 0 ? ' Giai đoạn huấn luyện dương nhưng ngoài mẫu âm: dấu hiệu quá khớp.' : ''}` };
}

let running = false;
$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (running) return;
  running = true;
  const btn = $<HTMLButtonElement>('run');
  btn.disabled = true;
  const status = $('status');
  try {
    const symbol = $<HTMLInputElement>('symbol').value.trim().toUpperCase() || 'BTCUSDT';
    const njs = $<HTMLSelectElement>('mode').value === 'njs';
    const tf = njs ? '15m' : $<HTMLSelectElement>('tf').value; // mô hình njs được huấn luyện trên khung 15 phút
    const ms = TF_MS[tf];
    const days = Math.min(1500, Math.max(300, Math.round(num('days', 1000))));
    // 15 phút: giới hạn số nến tải (mỗi 1000 nến là một lần gọi), phần D1/H4 vẫn tải đủ để chấm xu hướng
    const tfCount = Math.min(Math.round((days * 86_400_000) / ms), njs ? 60_000 : tf === '15m' ? 30_000 : 40_000);
    const closed = (b: Bar[], m: number) => b.filter((x) => x.t + m <= Date.now());

    status.textContent = 'Đang tải D1…';
    const d1 = closed(await fetchHistory(symbol, '1d', days + 260), 86_400_000);
    status.textContent = 'Đang tải H4…';
    const h4 = closed(await fetchHistory(symbol, '4h', Math.min(days * 6 + 300, 12_000)), 14_400_000);
    status.textContent = `Đang tải khung ${tf}…`;
    const tfBars = closed(await fetchHistory(symbol, tf, tfCount, (d, t) => { status.textContent = `Đang tải khung ${tf}: ${d}/${t} nến`; }), ms);
    if (tfBars.length < 600 || d1.length < 260) throw new DataError('Dữ liệu quá ngắn để chấm xu hướng D1 (cần ít nhất khoảng 260 ngày). Hãy tăng số ngày lịch sử.');

    status.textContent = 'Đang chạy thử…';
    await new Promise((r) => setTimeout(r, 30)); // nhường giao diện cập nhật trạng thái
    const params = readParams();
    const ctx = makeContextFrom(tfBars, ms, h4, d1);
    let trades: Trade[];
    let modelCut = 0;
    $('njsPanel').hidden = true;
    if (njs) {
      status.textContent = 'Đang tải mô hình njs…';
      const model = await loadModel();
      modelCut = model.trainedUntil;
      const logit = await scoreBars(ctx, model, (d, t) => { status.textContent = `Đang tính node njs: ${d}/${t}`; });
      trades = runNjs(ctx, logit, model, { delta: Math.max(0.01, num('delta', 0.05)), feePct: params.feePct, slipPct: params.slipPct, from: 0 });
      $('njsTop').innerHTML = `<thead><tr><th>Node</th><th>Họ</th><th>Biến thể</th><th>Trọng số ảnh hưởng</th></tr></thead><tbody>${topNodes(model, 20).map((n) =>
        `<tr><td>${n.name}</td><td>${n.familyName}</td><td>${n.variant + 1}/32</td><td>${(n.weight * 100).toFixed(2)}%</td></tr>`).join('')}</tbody>`;
      $('njsWf').innerHTML = `<thead><tr><th>Năm</th><th>AUC</th><th>Số tín hiệu</th><th>Thắng %</th><th>Lãi trước phí (R)</th><th>Phí (R)</th><th>Lãi sau phí (R)</th></tr></thead><tbody>${model.walkForward.map((w) =>
        `<tr><td>${w.year}</td><td>${w.auc.toFixed(3)}</td><td>${w.n}</td><td>${w.win.toFixed(1)}</td><td>${w.gross.toFixed(3)}</td><td>${w.cost.toFixed(3)}</td><td class="${sign(w.net)}">${w.net.toFixed(3)}</td></tr>`).join('')}</tbody>`;
      $('njsNote').textContent = `Mô hình: cắt lỗ = chốt lời = ${model.K} × ATR, giữ tối đa ${model.H} nến 15m; huấn luyện trên ${model.trainRows} mẫu đến ${fmtDate(model.trainedUntil)}. Bảng trên tính trên từng tín hiệu độc lập; kết quả giả lập ở trên chỉ giữ một lệnh tại một thời điểm.`;
      $('njsPanel').hidden = false;
    } else {
      trades = run(ctx, params);
    }

    const oos = Math.min(70, Math.max(10, Math.round(num('oos', 40)))) / 100;
    const tStart = ctx.f.bars[Math.min(220, ctx.f.bars.length - 1)].t;
    const tEnd = ctx.f.bars[ctx.f.bars.length - 1].t;
    // Với mô hình njs, mọi thứ sau thời điểm huấn luyện là ngoài mẫu
    const split = njs ? Math.min(Math.max(modelCut, tStart), tEnd) : tStart + (tEnd - tStart) * (1 - oos);
    const tr = trades.filter((t) => t.t < split), te = trades.filter((t) => t.t >= split);
    const eAll = evaluate(trades), eTr = evaluate(tr), eTe = evaluate(te);

    const vd = verdict(eTr, eTe);
    const vEl = $('verdict');
    vEl.dataset.v = vd.v;
    vEl.innerHTML = vd.html;
    vEl.hidden = false;
    const cEl = $('cards');
    cEl.innerHTML = card('Toàn bộ', eAll, `${fmtDate(tStart)} → ${fmtDate(tEnd)}`)
      + card('Huấn luyện', eTr, `${fmtDate(tStart)} → ${fmtDate(split)}`)
      + card('Ngoài mẫu', eTe, `${fmtDate(split)} → ${fmtDate(tEnd)}`);
    cEl.hidden = false;

    const years = [...new Set(trades.map((t) => new Date(t.t).getUTCFullYear()))].sort();
    $('yearTable').innerHTML = `<thead><tr><th>Năm</th><th>Lệnh</th><th>Thắng %</th><th>Kỳ vọng (R)</th><th>Tổng (R)</th></tr></thead><tbody>${years.map((y) => {
      const e = evaluate(trades.filter((t) => new Date(t.t).getUTCFullYear() === y));
      return `<tr><td>${y}</td><td>${e.n}</td><td>${e.winRate.toFixed(1)}</td><td class="${sign(e.expR)}">${e.expR.toFixed(3)}</td><td class="${sign(e.netR)}">${e.netR.toFixed(1)}</td></tr>`;
    }).join('')}</tbody>`;
    $('byYear').hidden = false;

    const last = trades.slice(-30).reverse();
    $('tradeTable').innerHTML = `<thead><tr><th>Thời gian (UTC)</th><th>Lệnh</th><th>Kênh</th><th>Giá vào</th><th>Cắt lỗ</th><th>Chốt lời</th><th>Rủi ro %</th><th>Kết quả</th><th>R sau phí</th></tr></thead><tbody>${last.length ? last.map((t) =>
      `<tr><td>${fmtTime(t.t)}</td><td>${t.dir > 0 ? 'MUA' : 'BÁN'}</td><td>${t.channel === 'with' ? 'Cùng' : 'Ngược'}</td><td>${price(t.entry)}</td><td>${price(t.sl)}</td><td>${price(t.tp)}</td><td>${t.riskPct.toFixed(2)}</td><td>${t.result === 'win' ? 'Thắng' : t.result === 'loss' ? 'Thua' : 'Hết hạn'}</td><td class="${sign(t.netR)}">${t.netR.toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="9">Không có lệnh nào với cấu hình này.</td></tr>'}</tbody>`;
    $('tradesWrap').hidden = false;
    status.textContent = `Xong: ${tfBars.length} nến ${tf}, ${trades.length} lệnh (${symbol}).`;
  } catch (err) {
    const e = err as DataError;
    status.textContent = e.message + (e.attempts?.length ? ` (${e.attempts.slice(0, 2).join('; ')})` : '');
  } finally {
    running = false;
    btn.disabled = false;
  }
});
