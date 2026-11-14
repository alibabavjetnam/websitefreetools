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
| Công cụ tin học | Desktop online (quản lý file, Notepad, xem ảnh/PDF, máy tính, lịch, thùng rác; menu chuột phải, Cắt/Sao chép/Dán, toàn màn hình; file lưu vào Google Drive) | `tools/web-desktop.html` |
| Tài chính & tính toán | Lương Gross ↔ Net (quy định 2026 trong `src/calc/salary.ts`) | `tools/salary.html` |
| Tiếp thị | Tạo mã QR | `tools/qr-code.html` |
| Tiếp thị | Tạo link UTM | `tools/utm.html` |
| Tiếp thị | Bảng màu & mã màu | `tools/colors.html` |
| Năng suất & đời sống | Tiền tệ & múi giờ (tỷ giá từ open.er-api.com) | `tools/currency-time.html` |
| Xử lý hình ảnh | Đổi kích thước ảnh (pixel, %, cỡ mạng xã hội) | `tools/image-resize.html` |
| Xử lý hình ảnh | Cắt ảnh (tỉ lệ, tròn, xoay, lật) | `tools/image-crop.html` |
| Xử lý hình ảnh | Lấy chữ từ ảnh / PDF scan (OCR, Tesseract.js) | `tools/image-ocr.html` |
| Xử lý hình ảnh | HEIC sang JPG (heic2any) | `tools/heic-jpg.html` |
| Xử lý hình ảnh | Xoá nền ảnh bằng AI (BiRefNet / MODNet, Transformers.js) | `tools/bg-remove.html` (tab AI) |
| Xử lý hình ảnh | Làm nét & phóng to ảnh AI (Swin2SR, xử lý theo ô) | `tools/image-upscale.html` |
| Xử lý file | Ảnh sang PDF | `tools/image-to-pdf.html` |
| Xử lý file | PDF sang ảnh | `tools/pdf-to-image.html` |
| Xử lý file | Nén PDF (nén lại ảnh JPEG giữ chữ, hoặc chuyển trang thành ảnh) | `tools/pdf-compress.html` |
| Xử lý file | PDF sang Word (.docx tự tạo) | `tools/pdf-to-word.html` |
| Xử lý file | Word sang PDF (tự đọc .docx, phân trang, tải PDF hoặc in) | `tools/word-to-pdf.html` |
| Xử lý file | Ký tên lên PDF | `tools/pdf-sign.html` |
| Xử lý dữ liệu Excel | Điền nội dung Word từ Excel | `tools/excel-word-fill.html` |
| Xử lý dữ liệu Excel | Gộp ô Excel nhiều sheet / nhiều file | `tools/excel-cell-merge.html` |
| Xử lý dữ liệu Excel | Nối dòng Excel nhiều sheet / nhiều file | `tools/excel-row-concat.html` |
| Xử lý dữ liệu Excel | Trộn dữ liệu Excel theo công thức | `tools/excel-formula-merge.html` |
| Xử lý file | Thêm chữ & điền form PDF | `tools/pdf-edit.html` |
| Xử lý văn bản | Đổi chữ hoa, chữ thường, camelCase… | `tools/case-convert.html` |
| Xử lý văn bản | Tạo chữ kiểu đẹp (Unicode) | `tools/fancy-text.html` |
| Xử lý văn bản | Đọc văn bản thành giọng nói (Web Speech) | `tools/text-to-speech.html` |
| Xử lý văn bản | Nói thành chữ (Web Speech) | `tools/speech-to-text.html` |
| Máy tính & chuyển đổi | Máy tính khoa học (bộ tính biểu thức tự viết, không eval) | `tools/scientific-calc.html` |
| Máy tính & chuyển đổi | Tính phần trăm | `tools/percentage.html` |
| Máy tính & chuyển đổi | Đổi đơn vị đo | `tools/unit-convert.html` |
| Công cụ thời gian | Tính tuổi | `tools/age-calc.html` |
| Công cụ thời gian | Cộng trừ ngày tháng | `tools/date-calc.html` |
| Giáo dục & giảng dạy | Tính điểm GPA | `tools/gpa.html` |
| Tiện ích sức khoẻ | Tính ngày dự sinh | `tools/due-date.html` |
| Kiểm tra thiết bị | Kiểm tra tốc độ gõ phím | `tools/typing-test.html` |
| Kiểm tra thiết bị | Đo tốc độ click (CPS) | `tools/cps-test.html` |
| Kiểm tra thiết bị | Kiểm tra webcam | `tools/webcam-test.html` |
| Kiểm tra thiết bị | Quay màn hình | `tools/screen-recorder.html` |
| Âm thanh & video | Nén video (ffmpeg.wasm) | `tools/video-compress.html` |
| Âm thanh & video | Tách MP3 từ video (ffmpeg.wasm) | `tools/video-to-mp3.html` |
| Âm thanh & video | Lên dây đàn guitar (dò cao độ YIN) | `tools/guitar-tuner.html` |
| Công cụ tin học | Tạo mật khẩu mạnh | `tools/password-gen.html` |
| Kinh doanh online | Tạo chữ ký tay | `tools/signature.html` |
| Tiếp thị | Tạo logo đơn giản | `tools/logo-maker.html` |
| Năng suất & đời sống | Sổ ghi chú online | `tools/notepad.html` |
| Game giải trí | Vòng quay may mắn | `tools/spin-wheel.html` |
| Game giải trí | Quay số ngẫu nhiên | `tools/random-number.html` |
| Game giải trí | Sudoku 9x9 | `tools/sudoku-9x9.html` |
| Game giải trí | Sudoku 16x16 | `tools/sudoku-16x16.html` |
| Game giải trí | Cờ vua (với máy / online) | `tools/chess.html` |
| Game giải trí | Cờ tướng (với máy / online) | `tools/xiangqi.html` |
| Game giải trí | Cờ úp (với máy / online) | `tools/co-up.html` |
| Game giải trí | Cờ vây (với máy / online) | `tools/go-game.html` |
| Game giải trí | Ghi nhớ hình và màu | `tools/memory-shapes.html` |
| Game giải trí | 2048 | `tools/game-2048.html` |
| Game giải trí | Dò mìn | `tools/minesweeper.html` |
| Game giải trí | Xếp gạch | `tools/block-puzzle.html` |
| Game giải trí | Rắn săn mồi | `tools/snake.html` |
| Game giải trí | Xếp bài Solitaire | `tools/solitaire.html` |
| Game giải trí | Xếp bài Nhện | `tools/spider-solitaire.html` |
| Game giải trí | FreeCell | `tools/freecell.html` |
| Game giải trí | Cờ caro | `tools/gomoku.html` |
| Game giải trí | Reversi | `tools/reversi.html` |
| Game giải trí | Nối 4 | `tools/connect-four.html` |
| Game giải trí | Ghép 3 | `tools/match-3.html` |
| Game giải trí | Phá gạch | `tools/brick-breaker.html` |
| Game giải trí | Bài Kim tự tháp | `tools/pyramid.html` |
| Game giải trí | Bài Ba đỉnh (TriPeaks) | `tools/tripeaks.html` |
| Game giải trí | Bài Golf | `tools/golf.html` |
| Game giải trí | Xì dách (Blackjack) | `tools/blackjack.html` |
| Game giải trí | Video Poker | `tools/video-poker.html` |
| Game giải trí | Cờ đam | `tools/checkers.html` |
| Game giải trí | Cờ cá ngựa | `tools/ludo.html` |
| Game giải trí | Ô ăn quan | `tools/o-an-quan.html` |
| Game giải trí | Lights Out | `tools/lights-out.html` |
| Game giải trí | Xếp số 15 (15-puzzle) | `tools/fifteen.html` |
| Game giải trí | Flood-it (Tô màu loang) | `tools/flood-it.html` |
| Game giải trí | Mastermind (Đoán dãy màu) | `tools/mastermind.html` |
| Game giải trí | Tháp Hà Nội | `tools/hanoi.html` |
| Game giải trí | Nối ống | `tools/pipes.html` |
| Game giải trí | Nonogram (Picross) | `tools/nonogram.html` |
| Game giải trí | Sokoban (Đẩy thùng) | `tools/sokoban.html` |
| Game giải trí | Xếp khối 10x10 | `tools/block-10x10.html` |
| Game giải trí | Nối điểm chiếm ô (Dots and Boxes) | `tools/dots-boxes.html` |
| Game giải trí | Ultimate Tic-Tac-Toe (Caro 9 bàn) | `tools/ultimate-tictactoe.html` |
| Game giải trí | Pong (Bóng bàn điện tử) | `tools/pong.html` |
| Game giải trí | Bắn phi thuyền | `tools/space-shooter.html` |
| Game giải trí | Tiểu hành tinh (Asteroids) | `tools/asteroids.html` |
| Game giải trí | Mê cung | `tools/maze.html` |
| Game giải trí | Qua đường (Ếch qua đường) | `tools/road-cross.html` |
| Game giải trí | Chim bay (Flappy) | `tools/flappy.html` |
| Game giải trí | Khủng long chạy | `tools/runner.html` |
| Game giải trí | Đập chuột (Whack-a-mole) | `tools/whack-a-mole.html` |
| Game giải trí | Simon (Nhớ dãy màu) | `tools/simon.html` |
| Game giải trí | Tập ngắm (Aim Trainer) | `tools/aim-trainer.html` |
| Game giải trí | Toán nhanh | `tools/quick-math.html` |
| Game giải trí | Thử phản xạ | `tools/reaction.html` |
| Game giải trí | Kalah (Mancala) | `tools/kalah.html` |
| Game giải trí | Rắn và thang | `tools/snakes-ladders.html` |
| Game giải trí | Cờ cối (Nine Men's Morris) | `tools/nine-mens-morris.html` |
| Game giải trí | Hải chiến (Battleship) | `tools/battleship.html` |
| Game giải trí | Bầu cua tôm cá | `tools/bau-cua.html` |
| Game giải trí | Baccarat | `tools/baccarat.html` |
| Game giải trí | Bài cào (ba lá) | `tools/bai-cao.html` |
| Game giải trí | Bingo | `tools/bingo.html` |
| Game giải trí | Yahtzee (Xúc xắc 5 viên) | `tools/yahtzee.html` |
| Game giải trí | Bài 8 lá (Crazy Eights) | `tools/crazy-eights.html` |
| Công cụ tin học | Mã hoá và giải mã Base64 | `tools/base64-text.html` |
| Công cụ tin học | Mã hoá và giải mã URL | `tools/url-encode.html` |
| Công cụ tin học | Tạo mã băm MD5, SHA | `tools/hash-gen.html` |
| Công cụ tin học | Giải mã JWT | `tools/jwt-decode.html` |
| Công cụ tin học | Mã hoá thực thể HTML | `tools/html-entities.html` |
| Công cụ tin học | Tạo UUID và ULID | `tools/uuid-gen.html` |
| Công cụ tin học | Mã hoá AES bằng mật khẩu | `tools/aes-encrypt.html` |
| Công cụ tin học | Tạo chữ ký HMAC | `tools/hmac-gen.html` |
| Công cụ tin học | Mật mã Caesar, Morse, nhị phân | `tools/cipher-tools.html` |
| Công cụ tin học | Kiểm tra ký tự Unicode | `tools/unicode-inspect.html` |
| Công cụ tin học | Thoát ký tự chuỗi (escape) | `tools/string-escape.html` |
| Công cụ tin học | Tạo văn bản Lorem Ipsum | `tools/lorem-ipsum.html` |
| Công cụ tin học | Kiểm tra biểu thức Regex | `tools/regex-tester.html` |
| Công cụ tin học | JSON sang TypeScript, Go | `tools/json-to-types.html` |
| Công cụ tin học | Xem JSON dạng cây, JSONPath | `tools/json-viewer.html` |
| Công cụ tin học | Chuyển đổi YAML, JSON, TOML | `tools/yaml-json-toml.html` |
| Công cụ tin học | Định dạng câu lệnh SQL | `tools/sql-format.html` |
| Công cụ tin học | Markdown sang HTML | `tools/markdown-html.html` |
| Công cụ tin học | Tạo và giải thích biểu thức Cron | `tools/cron-gen.html` |
| Công cụ tin học | Đổi hệ cơ số (nhị phân, hex) | `tools/number-base.html` |
| Công cụ tin học | Chuyển lệnh cURL sang mã | `tools/curl-convert.html` |
| Công cụ tin học | So sánh hai JSON | `tools/json-diff.html` |
| Công cụ tin học | Tạo dữ liệu giả để thử | `tools/fake-data.html` |
| Công cụ tin học | Tạo file .gitignore | `tools/gitignore-gen.html` |
| Công cụ tin học | Tạo thẻ meta SEO, Open Graph | `tools/meta-tags.html` |
| Công cụ tin học | Thông tin trình duyệt, IP | `tools/browser-info.html` |
| Công cụ tin học | Tạo favicon cho website | `tools/favicon-gen.html` |
| Công cụ tin học | Tạo CSS đổ bóng, gradient | `tools/css-generator.html` |
| Công cụ tin học | Tạo bố cục Flexbox, Grid | `tools/flex-grid.html` |
| Công cụ tin học | Tối ưu và nén SVG | `tools/svg-optimize.html` |
| Công cụ tin học | Phân tích và sửa URL | `tools/url-parser.html` |
| Công cụ tin học | Tính subnet, CIDR IPv4, IPv6 | `tools/subnet-calc.html` |
| Công cụ tin học | Tạo robots.txt, sitemap.xml | `tools/robots-sitemap.html` |
| Công cụ tin học | Tra mã trạng thái HTTP | `tools/http-status.html` |
| Công cụ tin học | Kiểm tra độ tương phản màu | `tools/contrast-check.html` |
| Công cụ tin học | Tạo mã nhúng video, bản đồ | `tools/embed-code.html` |
| Xử lý file | Xoay, đánh số, xoá trang PDF | `tools/pdf-pages.html` |
| Kinh doanh online | Tạo chữ ký email | `tools/email-signature.html` |
| Tài chính & tính toán | Chia tiền hoá đơn, chi tiêu nhóm | `tools/bill-split.html` |
| Xử lý văn bản | Đọc số thành chữ | `tools/number-words.html` |
| Kinh doanh online | Tạo mã QR chuyển khoản VietQR | `tools/vietqr.html` |
| Tiếp thị | Quét mã QR, mã vạch | `tools/qr-scan.html` |
| Âm thanh & video | Tách khung hình từ video | `tools/video-frames.html` |
| Xử lý hình ảnh | Ghép ảnh và tạo meme | `tools/image-collage.html` |
| Xử lý hình ảnh | Xoá thông tin EXIF, GPS ảnh | `tools/exif-remove.html` |
| Âm thanh & video | Ghi âm online | `tools/voice-recorder.html` |
| Kiểm tra thiết bị | Đo tốc độ mạng Internet | `tools/speed-test.html` |
| Công cụ thời gian | Tạo lịch tháng, lịch năm để in | `tools/calendar-print.html` |
| Năng suất & đời sống | Chia đội ngẫu nhiên | `tools/team-split.html` |
| Tài chính & tính toán | Tính tiền điện sinh hoạt | `tools/electricity-bill.html` |

Chơi online (cờ vua, cờ tướng, cờ úp, cờ vây): nước đi chuyển qua broker MQTT công cộng miễn phí (`src/lib/mqtt.ts` tự viết, `src/lib/online.ts`), mã hoá AES-GCM theo từng bàn; bàn công khai lên danh sách "Bàn chờ bạn", bàn riêng mời bằng link `?id=<guid>`; đăng nhập Google thì ván đấu (JSON) lưu vào Drive của người chơi (`WFTools/Games`).

Mọi trang công cụ có thanh chia sẻ (Facebook, X, Reddit, Threads, LinkedIn, Pinterest, Tumblr, Telegram — `src/share.ts`) và nút tự gắn biểu tượng SVG theo nghĩa của nút (`src/btn-icons.ts`).

Bộ mã hoá QR (`src/lib/qr.ts`) và mã vạch (`src/lib/barcode.ts`) được viết riêng, **không phụ thuộc thư viện ngoài**.

Nhóm Xử lý file nạp thư viện từ CDN chỉ khi người dùng bấm xử lý (`src/lib/cdn.ts`): pdf-lib (gộp, tách, tạo PDF), pdf.js (đọc và vẽ trang PDF), PptxGenJS (tạo .pptx), JSZip (đọc .docx, .pptx), SheetJS (đọc, ghi Excel). Nhóm Công cụ tin học nạp js-beautify (định dạng JS/HTML/CSS) và acorn (kiểm lỗi, làm rối JS) từ CDN; tạo khoá RSA bằng Web Crypto sẵn có của trình duyệt. Bộ làm rối mã (`src/lib/obfuscate.ts`) tự viết trên AST acorn. Nhóm sức khoẻ và thời gian dùng công thức tự viết (BMI/BMR Mifflin–St Jeor, MET, dự đoán chu kỳ, ngày làm việc trừ lễ VN 2024–2027) và Intl API cho múi giờ. Công cụ Đếm ngược tạo video dùng WebCodecs + mp4-muxer để xuất MP4 (H.264), tự chuyển sang WebM nếu trình duyệt chưa hỗ trợ. Điểm danh và Nhật ký lưu vào Google Sheet qua bộ đồng bộ sẵn có. Bộ đọc PowerPoint (`src/lib/pptx.ts`) và vẽ trang chiếu (`src/lib/pptx-render.ts`), so sánh văn bản (`src/calc/diff.ts`, thuật toán Myers), đọc XML, CSV được viết riêng.

Các công cụ thêm ngày 27/10/2026 nạp thêm từ CDN khi cần: Tesseract.js 5 (OCR, dữ liệu ngôn ngữ từ tessdata), heic2any (HEIC), Transformers.js 3 (mô hình AI từ Hugging Face, ưu tiên WebGPU), lõi @ffmpeg/core 0.12 (video, chạy trong `public/vendor/ffmpeg-worker.js` cùng tên miền vì trình duyệt không cho tạo worker từ CDN), html-to-image (Word → PDF). Bộ đọc .docx (`src/lib/docxhtml.ts`), bộ ghi .docx (`src/lib/docxwriter.ts`), ghép chữ PDF (`src/calc/pdftext.ts`), nén ảnh trong PDF (`src/lib/pdfcompress.ts`), khung soạn trang PDF (`src/lib/pdfeditor.ts`), bộ tính biểu thức (`src/calc/expr.ts`), dò cao độ (`src/calc/pitch.ts`) đều tự viết.

## Trang ẩn

`hidden/zzz/index.html` (truy cập tại `/zzz`) là công cụ 4v2 chuyển từ repo messenger: biểu đồ nến Binance realtime, tín hiệu 2 kênh, backtest. Trang này không có trong menu, trang chủ và được đánh dấu `noindex` để công cụ tìm kiếm không liệt kê.

`hidden/cq.html` (truy cập tại `/hidden/cq.html`) là trang ẩn định giá chứng quyền: dán HTML bảng giá iBoard để tính định giá và tỷ lệ lợi nhuận. Một file độc lập, không dịch, `noindex`, không có trong menu, sitemap và không gắn Google Analytics.

`hidden/ls/index.html` (truy cập tại `/hidden/ls/`, gõ `/ls` cũng được) liệt kê link các chức năng ẩn (zzz, cq...). Cũng ẩn: `noindex`, không có trong menu, sitemap, không gắn Google Analytics. Thêm chức năng ẩn mới thì thêm một dòng vào trang này.

`hidden/search/index.html` (truy cập tại `/hidden/search/`) là Smart Search Crawler: tìm từ khóa trên Google, Bing, Baidu (mỗi web tới 100 kết quả), quản lý URL, crawl nội dung, AI tổng hợp, xuất Excel. Người dùng tải bộ chạy Node.js (`public/hidden/search/helper/`) về chạy trên máy để tìm và crawl; trang web làm việc với bộ chạy qua `127.0.0.1`.

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
  styles-extra.css      Giao diện riêng các công cụ thêm ngày 27/10/2026
  pages/                Logic từng trang
  lib/                  Bộ mã hoá QR, mã vạch, tiện ích tải ảnh
  stock/                Lõi phân tích của trang 4v2 (chỉ báo, xu hướng, kênh, backtest, dữ liệu Binance, biểu đồ)
public/                 Tệp tĩnh (favicon, từ điển ngôn ngữ, vendor/ffmpeg-worker.js)
```

## Thêm công cụ mới

1. Tạo `tools/<id>.html` (chép từ một trang có sẵn, giữ `data-root=".."` và `<main id="content">`). Vite tự nhận mọi file trong `tools/`.
2. Tạo `src/pages/<id>.ts`, gọi `mountLayout({ activeTool: '<id>' })`.
3. Thêm một mục vào `TOOLS` trong `src/tools.ts` (chọn nhóm qua trường `group`) và biểu tượng trong `src/icons.ts`.
4. Phần tính toán thuần đặt trong `src/calc/` để kiểm thử riêng được.

## Triển khai

Workflow `.github/workflows/deploy.yml` tự build và đăng lên GitHub Pages mỗi khi đẩy lên nhánh `main`.
Lần đầu cần bật: **Settings → Pages → Source: GitHub Actions**.
