/**
 * Smart Search Crawler — trang ẩn tại /hidden/search/.
 * Từ khóa → (AI phân loại) → tìm Google/Bing/Baidu → danh sách URL → crawl → phân tích → xuất.
 * Việc tìm và crawl do bộ chạy Node.js trên máy người dùng (public/hidden/search/helper/wft-crawler.mjs) thực hiện.
 */
import { loadScript } from '../lib/cdn';
import { loadXlsx } from '../lib/excel-common';
import {
  askAi, parseJsonLoose, setManualHandler, digestPrompt, DEFAULT_MODELS, INTENT_SYSTEM, REPORT_SYSTEM, TABLE_SYSTEM,
  type AiConfig, type PageDigest, type Provider,
} from '../smartsearch/ai';
import { Helper, type SearchPage } from '../smartsearch/helper';
import {
  ENGINES, SOURCE_TYPES, classifyDomain, domainCounts, domainOf, normalizeUrl, parseManualUrls, relevanceScore, ruleCategory, ruleQueries,
  type EngineId, type UrlRow,
} from '../smartsearch/urls';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Thiếu phần tử #${id}`);
  return el as T;
};
function wrap(t: HTMLElement, h: number): HTMLElement {
  const d = document.createElement('div');
  d.className = 'tablewrap';
  d.style.maxHeight = `${h}px`;
  d.style.margin = '8px 0';
  d.append(t);
  return d;
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  kids.forEach((k) => e.append(k));
  return e;
}
const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): boolean { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

/* ------------------------------------------------------------------ trạng thái ---- */
const helper = new Helper();
let rows: UrlRow[] = [];
const byNorm = new Map<string, UrlRow>();
let nextId = 1;
let keyword = '';
let category = '';
let report = '';
let aiTable: { columns: string[]; rows: string[][] } | null = null;
let searchAbort: AbortController | null = null;
let crawlAbort: AbortController | null = null;

/* ------------------------------------------------------------------ 1. bộ chạy trên máy ---- */
function setHelperUi(): void {
  const badge = $('hStatus');
  const info = helper.info;
  if (info) {
    badge.textContent = 'Đã kết nối';
    badge.className = 'badge ok';
    const b = info.browser;
    $('hDetail').textContent = `cổng ${helper.port} · Node ${info.node} · mặc định: ${info.defaultMode === 'browser' ? 'trình duyệt' : 'nhanh'} · chế độ trình duyệt: ${b.available ? 'sẵn sàng' : 'chưa dùng được'}`;
  } else {
    badge.textContent = 'Chưa kết nối';
    badge.className = 'badge err';
    $('hDetail').textContent = 'Hãy chạy bộ chạy trên máy (xem hướng dẫn) rồi bấm "Kiểm tra kết nối".';
  }
}
async function connectHelper(): Promise<boolean> {
  $('hStatus').textContent = 'Đang tìm...';
  $('hStatus').className = 'badge warn';
  const saved = Number(store.get('wft.ss.port')) || undefined;
  const info = await helper.connect(saved);
  if (info) store.set('wft.ss.port', String(helper.port));
  setHelperUi();
  return !!info;
}

interface ZipLike { file(name: string, data: Uint8Array, o: { binary: boolean }): unknown; generate(o: { type: 'blob' }): Blob }
async function downloadZip(): Promise<void> {
  const names = ['wft-crawler.mjs', 'package.json', 'start-windows.bat', 'start-windows-browser.bat', 'HUONG-DAN.txt'];
  const btn = $<HTMLButtonElement>('btnZip');
  btn.disabled = true;
  try {
    await loadScript('/vendor/pizzip.min.js', 'PizZip');
    const PizZip = (window as unknown as Record<string, new () => ZipLike>).PizZip;
    const zip = new PizZip();
    for (const n of names) {
      const res = await fetch(`/hidden/search/helper/${n}`);
      if (!res.ok) throw new Error(`Không tải được ${n}.`);
      zip.file(`wft-crawler/${n}`, new Uint8Array(await res.arrayBuffer()), { binary: true });
    }
    saveBlob(zip.generate({ type: 'blob' }), 'wft-crawler.zip');
  } catch (e) {
    alert((e as Error).message || 'Không tạo được file zip.');
  } finally { btn.disabled = false; }
}
function saveBlob(blob: Blob, name: string): void {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ------------------------------------------------------------------ 2. AI ---- */
const AI_HELP: Record<Provider, string> = {
  none: 'Không dùng AI: vẫn tìm, crawl, lọc, thống kê và xuất Excel đầy đủ. Phân loại ý định và gợi ý từ khóa phụ theo quy tắc có sẵn. Chỉ phần "AI tổng hợp báo cáo / trích bảng" cần AI.',
  manual: 'Hoàn toàn miễn phí, dùng được cả ChatGPT, Claude và Gemini: trang soạn sẵn câu lệnh, bạn dán vào bản web của AI (đăng nhập tài khoản miễn phí), rồi dán câu trả lời lại. Mỗi bước AI cần một lần dán.',
  gemini: 'Gemini có gói API miễn phí (có giới hạn số lần gọi mỗi phút/ngày). Tạo khóa tại aistudio.google.com/apikey rồi dán vào ô khóa. Khóa chỉ gửi tới Google, không qua máy chủ nào khác.',
  openai: 'Dùng cho ChatGPT API (cần khóa, trả phí theo mức dùng) hoặc Ollama chạy trên máy bạn (miễn phí, không cần khóa): đặt địa chỉ http://localhost:11434/v1, mô hình ví dụ llama3.2, và khởi động Ollama với biến OLLAMA_ORIGINS=*.',
  claude: 'Claude API tính phí theo mức dùng, không có gói miễn phí qua API. Muốn dùng Claude miễn phí hãy chọn "Dán tay" rồi mở claude.ai.',
};
function aiConfig(): AiConfig {
  return {
    provider: $<HTMLSelectElement>('aiProvider').value as Provider,
    key: $<HTMLInputElement>('aiKey').value,
    model: $<HTMLInputElement>('aiModel').value.trim(),
    baseUrl: $<HTMLInputElement>('aiBase').value.trim(),
  };
}
function syncAiUi(fromChange: boolean): void {
  const p = $<HTMLSelectElement>('aiProvider').value as Provider;
  const needsApi = p === 'gemini' || p === 'openai' || p === 'claude';
  ['lblKey', 'lblModel', 'lblBase', 'lblRemember', 'btnAiTest'].forEach((id) => { $(id).style.display = needsApi ? '' : 'none'; });
  $('aiHelp').textContent = AI_HELP[p];
  if (needsApi && fromChange) {
    const d = DEFAULT_MODELS[p];
    $<HTMLInputElement>('aiModel').value = d.model;
    $<HTMLInputElement>('aiBase').value = d.baseUrl;
  }
  $('lblKey').style.display = p === 'openai' ? '' : needsApi ? '' : 'none';
}
function saveAi(): void {
  const c = aiConfig();
  const remember = $<HTMLInputElement>('aiRemember').checked;
  store.set('wft.ss.ai', JSON.stringify({ provider: c.provider, model: c.model, baseUrl: c.baseUrl, remember, key: remember ? c.key : '' }));
}
function loadAi(): void {
  try {
    const s = JSON.parse(store.get('wft.ss.ai') || 'null');
    if (s && typeof s === 'object') {
      $<HTMLSelectElement>('aiProvider').value = s.provider || 'none';
      syncAiUi(true);
      if (s.model) $<HTMLInputElement>('aiModel').value = s.model;
      if (s.baseUrl) $<HTMLInputElement>('aiBase').value = s.baseUrl;
      $<HTMLInputElement>('aiKey').value = s.key || '';
      $<HTMLInputElement>('aiRemember').checked = !!s.remember;
      return;
    }
  } catch { /* dùng mặc định */ }
  syncAiUi(true);
}

/** Hộp dán tay: trả về câu trả lời người dùng dán vào */
function manualDialog(system: string, user: string): Promise<string> {
  const dlg = $<HTMLDialogElement>('manualDlg');
  const prompt = `${system}\n\n=====\n\n${user}`;
  $<HTMLTextAreaElement>('mdPrompt').value = prompt;
  $<HTMLTextAreaElement>('mdAnswer').value = '';
  const kb = Math.round(prompt.length / 1000);
  $('mdSize').textContent = `${kb.toLocaleString('vi-VN')} nghìn ký tự${kb > 40 ? ' — khá dài, nếu AI báo quá dài hãy giảm "Số trang đưa cho AI"' : ''}`;
  return new Promise((resolve, reject) => {
    const done = (ok: boolean) => {
      dlg.close();
      $('mdOk').onclick = null; $('mdCancel').onclick = null;
      if (ok && $<HTMLTextAreaElement>('mdAnswer').value.trim()) resolve($<HTMLTextAreaElement>('mdAnswer').value);
      else reject(new Error('Chưa có câu trả lời của AI.'));
    };
    $('mdOk').onclick = () => done(true);
    $('mdCancel').onclick = () => done(false);
    $('mdCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(prompt); $('mdCopy').textContent = 'Đã sao chép ✓'; }
      catch { $<HTMLTextAreaElement>('mdPrompt').select(); $('mdCopy').textContent = 'Hãy nhấn Ctrl+C'; }
    };
    $('mdCopy').textContent = 'Sao chép câu lệnh';
    dlg.showModal();
  });
}

/* ------------------------------------------------------------------ 3. tìm kiếm ---- */
function enginesOn(): EngineId[] {
  return [...document.querySelectorAll<HTMLInputElement>('.eng-on')].filter((c) => c.checked).map((c) => c.dataset.e as EngineId);
}
function queryList(): string[] {
  const main = $<HTMLInputElement>('q').value.trim();
  const extra = $<HTMLTextAreaElement>('queries').value.split('\n').map((s) => s.trim()).filter(Boolean);
  const list = extra.length && main && extra[0].toLowerCase() !== main.toLowerCase() ? [main, ...extra] : extra.length ? extra : main ? [main] : [];
  return [...new Map(list.map((q) => [q.toLowerCase(), q])).values()];
}

async function runIntent(): Promise<void> {
  const k = $<HTMLInputElement>('q').value.trim();
  if (!k) { $('searchMsg').textContent = 'Hãy nhập từ khóa trước.'; return; }
  const cfg = aiConfig();
  let cat = ruleCategory(k);
  let intents: string[] = [];
  let qs = ruleQueries(k, cat);
  if (cfg.provider !== 'none') {
    $('searchMsg').textContent = 'AI đang phân tích ý định...';
    try {
      const out = parseJsonLoose<{ category?: string; intents?: string[]; queries?: { q: string; purpose?: string }[] }>(await askAi(cfg, INTENT_SYSTEM, `Từ khóa: ${k}`, { json: true }));
      if (out.category) cat = out.category;
      if (Array.isArray(out.intents)) intents = out.intents.map(String).slice(0, 5);
      if (Array.isArray(out.queries) && out.queries.length) qs = out.queries.filter((x) => x && x.q).map((x) => ({ q: String(x.q), purpose: String(x.purpose || '') })).slice(0, 6);
    } catch (e) {
      $('searchMsg').textContent = `AI chưa dùng được (${(e as Error).message}) — dùng quy tắc có sẵn.`;
    }
  }
  category = cat;
  const badge = $('catBadge');
  badge.hidden = false;
  badge.textContent = `Nhóm: ${cat}`;
  $('intentList').textContent = intents.length ? `Ý định: ${intents.join(' · ')}` : '';
  $<HTMLTextAreaElement>('queries').value = [k, ...qs.map((x) => x.q)].join('\n');
  if (!$('searchMsg').textContent?.startsWith('AI chưa')) $('searchMsg').textContent = `Đã gợi ý ${qs.length} từ khóa phụ. Sửa hoặc xóa dòng nào không cần.`;
}

function addRow(url: string, title: string, snippet: string): UrlRow | null {
  const norm = normalizeUrl(url);
  if (!norm) return null;
  let row = byNorm.get(norm);
  if (!row) {
    const domain = domainOf(norm);
    row = { id: nextId++, url, normalized: norm, domain, title, snippet, hits: [], category: classifyDomain(domain), selected: true, status: 'new' };
    byNorm.set(norm, row);
    rows.push(row);
  } else {
    if (!row.title && title) row.title = title;
    if (!row.snippet && snippet) row.snippet = snippet;
  }
  return row;
}
function addHit(engine: EngineId, query: string, item: { url: string; title: string; snippet: string; position: number }): boolean {
  const row = addRow(item.url, item.title, item.snippet);
  if (!row) return false;
  if (!row.hits.some((h) => h.engine === engine && h.query === query)) row.hits.push({ engine, query, position: item.position });
  return true;
}

interface EngState { got: number; target: number; state: string; kind: '' | 'ok' | 'warn' | 'err' }
const engState = new Map<EngineId, EngState>();
function renderEngProg(): void {
  const box = $('engProg');
  box.textContent = '';
  for (const e of ENGINES) {
    const s = engState.get(e.id);
    if (!s) continue;
    const bar = el('div', { className: 'bar' }, el('i'));
    (bar.firstChild as HTMLElement).style.width = `${Math.min(100, (s.got / Math.max(1, s.target)) * 100)}%`;
    const info = el('div', {}, el('span', { className: `badge ${s.kind}` }, `${s.got}/${s.target}`), ` ${s.state}`);
    box.append(el('div', { className: 'eng' }, el('b', {}, e.label), el('div', {}, info, bar)));
  }
}
const delayFor = (e: EngineId) => (e === 'google' ? 2500 + Math.random() * 2000 : e === 'baidu' ? 1500 + Math.random() * 1500 : 700 + Math.random() * 700);

async function searchEngine(engine: EngineId, queries: string[], nMain: number, nExtra: number, hl: string, gl: string, time: string, signal: AbortSignal): Promise<void> {
  const mode = $<HTMLSelectElement>('searchMode').value as 'auto' | 'fast' | 'browser';
  const target = queries.reduce((sum, _q, i) => sum + (i === 0 ? nMain : nExtra), 0);
  const st: EngState = { got: 0, target, state: 'đang chờ...', kind: '' };
  engState.set(engine, st);
  renderEngProg();
  for (let qi = 0; qi < queries.length; qi++) {
    const q = queries[qi];
    const want = qi === 0 ? nMain : nExtra;
    let got = 0, offset = 0, empty = 0;
    const seen = new Set<string>();
    for (let page = 0; page < 14 && got < want; page++) {
      if (signal.aborted) { st.state = 'đã dừng'; st.kind = 'warn'; renderEngProg(); return; }
      st.state = `đang tìm "${q}" (từ vị trí ${offset + 1})...`;
      renderEngProg();
      let res: SearchPage;
      try { res = await helper.search({ engine, query: q, offset, hl, gl, time, mode }, signal); }
      catch (e) {
        if (signal.aborted) { st.state = 'đã dừng'; st.kind = 'warn'; renderEngProg(); return; }
        st.state = (e as Error).message; st.kind = 'err'; renderEngProg(); return;
      }
      if (!res.ok) { st.state = res.error || 'Lỗi không rõ.'; st.kind = 'err'; renderEngProg(); return; }
      const fresh = res.results.filter((r) => !seen.has(r.url));
      fresh.forEach((r) => seen.add(r.url));
      if (!fresh.length) {
        if (res.blocked) {
          st.state = `${res.blocked} ${mode === 'browser' || helper.info?.defaultMode === 'browser' ? '' : 'Hãy chạy bộ chạy ở chế độ Trình duyệt (start-windows-browser.bat) và chọn "Trình duyệt" ở mục 1.'}`;
          st.kind = 'err'; renderEngProg(); return;
        }
        if (++empty >= 1) break;
      }
      for (const r of fresh) { if (got >= want) break; if (addHit(engine, q, r)) { got++; st.got++; } }
      offset += engine === 'google' ? (res.pageSize || 10) : Math.max(res.results.length, 1);
      renderEngProg();
      renderUrls();
      if (got < want) await sleep(delayFor(engine));
    }
  }
  st.state = st.got >= st.target ? 'xong' : st.got ? `xong (công cụ tìm kiếm chỉ trả về ${st.got} kết quả)` : 'không có kết quả';
  st.kind = st.got >= st.target ? 'ok' : st.got ? 'warn' : 'err';
  renderEngProg();
}

async function runSearch(): Promise<void> {
  const qs = queryList();
  if (!qs.length) { $('searchMsg').textContent = 'Hãy nhập từ khóa.'; return; }
  const engines = enginesOn();
  if (!engines.length) { $('searchMsg').textContent = 'Hãy chọn ít nhất một web tìm kiếm.'; return; }
  if (!helper.info && !(await connectHelper())) {
    $('searchMsg').textContent = 'Chưa kết nối bộ chạy trên máy. Xem hướng dẫn ở mục 1.';
    return;
  }
  keyword = qs[0];
  if (!category) category = ruleCategory(keyword);
  rows = []; byNorm.clear(); nextId = 1; report = ''; aiTable = null;
  $('reportOut').textContent = ''; $('tableOut').textContent = ''; $('statsOut').textContent = '';
  engState.clear();
  const [hl, gl] = $<HTMLSelectElement>('market').value.split('|');
  const time = $<HTMLSelectElement>('timeRange').value;
  const nMain = Math.min(100, Math.max(10, Number($<HTMLInputElement>('nMain').value) || 100));
  const nExtra = Math.min(100, Math.max(10, Number($<HTMLInputElement>('nExtra').value) || 20));
  searchAbort = new AbortController();
  $<HTMLButtonElement>('btnSearch').disabled = true;
  $<HTMLButtonElement>('btnStopSearch').disabled = false;
  $('searchMsg').textContent = 'Đang tìm...';
  try {
    await Promise.all(engines.map((e) => searchEngine(e, qs, nMain, nExtra, hl, gl, time, searchAbort!.signal)));
  } finally {
    $<HTMLButtonElement>('btnSearch').disabled = false;
    $<HTMLButtonElement>('btnStopSearch').disabled = true;
  }
  rows.forEach((r) => { r.relevance = relevanceScore(keyword, r); });
  renderUrls();
  const total = [...engState.values()].reduce((s, x) => s + x.got, 0);
  $('searchMsg').textContent = searchAbort.signal.aborted ? `Đã dừng. Có ${total} kết quả.` : `Xong: ${total} kết quả, ${rows.length} URL không trùng.`;
  saveHistory(qs);
}

/* ------------------------------------------------------------------ 4. bảng URL ---- */
let renderQueued = false;
function renderUrls(): void {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; drawUrls(); });
}
const filtered = (): UrlRow[] => {
  const t = $<HTMLInputElement>('fText').value.trim().toLowerCase();
  const e = $<HTMLSelectElement>('fEngine').value;
  const ty = $<HTMLSelectElement>('fType').value;
  const sel = $<HTMLInputElement>('fSel').checked;
  return rows.filter((r) => (!t || `${r.title} ${r.snippet} ${r.domain}`.toLowerCase().includes(t)) && (!e || r.hits.some((h) => h.engine === e)) && (!ty || r.category === ty) && (!sel || r.selected));
};
const expanded = new Set<number>();
function drawUrls(): void {
  const body = $('urlBody');
  const list = filtered();
  const frag = document.createDocumentFragment();
  for (const r of list.slice(0, 600)) {
    const cb = el('input', { type: 'checkbox', checked: r.selected });
    cb.addEventListener('change', () => { r.selected = cb.checked; drawStats(); });
    const tags = el('td');
    if (!r.hits.length) tags.append(el('span', { className: 'tag' }, 'thêm tay'));
    for (const e of ENGINES) {
      const h = r.hits.filter((x) => x.engine === e.id);
      if (h.length) tags.append(el('span', { className: 'tag', title: `${e.label}: hạng ${h.map((x) => x.position).join(', ')}` }, `${e.label[0]}${Math.min(...h.map((x) => x.position))}`));
    }
    const link = el('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.title || r.url);
    const tdT = el('td', { className: 't' }, link);
    if (r.snippet) tdT.append(el('div', { className: 'sn' }, r.snippet.slice(0, 180)));
    const c = r.crawl;
    if (c && c.ok) {
      const bits = [c.published ? `Ngày: ${c.published.slice(0, 10)}` : '', c.product?.price ? `Giá: ${c.product.price} ${c.product.currency}` : c.prices?.[0] ? `Giá: ${c.prices[0]}` : '', c.textLength ? `${c.textLength.toLocaleString('vi-VN')} ký tự` : ''].filter(Boolean).join(' · ');
      const more = el('a', { href: '#', textContent: expanded.has(r.id) ? ' [ẩn]' : ' [chi tiết]' });
      more.addEventListener('click', (ev) => { ev.preventDefault(); if (!expanded.delete(r.id)) expanded.add(r.id); drawUrls(); });
      tdT.append(el('div', { className: 'sn' }, bits, more));
    }
    const statusText = r.status === 'done' ? (c?.ok ? 'xong' : 'lỗi') : r.status === 'crawling' ? 'đang tải...' : r.status === 'error' ? 'lỗi' : '';
    const tdS = el('td', { className: `st-${r.status === 'done' && !c?.ok ? 'error' : r.status}`, title: c && !c.ok ? c.error || '' : '' }, statusText);
    frag.append(el('tr', {}, el('td', {}, cb), el('td', {}, String(r.id)), tags, el('td', {}, r.domain), tdT, el('td', {}, r.category), el('td', {}, r.relevance === undefined ? '' : String(r.relevance)), tdS));
    if (c && expanded.has(r.id)) {
      const parts = [c.description && `Mô tả: ${c.description}`, c.author && `Tác giả: ${c.author}`, c.lang && `Ngôn ngữ: ${c.lang}`, c.headings?.length && `Tiêu đề mục:\n- ${c.headings.slice(0, 12).join('\n- ')}`, c.text && `Nội dung:\n${c.text.slice(0, 1200)}`].filter(Boolean).join('\n');
      frag.append(el('tr', { className: 'detail' }, el('td'), el('td', { colSpan: 7 }, parts || c.note || 'Không có nội dung.')));
    }
  }
  body.textContent = '';
  body.append(frag);
  drawStats();
}
function drawStats(): void {
  const total = [...engState.values()].reduce((s, x) => s + x.got, 0) || rows.reduce((s, r) => s + r.hits.length, 0);
  const per = ENGINES.map((e) => `${e.label} ${rows.filter((r) => r.hits.some((h) => h.engine === e.id)).length}`).join(' · ');
  const sel = rows.filter((r) => r.selected).length;
  const crawled = rows.filter((r) => r.status === 'done' && r.crawl?.ok).length;
  const box = $('urlStats');
  box.textContent = '';
  if (!rows.length) { box.append(el('span', { className: 'muted' }, 'Chưa có kết quả.')); return; }
  box.append(el('span', {}, `${total} lượt kết quả · `), el('b', {}, `${rows.length} URL không trùng`), el('span', {}, ` (${per}) · đã chọn ${sel} · đã crawl ${crawled}`));
  const types = $<HTMLSelectElement>('fType');
  if (types.options.length <= 1) SOURCE_TYPES.forEach((t) => types.append(el('option', { value: t }, t)));
}

function addManualUrls(): void {
  const urls = parseManualUrls($<HTMLTextAreaElement>('manualUrls').value);
  const before = rows.length;
  for (const u of urls) addRow(u, '', '');
  if (!keyword) keyword = $<HTMLInputElement>('q').value.trim();
  rows.forEach((r) => { if (r.relevance === undefined) r.relevance = relevanceScore(keyword, r); });
  $<HTMLTextAreaElement>('manualUrls').value = '';
  renderUrls();
  $('crawlMsg').textContent = rows.length > before ? `Đã thêm ${rows.length - before} URL mới.` : 'Không có URL mới (trùng hoặc không hợp lệ).';
}

/* ------------------------------------------------------------------ 5. crawl ---- */
async function runCrawl(): Promise<void> {
  const todo = rows.filter((r) => r.selected && r.status !== 'done');
  if (!todo.length) { $('crawlMsg').textContent = 'Không có URL nào cần crawl (hãy chọn URL ở mục 4).'; return; }
  if (!helper.info && !(await connectHelper())) { $('crawlMsg').textContent = 'Chưa kết nối bộ chạy trên máy. Xem hướng dẫn ở mục 1.'; return; }
  const mode = $<HTMLSelectElement>('crawlMode').value as 'quick' | 'full';
  const par = Math.min(8, Math.max(1, Number($<HTMLInputElement>('crawlPar').value) || 4));
  crawlAbort = new AbortController();
  const signal = crawlAbort.signal;
  $<HTMLButtonElement>('btnCrawl').disabled = true;
  $<HTMLButtonElement>('btnStopCrawl').disabled = false;
  let done = 0, i = 0;
  const bar = $('crawlBar');
  const update = () => { bar.style.width = `${(done / todo.length) * 100}%`; $('crawlMsg').textContent = `${done}/${todo.length}`; };
  update();
  const worker = async () => {
    while (i < todo.length && !signal.aborted) {
      const r = todo[i++];
      r.status = 'crawling';
      renderUrls();
      try {
        r.crawl = await helper.crawl(r.url, mode, signal);
        r.status = 'done';
      } catch (e) {
        if (signal.aborted) { r.status = 'new'; break; }
        r.crawl = { ok: false, error: (e as Error).message };
        r.status = 'error';
      }
      r.relevance = relevanceScore(keyword || $<HTMLInputElement>('q').value, r);
      done++;
      update();
      renderUrls();
    }
  };
  try { await Promise.all(Array.from({ length: par }, worker)); }
  finally {
    $<HTMLButtonElement>('btnCrawl').disabled = false;
    $<HTMLButtonElement>('btnStopCrawl').disabled = true;
    rows.filter((r) => r.status === 'crawling').forEach((r) => { r.status = 'new'; });
    renderUrls();
  }
  const ok = rows.filter((r) => r.status === 'done' && r.crawl?.ok).length;
  $('crawlMsg').textContent = signal.aborted ? `Đã dừng (${done}/${todo.length}).` : `Xong: ${ok} trang lấy được nội dung, ${done - todo.filter((r) => r.status === 'done' && r.crawl?.ok).length} trang lỗi.`;
}

/* ------------------------------------------------------------------ 6. phân tích ---- */
const crawledRows = (): UrlRow[] => rows.filter((r) => r.selected && r.status === 'done' && r.crawl?.ok && r.crawl.kind === 'html');

function priceOf(r: UrlRow): string {
  const c = r.crawl;
  if (!c) return '';
  if (c.product && c.product.price !== '' && c.product.price !== undefined) return `${c.product.price} ${c.product.currency || ''}`.trim();
  return c.prices?.[0] || '';
}
function showStats(): void {
  const list = crawledRows();
  const box = $('statsOut');
  box.textContent = '';
  if (!rows.length) { box.append(el('div', { className: 'note' }, 'Chưa có dữ liệu. Hãy tìm kiếm trước.')); return; }
  const sel = rows.filter((r) => r.selected);
  const dom = domainCounts(sel).slice(0, 10);
  const types = new Map<string, number>();
  sel.forEach((r) => types.set(r.category, (types.get(r.category) || 0) + 1));
  const groups = new Map<string, UrlRow[]>();
  list.forEach((r) => { const h = r.crawl!.contentHash; if (h) groups.set(h, [...(groups.get(h) || []), r]); });
  const dups = [...groups.values()].filter((g) => g.length > 1);
  const table = (head: string[], body: (string | number)[][]): HTMLElement => {
    const t = el('table', {}, el('thead', {}, el('tr', {}, ...head.map((h) => el('th', {}, h)))), el('tbody', {}, ...body.map((b) => el('tr', {}, ...b.map((c) => el('td', {}, String(c)))))));
    return wrap(t, 260);
  };
  box.append(
    el('h3', {}, 'Tên miền xuất hiện nhiều nhất'), table(['Tên miền', 'Số URL'], dom),
    el('h3', {}, 'Loại nguồn'), table(['Loại', 'Số URL'], [...types.entries()].sort((a, b) => b[1] - a[1])),
  );
  const priced = list.map((r) => ({ r, p: priceOf(r) })).filter((x) => x.p);
  if (priced.length) box.append(el('h3', {}, `Giá nhìn thấy (${priced.length} trang)`), table(['Tên miền', 'Giá', 'Tiêu đề'], priced.slice(0, 40).map((x) => [x.r.domain, x.p, (x.r.crawl?.title || x.r.title).slice(0, 80)])));
  box.append(el('div', { className: 'note small' }, dups.length ? `Phát hiện ${dups.length} nhóm trang có nội dung trùng nhau (ví dụ: ${dups[0].map((x) => x.domain).join(', ')}).` : list.length ? 'Không thấy nội dung trùng lặp giữa các trang đã crawl.' : 'Chưa crawl trang nào — thống kê giá và trùng lặp cần bước 5.'));
}

function pageDigests(limit: number): PageDigest[] {
  const n = Math.min(60, Math.max(3, Number($<HTMLInputElement>('aiPages').value) || 25));
  const per = n > 25 ? 600 : limit;
  return crawledRows().sort((a, b) => (b.relevance || 0) - (a.relevance || 0)).slice(0, n).map((r) => ({
    id: r.id, url: r.url, title: r.crawl?.title || r.title, published: r.crawl?.published,
    text: `${r.crawl?.description || ''} ${r.crawl?.text || ''}`.trim().slice(0, per), prices: r.crawl?.prices?.slice(0, 4), product: r.crawl?.product,
  }));
}
function mdToHtml(md: string): string {
  const urlOf = new Map(rows.map((r) => [r.id, r.url]));
  const inline = (s: string) => escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[(\d+)\]/g, (m, n: string) => { const u = urlOf.get(Number(n)); return u && /^https?:\/\//.test(u) ? `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">[${n}]</a>` : m; });
  const out: string[] = [];
  let inList = false;
  for (const line of md.split('\n')) {
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (li) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (inList) { out.push('</ul>'); inList = false; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) out.push(`<h3>${inline(h[2])}</h3>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
}
async function runAnalysis(kind: 'report' | 'table'): Promise<void> {
  const cfg = aiConfig();
  if (cfg.provider === 'none') { $('anaMsg').textContent = 'Hãy chọn một AI ở mục 2 (hoặc "Dán tay" để dùng miễn phí).'; return; }
  const pages = pageDigests(1200);
  if (!pages.length) { $('anaMsg').textContent = 'Chưa có trang nào được crawl. Hãy làm bước 5 trước.'; return; }
  const k = keyword || $<HTMLInputElement>('q').value.trim();
  const extra = `Nhóm nội dung: ${category || ruleCategory(k)}.`;
  const buttons = [$<HTMLButtonElement>('btnReport'), $<HTMLButtonElement>('btnTable')];
  buttons.forEach((b) => { b.disabled = true; });
  $('anaMsg').textContent = `AI đang xử lý ${pages.length} trang...`;
  try {
    if (kind === 'report') {
      report = await askAi(cfg, REPORT_SYSTEM, digestPrompt(k, pages, extra));
      $('reportOut').innerHTML = mdToHtml(report);
    } else {
      const out = parseJsonLoose<{ columns?: unknown[]; rows?: unknown[][] }>(await askAi(cfg, TABLE_SYSTEM, digestPrompt(k, pages, extra), { json: true }));
      if (!Array.isArray(out.columns) || !Array.isArray(out.rows)) throw new Error('AI trả về bảng sai cấu trúc. Hãy thử lại.');
      aiTable = { columns: out.columns.map(String), rows: out.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])) };
      drawAiTable();
    }
    $('anaMsg').textContent = 'Xong.';
  } catch (e) {
    $('anaMsg').textContent = (e as Error).message;
  } finally { buttons.forEach((b) => { b.disabled = false; }); }
}
function drawAiTable(): void {
  const box = $('tableOut');
  box.textContent = '';
  if (!aiTable) return;
  const urlOf = new Map(rows.map((r) => [r.id, r.url]));
  const t = el('table', {}, el('thead', {}, el('tr', {}, ...aiTable.columns.map((c) => el('th', {}, c)))));
  const tb = el('tbody');
  aiTable.rows.forEach((r) => {
    const tr = el('tr');
    aiTable!.columns.forEach((_c, i) => {
      const v = r[i] ?? '';
      const id = Number(/\d+/.exec(v)?.[0]);
      const u = i === aiTable!.columns.length - 1 ? urlOf.get(id) : undefined;
      tr.append(u && /^https?:\/\//.test(u) ? el('td', {}, el('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, v)) : el('td', {}, v));
    });
    tb.append(tr);
  });
  t.append(tb);
  box.append(el('h3', {}, 'Bảng dữ liệu do AI trích xuất'), wrap(t, 320), el('div', { className: 'note warn small' }, 'Dữ liệu do AI trích từ nội dung đã crawl, có thể sai sót — hãy đối chiếu với nguồn (cột cuối) trước khi dùng.'));
}

/* ------------------------------------------------------------------ xuất dữ liệu ---- */
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
async function exportXlsx(): Promise<void> {
  if (!rows.length) { $('anaMsg').textContent = 'Chưa có dữ liệu để xuất.'; return; }
  const X = await loadXlsx();
  const wb = X.utils.book_new();
  const engLabel = (r: UrlRow) => r.hits.map((h) => `${h.engine}#${h.position}`).join(', ');
  const urlRows = [['STT', 'URL', 'Tên miền', 'Tiêu đề', 'Mô tả (kết quả tìm kiếm)', 'Web tìm kiếm / hạng', 'Loại nguồn', 'Điểm liên quan', 'Đã chọn', 'Trạng thái crawl']]
    .concat(rows.map((r) => [r.id, r.url, r.domain, r.title, r.snippet, engLabel(r), r.category, r.relevance ?? '', r.selected ? 'x' : '', r.status === 'done' ? (r.crawl?.ok ? 'xong' : r.crawl?.error || 'lỗi') : ''] as unknown as string[]));
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(urlRows), 'URL');
  const cr = rows.filter((r) => r.crawl?.ok);
  if (cr.length) {
    const head = ['STT', 'URL', 'Tiêu đề trang', 'Mô tả', 'Ngày đăng', 'Tác giả', 'Giá', 'Thương hiệu', 'Ngôn ngữ', 'Số ký tự', 'Nội dung (đầu trang)'];
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([head, ...cr.map((r) => [r.id, r.crawl!.finalUrl || r.url, r.crawl!.title || '', r.crawl!.description || '', r.crawl!.published || '', r.crawl!.author || '', priceOf(r), r.crawl!.product?.brand || '', r.crawl!.lang || '', r.crawl!.textLength || 0, (r.crawl!.text || '').slice(0, 3000)])]), 'Nội dung');
  }
  if (aiTable) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([aiTable.columns, ...aiTable.rows]), 'Bảng AI');
  if (report) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(report.split('\n').map((l) => [l])), 'Báo cáo');
  const data = X.write(wb, { type: 'array', bookType: 'xlsx', compression: true });
  saveBlob(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `smart-search-${stamp()}.xlsx`);
}
function exportJson(): void {
  if (!rows.length) { $('anaMsg').textContent = 'Chưa có dữ liệu để xuất.'; return; }
  const data = { keyword, category, exportedAt: new Date().toISOString(), urls: rows.map((r) => ({ id: r.id, url: r.url, domain: r.domain, title: r.title, snippet: r.snippet, hits: r.hits, type: r.category, relevance: r.relevance, selected: r.selected, crawl: r.crawl })), table: aiTable, report };
  saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `smart-search-${stamp()}.json`);
}
function exportMd(): void {
  if (!report) { $('anaMsg').textContent = 'Chưa có báo cáo AI. Bấm "AI tổng hợp báo cáo" trước.'; return; }
  const sources = rows.filter((r) => report.includes(`[${r.id}]`)).map((r) => `[${r.id}] ${r.crawl?.title || r.title || r.domain} — ${r.url}`).join('\n');
  saveBlob(new Blob([`# ${keyword}\n\n${report}\n\n## Nguồn\n\n${sources}\n`], { type: 'text/markdown' }), `bao-cao-${stamp()}.md`);
}

