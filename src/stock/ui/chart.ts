import { regressionChannel } from '../core/indicators';
import type { ChannelResult, ChartMark, Series, Trade } from '../core/types';

export interface ChartInput {
  series: Series;
  intervalMs: number;
  title: string;
  type: 'candle' | 'line';
  marks: ChartMark[];
  channels: ChannelResult[];
  trades: Trade[];
  resetZoom: boolean;
}

// Màu lấy từ khung .stock-app (biến CSS của công cụ được giới hạn trong khung này)
const css = (name: string) =>
  getComputedStyle(document.querySelector('.stock-app') ?? document.documentElement).getPropertyValue(name).trim();

function timeLabel(t: number, intervalMs: number) {
  const d = new Date(t);
  const p = (x: number) => String(x).padStart(2, '0');
  const date = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
  return intervalMs >= 86_400_000 ? date : `${date} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export class PriceChart {
  private chart: EChartsInstance | null = null;
  private ro: ResizeObserver | null = null;

  constructor(private el: HTMLElement) {}

  get ready() {
    return typeof echarts !== 'undefined';
  }

  render(input: ChartInput) {
    if (!this.ready) {
      this.el.innerHTML = '<p class="chart-empty">Không nạp được thư viện biểu đồ (ECharts). Kiểm tra kết nối mạng rồi tải lại trang.</p>';
      return;
    }
    if (!this.chart) {
      this.el.innerHTML = '';
      this.chart = echarts.init(this.el, null, { renderer: 'canvas' });
      this.ro = new ResizeObserver(() => this.chart?.resize());
      this.ro.observe(this.el);
    }
    const s = input.series;
    const n = s.close.length;
    const cats = s.candles.map((c) => timeLabel(c.t, input.intervalMs));
    const up = css('--up'), down = css('--down'), ink = css('--ink'), muted = css('--muted');
    const line = css('--line'), panel = css('--panel'), accent = css('--accent'), signal = css('--signal');
    const reg = regressionChannel(s.close, 120);
    const narrow = this.el.clientWidth < 640;

    const markPoints = input.marks.map((m) => ({
      coord: [cats[m.idx], m.price],
      value: m.label,
      symbol: 'pin',
      symbolSize: narrow ? 30 : 36,
      symbolRotate: m.side === 'below' ? 180 : 0,
      symbolOffset: [0, m.side === 'below' ? '50%' : '-50%'],
      itemStyle: { color: signal },
      label: { color: css('--signal-ink') || '#ffffff', fontSize: 9, fontWeight: 700, offset: [0, m.side === 'below' ? 4 : -2] },
    }));

    const markLines: unknown[] = [];
    for (const ch of input.channels) {
      if (ch.triggerLevel === null || ch.anchorIdx === null) continue;
      const short = ch.id === 'with' ? 'K1' : 'K2';
      markLines.push({
        yAxis: ch.triggerLevel,
        lineStyle: { color: accent, type: 'dashed', width: 1 },
        label: { formatter: `${short} vào lệnh`, color: accent, position: 'insideEndTop', fontSize: 10 },
      });
      if (ch.stopLoss !== null) {
        markLines.push({
          yAxis: ch.stopLoss,
          lineStyle: { color: down, type: 'dotted', width: 1 },
          label: { formatter: `${short} SL`, color: down, position: 'insideEndBottom', fontSize: 10 },
        });
      }
    }

    const tradePoints = input.trades
      .filter((t) => t.entryIdx < n)
      .map((t) => ({
        value: [cats[t.entryIdx], t.direction === 'BUY' ? s.low[t.entryIdx] : s.high[t.entryIdx]],
        symbol: 'triangle',
        symbolRotate: t.direction === 'BUY' ? 0 : 180,
        symbolOffset: [0, t.direction === 'BUY' ? 10 : -10],
        itemStyle: {
          color: t.result === 'win' ? up : t.result === 'loss' ? down : muted,
          borderColor: t.channel === 'with' ? ink : accent,
          borderWidth: 1,
        },
        trade: t,
      }));

    const volumes = s.candles.map((c) => ({ value: c.v, itemStyle: { color: c.c >= c.o ? up : down, opacity: 0.55 } }));
    const last = s.candles[n - 1];
    const lastColor = last && last.c >= last.o ? up : down;
    const axisLabel = { color: muted, fontSize: 10 };
    const grid = narrow
      ? [{ left: 8, right: 54, top: 54, height: '54%' }, { left: 8, right: 54, top: '68%', height: '9%' }, { left: 8, right: 54, top: '80%', height: '12%' }]
      : [{ left: 12, right: 70, top: 56, height: '56%' }, { left: 12, right: 70, top: '70%', height: '9%' }, { left: 12, right: 70, top: '82%', height: '11%' }];

    const lineSeries = (name: string, data: (number | null)[], color: string, extra: object = {}) => ({
      name, type: 'line', data, showSymbol: false, xAxisIndex: 0, yAxisIndex: 0,
      lineStyle: { width: 1.2, color }, itemStyle: { color }, emphasis: { disabled: true }, ...extra,
    });

    const zoomStart = n > 240 ? Math.round((1 - 240 / n) * 100) : 0;
    const option: Record<string, unknown> = {
      animation: false,
      backgroundColor: 'transparent',
      textStyle: { fontFamily: css('--font') },
      title: {
        text: input.title,
        subtext: last ? `Giá ${last.c}` : '',
        left: 12, top: 4,
        textStyle: { color: ink, fontSize: 13, fontWeight: 600 },
        subtextStyle: { color: lastColor, fontSize: 13, fontWeight: 700 },
        itemGap: 2,
      },
      legend: {
        type: 'scroll', right: 12, top: 6, width: narrow ? '55%' : '70%',
        textStyle: { color: muted, fontSize: 11 }, itemWidth: 14, itemHeight: 8,
        pageIconColor: ink, pageTextStyle: { color: muted },
        selected: { 'Kênh hồi quy': !narrow, 'Khối lượng': true },
      },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'cross', label: { backgroundColor: ink } },
        backgroundColor: panel, borderColor: line, textStyle: { color: ink, fontSize: 12 },
        confine: true,
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid,
      xAxis: [0, 1, 2].map((g) => ({
        type: 'category', data: cats, gridIndex: g, boundaryGap: input.type === 'candle',
        axisLine: { lineStyle: { color: line } }, axisTick: { show: false },
        axisLabel: g === 2 ? axisLabel : { show: false },
      })),
      yAxis: [
        { scale: true, gridIndex: 0, position: 'right', splitLine: { lineStyle: { color: line, opacity: 0.6 } }, axisLabel },
        { scale: true, gridIndex: 1, position: 'right', splitNumber: 1, splitLine: { show: false }, axisLabel: { show: false } },
        { min: 0, max: 100, gridIndex: 2, position: 'right', interval: 30, splitLine: { show: false }, axisLabel },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1, 2], ...(input.resetZoom ? { start: zoomStart, end: 100 } : {}) },
        {
          type: 'slider', xAxisIndex: [0, 1, 2], bottom: 4, height: 18, borderColor: line,
          textStyle: { color: muted, fontSize: 10 }, ...(input.resetZoom ? { start: zoomStart, end: 100 } : {}),
        },
      ],
      series: [
        input.type === 'candle'
          ? {
            name: 'Giá', type: 'candlestick', data: s.candles.map((c) => [c.o, c.c, c.l, c.h]),
            itemStyle: { color: up, color0: down, borderColor: up, borderColor0: down },
            markPoint: { data: markPoints }, markLine: { symbol: 'none', silent: true, data: markLines },
          }
          : {
            name: 'Giá', type: 'line', data: s.close, showSymbol: false, lineStyle: { width: 1.6, color: ink },
            itemStyle: { color: ink }, markPoint: { data: markPoints }, markLine: { symbol: 'none', silent: true, data: markLines },
          },
        lineSeries('EMA20', s.ema20, '#2f9e9e'),
        lineSeries('SMA50', s.sma50, '#d4a017'),
        lineSeries('SMA200', s.sma200, '#6b5bd2', { lineStyle: { width: 1.8, color: '#6b5bd2' } }),
        lineSeries('Bollinger', s.bbUpper, muted, { lineStyle: { width: 1, color: muted, type: 'dashed' } }),
        lineSeries('Bollinger', s.bbLower, muted, { lineStyle: { width: 1, color: muted, type: 'dashed' } }),
        lineSeries('Kênh hồi quy', reg.upper, '#c2549d', { lineStyle: { width: 1, color: '#c2549d', type: 'dotted' } }),
        lineSeries('Kênh hồi quy', reg.mid, '#c2549d', { lineStyle: { width: 1, color: '#c2549d', opacity: 0.7 } }),
        lineSeries('Kênh hồi quy', reg.lower, '#c2549d', { lineStyle: { width: 1, color: '#c2549d', type: 'dotted' } }),
        {
          name: 'Lệnh backtest', type: 'scatter', data: tradePoints, xAxisIndex: 0, yAxisIndex: 0, symbolSize: 9, z: 20,
          tooltip: {
            trigger: 'item',
            formatter: (p: { data: { trade: Trade } }) => {
              const t = p.data.trade;
              const r = t.result === 'win' ? 'Thắng' : t.result === 'loss' ? 'Thua' : 'Đang mở';
              return `${t.channel === 'with' ? 'Kênh 1' : 'Kênh 2'} · ${t.direction === 'BUY' ? 'Mua' : 'Bán'}<br/>Vào ${t.entry}<br/>SL ${t.stopLoss.toPrecision(6)} · TP ${t.takeProfit.toPrecision(6)}<br/>${r}`;
            },
          },
        },
        { name: 'Khối lượng', type: 'bar', data: volumes, xAxisIndex: 1, yAxisIndex: 1 },
        {
          name: 'RSI 14', type: 'line', data: s.rsi, xAxisIndex: 2, yAxisIndex: 2, showSymbol: false,
          lineStyle: { width: 1.2, color: accent }, itemStyle: { color: accent },
          markLine: {
            symbol: 'none', silent: true, label: { show: true, color: muted, fontSize: 10, position: 'insideStartTop' },
            data: [
              { yAxis: 30, lineStyle: { color: up, type: 'dashed', width: 1 } },
              { yAxis: 70, lineStyle: { color: down, type: 'dashed', width: 1 } },
            ],
          },
        },
      ],
    };

    this.chart.setOption(option, { replaceMerge: ['series'] });
  }

  dispose() {
    this.ro?.disconnect();
    this.chart?.dispose();
    this.chart = null;
  }
}
