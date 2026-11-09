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
- `src/stock/`: lõi phân tích cho trang ẩn `hidden/zzz/index.html` (địa chỉ vẫn là `/zzz/`) (4v2: nến Binance, backtest), `noindex`, không có trong menu
- `hidden/`: mọi chức năng ẩn (không có trong menu/sitemap, `noindex`, không Google Analytics, không dịch), cả mã nguồn lẫn địa chỉ nằm dưới `/hidden/`: `hidden/zzz/index.html` → `/hidden/zzz/` (tài nguyên PWA ở `public/hidden/zzz/`), `hidden/cq.html` → `/hidden/cq.html` (định giá chứng quyền, tải dữ liệu Vietstock bằng dấu trang), `hidden/ls/index.html` → `/hidden/ls/` (danh sách link), `hidden/search/index.html` → `/hidden/search/` (Smart Search Crawler: tìm Google/Bing/Baidu mỗi web tới 100 kết quả, quản lý URL, crawl, AI Gemini/ChatGPT/Claude/dán tay/Ollama, xuất Excel/JSON/MD; logic ở `src/pages/smartsearch.ts` + `src/smartsearch/{ai,helper,urls}.ts`; việc tìm và crawl do bộ chạy Node.js không phụ thuộc thư viện `public/hidden/search/helper/wft-crawler.mjs` chạy trên máy người dùng, trang tự tải thành zip bằng PizZip; chế độ trình duyệt tuỳ chọn dùng puppeteer-core để người dùng tự giải CAPTCHA; đã kiểm thử đầu–cuối với công cụ tìm kiếm giả, **chưa thử với Google/Bing/Baidu thật** vì máy phiên này không truy cập được). `public/404.html` chuyển `/ls`, `/zzz`, `/cq.html` (địa chỉ ngắn/cũ) sang `/hidden/...`. Thêm chức năng ẩn mới: đặt vào `hidden/`, khai báo input trong `vite.config.ts`, thêm vào `NO_ANALYTICS`, thêm một dòng vào `hidden/ls/index.html`. Vỏ Android (`android-app`) trỏ vào `/hidden/zzz/`
- `m/index.html`: trang khách xem thực đơn khi quét QR (dữ liệu sau dấu `#`)
- `public/language/{en,vi,ja,zh}.json`: từ điển đa ngôn ngữ

