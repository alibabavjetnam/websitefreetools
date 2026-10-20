import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Mỗi công cụ là một trang HTML riêng (multi-page app).
// Mọi file trong thư mục tools/ được tự nhận làm trang, không cần khai báo từng trang.
const toolPages = Object.fromEntries(
  readdirSync(resolve(__dirname, 'tools'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => [`tool-${f.replace(/\.html$/, '')}`, resolve(__dirname, 'tools', f)]),
);

// base './' giúp site chạy được cả ở tên miền gốc lẫn trong thư mục con.
export default defineConfig({
  base: './',
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
        // Trang khách xem thực đơn khi quét mã QR (dữ liệu nằm sau dấu #)
        menu: resolve(__dirname, 'm/index.html'),
        ...toolPages,
      },
    },
  },
});
