import { writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Chèn thẻ SEO (canonical, Open Graph, Twitter, JSON-LD) vào từng trang tĩnh khi build,
 * và sinh sitemap.xml. Trang noindex (/zzz, /m) được bỏ qua và không vào sitemap.
 */
const SITE = 'https://websitefreetools.com';
const OG_IMAGE = `${SITE}/og-image.png`;

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pick = (html: string, re: RegExp): string => (re.exec(html)?.[1] ?? '').trim();

function canonicalPath(urlPath: string): string {
  let p = urlPath.split('?')[0];
  if (!p.startsWith('/')) p = '/' + p;
  if (p === '/index.html') return '/';
  return p;
}

export function seoPlugin(): Plugin {
  const urls: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  return {
    name: 'wft-seo',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // Ưu tiên tính đường dẫn từ tên file (ổn định giữa các bản Vite), dự phòng dùng ctx.path
        const rel = ctx.filename ? '/' + relative(__dirname, ctx.filename).replace(/\\/g, '/') : ctx.path || '/';
        const path = canonicalPath(rel);
        // Bỏ qua trang ẩn / không index
        if (/^\/(zzz|m)\//.test(rel) || /name="robots"\s+content="[^"]*noindex/i.test(html)) return html;

        const title = pick(html, /<title>([^<]*)<\/title>/i) || 'WFTools';
        const desc = pick(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
        const h1 = pick(html, /<h1[^>]*>([^<]*)<\/h1>/i) || title.split('—')[0].split('|')[0].trim();
        const url = SITE + path;
        const isHome = path === '/';
        const isTool = path.startsWith('/tools/');
        urls.push(url);

        const ld: Record<string, unknown>[] = [];
        if (isHome) {
          ld.push({
            '@context': 'https://schema.org', '@type': 'WebSite', name: 'WFTools', alternateName: 'websitefreetools',
            url: SITE + '/', inLanguage: 'vi', description: desc,
            publisher: { '@type': 'Organization', name: 'WFTools', url: SITE + '/', logo: `${SITE}/apple-touch-icon.png` },
          });
        } else if (isTool) {
          ld.push({
            '@context': 'https://schema.org', '@type': 'WebApplication', name: h1, url, description: desc,
            applicationCategory: 'UtilitiesApplication', operatingSystem: 'All', inLanguage: 'vi',
            browserRequirements: 'Requires JavaScript',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
            publisher: { '@type': 'Organization', name: 'WFTools', url: SITE + '/' },
          });
          ld.push({
            '@context': 'https://schema.org', '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE + '/' },
              { '@type': 'ListItem', position: 2, name: h1, item: url },
            ],
          });
        }

        const tags = [
          `<link rel="canonical" href="${url}" />`,
          `<meta name="robots" content="index, follow, max-image-preview:large" />`,
          `<meta property="og:type" content="website" />`,
          `<meta property="og:site_name" content="WFTools" />`,
          `<meta property="og:locale" content="vi_VN" />`,
          `<meta property="og:title" content="${esc(title)}" />`,
          desc ? `<meta property="og:description" content="${esc(desc)}" />` : '',
          `<meta property="og:url" content="${url}" />`,
          `<meta property="og:image" content="${OG_IMAGE}" />`,
          `<meta property="og:image:width" content="1200" />`,
          `<meta property="og:image:height" content="630" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
          `<meta name="twitter:title" content="${esc(title)}" />`,
          desc ? `<meta name="twitter:description" content="${esc(desc)}" />` : '',
          `<meta name="twitter:image" content="${OG_IMAGE}" />`,
          `<meta name="theme-color" content="#0d6efd" />`,
          `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
          `<link rel="manifest" href="/site.webmanifest" />`,
          ld.length ? `<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld)}</script>` : '',
        ].filter(Boolean).join('\n    ');

        return html.replace('</head>', `    ${tags}\n  </head>`);
      },
    },
    closeBundle() {
      const now = new Date().toISOString();
      const priority = (u: string) => (u === SITE + '/' ? '1.0' : u.includes('/tools/') ? '0.8' : '0.4');
      const body = [...new Set(urls)].sort().map((u) =>
        `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${priority(u)}</priority></url>`).join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
      writeFileSync(resolve(__dirname, 'dist', 'sitemap.xml'), xml);
      // eslint-disable-next-line no-console
      console.log(`[wft-seo] sitemap.xml: ${new Set(urls).size} URL · ${now}`);
    },
  };
}