## Đa ngôn ngữ (i18n)
- `scripts/i18n.mjs` chạy sau `vite build`: sinh bản `/en /vi /ja /zh` cho mọi trang, thẻ SEO (canonical, hreflang, Open Graph, JSON-LD), `/language/<lang>.js` và `sitemap.xml`
- Tiếng Anh là mặc định. Thiếu bản dịch thì lùi về tiếng Anh, rồi về chuỗi gốc tiếng Việt trong HTML
- Ngôn ngữ hiện có (50): 20 ngôn ngữ đầu: en, vi, ja, zh, es, de, ru, fr, pt (Brazil), it, tr, nl, ko, ar (**RTL**), hi, id, th, pl, uk, bn. 30 ngôn ngữ thêm ngày 27/10/2026: ms, fa (**RTL**), he (**RTL**), ur (**RTL**), ta, te, mr, gu, kn, ml, pa, sv, da, nb, fi, cs, sk, hu, ro, bg, el, hr, sr (Cyrillic), lt, lv, et, sl, fil, sw, ca. Mỗi ngôn ngữ đã dịch đủ 1936 chuỗi (cộng 1154 chuỗi của 37 công cụ thêm sau, xong 28/10/2026); build ra 48 trang × 50 ngôn ngữ, đã quét render bằng Playwright (không lỗi, không sót tiếng Việt ngoài đ, tên món Việt, Tết, NĐ-CP). Nhóm RTL: ar, fa, he, ur
- Ả Rập (`ar`): `dir: "rtl"` trong `ar.json`, `i18n.mjs` gắn `<html dir="rtl">`, `404.html` tự đặt `dir`, phần chỉnh RTL ở cuối `src/styles.css`. Đọc số thành chữ cho ko/ar/hi/id/th/pl/uk/bn nằm ở `src/calc/words-more.ts` (gọi từ `moneyInWords` trong `words-vi.ts`)
- Đợt bổ sung thêm đã xong toàn bộ 50 ngôn ngữ (đến 03/11/2026, tổng 100 ngôn ngữ): lb, is, yue, ga, cy, zh-TW, mt, eu, gl, af, sq, bs, mk, kk, az, ka, hy, be, uz, mn, ku, zu, xh, sn, ceb, jv, su, ne, si, my, km, lo, ky, tg, tk, ps, sd, ht, mi, ha, yo, ig, am, so, rw, mg, as, or, mai, bho. Cách làm giống 30 ngôn ngữ dưới (chỉ dữ liệu), key có dấu gạch (zh-TW) phải đặt trong nháy ở `public/404.html`. Giới hạn: `moneyInWords` (đọc số thành chữ) của các ngôn ngữ này đang lùi về chữ số tiếng Anh kèm mã tiền tệ. Cờ: nhiều ngôn ngữ dùng chung một lá cờ (Ấn Độ cho hi/ta/te/mr/gu/kn/ml/pa/as/or/mai/bho; Nigeria cho ha/yo/ig) — chờ chủ site quyết định có đổi sang nhãn mã ngôn ngữ không
- Đã đủ 50 ngôn ngữ. 30 ngôn ngữ thêm sau (ms…ca) đăng ký bằng dữ liệu, không sửa code: `src/langs.json` ({mã: {name, locale, rtl?, cur:[tiền tệ, số lẻ, giá trị 1 đơn vị so với VND]}}), `src/flags-extra.json` (cờ), `src/menu/menu-extra.json` (chữ + tiền tệ menu khách `/m/`), cùng bản dịch trang lỗi trong `public/404.html`. Giới hạn đã biết: đọc số thành chữ (`moneyInWords`) chưa có bản bản ngữ cho 30 ngôn ngữ này, đang lùi về chữ số tiếng Anh kèm mã tiền tệ
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

