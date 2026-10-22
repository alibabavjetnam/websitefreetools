import { defineConfig, type Plugin } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Google Analytics (gtag.js): chèn vào <head> của mọi trang khi build (không chèn khi chạy dev).
// Bỏ qua trang ẩn /zzz và trang khách xem menu /m/ (đường link menu chứa dữ liệu sau dấu #).
const GA_ID = 'G-2RCGQ2LS9Y';
const NO_ANALYTICS = ['/zzz/index.html', '/zzz2/index.html', '/m/index.html'];
const analytics = (): Plugin => ({
  name: 'wft-google-analytics',
  apply: 'build',
  transformIndexHtml(html, ctx) {
    const file = (ctx.filename || '').replace(/\\/g, '/');
    if (NO_ANALYTICS.some((p) => file.endsWith(p))) return html;
    return {
      html,
      tags: [
        { tag: 'script', attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}` }, injectTo: 'head' },
        {
          tag: 'script',
          children: `window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '${GA_ID}');`,
          injectTo: 'head',
        },
      ],
    };
  },
});

// Mỗi công cụ là một trang HTML riêng (multi-page app).
// Mọi file trong thư mục tools/ được tự nhận làm trang, không cần khai báo từng trang.
const toolPages = Object.fromEntries(
  readdirSync(resolve(__dirname, 'tools'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => [`tool-${f.replace(/\.html$/, '')}`, resolve(__dirname, 'tools', f)]),
);

// base './' giúp site chạy được cả ở tên miền gốc lẫn trong thư mục con.
export default defineConfig({
  plugins: [analytics()],
  base: '/',
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        privacy: resolve(__dirname, 'chinh-sach-bao-mat.html'),
        terms: resolve(__dirname, 'dieu-khoan.html'),
        // Chính sách bảo mật dạng trang độc lập (dùng làm link Privacy Policy trong cấu hình Google OAuth)
        privacyPolicy: resolve(__dirname, 'privacy-policy.html'),
        // Trang ẩn, không có trong menu: truy cập trực tiếp tại /zzz
        zzz: resolve(__dirname, 'zzz/index.html'),
        zzz2: resolve(__dirname, 'zzz2/index.html'),
        // Trang khách xem thực đơn khi quét mã QR (dữ liệu nằm sau dấu #)
        menu: resolve(__dirname, 'm/index.html'),
        ...toolPages,
      },
    },
  },
});
