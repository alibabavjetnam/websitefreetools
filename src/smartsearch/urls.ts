/** Xử lý URL và phân loại cho Smart Search Crawler (phần thuần, không đụng DOM) */

export type EngineId = 'google' | 'bing' | 'baidu';
export const ENGINES: { id: EngineId; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'bing', label: 'Bing' },
  { id: 'baidu', label: 'Baidu' },
];

export interface Hit { engine: EngineId; query: string; position: number }
export interface CrawlData {
  ok: boolean; error?: string; finalUrl?: string; status?: number; kind?: string;
  title?: string; description?: string; lang?: string; published?: string; author?: string; image?: string; siteName?: string;
  text?: string; textLength?: number; prices?: string[]; contentHash?: string;
  product?: { name: string; brand: string; sku: string; price: string | number; currency: string; rating: string | number };
  headings?: string[]; images?: string[]; links?: { url: string; text: string }[]; tables?: string[][][]; note?: string;
}
export interface UrlRow {
  id: number; url: string; normalized: string; domain: string; title: string; snippet: string;
  hits: Hit[]; category: string; selected: boolean;
  status: 'new' | 'crawling' | 'done' | 'error'; crawl?: CrawlData; relevance?: number;
}

const TRACKING = /^(utm_[a-z]+|gclid|fbclid|msclkid|yclid|mc_cid|mc_eid|igshid|ref|ref_src|spm|_ga|gad_source|gbraid|wbraid|srsltid)$/i;

/** Chuẩn hóa để nhận ra URL trùng: bỏ #hash, tham số theo dõi, "www.", dấu / cuối; chữ thường ở tên miền */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    const keep: [string, string][] = [];
    u.searchParams.forEach((v, k) => { if (!TRACKING.test(k)) keep.push([k, v]); });
    keep.sort((a, b) => a[0].localeCompare(b[0]));
    u.search = '';
    keep.forEach(([k, v]) => u.searchParams.append(k, v));
    let s = u.toString();
    if (u.pathname !== '/' || u.search) s = s.replace(/\/(?=(\?|$))/, '');
    else s = s.replace(/\/$/, '');
    return s.replace(/^http:\/\//, 'https://');
  } catch { return ''; }
}

export function domainOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

export const SOURCE_TYPES = ['Chính phủ', 'Giáo dục', 'Báo chí', 'Thương mại', 'Mạng xã hội', 'Bách khoa', 'Khác'] as const;
const NEWS = /(^|\.)(vnexpress|tuoitre|thanhnien|dantri|vietnamnet|zingnews|znews|nld|laodong|cafef|cafebiz|vov|baochinhphu|nhandan|tienphong|24h|kenh14|soha|bbc|cnn|reuters|nytimes|theguardian|bloomberg|forbes|techcrunch|theverge|xinhuanet|people|chinadaily|sina|163|qq|sohu|ifeng|nikkei|asahi|nhk|mainichi)\./i;
const SHOP = /(^|\.)(shopee|lazada|tiki|sendo|thegioididong|dienmayxanh|fptshop|cellphones|hoanghamobile|nguyenkim|amazon|ebay|aliexpress|alibaba|taobao|tmall|jd|walmart|bestbuy|rakuten|pinduoduo|1688)\./i;
const SOCIAL = /(^|\.)(facebook|youtube|tiktok|twitter|x|instagram|reddit|linkedin|pinterest|weibo|zhihu|tieba|douyin|bilibili|quora)\./i;
const WIKI = /(^|\.)(wikipedia|wikimedia|baike\.baidu|britannica|wikihow)\./i;

export function classifyDomain(domain: string): string {
  const d = domain.toLowerCase();
  if (/\.(gov|mil)(\.[a-z]{2})?$/.test(d) || /\.gov\.[a-z]{2}$/.test(d)) return 'Chính phủ';
  if (/\.(edu)(\.[a-z]{2})?$/.test(d) || /\.ac\.[a-z]{2}$/.test(d) || /\.edu\.[a-z]{2}$/.test(d)) return 'Giáo dục';
  if (WIKI.test(d + '.')) return 'Bách khoa';
  if (SOCIAL.test(d + '.')) return 'Mạng xã hội';
  if (SHOP.test(d + '.')) return 'Thương mại';
  if (NEWS.test(d + '.')) return 'Báo chí';
  return 'Khác';
}

/* ---------- Phân nhóm ý định (không cần AI) ---------- */
export const CATEGORIES = ['Sản phẩm', 'Khuyến mãi', 'Bài viết', 'Tin tức', 'Nghiên cứu', 'Doanh nghiệp', 'Dịch vụ', 'Văn bản', 'Hình ảnh', 'Tuyển dụng'] as const;