## 37 công cụ thêm ngày 27/10/2026
- Chọn từ danh sách công cụ online được tìm nhiều nhất (mức ★★★), chạy hoàn toàn trên trình duyệt, không API trả phí. Tổng site: 91 công cụ (09/11/2026 thêm Desktop online `web-desktop`; từ 08/11/2026 gồm 6 game trí tuệ, xem mục Game giải trí; trước đó 84) (05/11/2026 thêm nhóm `excel` "Xử lý dữ liệu Excel" với 4 công cụ `excel-word-fill`, `excel-cell-merge`, `excel-row-concat`, `excel-formula-merge`: lõi dùng chung `src/lib/excel-common.ts` + `src/lib/excel-ui.ts`, bộ tính công thức không eval `src/calc/excel-formula.ts`, pizzip + docxtemplater đặt ở `public/vendor/` (cùng tên miền), SheetJS nạp từ CDN; chuỗi dịch đã có đủ 100 ngôn ngữ (05/11/2026); đã kiểm tra đầu–cuối bằng Chromium với xlsx/docx thật; 03/11/2026 gộp "Xoá nền ảnh bằng AI" vào `bg-remove` thành tab AI; logic ở `src/lib/ai-bg-ui.ts`, chuỗi dịch `s.bg-remove.ai.*`, URL cũ `ai-bg-remove.html` chuyển hướng ở `public/404.html`)
- Nhóm mới: `text` (Xử lý văn bản), `calc` (Máy tính & chuyển đổi), `entertainment` (Game giải trí, đặt cuối danh sách nhóm; mã cũ `random`), `device` (Kiểm tra thiết bị), `media` (Âm thanh & video)
- CSS riêng của các công cụ này ở `src/styles-extra.css` (nạp trong `layout.ts`)
- Thư viện CDN mới (chỉ nạp khi bấm xử lý): Tesseract.js 5.1.1 (OCR), heic2any 0.0.4, Transformers.js 3.5.2 (`src/lib/ai.ts`: BiRefNet_lite, MODNet, Swin2SR), @ffmpeg/core 0.12.6 (`src/lib/ffmpeg.ts` + worker tự viết `public/vendor/ffmpeg-worker.js`, vì worker phải cùng tên miền), html-to-image 1.11.13 (Word → PDF)
- Tự viết: đọc .docx → HTML (`src/lib/docxhtml.ts`), ghi .docx (`src/lib/docxwriter.ts`), ghép chữ pdf.js thành đoạn và sửa chữ có dấu bị vẽ chồng (`src/calc/pdftext.ts`), nén lại ảnh JPEG trong PDF giữ nguyên chữ (`src/lib/pdfcompress.ts`), khung đặt chữ ký/chữ/ô che lên trang PDF có xử lý trang xoay (`src/lib/pdfeditor.ts`), bộ tính biểu thức không eval (`src/calc/expr.ts`), dò cao độ YIN (`src/calc/pitch.ts`)
- Chữ đặt lên PDF (ký tên, thêm chữ, ô biểu mẫu có chữ tiếng Việt) được vẽ thành ảnh PNG độ phân giải cao vì phông chuẩn của pdf-lib không có dấu tiếng Việt và không có fontkit
- Bản dịch (xong 28/10/2026): chuỗi riêng 37 công cụ mới, tên nhóm, tên công cụ (1154 chuỗi) đã dịch đủ cả 50 ngôn ngữ. Nội dung mẫu địa phương hoá theo từng nước: tên trên vòng quay, đoạn văn thử gõ phím (ngôn ngữ chữ Latin/Kirin/Hy Lạp gõ bằng tiếng bản ngữ; CJK, Ấn Độ, Thái, Hàn, fa/ur, fil giữ đoạn tiếng Anh nhưng đổi địa danh), câu mẫu đổi chữ hoa/thường, tên mẫu chữ ký/logo. Tên mẫu chữ ký và chữ kiểu dùng chữ Latin cho các hệ chữ mà phông viết tay không hỗ trợ (riêng ru/uk/bg/sr dùng Kirin vì Caveat/Pacifico có Kirin). Dòng xổ số luôn là "Lotto 6/45", ảnh hộ chiếu 3,5×4,5 cm. `scripts/i18n.mjs` vẫn lùi về tiếng Anh nếu thiếu chuỗi
- Đã chạy thử bằng Chromium (Playwright) cả 37 trang ở en/ja/vi: không lỗi JS, không sót tiếng Việt ở bản en/ja. Đã kiểm tra thật đầu–cuối (thư viện chạy cục bộ): ảnh ↔ PDF, nén PDF, PDF → Word, Word → PDF, ký PDF, điền form PDF. **Chưa chạy được đầu–cuối** (máy phiên này không tải được CDN): OCR, HEIC, xoá nền AI, làm nét AI, nén video, tách MP3 — cần thử trên site thật
- Việc tiếp theo: thử các công cụ CDN ở trên (OCR, HEIC, xoá nền AI, làm nét AI, nén video, tách MP3) trên site thật

