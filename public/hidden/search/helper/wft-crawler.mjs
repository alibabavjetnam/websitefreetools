#!/usr/bin/env node
/**
 * WFT Crawler — bộ hỗ trợ chạy trên máy của bạn cho trang Smart Search Crawler (websitefreetools.com/hidden/search/).
 *
 * Cách dùng:  node wft-crawler.mjs        (cần Node.js 18 trở lên, tải tại https://nodejs.org)
 * Giữ cửa sổ này mở, quay lại trang web và làm việc ở ô tìm kiếm như bình thường.
 *
 * Làm gì:
 *  - /search : tìm từ khóa trên Google, Bing, Baidu (từng trang kết quả)
 *  - /crawl  : tải một URL và trích xuất tiêu đề, mô tả, ngày đăng, nội dung chính, giá, bảng...
 * Bảo mật:
 *  - Chỉ lắng nghe 127.0.0.1 (chỉ máy bạn truy cập được), chỉ nhận yêu cầu từ websitefreetools.com và localhost.
 *  - Từ chối tải địa chỉ mạng nội bộ (192.168.x.x, 10.x.x.x, localhost...) để trang web không dò được mạng của bạn.
 *  - Không gửi dữ liệu đi đâu ngoài các trang bạn yêu cầu.
 * Chế độ trình duyệt (tuỳ chọn, để vượt CAPTCHA của Google/Baidu): chạy `npm install` một lần rồi
 * `node wft-crawler.mjs --browser`. Chrome sẽ mở ra để bạn tự giải CAPTCHA khi cần.
 */
import http from 'node:http';
import dns from 'node:dns/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const VERSION = '1.0.0';
const ALLOW_PRIVATE = process.env.WFT_ALLOW_PRIVATE === '1'; // chỉ dùng khi kiểm thử
const ORIGINS = [/^https:\/\/(www\.)?websitefreetools\.com$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MAX_BODY = 3 * 1024 * 1024;

/* ------------------------------------------------------------------ tiện ích văn bản ---- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»' };
export function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(code); } catch { return m; }
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
export const stripTags = (s) => decodeEntities(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ chặn địa chỉ nội bộ ---- */
export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('fc') || v.startsWith('fd')) return true;
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isPrivateIp(m[1]);
    return false;
  }
  return true;
}
async function assertPublicUrl(u) {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Chỉ hỗ trợ địa chỉ http và https.');
  if (ALLOW_PRIVATE) return;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Không tải địa chỉ mạng nội bộ.');
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivateIp)) throw new Error('Không tải địa chỉ mạng nội bộ.');
}

/* ------------------------------------------------------------------ tải trang ---- */
function decodeBody(buf, contentType, headSample) {
  let label = (/charset=["']?([\w-]+)/i.exec(contentType || '') || [])[1];
  if (!label) label = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(headSample) || [])[1];
  try { return new TextDecoder(label || 'utf-8').decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
}

/** Tải một URL: theo chuyển hướng thủ công (kiểm tra từng bước), giới hạn thời gian và dung lượng */
export async function safeFetch(url, { timeout = 15000, headers = {}, maxBytes = MAX_BODY, method = 'GET' } = {}) {
  let current = new URL(url);
  for (let hop = 0; hop < 6; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { method, redirect: 'manual', signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', ...headers } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current);
      continue;
    }
    const type = res.headers.get('content-type') || '';
    if (method === 'HEAD') return { status: res.status, url: current.href, type, text: '', size: 0 };
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      chunks.push(value);
      if (size > maxBytes) { try { await reader.cancel(); } catch { /* bỏ qua */ } break; }
    }
    const buf = Buffer.concat(chunks);
    const isText = /text\/|html|xml|json/i.test(type) || type === '';
    return { status: res.status, url: current.href, type, size, text: isText ? decodeBody(buf, type, buf.subarray(0, 2048).toString('latin1')) : '', truncated: size > maxBytes };
  }
  throw new Error('Trang chuyển hướng quá nhiều lần.');
}

/* ------------------------------------------------------------------ trích xuất nội dung ---- */
const meta = (html, key) => {
  const re1 = new RegExp(`<meta[^>]+(?:name|property|itemprop)=["']${key}["'][^>]*?content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:name|property|itemprop)=["']${key}["']`, 'i');
  const m = re1.exec(html) || re2.exec(html);
  return m ? decodeEntities(m[1]).trim() : '';
};

function readJsonLd(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim());
      const walk = (n) => {
        if (Array.isArray(n)) n.forEach(walk);
        else if (n && typeof n === 'object') { out.push(n); if (n['@graph']) walk(n['@graph']); }
      };
      walk(data);
    } catch { /* JSON-LD hỏng thì bỏ qua */ }
  }
  return out;
}
const typeOf = (o) => [].concat(o['@type'] || []).map(String);
const firstOffer = (o) => { const x = [].concat(o.offers || [])[0]; return x && typeof x === 'object' ? x : null; };

