# WFTools (websitefreetools)

Website gồm nhiều công cụ online nhỏ, chạy hoàn toàn trên trình duyệt (dữ liệu không gửi lên máy chủ).
Tên miền: https://websitefreetools.com (file `CNAME`). Chi tiết danh sách công cụ: xem `README.md`.

## Stack
- TypeScript + Vite 6 (multi-page app, không framework)
- Build: `npm run build` = `tsc --noEmit && vite build && node scripts/i18n.mjs`
- Lệnh khác: `npm run dev` (http://localhost:5173), `npm run typecheck`, `npm run preview`
- Triển khai: GitHub Pages qua `.github/workflows/deploy.yml`, tự chạy khi push lên `main` (Node 20)

## Cấu trúc
- `index.html`: trang chủ. `chinh-sach-bao-mat.html`, `dieu-khoan.html`, `privacy-policy.html`: trang tĩnh
- `tools/<id>.html`: mỗi công cụ một trang. Vite tự nhận mọi file trong `tools/`
- `src/pages/<id>.ts`: logic từng trang
- `src/tools.ts`: danh sách công cụ, nguồn cho menu và trang chủ (6+ nhóm qua trường `group`)
- `src/layout.ts`: menu ngang + menu trái dùng chung. `src/icons.ts`: biểu tượng
- `src/calc/`: phần tính toán thuần (kiểm thử riêng được), ví dụ `salary.ts` (quy định lương 2026)
- `src/lib/`: tiện ích và bộ mã hoá tự viết (QR, mã vạch, pptx, obfuscate...). `src/lib/cdn.ts` nạp thư viện từ CDN khi người dùng bấm xử lý
- `src/google/`: đăng nhập Google + đồng bộ Google Sheets (Điểm danh, Nhật ký)
- `src/stock/`: lõi phân tích cho trang ẩn `zzz/index.html` (4v2: nến Binance, backtest), `noindex`, không có trong menu
- `m/index.html`: trang khách xem thực đơn khi quét QR (dữ liệu sau dấu `#`)
- `public/language/{en,vi,ja,zh}.json`: từ điển đa ngôn ngữ

## Đa ngôn ngữ (i18n)
- `scripts/i18n.mjs` chạy sau `vite build`: sinh bản `/en /vi /ja /zh` cho mọi trang, thẻ SEO (canonical, hreflang, Open Graph, JSON-LD), `/language/<lang>.js` và `sitemap.xml`
- Tiếng Anh là mặc định. Thiếu bản dịch thì lùi về tiếng Anh, rồi về chuỗi gốc tiếng Việt trong HTML
- Commit gần nhất: "i18n Phase 2: dịch pptx-pdf (PowerPoint ↔ PDF), công cụ còn sót"

## Thêm công cụ mới
1. Tạo `tools/<id>.html` (chép từ trang có sẵn, giữ `data-root=".."` và `<main id="content">`)
2. Tạo `src/pages/<id>.ts`, gọi `mountLayout({ activeTool: '<id>' })`
3. Thêm mục vào `TOOLS` trong `src/tools.ts` và biểu tượng trong `src/icons.ts`
4. Phần tính toán thuần đặt trong `src/calc/`
5. Thêm chuỗi dịch vào `public/language/*.json` cho 4 ngôn ngữ

## Quy ước
- Giao diện và chuỗi gốc bằng tiếng Việt
- Không phụ thuộc thư viện ngoài khi có thể (QR, mã vạch, pptx, diff, obfuscate đều tự viết)
- Chạy `npm run typecheck` trước khi commit

## Quyết định đã chốt
- Hướng tới người dùng phổ thông: giao diện không có gì liên quan GitHub (menu ngang có mục "Hướng dẫn", không có link GitHub). README và workflow vẫn giữ trong repo
- Câu chữ dễ hiểu, tránh thuật ngữ kỹ thuật (ví dụ "Độ bền của mã" thay vì "mức sửa lỗi", "Tên mạng Wi-Fi" thay vì "SSID"). Báo lỗi phải kèm cách sửa
- Nội dung mẫu của mã QR là `https://websitefreetools.com`
- QR và mã vạch (Code 128, EAN-13, EAN-8, UPC-A, Code 39) tự viết bằng TypeScript, không dùng thư viện ngoài
- Hướng ra toàn cầu: ở chế độ en/ja/zh không được sót tiếng Việt. Ngoại lệ hợp lệ: tên ngôn ngữ như "Tiếng Việt" giữ nguyên
- GitHub Pages phải để **Source: GitHub Actions** (không dùng "Deploy from branch", vì trình duyệt không chạy được file .ts). Tên miền riêng websitefreetools.com, có `CNAME` ở gốc repo và trong `public/`

## Đang làm dở: i18n (rà soát tiếng Việt còn sót ở bản en/ja/zh)
- Đã làm: Phase 2 dịch các công cụ, commit gần nhất dịch xong `pptx-pdf`
- Đang làm khi hết hạn mức: đọc `src/data/foods.ts` để dịch tên món và khẩu phần cho công cụ Thực đơn & calo (`meal-calo`). Chưa rõ đã sửa tới đâu, cần kiểm tra lại file này
- Cách rà soát đã dùng: render từng công cụ ở chế độ tiếng Anh rồi quét ký tự tiếng Việt còn sót
  - Build gộp cả 44 công cụ một lượt từng gây lỗi 404 (module không nạp), nên kết quả "sạch" là sai. Phải build và kiểm tra từng công cụ riêng
  - Công cụ kiểm tra phải nạp từ điển chrome thật (`__WFT_I18N__` từ `/language/en.js`), nếu không tên nhóm/công cụ trong menu sẽ báo nhầm là còn tiếng Việt
- Bước tiếp theo: hoàn tất dịch `foods.ts`, rồi rà lại toàn bộ công cụ ở en/ja/zh theo cách trên, sửa các chuỗi còn sót trong `public/language/*.json`
