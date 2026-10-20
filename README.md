# WFTools — Công cụ trực tuyến miễn phí

Website tổng hợp các công cụ online nhỏ gọn, viết bằng **TypeScript + Vite**, chạy hoàn toàn trên trình duyệt (dữ liệu không gửi lên máy chủ).

## Công cụ hiện có

Công cụ được chia thành 6 nhóm (khai báo trong `src/tools.ts`), hiển thị thành các khung ở trang chủ và menu trái.

| Nhóm | Công cụ | Trang |
| --- | --- | --- |
| File & hình ảnh | Nén ảnh | `tools/image-convert.html` |
| File & hình ảnh | Chuyển đổi định dạng ảnh (JPG, PNG, WebP, AVIF, BMP, ICO) | `tools/image-format.html` |
| File & hình ảnh | Ảnh sang Base64 và ngược lại | `tools/image-base64.html` |
| File & hình ảnh | Xoá nền ảnh (thuật toán, hoặc AI: Transformers.js + BiRefNet lite, giấy phép Apache-2.0/MIT) | `tools/bg-remove.html` |
| File & hình ảnh | Thêm watermark vào ảnh | `tools/watermark.html` |
| Công cụ kỹ thuật tin học | JSON, Base64, Regex | `tools/dev-tools.html` |
| Công cụ kỹ thuật tin học | Cron & Unix timestamp | `tools/cron-time.html` |
| Kinh doanh online | Tạo mã vạch | `tools/barcode.html` |
| Tài chính & tính toán | Tính khoản vay | `tools/loan.html` |
| Tài chính & tính toán | Lãi kép & tích luỹ | `tools/compound.html` |
| Tài chính & tính toán | Lương Gross ↔ Net (quy định 2026 trong `src/calc/salary.ts`) | `tools/salary.html` |
| Tiếp thị | Tạo mã QR | `tools/qr-code.html` |
| Tiếp thị | Tạo link UTM | `tools/utm.html` |
| Tiếp thị | Bảng màu & mã màu | `tools/colors.html` |
| Năng suất & đời sống | Tiền tệ & múi giờ (tỷ giá từ open.er-api.com) | `tools/currency-time.html` |

Bộ mã hoá QR (`src/lib/qr.ts`) và mã vạch (`src/lib/barcode.ts`) được viết riêng, **không phụ thuộc thư viện ngoài**.

## Trang ẩn

`zzz/index.html` (truy cập tại `/zzz`) là công cụ 4v2 chuyển từ repo messenger: biểu đồ nến Binance realtime, tín hiệu 2 kênh, backtest. Trang này không có trong menu, trang chủ và được đánh dấu `noindex` để công cụ tìm kiếm không liệt kê.

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
src/
  layout.ts             Menu ngang + menu trái dùng chung
  tools.ts              Danh sách công cụ (nguồn cho menu và trang chủ)
  styles.css            Giao diện chung
  pages/                Logic từng trang
  lib/                  Bộ mã hoá QR, mã vạch, tiện ích tải ảnh
  stock/                Lõi phân tích của trang 4v2 (chỉ báo, xu hướng, kênh, backtest, dữ liệu Binance, biểu đồ)
public/                 Tệp tĩnh (favicon)
```

## Thêm công cụ mới

1. Tạo `tools/<id>.html` (chép từ một trang có sẵn, giữ `data-root=".."` và `<main id="content">`). Vite tự nhận mọi file trong `tools/`.
2. Tạo `src/pages/<id>.ts`, gọi `mountLayout({ activeTool: '<id>' })`.
3. Thêm một mục vào `TOOLS` trong `src/tools.ts` (chọn nhóm qua trường `group`) và biểu tượng trong `src/icons.ts`.
4. Phần tính toán thuần đặt trong `src/calc/` để kiểm thử riêng được.

## Triển khai

Workflow `.github/workflows/deploy.yml` tự build và đăng lên GitHub Pages mỗi khi đẩy lên nhánh `main`.
Lần đầu cần bật: **Settings → Pages → Source: GitHub Actions**.