export function extractPrices(text) {
  const found = [];
  const re = /((?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?)\s?(₫|đ|vnđ|vnd|usd|eur|€|\$|¥|円|元)|(\$|€|£|¥)\s?((?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?)/gi;
  let m;
  while ((m = re.exec(text)) && found.length < 12) {
    const s = m[0].replace(/\s+/g, ' ').trim();
    if (!found.includes(s)) found.push(s);
  }
  return found;
}

function mainHtml(html) {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|template|canvas|select|button)\b[\s\S]*?<\/\1>/gi, ' ');
  const pick = (tag) => { const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(h); return m && stripTags(m[1]).length > 200 ? m[1] : ''; };
  const chosen = pick('article') || pick('main') || (/<body\b[^>]*>([\s\S]*)<\/body>/i.exec(h) || [, h])[1];
  return chosen.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, ' ');
}
function htmlToText(h) {
  return decodeEntities(
    h.replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article|\/table|\/ul|\/ol)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, ' '),
  ).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

export function extractPage(html, pageUrl, mode = 'quick') {
  const title = stripTags((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1]) || meta(html, 'og:title');
  const ld = readJsonLd(html);
  const product = ld.find((o) => typeOf(o).includes('Product'));
  const article = ld.find((o) => typeOf(o).some((t) => /Article|NewsArticle|BlogPosting|Report|ScholarlyArticle/.test(t)));
  const org = ld.find((o) => typeOf(o).some((t) => /Organization|LocalBusiness|Corporation/.test(t)));
  const offer = product && firstOffer(product);
  const authorLd = article && article.author ? [].concat(article.author)[0] : null;
  const published = meta(html, 'article:published_time') || (article && article.datePublished) || meta(html, 'datePublished') || ((/<time[^>]+datetime=["']([^"']+)["']/i.exec(html) || [])[1]) || '';
  const body = mainHtml(html);
  const text = htmlToText(body);
  const limit = mode === 'full' ? 20000 : 1500;
  const out = {
    title,
    description: meta(html, 'description') || meta(html, 'og:description'),
    lang: (/<html[^>]+lang=["']([\w-]+)/i.exec(html) || [])[1] || '',
    canonical: ((/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html) || [])[1]) || '',
    published: String(published).slice(0, 40),
    author: (authorLd && (authorLd.name || (typeof authorLd === 'string' ? authorLd : ''))) || meta(html, 'author'),
    image: meta(html, 'og:image'),
    siteName: meta(html, 'og:site_name') || (org && org.name) || '',
    text: text.slice(0, limit),
    textLength: text.length,
    prices: extractPrices(text.slice(0, 20000)),
    contentHash: crypto.createHash('sha1').update(text.slice(0, 5000).toLowerCase().replace(/\s+/g, ' ')).digest('hex').slice(0, 16),
  };
  if (product) {
    out.product = {
      name: product.name || '', brand: (product.brand && (product.brand.name || product.brand)) || '', sku: product.sku || '',
      price: offer ? (offer.price ?? offer.lowPrice ?? '') : '', currency: offer ? offer.priceCurrency || '' : '',
      rating: product.aggregateRating ? product.aggregateRating.ratingValue : '',
    };
  }
  if (mode === 'full') {
    out.headings = [...body.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => `h${m[1]}: ${stripTags(m[2])}`).filter((x) => x.length > 4).slice(0, 60);
    out.images = [...body.matchAll(/<img\b[^>]+src=["']([^"']+)["']/gi)].map((m) => { try { return new URL(decodeEntities(m[1]), pageUrl).href; } catch { return ''; } }).filter((u) => /^https?:/.test(u)).slice(0, 20);
    out.links = [...body.matchAll(/<a\b[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => { try { return { url: new URL(decodeEntities(m[1]), pageUrl).href, text: stripTags(m[2]).slice(0, 80) }; } catch { return null; } }).filter((x) => x && /^https?:/.test(x.url) && x.text).slice(0, 60);
    out.tables = [...body.matchAll(/<table\b[\s\S]*?<\/table>/gi)].slice(0, 5).map((t) => [...t[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].slice(0, 40).map((r) => [...r[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => stripTags(c[1]).slice(0, 120)))).filter((t) => t.length > 1);
  }
  return out;
}

export async function crawlUrl(url, mode = 'quick') {
  const r = await safeFetch(url, { timeout: 18000 });
  if (r.status >= 400) return { ok: false, url, finalUrl: r.url, status: r.status, error: `Trang trả về mã lỗi ${r.status}.` };
  if (!r.text) {
    return { ok: true, url, finalUrl: r.url, status: r.status, kind: /pdf/i.test(r.type) ? 'pdf' : 'other', contentType: r.type, size: r.size, title: '', text: '', note: 'Không phải trang HTML (chỉ ghi nhận địa chỉ).' };
  }
  return { ok: true, url, finalUrl: r.url, status: r.status, kind: 'html', size: r.size, ...extractPage(r.text, r.url, mode) };
}

/* ------------------------------------------------------------------ công cụ tìm kiếm ---- */
const BASES = {
  google: process.env.WFT_BASE_GOOGLE || 'https://www.google.com/search',
  bing: process.env.WFT_BASE_BING || 'https://www.bing.com/search',
  baidu: process.env.WFT_BASE_BAIDU || 'https://www.baidu.com/s',
};
export const PAGE_SIZE = { google: 10, bing: 50, baidu: 50 };

export function buildSearchUrl(engine, query, offset, { hl = 'vi', gl = 'VN', time = '' } = {}) {
  const u = new URL(BASES[engine]);
  const p = u.searchParams;
  if (engine === 'google') {
    p.set('q', query); p.set('hl', hl); p.set('gl', gl); p.set('num', '10'); p.set('start', String(offset)); p.set('pws', '0');
    const tbs = { day: 'qdr:d', week: 'qdr:w', month: 'qdr:m', year: 'qdr:y' }[time];
    if (tbs) p.set('tbs', tbs);
  } else if (engine === 'bing') {
    p.set('q', query); p.set('count', '50'); p.set('first', String(offset + 1)); p.set('setlang', hl); p.set('cc', gl);
    const f = { day: 'ex1:"ez1"', week: 'ex1:"ez2"', month: 'ex1:"ez3"' }[time];
    if (f) p.set('filters', f);
  } else {
    p.set('wd', query); p.set('rn', '50'); p.set('pn', String(offset));
    const days = { day: 1, week: 7, month: 30, year: 365 }[time];
    if (days) { const now = Math.floor(Date.now() / 1000); p.set('gpc', `stf=${now - days * 86400},${now}|stftype=1`); }
  }
  return u.href;
}

function decodeBingUrl(href) {
  try {
    const u = new URL(href);
    if (/bing\.com$/.test(u.hostname) && u.pathname.startsWith('/ck/')) {
      const v = u.searchParams.get('u');
      if (v && v.startsWith('a1')) {
        const raw = Buffer.from(v.slice(2).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        if (/^https?:\/\//.test(raw)) return raw;
      }
    }
  } catch { /* giữ nguyên */ }
  return href;
}

export function parseBing(html) {
  const out = [];
  for (const block of html.split(/<li[^>]+class="[^"]*\bb_algo\b/).slice(1)) {
    const m = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!m) continue;
    const url = decodeBingUrl(decodeEntities(m[1]));
    if (!/^https?:\/\//.test(url)) continue;
    const sn = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block) || /<div[^>]+class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block);
    out.push({ url, title: stripTags(m[2]), snippet: sn ? stripTags(sn[1]) : '' });
  }
  return out;
}

export function parseBaidu(html) {
  const out = [];
  for (const block of html.split(/<div[^>]+class="[^"]*\bc-container\b[^"]*"/).slice(1)) {
    const h3 = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(block);
    if (!h3) continue;
    const a = /<a[^>]+href="([^"]+)"/i.exec(h3[1]);
    const mu = /\bmu="(https?:\/\/[^"]+)"/i.exec(block);
    const url = mu ? decodeEntities(mu[1]) : a ? decodeEntities(a[1]) : '';
    if (!/^https?:\/\//.test(url)) continue;
    const rest = block.replace(h3[0], ' ');
    const sn = /class="[^"]*(?:c-abstract|content-right|c-span-last)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span)>/i.exec(rest);
    out.push({ url, title: stripTags(h3[1]), snippet: stripTags(sn ? sn[1] : rest).slice(0, 300), needsResolve: /baidu\.com\/link\?/.test(url) });
  }
  return out;
}