## Nhóm Game giải trí (08/11/2026)
- 6 game, mỗi game 10 cấp từ dễ đến khó, tiến độ lưu `localStorage` (`wft:game-<id>`, cấp sau mở khi thắng cấp trước, có nút "Mở hết các cấp"): `sudoku-9x9`, `sudoku-16x16`, `chess`, `xiangqi`, `go-game`, `memory-shapes`. Cùng nhóm với `spin-wheel`, `random-number`
- Lõi thuần (không DOM) ở `src/calc/`: `sudoku.ts` (sinh đề có nghiệm duy nhất bằng bitmask + MRV), `chess.ts`, `xiangqi.ts` (luật đầy đủ, đã kiểm perft: cờ vua 8902/197281, Kiwipete 97862; cờ tướng 44/1920/79666/3290240), `search.ts` (negamax + alpha-beta + quiescence, giới hạn thời gian, dùng chung hai môn cờ), `go.ts` (bắt quân, cấm tự sát, ko đơn giản, chấm diện tích, máy Monte-Carlo + UCB1), `memory.ts`
- Giao diện ở `src/lib/{game-ui,sudoku-ui,chess-ui,xiangqi-ui,go-ui,memory-ui}.ts`; `game-ui.ts` có thanh cấp, lưu tiến độ, thông báo thắng/thua. Trang `src/pages/<id>.ts` chỉ gọi `mountXxx`. CSS cuối `src/styles-extra.css`
- Độ khó máy: cấp 1 đi ngẫu nhiên; cấp 2-7 giảm dần nhiễu và tăng độ sâu; cấp 8-10 tìm sâu 4-8 nước trong 2-3,5 giây (chạy trên luồng chính, hiện "Máy đang nghĩ…"). Cờ vây: cấp 1-2 bàn 5x5, 3-5 bàn 7x7, 6-10 bàn 9x9, komi 0,5 / 4,5 / 6,5; máy mạnh ở mức vừa phải (Monte-Carlo, không phải KataGo). Người chơi luôn cầm quân đi trước (Trắng / Đỏ / Đen)
- Chuỗi dịch dùng chung: `ui['lib.game.*']` (54 khoá) + `tools.<id>` cho 6 game. Đã dịch đủ 100 ngôn ngữ (08/11/2026; 96 ngôn ngữ ngoài vi/en/ja/zh do AI dịch, chưa người bản ngữ rà, nhóm ít tài nguyên như zu, jv, my, tg, ht, ig, mg, bho, xh, su, tk, mi, am, as cần rà trước). Chữ trên quân cờ tướng (帥仕相傌俥炮兵 / 將士象馬車砲卒) giữ nguyên ở mọi ngôn ngữ
- Đã chạy thử Chromium (en/ja/zh/vi/de/ar/es): thắng Sudoku 9x9 và 16x16 bằng gợi ý, đi nước cờ vua/cờ tướng/cờ vây, ghi nhớ hình, không lỗi JS. Chưa đánh giá độ mạnh thực tế của từng cấp với người chơi thật

