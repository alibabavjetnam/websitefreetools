/**
 * Hậu xử lý sau khi Vite build: sinh các bản ngôn ngữ của mọi trang hiển thị dưới
 * /en, /vi, /ja, /zh, /es kèm thẻ SEO (canonical, hreflang, Open Graph, JSON-LD), file
 * từ điển runtime /language/<lang>.js, trang chủ chuyển hướng theo ngôn ngữ trình duyệt,
 * và sitemap.xml đa ngôn ngữ. Tiếng Anh là mặc định; thiếu bản dịch thì lùi về tiếng Anh.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const SITE = 'https://websitefreetools.com';
const OG_IMAGE = `${SITE}/og-image.png`;
const LANG_META = JSON.parse(readFileSync(resolve(ROOT, 'src/langs.json'), 'utf8'));
const LANGS = Object.keys(LANG_META);
const DEFAULT = 'en';
const LANG_NAME = Object.fromEntries(Object.entries(LANG_META).map(([k, v]) => [k, v.name]));

const dicts = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(readFileSync(resolve(ROOT, 'public/language', `${l}.json`), 'utf8'))]));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Danh sách trang gốc cần đa ngôn ngữ: [đường dẫn tương đối trong dist, loại, khoá] */
function basePages() {
  const pages = [
    { file: 'index.html', type: 'home', key: 'home' },
    { file: 'chinh-sach-bao-mat.html', type: 'static' },
    { file: 'dieu-khoan.html', type: 'static' },
    { file: 'privacy-policy.html', type: 'static' },
  ];
  const toolsDir = resolve(DIST, 'tools');
  if (existsSync(toolsDir)) {
    for (const f of readdirSync(toolsDir).filter((x) => x.endsWith('.html'))) {
      pages.push({ file: `tools/${f}`, type: 'tool', key: f.replace(/\.html$/, '') });
    }
  }
  return pages;
}

