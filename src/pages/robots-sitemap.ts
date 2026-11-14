import { mountLayout } from '../layout';
import { $, setupTabs, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { area, input, select, check, button, bindCopy, bindDownload, dk, el, privacyNote, val, setVal, checked, onChange } from '../lib/devkit';

mountLayout({ activeTool: 'robots-sitemap' });
const T = pageText();
const BOTS: [string, string][] = [['GPTBot', 'OpenAI GPTBot'], ['ClaudeBot', 'Anthropic ClaudeBot'], ['Google-Extended', 'Google-Extended (Gemini)'], ['CCBot', 'Common Crawl'], ['PerplexityBot', 'PerplexityBot'], ['Bytespider', 'Bytespider (ByteDance)']];

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="robots">robots.txt</button>
    <button type="button" role="tab" data-tab="sitemap">sitemap.xml</button>
  </div>
  <div class="workspace" style="margin-top:0">
    <div class="panel">
      <div data-panel="robots">
        ${select('def', T('def', 'Mặc định cho mọi bot'), [['allow', T('d.allow', 'Cho phép thu thập toàn bộ')], ['deny', T('d.deny', 'Chặn toàn bộ (site đang xây dựng)')]], 'allow')}
        ${area('dis', T('dis', 'Thư mục không cho thu thập (mỗi dòng một đường dẫn)'), { rows: 4, value: '/admin/\n/cart/\n/search?' })}
        ${area('alw', T('alw', 'Ngoại lệ được phép (không bắt buộc)'), { rows: 2, value: '' })}
        <div class="field"><span class="field-label">${T('ai', 'Chặn bot thu thập dữ liệu cho AI')}</span><div class="row">${BOTS.map(([k, l]) => check('b-' + k, l)).join('')}</div></div>
        ${input('delay', T('delay', 'Crawl-delay (giây, không bắt buộc)'), { type: 'number', attrs: 'min="0" max="60"' })}
        ${input('smurl', T('smurl', 'Địa chỉ sitemap'), { type: 'url', value: 'https://example.com/sitemap.xml' })}
      </div>
      <div data-panel="sitemap" hidden>
        ${input('base', T('base', 'Tên miền'), { type: 'url', value: 'https://example.com' })}
        ${area('urls', T('urls', 'Danh sách trang (mỗi dòng một đường dẫn hoặc URL đầy đủ)'), { rows: 9, value: '/\n/gioi-thieu\n/san-pham\n/san-pham/ao-thun\n/lien-he' })}
        <div class="form-grid">
          ${select('freq', 'changefreq', [['', T('none', '(không ghi)')], ['daily', 'daily'], ['weekly', 'weekly'], ['monthly', 'monthly'], ['yearly', 'yearly']], 'weekly')}
          ${check('lastmod', T('lastmod', 'Ghi ngày cập nhật (hôm nay)'), true)}
          ${check('prio', T('prio', 'Tự đặt độ ưu tiên theo độ sâu'), true)}
        </div>
      </div>
    </div>
    <div class="panel">
      ${area('out', dk.output(), { rows: 22, ro: true })}
      <div class="row">${button('copy', dk.copy(), true)}${button('dl', dk.download())}</div>
      <p class="note" id="hint"></p>
    </div>
  </div>
  ${privacyNote()}
`;
let tab = 'robots';
const lines = (id: string) => val(id).split('\n').map((x) => x.trim()).filter(Boolean);
function robots(): string {
  const out = ['User-agent: *'];
  if (val('def') === 'deny') out.push('Disallow: /');
  else {
    const d = lines('dis');
    out.push(...(d.length ? d.map((x) => `Disallow: ${x}`) : ['Disallow:']));
    out.push(...lines('alw').map((x) => `Allow: ${x}`));
  }
  if (Number(val('delay')) > 0) out.push(`Crawl-delay: ${Number(val('delay'))}`);
  for (const [k] of BOTS) if (checked('b-' + k)) out.push('', `User-agent: ${k}`, 'Disallow: /');
  if (val('smurl')) out.push('', `Sitemap: ${val('smurl')}`);
  return out.join('\n') + '\n';
}
function sitemap(): string {
  const base = val('base').replace(/\/+$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const items = lines('urls').map((p) => {
    const loc = /^https?:/i.test(p) ? p : base + (p.startsWith('/') ? p : '/' + p);
    let path = '/';
    try { path = new URL(loc).pathname; } catch { /* giữ */ }
    const depth = path.split('/').filter(Boolean).length;
    const tags = [`    <loc>${escapeHtml(encodeURI(decodeURI(loc)))}</loc>`];
    if (checked('lastmod')) tags.push(`    <lastmod>${today}</lastmod>`);
    if (val('freq')) tags.push(`    <changefreq>${val('freq')}</changefreq>`);
    if (checked('prio')) tags.push(`    <priority>${Math.max(0.3, 1 - depth * 0.2).toFixed(1)}</priority>`);
    return `  <url>\n${tags.join('\n')}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</urlset>\n`;
}
function run(): void {
  setVal('out', tab === 'robots' ? robots() : sitemap());
  el('hint').textContent = tab === 'robots' ? T('hRobots', 'Đặt file ở gốc tên miền: https://tên-miền/robots.txt. robots.txt chỉ là lời đề nghị, không phải biện pháp bảo mật.') : T('hSitemap', 'Tải file lên gốc tên miền rồi khai báo trong Google Search Console và robots.txt. Một sitemap chứa tối đa 50.000 URL.');
}
el('tool-root').addEventListener('input', run);
el('tool-root').addEventListener('change', run);
bindCopy('copy', () => val('out'));
bindDownload('dl', () => val('out'), () => (tab === 'robots' ? 'robots.txt' : 'sitemap.xml'), tab === 'robots' ? 'text/plain' : 'application/xml');
void onChange;
setupTabs($('#tool-root'), (t) => { tab = t; run(); });
run();