export function parseGoogle(html) {
  const out = [];
  const re = /<a[^>]+href="([^"]+)"[^>]*>(?:(?!<\/a>)[\s\S])*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let m;
  while ((m = re.exec(html))) {
    let href = decodeEntities(m[1]);
    if (href.startsWith('/url?')) href = new URL(href, 'https://www.google.com').searchParams.get('q') || href;
    if (!/^https?:\/\//.test(href) || /(^|\.)google\.[a-z.]+\//.test(href.replace(/^https?:\/\//, '') + '/')) continue;
    out.push({ url: href, title: stripTags(m[2]), snippet: '' });
  }
  return out;
}
const PARSERS = { google: parseGoogle, bing: parseBing, baidu: parseBaidu };

export function detectBlock(engine, html, finalUrl = '') {
  if (engine === 'google' && (/\/sorry\//.test(finalUrl) || /unusual traffic|enablejs|id="captcha-form"|g-recaptcha/i.test(html))) return 'Google yêu cầu xác minh (CAPTCHA) hoặc đòi bật JavaScript.';
  if (engine === 'baidu' && (/wappass\.baidu\.com|安全验证|captcha/i.test(html + finalUrl))) return 'Baidu yêu cầu xác minh (CAPTCHA).';
  if (engine === 'bing' && /\/challenge|captcha|Please solve the challenge/i.test(html.slice(0, 20000)) && !/b_algo/.test(html)) return 'Bing yêu cầu xác minh (CAPTCHA).';
  return '';
}

async function resolveBaiduLinks(results) {
  let i = 0;
  const worker = async () => {
    while (i < results.length) {
      const r = results[i++];
      if (!r.needsResolve) continue;
      try {
        let cur = r.url;
        for (let hop = 0; hop < 4 && /baidu\.com\/link\?/.test(cur); hop++) {
          const res = await fetch(cur, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': UA } });
          const loc = res.headers.get('location');
          if (!loc) break;
          cur = new URL(loc, cur).href;
        }
        r.url = cur;
      } catch { /* giữ link trung gian */ }
      delete r.needsResolve;
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  results.forEach((r) => delete r.needsResolve);
}

/* ------------------------------------------------------------------ chế độ trình duyệt (tuỳ chọn) ---- */
let browserState = null;
let browserQueue = Promise.resolve();
function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const e = process.env;
  const list = process.platform === 'win32'
    ? [`${e.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`, `${e['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`, `${e.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`, `${e.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`, `${e['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/usr/bin/microsoft-edge'];
  return list.find((p) => p && fs.existsSync(p)) || '';
}
async function loadPuppeteer() {
  try { return (await import('puppeteer-core')).default; } catch { return null; }
}
export async function browserInfo() {
  const chrome = findChrome();
  const pptr = await loadPuppeteer();
  return { available: !!(chrome && pptr), chrome: !!chrome, puppeteer: !!pptr };
}
async function getBrowser() {
  if (browserState && browserState.browser.connected) return browserState;
  const pptr = await loadPuppeteer();
  const chrome = findChrome();
  if (!pptr) throw new Error('Chưa cài puppeteer-core. Mở cửa sổ lệnh trong thư mục này và chạy: npm install');
  if (!chrome) throw new Error('Không tìm thấy Chrome hoặc Edge trên máy. Đặt biến CHROME_PATH trỏ tới file chạy của trình duyệt.');
  const browser = await pptr.launch({ executablePath: chrome, headless: process.env.WFT_HEADLESS === '1', defaultViewport: null, userDataDir: path.join(os.homedir(), '.wft-crawler', 'profile'), args: ['--no-first-run', '--no-default-browser-check', ...(process.env.WFT_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])] });
  const page = await browser.newPage();
  browserState = { browser, page };
  browser.on('disconnected', () => { browserState = null; });
  return browserState;
}
function browserFetch(engine, url) {
  const job = async () => {
    const { page } = await getBrowser();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const started = Date.now();
    let warned = false;
    for (;;) {
      await new Promise((r) => setTimeout(r, 1200));
      const html = await page.content();
      const reason = detectBlock(engine, html, page.url());
      if (!reason) return { html, finalUrl: page.url() };
      if (!warned) { console.log(`\n⚠ ${reason} Hãy giải xác minh trong cửa sổ Chrome vừa mở (chờ tối đa 3 phút)...`); warned = true; }
      if (Date.now() - started > 180000) return { html, finalUrl: page.url() };
    }
  };
  const run = browserQueue.then(job, job);
  browserQueue = run.catch(() => {});
  return run;
}

/** Lấy một trang kết quả tìm kiếm */
export async function searchPage({ engine, query, offset = 0, hl, gl, time, mode = 'fast' }) {
  if (!PARSERS[engine]) throw new Error('Công cụ tìm kiếm không hợp lệ.');
  const url = buildSearchUrl(engine, String(query).slice(0, 300), Math.max(0, Number(offset) || 0), { hl, gl, time });
  let html, finalUrl;
  if (mode === 'browser') {
    ({ html, finalUrl } = await browserFetch(engine, url));
  } else {
    const headers = { 'Accept-Language': `${hl || 'vi'},en;q=0.8` };
    if (engine === 'google') headers.Cookie = 'CONSENT=YES+cb; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg';
    const r = await safeFetch(url, { timeout: 20000, headers });
    html = r.text; finalUrl = r.url;
  }
  const results = PARSERS[engine](html);
  const blocked = detectBlock(engine, html, finalUrl);
  if (engine === 'baidu' && results.length) await resolveBaiduLinks(results);
  results.forEach((r, i) => { r.position = (Number(offset) || 0) + i + 1; });
  return { ok: true, engine, mode, results, blocked: results.length ? '' : blocked, pageSize: PAGE_SIZE[engine] };
}

/* ------------------------------------------------------------------ máy chủ cục bộ ---- */
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.some((re) => re.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Max-Age', '600');
    return true;
  }
  return !origin; // không có Origin = công cụ dòng lệnh trên chính máy này
}
const readJson = (req) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > 1e6) { reject(new Error('Yêu cầu quá lớn.')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('Dữ liệu gửi lên không đúng định dạng JSON.')); } });
  req.on('error', reject);
});

export function createServer({ defaultMode = 'fast' } = {}) {
  return http.createServer(async (req, res) => {
    const allowed = cors(req, res);
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
    if (!allowed) return send(403, { ok: false, error: 'Nguồn truy cập không được phép.' });
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    try {
      if (req.method === 'GET' && pathname === '/ping') return send(200, { ok: true, app: 'wft-crawler', version: VERSION, node: process.version, defaultMode, browser: await browserInfo() });
      if (req.method === 'POST' && pathname === '/search') {
        const b = await readJson(req);
        return send(200, await searchPage({ ...b, mode: b.mode === 'browser' ? 'browser' : defaultMode === 'browser' && b.mode !== 'fast' ? 'browser' : 'fast' }));
      }
      if (req.method === 'POST' && pathname === '/crawl') {
        const b = await readJson(req);
        if (!b.url) return send(400, { ok: false, error: 'Thiếu địa chỉ URL.' });
        try { return send(200, await crawlUrl(String(b.url), b.mode === 'full' ? 'full' : 'quick')); }
        catch (e) { return send(200, { ok: false, url: b.url, error: String(e && e.name === 'TimeoutError' ? 'Quá thời gian chờ.' : (e && e.message) || e) }); }
      }
      return send(404, { ok: false, error: 'Không có chức năng này.' });
    } catch (e) {
      return send(200, { ok: false, error: String((e && e.message) || e) });
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  const defaultMode = args.includes('--browser') || process.env.WFT_BROWSER === '1' ? 'browser' : 'fast';
  const portArg = args.find((a) => /^\d+$/.test(a));
  let port = Number(process.env.PORT || portArg || 8787);
  const server = createServer({ defaultMode });
  const start = (p, tries) => {
    server.once('error', (e) => {
      if (e.code === 'EADDRINUSE' && tries < 10) start(p + 1, tries + 1);
      else { console.error('Không mở được cổng:', e.message); process.exit(1); }
    });
    server.listen(p, '127.0.0.1', async () => {
      const info = await browserInfo();
      console.log(`\n WFT Crawler ${VERSION} đang chạy tại http://127.0.0.1:${p}`);
      console.log(` Chế độ tìm kiếm mặc định: ${defaultMode === 'browser' ? 'TRÌNH DUYỆT (Chrome sẽ mở khi tìm)' : 'NHANH (không cần Chrome)'}`);
      console.log(` Chế độ trình duyệt: ${info.available ? 'sẵn sàng' : `chưa dùng được (${!info.puppeteer ? 'chưa chạy npm install' : 'không tìm thấy Chrome/Edge'})`}`);
      console.log(' Quay lại trang web và làm việc ở ô tìm kiếm. Giữ cửa sổ này mở; đóng cửa sổ (hoặc Ctrl+C) để dừng.\n');
    });
  };
  start(port, 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