/** Lấy nội dung đã dịch cho một trang theo ngôn ngữ (lùi về tiếng Anh, rồi về bản gốc). */
function content(page, lang, base) {
  const d = dicts[lang];
  const en = dicts[DEFAULT];
  const orig = {
    title: (base.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'WFTools',
    desc: (base.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || '',
    h1: (base.match(/<h1[^>]*>([^<]*)<\/h1>/i) || [])[1] || '',
    lead: (base.match(/<p class="lead">([^<]*)<\/p>/i) || [])[1] || '',
  };
  if (page.type === 'home') {
    const h = (d.pages && d.pages.home) || (en.pages && en.pages.home) || {};
    return { title: h.title || orig.title, desc: h.metaDescription || orig.desc, h1: h.h1 || orig.h1, lead: h.lead || orig.lead, type: 'WebSite' };
  }
  if (page.type === 'tool') {
    const tv = (d.tools && d.tools[page.key]) || {};
    const te = (en.tools && en.tools[page.key]) || {};
    const name = tv.name || te.name || orig.h1;
    const desc = tv.desc || te.desc || orig.desc;
    return {
      title: tv.title || (name ? `${name} — WFTools` : orig.title),
      desc: tv.metaDescription || desc || orig.desc,
      h1: tv.h1 || name || orig.h1,
      lead: tv.lead || desc || orig.lead,
      type: 'WebApplication',
    };
  }
  // static: giữ tiêu đề/mô tả gốc, chỉ gắn SEO + chrome dịch
  return { title: orig.title, desc: orig.desc, h1: orig.h1, lead: orig.lead, type: 'WebPage' };
}

function seoHead(page, lang, c) {
  const path = `/${lang}/${page.file === 'index.html' ? '' : page.file}`.replace(/\/index\.html$/, '/');
  const url = SITE + (path === `/${lang}/` ? `/${lang}/` : path);
  const altPath = (l) => `/${l}/${page.file === 'index.html' ? '' : page.file}`.replace(/\/index\.html$/, '/');
  const alts = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${altPath(l)}" />`);
  // x-default trỏ về bản tiếng Anh (ngôn ngữ mặc định)
  alts.push(`<link rel="alternate" hreflang="x-default" href="${SITE}${altPath(DEFAULT)}" />`);

  const ld = [];
  if (c.type === 'WebSite') {
    ld.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'WFTools', url, inLanguage: lang, description: c.desc,
      publisher: { '@type': 'Organization', name: 'WFTools', url: `${SITE}/${lang}/`, logo: `${SITE}/apple-touch-icon.png` } });
  } else if (c.type === 'WebApplication') {
    ld.push({ '@context': 'https://schema.org', '@type': 'WebApplication', name: c.h1, url, description: c.desc,
      applicationCategory: 'UtilitiesApplication', operatingSystem: 'All', inLanguage: lang,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@type': 'Organization', name: 'WFTools', url: `${SITE}/${lang}/` } });
    ld.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'WFTools', item: `${SITE}/${lang}/` },
      { '@type': 'ListItem', position: 2, name: c.h1, item: url },
    ] });
  }
  const tags = [
    `<link rel="canonical" href="${url}" />`,
    ...alts,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="WFTools" />`,
    `<meta property="og:locale" content="${lang}" />`,
    `<meta property="og:title" content="${esc(c.title)}" />`,
    c.desc ? `<meta property="og:description" content="${esc(c.desc)}" />` : '',
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(c.title)}" />`,
    c.desc ? `<meta name="twitter:description" content="${esc(c.desc)}" />` : '',
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<meta name="theme-color" content="#0d6efd" />`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
    `<link rel="manifest" href="/site.webmanifest" />`,
    ld.length ? `<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld)}</script>` : '',
    `<script>window.__WFT_LANG__="${lang}"</script>`,
    `<script src="/language/${lang}.js"></script>`,
    page.type === 'tool' && hasPageStrings(page.key) ? `<script src="/language/${lang}/s/${page.key}.js"></script>` : '',
  ].filter(Boolean);
  return tags.join('\n    ');
}

/**
 * Ghi sẵn bản dịch vào HTML cho các phần tử đánh dấu data-i18n / data-i18n-ph / data-i18n-attr,
 * để người dùng và công cụ tìm kiếm thấy đúng ngôn ngữ ngay cả trước khi JavaScript chạy.
 * (Lúc chạy, applyI18n() trong src/i18n.ts vẫn áp dụng lại cùng từ điển.)
 */
function bakeStrings(html, id, lang) {
  const merged = { ...((dicts[DEFAULT].s && dicts[DEFAULT].s[id]) || {}), ...((dicts[lang].s && dicts[lang].s[id]) || {}) };
  if (!Object.keys(merged).length) return html;
  html = html.replace(/<([a-z0-9]+)([^>]*?)\sdata-i18n="([^"]+)"([^>]*)>([^<]*)<\/\1>/gi, (m, tag, a, key, b, text) =>
    merged[key] != null ? `<${tag}${a} data-i18n="${key}"${b}>${esc(merged[key])}</${tag}>` : m);
  const setAttr = (attrs, name, value) => {
    const re = new RegExp(`(\\s${name}=)"[^"]*"`, 'i');
    return re.test(attrs) ? attrs.replace(re, `$1"${esc(value)}"`) : `${attrs} ${name}="${esc(value)}"`;
  };
  return html.replace(/<([a-z0-9]+)\b([^>]*\sdata-i18n-(?:ph|attr)="[^"]*"[^>]*)>/gi, (m, tag, attrs) => {
    const ph = /\sdata-i18n-ph="([^"]+)"/i.exec(attrs);
    if (ph && merged[ph[1]] != null) attrs = setAttr(attrs, 'placeholder', merged[ph[1]]);
    const at = /\sdata-i18n-attr="([^"]+)"/i.exec(attrs);
    if (at) for (const pair of at[1].split(';')) {
      const [attr, key] = pair.split(':');
      if (attr && key && merged[key.trim()] != null) attrs = setAttr(attrs, attr.trim(), merged[key.trim()]);
    }
    return `<${tag}${attrs}>`;
  });
}

function localizePage(page, lang) {
  const base = readFileSync(resolve(DIST, page.file), 'utf8');
  const c = content(page, lang, base);
  let html = base;
  html = html.replace(/<html([^>]*)\slang="[^"]*"/i, `<html$1 lang="${lang}"`);
  if (dicts[lang].dir === 'rtl') html = html.replace(/<html([^>]*?)(\sdir="[^"]*")?>/i, '<html$1 dir="rtl">');
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(c.title)}</title>`);
  if (/<meta\s+name="description"/i.test(html)) html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(c.desc)}" />`);
  else html = html.replace(/<\/title>/i, `</title>\n    <meta name="description" content="${esc(c.desc)}" />`);
  if (page.type !== 'static') {
    if (c.h1) html = html.replace(/<h1([^>]*)>[^<]*<\/h1>/i, `<h1$1>${esc(c.h1)}</h1>`);
    if (c.lead) html = html.replace(/<p class="lead">[^<]*<\/p>/i, `<p class="lead">${esc(c.lead)}</p>`);
  }
  if (page.type === 'home') {
    const kw = (dicts[lang].pages && dicts[lang].pages.home && dicts[lang].pages.home.keywords) || (dicts[DEFAULT].pages && dicts[DEFAULT].pages.home && dicts[DEFAULT].pages.home.keywords);
    if (kw) html = html.replace(/<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i, `<meta name="keywords" content="${esc(kw)}" />`);
  }
  if (page.type === 'tool') html = bakeStrings(html, page.key, lang);
  html = html.replace(/<\/head>/i, `    ${seoHead(page, lang, c)}\n  </head>`);
  const outDir = resolve(DIST, lang, dirname(page.file) === '.' ? '' : dirname(page.file));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(DIST, lang, page.file), html);
}