const RULES: [string, RegExp][] = [
  ['Khuyến mãi', /khuyến mãi|giảm giá|voucher|mã giảm|coupon|sale|ưu đãi|discount|优惠|促销/i],
  ['Tuyển dụng', /tuyển dụng|việc làm|tìm việc|lương|job|hiring|career|招聘/i],
  ['Văn bản', /luật|nghị định|thông tư|nghị quyết|quyết định|công văn|văn bản|pháp lệnh|law|regulation|法规/i],
  ['Tin tức', /tin tức|thời sự|hôm nay|mới nhất|news|breaking|新闻/i],
  ['Nghiên cứu', /nghiên cứu|báo cáo|luận văn|luận án|khoa học|số liệu|thống kê|research|study|paper|report|论文|研究/i],
  ['Hình ảnh', /hình ảnh|ảnh |wallpaper|images?|pictures?|图片/i],
  ['Doanh nghiệp', /công ty|doanh nghiệp|tập đoàn|company|corporation|企业|公司/i],
  ['Dịch vụ', /dịch vụ|vận chuyển|sửa chữa|lắp đặt|thuê|service|安装|服务/i],
  ['Sản phẩm', /giá|mua |bán |máy |điện thoại|laptop|iphone|samsung|xe |review|đánh giá|so sánh|price|buy|best|购买|价格/i],
];
export function ruleCategory(q: string): string {
  for (const [name, re] of RULES) if (re.test(q)) return name;
  return 'Bài viết';
}

/** Gợi ý từ khóa phụ theo nhóm khi không dùng AI */
export function ruleQueries(keyword: string, category: string): { q: string; purpose: string }[] {
  const k = keyword.trim();
  const out: { q: string; purpose: string }[] = [];
  const add = (q: string, purpose: string) => { if (!out.some((x) => x.q.toLowerCase() === q.toLowerCase()) && q.toLowerCase() !== k.toLowerCase()) out.push({ q, purpose }); };
  if (category === 'Sản phẩm' || category === 'Khuyến mãi') {
    add(`${k} giá tốt`, 'Tìm nơi bán'); add(`đánh giá ${k}`, 'Tìm bài đánh giá'); add(`so sánh ${k}`, 'Tìm bài so sánh'); add(`khuyến mãi ${k}`, 'Tìm khuyến mãi'); add(`thông số kỹ thuật ${k}`, 'Tìm thông số');
  } else if (category === 'Văn bản') {
    add(`${k} pdf`, 'Tìm file văn bản'); add(`${k} hướng dẫn thi hành`, 'Tìm hướng dẫn'); add(`${k} toàn văn`, 'Tìm toàn văn');
  } else if (category === 'Nghiên cứu') {
    add(`${k} báo cáo`, 'Tìm báo cáo'); add(`${k} pdf`, 'Tìm tài liệu'); add(`${k} số liệu thống kê`, 'Tìm số liệu');
  } else if (category === 'Tin tức') {
    add(`${k} mới nhất`, 'Tin mới'); add(`${k} phân tích`, 'Tìm bài phân tích');
  } else {
    add(`${k} là gì`, 'Tìm định nghĩa'); add(`${k} hướng dẫn`, 'Tìm hướng dẫn'); add(`${k} kinh nghiệm`, 'Tìm kinh nghiệm');
  }
  return out.slice(0, 5);
}

/* ---------- Chấm điểm liên quan (không cần AI) ---------- */
const STOP = new Set(['và', 'của', 'là', 'the', 'a', 'an', 'of', 'in', 'to', 'for', 'và', 'các', 'những', 'cho', 'với']);
export function tokens(q: string): string[] {
  return q.toLowerCase().split(/[\s,.;:!?()"'/\\|-]+/).filter((t) => t.length > 1 && !STOP.has(t));
}
/** 0–100: tỉ lệ từ khóa xuất hiện trong tiêu đề/mô tả/nội dung, cộng điểm cho thứ hạng cao */
export function relevanceScore(keyword: string, row: UrlRow): number {
  const toks = tokens(keyword);
  if (!toks.length) return 0;
  const hay = `${row.title} ${row.snippet} ${row.crawl?.title || ''} ${row.crawl?.description || ''} ${(row.crawl?.text || '').slice(0, 3000)}`.toLowerCase();
  const found = toks.filter((t) => hay.includes(t)).length / toks.length;
  const best = Math.min(...row.hits.map((h) => h.position), 100);
  const rank = (1 - Math.min(best, 100) / 100) * 0.3;
  const multi = Math.min(new Set(row.hits.map((h) => h.engine)).size - 1, 2) * 0.05;
  return Math.round(Math.min(1, found * 0.65 + rank + multi) * 100);
}

export function parseManualUrls(text: string): string[] {
  return [...new Set((text.match(/https?:\/\/[^\s"'<>]+/gi) || []).map((u) => u.replace(/[),.;]+$/, '')))];
}

export function domainCounts(rows: UrlRow[]): [string, number][] {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(r.domain, (m.get(r.domain) || 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
