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
- Ngôn ngữ hiện có: en, vi, ja, zh, es (Tây Ban Nha), de (Đức), ru (Nga), fr (Pháp), pt (Bồ Đào Nha, Brazil), it (Ý), tr (Thổ Nhĩ Kỳ), nl (Hà Lan); mỗi ngôn ngữ đã dịch đủ 1937 chuỗi, render thật 45 trang không lỗi. Đã hết danh sách kế hoạch; thêm ngôn ngữ nữa thì làm theo checklist dưới
- Thêm một ngôn ngữ mới (làm theo es): (1) `public/language/<l>.json` đủ khoá như en.json; (2) `LANGS` + tên ở `scripts/i18n.mjs` và `src/i18n.ts` (cả `localeTag`); (3) thêm `<l>: '<locale>'` vào các bảng `LOCALE` trong `src/pages/*.ts`; (4) cờ ở `src/flags.ts`; (5) `moneyInWords` trong `src/calc/words-vi.ts`; (6) `MenuLang`, `MENU_TEXT`, `PRICE_LOCALE` trong `src/menu/menu.ts`; (7) bản dịch trang lỗi ở `public/404.html`; (8) kiểm tra định dạng ngày ở `expense.ts`/`invoice.ts` (mặc định ngày/tháng/năm); (9) thêm hàm đọc số + nhánh `moneyInWords` (đã có cho mọi ngôn ngữ hiện tại); (10) build rồi render từng trang bằng trình duyệt, quét chữ Việt còn sót (chỉ cho phép đ, tên món Việt, NĐ-CP, Tết)
- Chuỗi riêng từng công cụ: `s.<toolId>.<key>` trong từ điển, dùng `T('key', 'fallback Việt')` (`pageText()`) hoặc `data-i18n` / `data-i18n-ph`
- Chuỗi dùng chung trong `src/lib`, `src/calc`, `src/ui.ts`: key `lib.<module>.<key>` trong `ui`, dùng `t()` / `tf()` (thay `{tên}`) ở lúc gọi hàm, không đọc ở top-level module
- Danh sách dữ liệu có nhãn (món ăn, hoạt động, thành phố, ngày lễ...): có trường `key` ổn định, page tra `T('prefix.' + key, tênViệt)`; dữ liệu người dùng đã lưu theo tên Việt vẫn phải hiển thị được
- Nội dung mẫu / ví dụ / placeholder phải địa phương hoá theo văn hoá từng nước (en: Mỹ/Anh, ja: Nhật, zh: Trung Quốc), không dịch máy móc; không đổi công thức tính
- Trang `/m/` (khách xem menu) không nạp từ điển, 4 ngôn ngữ nhúng thẳng trong `src/menu/menu.ts`
- Đọc số thành chữ (hoá đơn) theo ngôn ngữ: `src/calc/words-vi.ts` (`moneyInWords`)

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
- **Không dịch 3 trang pháp lý** `chinh-sach-bao-mat.html`, `dieu-khoan.html`, `privacy-policy.html`: giữ tiếng Việt ở mọi ngôn ngữ (en/ja/zh và cả các ngôn ngữ thêm sau này) vì không phục vụ người dùng. Đây là chủ ý, không phải sót. `scripts/i18n.mjs` giữ nội dung gốc cho trang tĩnh, chỉ gắn SEO và menu. Khi rà tiếng Việt còn sót, bỏ qua 3 trang này
- GitHub Pages phải để **Source: GitHub Actions** (không dùng "Deploy from branch", vì trình duyệt không chạy được file .ts). Tên miền riêng websitefreetools.com, có `CNAME` ở gốc repo và trong `public/`

## Đang làm dở: i18n (rà soát tiếng Việt còn sót ở bản en/ja/zh)
- Đã xong (22/10/2026): Phase 2 dịch các công cụ; dịch món ăn `meal-calo`; rà soát toàn bộ 44 công cụ: thông báo lỗi của lib (xml, extract, ranges, pptx, codetools, barcode, image...), nội dung mẫu/ví dụ theo từng nước, đọc số thành chữ en/ja/zh, đếm từ ja/zh (`Intl.Segmenter`), ngày lễ VN có tên dịch, trang chủ, menu khách `/m/`. `npm run typecheck` và `npm run build` đều qua; mọi key tĩnh dùng trong code đều có đủ 4 ngôn ngữ
- Quyết định còn mở, chờ chủ site:
  - Đơn vị tiền "đ" và định dạng số kiểu vi-VN gắn cứng ở `fmtMoney`/`fmtInt`/`parseMoney` trong `src/ui.ts`, nên loan, compound, salary, teaching-pay, inventory vẫn hiện "đ" và giá trị mẫu kiểu VND ở mọi ngôn ngữ (invoice đã đổi ký hiệu tiền theo ngôn ngữ)
  - Tên trang tính và tên cột Google Sheets (attendance, journal, habit, expense, inventory, invoice, study-timetable) vẫn tiếng Việt: code đọc lại theo đúng tên đó, dịch đi sẽ làm hỏng bảng cũ. Muốn đổi cần bước đọc tương thích tên cũ
  - Đồng hồ thế giới đang so giờ với Việt Nam; hoạt động MET trong calo-burn tra theo chỉ số `act.N`, không có `key` ổn định; sức khoẻ chưa có lb / ft-in cho en
  - `safeFilename` (`src/lib/download.ts`) bỏ dấu tiếng Việt nên tên file ja/zh rơi về giá trị mặc định
- Còn lại, đã biết:
  - Chưa kiểm tra render thật bằng trình duyệt (máy chạy phiên này chưa có trình duyệt headless). Quét tĩnh trong `dist/` chỉ bắt được chữ gắn cứng trong HTML. Tiêu đề trang chủ ("Danh sách công cụ", "Cách dùng") được `src/pages/home.ts` dịch lúc chạy nên quét tĩnh báo nhầm
  - Các chuỗi tiếng Việt còn trong từ điển en/ja/zh là cố ý: tên món Việt trong ngoặc (Bún bò Huế...), ký hiệu đ, số hiệu văn bản pháp luật (NĐ-CP), từ dừng (và, của), Tết
- Cách rà soát đã dùng: render từng công cụ ở chế độ tiếng Anh rồi quét ký tự tiếng Việt còn sót
  - Build gộp cả 44 công cụ một lượt từng gây lỗi 404 (module không nạp), nên kết quả "sạch" là sai. Phải build và kiểm tra từng công cụ riêng
  - Công cụ kiểm tra phải nạp từ điển chrome thật (`__WFT_I18N__` từ `/language/en.js`), nếu không tên nhóm/công cụ trong menu sẽ báo nhầm là còn tiếng Việt
- Bước tiếp theo: render thật từng công cụ ở en/ja/zh bằng trình duyệt (build từng công cụ riêng, nạp `/language/<lang>.js`), sửa chuỗi còn sót trong `public/language/*.json`
