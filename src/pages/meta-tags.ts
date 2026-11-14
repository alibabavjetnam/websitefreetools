import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { area, input, select, button, bindCopy, dk, el, privacyNote, val, onChange } from '../lib/devkit';

mountLayout({ activeTool: 'meta-tags' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="workspace" style="margin-top:24px">
    <div class="panel">
      ${input('title', T('title', 'Tiêu đề trang'), { value: T('s.title', 'Công cụ online miễn phí — WFTools') })}
      <p class="note" id="tlen"></p>
      ${area('desc', T('desc', 'Mô tả'), { rows: 3, mono: false, value: T('s.desc', 'Hơn 200 công cụ online miễn phí: tạo mã QR, nén ảnh, gộp PDF, đổi đơn vị. Chạy ngay trên trình duyệt, không cần cài đặt.') })}
      <p class="note" id="dlen"></p>
      ${input('url', T('url', 'Địa chỉ trang (canonical)'), { type: 'url', value: 'https://websitefreetools.com/' })}
      ${input('image', T('image', 'Ảnh chia sẻ (1200×630)'), { type: 'url', value: 'https://websitefreetools.com/og.png' })}
      <div class="form-grid">
        ${input('site', T('site', 'Tên website'), { value: 'WFTools' })}
        ${input('twitter', T('twitter', 'Tài khoản X (Twitter)'), { ph: '@wftools' })}
        ${select('type', T('type', 'Loại trang'), [['website', 'website'], ['article', 'article'], ['product', 'product']], 'website')}
        ${input('lang', T('lang', 'Ngôn ngữ'), { value: 'vi_VN' })}
        ${select('robots', 'Robots', [['index, follow', 'index, follow'], ['noindex, nofollow', 'noindex, nofollow'], ['index, nofollow', 'index, nofollow']], 'index, follow')}
        ${input('color', T('color', 'Màu thanh trình duyệt'), { type: 'color', value: '#0d6efd' })}
      </div>
    </div>
    <div class="panel">
      <span class="field-label">${T('google', 'Xem trước trên Google')}</span>
      <div class="mt-serp"><div class="mt-url" id="p-url"></div><div class="mt-title" id="p-title"></div><div class="mt-desc" id="p-desc"></div></div>
      <span class="field-label">${T('social', 'Xem trước khi chia sẻ (Facebook, Zalo, X)')}</span>
      <div class="mt-card"><div class="mt-img" id="p-img"></div><div class="mt-body"><div class="mt-host" id="p-host"></div><div class="mt-ctitle" id="p-ctitle"></div><div class="mt-cdesc" id="p-cdesc"></div></div></div>
      ${area('out', escapeHtml(T('code', 'Mã dán vào thẻ <head>')), { rows: 14, ro: true })}
      <div class="row">${button('copy', dk.copy(), true)}</div>
    </div>
  </div>
  ${privacyNote()}
`;
const a = (s: string) => escapeHtml(s.trim());
function run(): void {
  const t = val('title'), d = val('desc'), u = val('url'), img = val('image');
  const lines = [
    `<title>${a(t)}</title>`, `<meta name="description" content="${a(d)}" />`, `<link rel="canonical" href="${a(u)}" />`, `<meta name="robots" content="${a(val('robots'))}" />`,
    `<meta name="theme-color" content="${a(val('color'))}" />`, '', `<!-- Open Graph -->`, `<meta property="og:type" content="${a(val('type'))}" />`, `<meta property="og:title" content="${a(t)}" />`,
    `<meta property="og:description" content="${a(d)}" />`, `<meta property="og:url" content="${a(u)}" />`, img ? `<meta property="og:image" content="${a(img)}" />` : '', val('site') ? `<meta property="og:site_name" content="${a(val('site'))}" />` : '',
    `<meta property="og:locale" content="${a(val('lang'))}" />`, '', `<!-- X (Twitter) -->`, `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}" />`,
    val('twitter') ? `<meta name="twitter:site" content="${a(val('twitter'))}" />` : '', `<meta name="twitter:title" content="${a(t)}" />`, `<meta name="twitter:description" content="${a(d)}" />`, img ? `<meta name="twitter:image" content="${a(img)}" />` : '',
  ].filter((x, i, arr) => x !== '' || (arr[i - 1] !== '' && i > 0));
  (el<HTMLTextAreaElement>('out')).value = lines.join('\n');
  const tl = [...t].length, dl = [...d].length;
  el('tlen').textContent = T('tLen', '{n} ký tự — nên từ 30 đến 60 để Google không cắt bớt.').replace('{n}', String(tl));
  el('tlen').className = tl > 60 || tl < 30 ? 'note error-text' : 'note ok-text';
  el('dlen').textContent = T('dLen', '{n} ký tự — nên từ 110 đến 160.').replace('{n}', String(dl));
  el('dlen').className = dl > 160 || dl < 110 ? 'note error-text' : 'note ok-text';
  let host = u;
  try { host = new URL(u).hostname; } catch { /* để nguyên */ }
  el('p-url').textContent = u;
  el('p-title').textContent = tl > 60 ? [...t].slice(0, 58).join('') + '…' : t;
  el('p-desc').textContent = dl > 160 ? [...d].slice(0, 157).join('') + '…' : d;
  el('p-host').textContent = host.toUpperCase();
  el('p-ctitle').textContent = t;
  el('p-cdesc').textContent = d;
  el('p-img').style.backgroundImage = img ? `url("${img.replace(/"/g, '')}")` : '';
}
onChange(['title', 'desc', 'url', 'image', 'site', 'twitter', 'type', 'lang', 'robots', 'color'], run, 80);
bindCopy('copy', () => val('out'));
run();