/* ------------------------------------------------------------------ 7. lịch sử ---- */
interface Hist { ts: number; keyword: string; queries: string[]; rows: { u: string; t: string; s: string; h: [string, string, number][] }[] }
const HKEY = 'wft.ss.history';
const readHistory = (): Hist[] => { try { const v = JSON.parse(store.get(HKEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
function saveHistory(queries: string[]): void {
  if (!rows.length) return;
  let list = [{ ts: Date.now(), keyword, queries, rows: rows.map((r) => ({ u: r.url, t: r.title.slice(0, 120), s: r.snippet.slice(0, 120), h: r.hits.map((h) => [h.engine, h.query, h.position] as [string, string, number]) })) }, ...readHistory()].slice(0, 10);
  while (list.length && !store.set(HKEY, JSON.stringify(list))) list = list.slice(0, -1);
  drawHistory();
}
function drawHistory(): void {
  const box = $('histOut');
  const list = readHistory();
  box.textContent = '';
  if (!list.length) { box.textContent = 'Chưa có.'; return; }
  list.forEach((h, idx) => {
    const open = el('button', { type: 'button' }, 'Mở lại');
    open.addEventListener('click', () => loadHistory(h));
    const del = el('button', { type: 'button' }, 'Xóa');
    del.addEventListener('click', () => { const l = readHistory(); l.splice(idx, 1); store.set(HKEY, JSON.stringify(l)); drawHistory(); });
    box.append(el('div', { className: 'hist' }, el('b', {}, h.keyword), el('span', { className: 'muted' }, `${new Date(h.ts).toLocaleString('vi-VN')} · ${h.rows.length} URL`), open, del));
  });
}
function loadHistory(h: Hist): void {
  rows = []; byNorm.clear(); nextId = 1; report = ''; aiTable = null; engState.clear();
  keyword = h.keyword;
  $<HTMLInputElement>('q').value = h.keyword;
  $<HTMLTextAreaElement>('queries').value = h.queries.join('\n');
  for (const r of h.rows) for (const [e, q, p] of r.h) addHit(e as EngineId, q, { url: r.u, title: r.t, snippet: r.s, position: p });
  rows.forEach((r) => { r.relevance = relevanceScore(keyword, r); });
  $('engProg').textContent = ''; $('reportOut').textContent = ''; $('tableOut').textContent = '';
  renderUrls();
  $('searchMsg').textContent = `Đã mở lại kết quả của "${h.keyword}" (chưa có nội dung crawl, bấm Crawl nếu cần).`;
}

/* ------------------------------------------------------------------ khởi động ---- */
function init(): void {
  setManualHandler(manualDialog);
  loadAi();
  $('aiProvider').addEventListener('change', () => { syncAiUi(true); saveAi(); });
  ['aiKey', 'aiModel', 'aiBase', 'aiRemember'].forEach((id) => $(id).addEventListener('change', saveAi));
  $('btnAiTest').addEventListener('click', async () => {
    $('aiMsg').textContent = 'Đang thử...';
    try { const r = await askAi(aiConfig(), 'Trả lời ngắn gọn.', 'Chỉ trả lời đúng một từ: OK'); $('aiMsg').textContent = `Kết nối được. AI trả lời: ${r.trim().slice(0, 40)}`; }
    catch (e) { $('aiMsg').textContent = (e as Error).message; }
  });
  $('btnConnect').addEventListener('click', () => { void connectHelper(); });
  $('btnZip').addEventListener('click', () => { void downloadZip(); });
  $('btnIntent').addEventListener('click', () => { void runIntent(); });
  $('btnSearch').addEventListener('click', () => { void runSearch(); });
  $('q').addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') void runSearch(); });
  $('q').addEventListener('input', () => { category = ''; });
  $('btnStopSearch').addEventListener('click', () => searchAbort?.abort());
  ['fText', 'fEngine', 'fType', 'fSel'].forEach((id) => $(id).addEventListener('input', renderUrls));
  $('btnSelAll').addEventListener('click', () => { filtered().forEach((r) => { r.selected = true; }); renderUrls(); });
  $('btnSelNone').addEventListener('click', () => { rows.forEach((r) => { r.selected = false; }); renderUrls(); });
  $('btnSelTop').addEventListener('click', () => { rows.forEach((r) => { r.selected = r.hits.some((h) => h.position > 0 && h.position <= 20); }); renderUrls(); });
  $('btnSelRel').addEventListener('click', () => { rows.forEach((r) => { r.selected = (r.relevance ?? 0) >= 50; }); renderUrls(); });
  $('btnAddUrls').addEventListener('click', addManualUrls);
  $('btnCrawl').addEventListener('click', () => { void runCrawl(); });
  $('btnStopCrawl').addEventListener('click', () => crawlAbort?.abort());
  $('btnStats').addEventListener('click', showStats);
  $('btnReport').addEventListener('click', () => { void runAnalysis('report'); });
  $('btnTable').addEventListener('click', () => { void runAnalysis('table'); });
  $('btnXlsx').addEventListener('click', () => { exportXlsx().catch((e: Error) => { $('anaMsg').textContent = e.message; }); });
  $('btnJson').addEventListener('click', exportJson);
  $('btnMd').addEventListener('click', exportMd);
  drawHistory();
  drawStats();
  void connectHelper();
}
init();
