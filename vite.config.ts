import { defineConfig, type Plugin } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Google Analytics (gtag.js): chèn vào <head> của mọi trang khi build (không chèn khi chạy dev).
// Bỏ qua trang ẩn /zzz và trang khách xem menu /m/ (đường link menu chứa dữ liệu sau dấu #).
const GA_ID = 'G-2RCGQ2LS9Y';
const NO_ANALYTICS = ['/hidden/zzz/index.html', '/m/index.html', '/hidden/cq.html', '/hidden/ls/index.html', '/hidden/search/index.html', '/hidden/co-up/index.html'];
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

// Các chức năng ẩn nằm hết trong thư mục hidden/ (mã nguồn lẫn địa chỉ): /hidden/zzz/, /hidden/cq.html, /hidden/ls/.
// Thêm chức năng ẩn mới: đặt vào hidden/, khai báo trong input bên dưới, thêm vào NO_ANALYTICS và vào trang hidden/ls/index.html.
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
        // Trang ẩn, không có trong menu: truy cập trực tiếp tại /hidden/zzz/
        zzz: resolve(__dirname, 'hidden/zzz/index.html'),
        // Trang ẩn định giá chứng quyền, không dịch, không có trong menu: truy cập tại /hidden/cq.html
        cq: resolve(__dirname, 'hidden/cq.html'),
        // Trang ẩn liệt kê các chức năng ẩn (zzz, cq...): truy cập tại /hidden/ls/ (gõ /ls cũng được, 404.html chuyển sang)
        ls: resolve(__dirname, 'hidden/ls/index.html'),
        // Trang ẩn tìm kiếm Google/Bing/Baidu + crawl + AI (kèm bộ chạy Node.js ở public/hidden/search/helper/)
        search: resolve(__dirname, 'hidden/search/index.html'),
        // Trang ẩn cờ úp (bản sao, ?cheat=1 hiện bảng cheat): truy cập tại /hidden/co-up/
        coupx: resolve(__dirname, 'hidden/co-up/index.html'),
        // Trang khách xem thực đơn khi quét mã QR (dữ liệu nằm sau dấu #)
        menu: resolve(__dirname, 'm/index.html'),
        ...toolPages,
      },
    },
  },
});
