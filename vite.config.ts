import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Mỗi công cụ là một trang HTML riêng (multi-page app).
// base './' giúp site chạy được cả ở tên miền gốc lẫn trong thư mục con.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        qrCode: resolve(__dirname, 'tools/qr-code.html'),
        barcode: resolve(__dirname, 'tools/barcode.html'),
      },
    },
  },
});