## Desktop online `web-desktop` (09/11/2026, nhóm `dev` "Công cụ tin học")
- Màn hình máy tính trên trình duyệt: cửa sổ kéo/đổi cỡ/thu nhỏ/phóng to, thanh tác vụ, menu Start, toàn màn hình. Ứng dụng con: Tệp (thư mục mới, file văn bản mới, tải lên/kéo thả, tải về, đổi tên, xoá vào thùng rác), Notepad (Ctrl+S, Lưu thành, hỏi lưu khi đóng, giới hạn 5 MB), Xem ảnh (phóng to, ảnh trước/sau, đặt làm hình nền), Xem PDF (iframe blob), Máy tính (dùng `src/calc/expr.ts`), Lịch, Thùng rác (khôi phục, xoá vĩnh viễn, dọn sạch), Cài đặt (6 hình nền, sáng/tối, đồng hồ 24 giờ, nơi lưu)
- Nơi lưu: đăng nhập Google → thư mục `WFTools/Desktop` trong Drive của người dùng (`DriveFs`, quyền `drive.file`, mỗi file gắn `appProperties wftd=1` để tìm thùng rác; thư mục gốc gắn `wft=desktop`); chưa đăng nhập → chọn "Dùng thử" lưu IndexedDB (`LocalFs`, CSDL `wft-desktop`). Cài đặt lưu localStorage `wft:desktop-settings` và file ẩn `.wftdesk-settings.json` ở gốc Desktop trên Drive (tên bắt đầu `.wftdesk` bị ẩn và cấm đặt). Đăng nhập/đăng xuất thì tải lại trang. Token hết hạn → màn hình "Kết nối lại" (cửa sổ Google phải mở từ cú bấm)
- Mã: `src/desktop/fs.ts` (2 kho), `src/desktop/shell.ts` (vỏ, cửa sổ, hộp thoại), `src/desktop/apps.ts` (ứng dụng con), `src/pages/web-desktop.ts`, phần thuần `src/calc/desktop.ts` (kiểm tên, tên không trùng, loại file, lưới lịch). CSS cuối `src/styles-extra.css` (lớp `wd-*`, có chủ đề tối riêng). `ensureFolder` trong `src/google/sheets.ts` được export để dùng chung
- Lưu ý: chọn/bỏ chọn mục không được vẽ lại danh sách (vẽ lại giữa hai lần bấm làm mất sự kiện nhấp đúp)
- Chuỗi dịch `s.web-desktop.*` (117 khoá) + `tools.web-desktop`: có en, vi (09/11/2026). **Chưa dịch 98 ngôn ngữ còn lại** (đang lùi về tiếng Anh)
- Đã kiểm thử đầu–cuối bằng Chromium (Playwright) cả hai nơi lưu: IndexedDB thật và Google Drive giả lập bằng route (tạo/đổi tên/xoá/khôi phục/xoá vĩnh viễn thư mục kèm file con, ghi đè nội dung UTF-8, tải lên ảnh nhị phân, cài đặt lưu Drive), ở en/vi/ja/ar và màn hình điện thoại; không lỗi JS. **Chưa thử với Google Drive thật**

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
- Quyết định đã chốt (23/10/2026):
  - Định dạng số/tiền theo ngôn ngữ đang chọn (mặc định kiểu Mỹ): `fmtInt`/`fmtDec`/`fmtAmt`/`fmtField`/`fmtMoney` trong `src/ui.ts` dùng `localeTag()` và đồng tiền từng nước (bảng `CURRENCY`: en USD, ja JPY, zh CNY, de/fr/es/it/nl EUR, pt BRL, ru RUB, tr TRY, vi đ). Giá trị mẫu quy từ VND bằng `sampleMoney()`. Riêng `salary` là luật Việt Nam nên luôn hiện "đ" (`fmtVnd`) nhưng số vẫn theo ngôn ngữ. `parseNumber` ưu tiên cách hiểu dấu chấm/phẩy của ngôn ngữ đang chọn
  - Tên trang tính và cột Google Sheets bằng tiếng Anh. Bảng tính cũ (tên tiếng Việt) vẫn dùng được: `legacySheet`/`legacy` trong `SheetStore` (trang tính cũ được đổi tên, cột cũ vẫn đọc được). Giá trị dữ liệu (loại thu/chi, tên danh mục) vẫn lưu theo tiếng Việt
  - Đồng hồ thế giới so giờ với nước của ngôn ngữ đang chọn (phần tử đầu của `defaultZones`), khoá `sameRef`/`vsRef`
  - `calo-burn`: mỗi hoạt động/nhóm có `key`/`groupKey` ổn định trong `ACTIVITIES` (`src/calc/health.ts`), bản dịch tra `act.<key>` / `grp.<groupKey>`
  - `safeFilename` (`src/lib/download.ts`) bỏ dấu tiếng Việt nhưng giữ chữ Unicode (Nhật, Trung, Nga...) nên tên file đúng ngôn ngữ. Từ 28/10/2026 giữ cả dấu kết hợp (`\p{M}`) để không làm hỏng chữ Ấn Độ/Thái; tên file mặc định cho các hệ chữ này vẫn để tiếng Anh
- Quyết định còn mở, chờ chủ site: sức khoẻ chưa có lb / ft-in cho en
- Còn lại, đã biết:
  - Chưa kiểm tra render thật bằng trình duyệt (máy chạy phiên này chưa có trình duyệt headless). Quét tĩnh trong `dist/` chỉ bắt được chữ gắn cứng trong HTML. Tiêu đề trang chủ ("Danh sách công cụ", "Cách dùng") được `src/pages/home.ts` dịch lúc chạy nên quét tĩnh báo nhầm
  - Các chuỗi tiếng Việt còn trong từ điển en/ja/zh là cố ý: tên món Việt trong ngoặc (Bún bò Huế...), ký hiệu đ, số hiệu văn bản pháp luật (NĐ-CP), từ dừng (và, của), Tết
- Cách rà soát đã dùng: render từng công cụ ở chế độ tiếng Anh rồi quét ký tự tiếng Việt còn sót
  - Build gộp cả 44 công cụ một lượt từng gây lỗi 404 (module không nạp), nên kết quả "sạch" là sai. Phải build và kiểm tra từng công cụ riêng
  - Công cụ kiểm tra phải nạp từ điển chrome thật (`__WFT_I18N__` từ `/language/en.js`), nếu không tên nhóm/công cụ trong menu sẽ báo nhầm là còn tiếng Việt
- Bước tiếp theo: render thật từng công cụ ở en/ja/zh bằng trình duyệt (build từng công cụ riêng, nạp `/language/<lang>.js`), sửa chuỗi còn sót trong `public/language/*.json`
