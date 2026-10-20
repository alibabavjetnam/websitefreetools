# WFTools — Công cụ trực tuyến miễn phí

Website tổng hợp các công cụ online nhỏ gọn, viết bằng **TypeScript + Vite**, chạy hoàn toàn trên trình duyệt (dữ liệu không gửi lên máy chủ).

## Công cụ hiện có

| Công cụ | Trang | Mô tả |
| --- | --- | --- |
| Tạo mã QR | `tools/qr-code.html` | Liên kết/văn bản, Wi‑Fi, email, điện thoại, SMS. 4 mức sửa lỗi, đổi màu, tải PNG/SVG. |
| Tạo mã vạch | `tools/barcode.html` | Code 128, EAN‑13, EAN‑8, UPC‑A, Code 39. Tự tính số kiểm tra, tải PNG/SVG. |
| Biểu đồ stock | `tools/stock-chart.html` | Chuyển từ công cụ 4v2 (repo messenger): biểu đồ nến Binance realtime, chấm điểm xu hướng, tín hiệu 2 kênh, backtest. Dùng ECharts nạp từ CDN. |

Bộ mã hoá QR (`src/lib/qr.ts`) và mã vạch (`src/lib/barcode.ts`) được viết riêng, **không phụ thuộc thư viện ngoài**.

## Chạy trên máy

```bash
npm install
npm run dev       # mở http://localhost:5173
npm run build     # build ra thư mục dist/
npm run preview   # xem thử bản build
```

## Cấu trúc

```
index.html              Trang chủ (danh sách công cụ)
tools/                  Mỗi công cụ là một trang HTML riêng
  qr-code.html
  barcode.html
  stock-chart.html
src/
  layout.ts             Menu ngang + menu trái dùng chung
  tools.ts              Danh sách công cụ (nguồn cho menu và trang chủ)
  styles.css            Giao diện chung
  pages/                Logic từng trang
  lib/                  Bộ mã hoá QR, mã vạch, tiện ích tải ảnh
  stock/                Lõi phân tích của Biểu đồ stock (chỉ báo, xu hướng, kênh, backtest, dữ liệu Binance, biểu đồ)
public/                 Tệp tĩnh (favicon)
```

## Thêm công cụ mới

1. Tạo `tools/<ten-cong-cu>.html` (chép từ một trang có sẵn, giữ `data-root=".."` và `<main id="content">`).
2. Tạo `src/pages/<ten-cong-cu>.ts`, gọi `mountLayout({ activeTool: '<id>' })`.
3. Thêm một mục vào `TOOLS` trong `src/tools.ts`.
4. Khai báo trang trong `build.rollupOptions.input` của `vite.config.ts`.

## Triển khai

Workflow `.github/workflows/deploy.yml` tự build và đăng lên GitHub Pages mỗi khi đẩy lên nhánh `main`.
Lần đầu cần bật: **Settings → Pages → Source: GitHub Actions**.
