# WFTools — Công cụ trực tuyến miễn phí

Website tổng hợp các công cụ online nhỏ gọn, viết bằng **TypeScript + Vite**, chạy hoàn toàn trên trình duyệt (dữ liệu không gửi lên máy chủ).

## Công cụ hiện có

Công cụ được chia thành 6 nhóm (khai báo trong `src/tools.ts`), hiển thị thành các khung ở trang chủ và menu trái.

| Nhóm | Công cụ | Trang |
| --- | --- | --- |
| Xử lý hình ảnh | Nén ảnh | `tools/image-convert.html` |
| Xử lý hình ảnh | Chuyển đổi định dạng ảnh (JPG, PNG, WebP, AVIF, BMP, ICO) | `tools/image-format.html` |
| Xử lý hình ảnh | Ảnh sang Base64 và ngược lại | `tools/image-base64.html` |
| Xử lý hình ảnh | Xoá nền ảnh (nền trắng, nền một màu) | `tools/bg-remove.html` |
| Xử lý hình ảnh | Thêm watermark vào ảnh | `tools/watermark.html` |
| Xử lý file | Nối và tách PDF | `tools/pdf-merge.html` |
| Xử lý file | PowerPoint ↔ PDF | `tools/pptx-pdf.html` |
| Xử lý file | So sánh hai file (TXT, Word, HTML, PDF) | `tools/file-diff.html` |
| Xử lý file | Phân tích văn bản (số từ, ký tự, thời gian đọc, mật độ từ khoá) | `tools/text-analysis.html` |
| Xử lý file | Chuyển đổi JSON, XML, CSV, Excel | `tools/data-convert.html` |
| Kinh doanh online | Tạo mã vạch | `tools/barcode.html` |
| Tài chính & tính toán | Tính khoản vay | `tools/loan.html` |
| Tài chính & tính toán | Lãi kép & tích luỹ | `tools/compound.html` |
| Tiện ích sức khoẻ | Chỉ số BMI & BMR, TDEE | `tools/bmi-bmr.html` |
| Tiện ích sức khoẻ | Thực đơn & calo hàng ngày | `tools/meal-calo.html` |
| Tiện ích sức khoẻ | Theo dõi nước uống | `tools/water-tracker.html` |
| Tiện ích sức khoẻ | Calo tiêu hao theo vận động (MET) | `tools/calo-burn.html` |
| Tiện ích sức khoẻ | Theo dõi & dự đoán chu kỳ (chỉ lưu máy) | `tools/cycle-track.html` |
| Giáo dục & giảng dạy | Thời khoá biểu học tập | `tools/study-timetable.html` |
| Giáo dục & giảng dạy | Đề thi & câu hỏi trắc nghiệm | `tools/quiz-bank.html` |
| Giáo dục & giảng dạy | Điểm danh (Google Sheet) | `tools/attendance.html` |
| Giáo dục & giảng dạy | Sơ đồ tư duy & tóm tắt tự động | `tools/mindmap.html` |
| Giáo dục & giảng dạy | Giờ giảng & thù lao | `tools/teaching-pay.html` |
| Công cụ thời gian | Đồng hồ toàn màn hình (+ bấm giờ, đếm ngược) | `tools/fullscreen-clock.html` |
| Công cụ thời gian | Đếm ngược tạo video (MP4/WebM) | `tools/countdown-video.html` |
| Công cụ thời gian | Đồng hồ thế giới & so sánh múi giờ | `tools/world-clock.html` |
| Công cụ thời gian | Tính ngày làm việc (trừ lễ VN) | `tools/workdays.html` |
| Công cụ thời gian | Nhật ký online (Google Sheet riêng tư) | `tools/journal.html` |
| Công cụ tin học | Định dạng JS, HTML, CSS, JSON | `tools/code-format.html` |
| Công cụ tin học | Kiểm tra lỗi cú pháp JS, HTML, CSS, JSON | `tools/code-check.html` |
| Công cụ tin học | Làm rối mã JavaScript (obfuscator) | `tools/js-obfuscate.html` |
| Công cụ tin học | Khoá RSA + mã hoá/giải mã văn bản (AES + RSA lai) | `tools/rsa-keys.html` |
| Công cụ tin học | Soạn văn bản thành HTML | `tools/text-to-html.html` |
| Tài chính & tính toán | Lương Gross ↔ Net (quy định 2026 trong `src/calc/salary.ts`) | `tools/salary.html` |
| Tiếp thị | Tạo mã QR | `tools/qr-code.html` |
| Tiếp thị | Tạo link UTM | `tools/utm.html` |
| Tiếp thị | Bảng màu & mã màu | `tools/colors.html` |
| Năng suất & đời sống | Tiền tệ & múi giờ (tỷ giá từ open.er-api.com) | `tools/currency-time.html` |

Bộ mã hoá QR (`src/lib/qr.ts`) và mã vạch (`src/lib/barcode.ts`) được viết riêng, **không phụ thuộc thư viện ngoài**.

Nhóm Xử lý file nạp thư viện từ CDN chỉ khi người dùng bấm xử lý (`src/lib/cdn.ts`): pdf-lib (gộp, tách, tạo PDF), pdf.js (đọc và vẽ trang PDF), PptxGenJS (tạo .pptx), JSZip (đọc .docx, .pptx), SheetJS (đọc, ghi Excel). Nhóm Công cụ tin học nạp js-beautify (định dạng JS/HTML/CSS) và acorn (kiểm lỗi, làm rối JS) từ CDN; tạo khoá RSA bằng Web Crypto sẵn có của trình duyệt. Bộ làm rối mã (`src/lib/obfuscate.ts`) tự viết trên AST acorn. Nhóm sức khoẻ và thời gian dùng công thức tự viết (BMI/BMR Mifflin–St Jeor, MET, dự đoán chu kỳ, ngày làm việc trừ lễ VN 2024–2027) và Intl API cho múi giờ. Công cụ Đếm ngược tạo video dùng WebCodecs + mp4-muxer để xuất MP4 (H.264), tự chuyển sang WebM nếu trình duyệt chưa hỗ trợ. Điểm danh và Nhật ký lưu vào Google Sheet qua bộ đồng bộ sẵn có. Bộ đọc PowerPoint (`src/lib/pptx.ts`) và vẽ trang chiếu (`src/lib/pptx-render.ts`), so sánh văn bản (`src/calc/diff.ts`, thuật toán Myers), đọc XML, CSV được viết riêng.

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