function runtimeDicts() {
  for (const l of LANGS) {
    const d = dicts[l];
    const en = dicts[DEFAULT];
    // Nhóm / công cụ chưa dịch sang ngôn ngữ này thì lùi về tiếng Anh (không để lộ tên gốc tiếng Việt)
    const pick = (base, own) => Object.fromEntries(Object.keys({ ...base, ...own }).map((k) => {
      const v = { ...(base[k] || {}), ...(own[k] || {}) };
      return [k, { name: v.name, desc: v.desc }];
    }));
    const trimmed = {
      lang: l, ui: { ...en.ui, ...d.ui },
      groups: pick(en.groups || {}, d.groups || {}),
      tools: pick(en.tools || {}, d.tools || {}),
    };
    writeFileSync(resolve(DIST, 'language', `${l}.js`), `window.__WFT_I18N__=${JSON.stringify(trimmed)};`);
  }
  // Chuỗi nội bộ từng công cụ: dựa trên khung tiếng Anh, mỗi ngôn ngữ ghi đè theo từng khoá.
  const baseS = dicts[DEFAULT].s || {};
  for (const l of LANGS) {
    const langS = dicts[l].s || {};
    for (const id of Object.keys(baseS)) {
      const merged = { ...baseS[id], ...(langS[id] || {}) };
      const dir = resolve(DIST, 'language', l, 's');
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, `${id}.js`), `window.__WFT_S__=${JSON.stringify(merged)};`);
    }
  }
}
/** Công cụ có bộ chuỗi nội bộ (đã dịch Giai đoạn 2) */
function hasPageStrings(id) {
  return !!(dicts[DEFAULT].s && dicts[DEFAULT].s[id]);
}

function rootRedirect() {
  const alts = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}/${l}/" />`).join('\n    ');
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WFTools — Free Online Tools</title>
    <meta name="description" content="Free online tools: QR & barcode, image & PDF tools, converters, calculators and more. Runs in your browser, no sign-up." />
    <link rel="canonical" href="${SITE}/${DEFAULT}/" />
    ${alts}
    <link rel="alternate" hreflang="x-default" href="${SITE}/${DEFAULT}/" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <script>
      (function () {
        var supported = ${JSON.stringify(LANGS)};
        var def = ${JSON.stringify(DEFAULT)};
        var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || def]);
        var pick = def;
        outer: for (var i = 0; i < langs.length; i++) {
          var code = String(langs[i] || '').toLowerCase().split('-')[0];
          for (var j = 0; j < supported.length; j++) { if (supported[j] === code) { pick = code; break outer; } }
        }
        location.replace('/' + pick + '/' + location.search + location.hash);
      })();
    </script>
    <meta http-equiv="refresh" content="0; url=/${DEFAULT}/" />
  </head>
  <body>
    <p style="font-family:system-ui,sans-serif;text-align:center;margin-top:3rem">
      Redirecting… <a href="/${DEFAULT}/">Open WFTools</a>
    </p>
  </body>
</html>
`;
  writeFileSync(resolve(DIST, 'index.html'), html);
}

function sitemap(pages) {
  const today = new Date().toISOString().slice(0, 10);
  const xmlns = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"';
  const entries = [];
  for (const page of pages) {
    if (page.type === 'static' && page.file === 'privacy-policy.html') continue; // trùng với chính sách chính
    for (const lang of LANGS) {
      const path = `/${lang}/${page.file === 'index.html' ? '' : page.file}`.replace(/\/index\.html$/, '/');
      const loc = SITE + path;
      const links = LANGS.map((l) => {
        const p = `/${l}/${page.file === 'index.html' ? '' : page.file}`.replace(/\/index\.html$/, '/');
        return `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${p}" />`;
      }).join('\n');
      const prio = page.type === 'home' ? '1.0' : page.type === 'tool' ? '0.8' : '0.3';
      entries.push(`  <url>\n    <loc>${loc}</loc>\n${links}\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${prio}</priority>\n  </url>`);
    }
  }
  writeFileSync(resolve(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${xmlns}>\n${entries.join('\n')}\n</urlset>\n`);
  return entries.length;
}

function main() {
  const pages = basePages();
  for (const page of pages) {
    if (!existsSync(resolve(DIST, page.file))) continue;
    for (const lang of LANGS) localizePage(page, lang);
  }
  runtimeDicts();
  const n = sitemap(pages);
  rootRedirect();
  // Xoá các trang gốc ở thư mục dist (chỉ giữ bản /<lang>/, trang chuyển hướng gốc, và /zzz /m)
  for (const page of pages) {
    if (page.file === 'index.html') continue; // đã thay bằng trang chuyển hướng
    rmSync(resolve(DIST, page.file), { force: true });
  }
  rmSync(resolve(DIST, 'tools'), { recursive: true, force: true });
  console.log(`[i18n] ${pages.length} trang × ${LANGS.length} ngôn ngữ; sitemap ${n} URL`);
}

main();
