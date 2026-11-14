/**
 * Danh sách nhóm và công cụ — nguồn dữ liệu duy nhất cho menu trái, trang chủ.
 * Thêm công cụ mới: tạo tools/<id>.html + src/pages/<id>.ts rồi thêm một mục vào TOOLS.
 * (vite.config.ts tự nhận mọi file trong thư mục tools/)
 */

export interface ToolGroup {
  id: string;
  name: string;
  description: string;
}

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  /** Đường dẫn tính từ thư mục gốc của site */
  path: string;
  group: string;
  /** Nội dung mẫu để vẽ biểu tượng bằng chính mã thật (chỉ QR, mã vạch) */
  iconSample?: string;
}

export const GROUPS: ToolGroup[] = [
  { id: 'image', name: 'Xử lý hình ảnh', description: 'Nén, đổi định dạng, xoá nền, đóng dấu ảnh ngay trên máy.' },
  { id: 'file', name: 'Xử lý file', description: 'Gộp tách PDF, đổi PowerPoint, so sánh văn bản, chuyển đổi dữ liệu.' },
  { id: 'excel', name: 'Xử lý dữ liệu Excel', description: 'Điền Word từ Excel, gộp ô, nối dòng và trộn dữ liệu nhiều sheet, nhiều file Excel theo công thức.' },
  { id: 'text', name: 'Xử lý văn bản', description: 'Đổi kiểu chữ, chữ đẹp mạng xã hội, đọc văn bản và gõ bằng giọng nói.' },
  { id: 'business', name: 'Kinh doanh online', description: 'Công cụ cho shop online, hộ kinh doanh, freelancer.' },
  { id: 'finance', name: 'Tài chính & tính toán', description: 'Tính toán chính xác theo công thức và quy định hiện hành.' },
  { id: 'calc', name: 'Máy tính & chuyển đổi', description: 'Máy tính khoa học, tính phần trăm, đổi đơn vị đo.' },
  { id: 'marketing', name: 'Tiếp thị', description: 'Mã QR, liên kết chiến dịch, màu sắc thương hiệu.' },
  { id: 'life', name: 'Năng suất & đời sống', description: 'Tiện ích dùng hằng ngày.' },
  { id: 'health', name: 'Tiện ích sức khoẻ', description: 'Theo dõi cân nặng, dinh dưỡng, nước uống, vận động, chu kỳ.' },
  { id: 'edu', name: 'Giáo dục & giảng dạy', description: 'Thời khoá biểu, đề thi, điểm danh, sơ đồ tư duy, thù lao.' },
  { id: 'time', name: 'Công cụ thời gian', description: 'Đồng hồ, đếm ngược, múi giờ, ngày làm việc, nhật ký.' },
  { id: 'device', name: 'Kiểm tra thiết bị', description: 'Thử webcam, quay màn hình, đo tốc độ gõ phím và tốc độ click chuột.' },
  { id: 'media', name: 'Âm thanh & video', description: 'Nén video, tách nhạc MP3 và lên dây đàn guitar ngay trên trình duyệt.' },
  { id: 'dev', name: 'Công cụ tin học', description: 'Định dạng, kiểm lỗi, mã hoá và chuyển đổi mã nguồn.' },
  { id: 'entertainment', name: 'Game giải trí', description: 'Vòng quay may mắn, quay số ngẫu nhiên và các trò chơi trên trình duyệt: Sudoku, cờ vua, cờ tướng, cờ caro, 2048, dò mìn, xếp gạch, rắn săn mồi, xếp bài, phá gạch.' },
];

const tool = (id: string, group: string, name: string, description: string, iconSample?: string): ToolInfo => ({
  id, group, name, description, path: `tools/${id}.html`, iconSample,
});

export const TOOLS: ToolInfo[] = [
  // Xử lý hình ảnh
  tool('image-convert', 'image', 'Nén ảnh', 'Giảm dung lượng ảnh, thu nhỏ kích thước nhiều ảnh cùng lúc để đăng web, gửi email nhanh hơn.'),
  tool('image-format', 'image', 'Chuyển đổi định dạng ảnh', 'Đổi ảnh qua lại giữa JPG, PNG, WebP, AVIF, BMP, ICO (favicon) cho website, ứng dụng hoặc lưu trữ.'),
  tool('image-base64', 'image', 'Ảnh sang Base64', 'Chuyển ảnh thành chuỗi Base64 để nhúng vào HTML, CSS, mã nguồn, và đổi Base64 ngược lại thành ảnh.'),
  tool('bg-remove', 'image', 'Xoá nền ảnh', 'Xoá nền trắng, nền một màu hoặc mọi loại nền (AI chạy ngay trên máy) khỏi ảnh sản phẩm, logo, chân dung, thú cưng, tải PNG nền trong suốt.'),
  tool('watermark', 'image', 'Thêm watermark vào ảnh', 'Chèn chữ, logo hoặc dấu bản quyền lên một hoặc nhiều ảnh cùng lúc.'),

  // Xử lý file
  tool('pdf-merge', 'file', 'Nối và tách PDF', 'Gộp nhiều file PDF thành một, tách lấy trang cần dùng, chia nhỏ file PDF theo từng trang.'),
  tool('pptx-pdf', 'file', 'PowerPoint ↔ PDF', 'Chuyển bài trình chiếu PowerPoint (.pptx) sang PDF và chuyển PDF thành file PowerPoint.'),
  tool('file-diff', 'file', 'So sánh hai file', 'Tìm chỗ khác nhau giữa hai văn bản: TXT, Word, HTML, PDF có chữ. Tô màu phần thêm, xoá, sửa.'),
  tool('text-analysis', 'file', 'Phân tích văn bản', 'Đếm số từ, ký tự, câu, đoạn, ước tính thời gian đọc và mật độ từ khoá của văn bản, file TXT, Word, PDF.'),
  tool('data-convert', 'file', 'Chuyển đổi JSON, XML, CSV, Excel', 'Đổi dữ liệu qua lại giữa JSON, XML, CSV và Excel (.xlsx), xem trước dạng bảng.'),

  // Tiện ích sức khoẻ
  tool('bmi-bmr', 'health', 'Chỉ số BMI & BMR', 'Tính chỉ số khối cơ thể BMI, tỷ lệ eo/hông và nhu cầu calo cơ bản BMR, TDEE theo độ tuổi, giới tính, vận động.'),
  tool('meal-calo', 'health', 'Thực đơn & calo hàng ngày', 'Lập thực đơn theo mục tiêu calo, tra lượng calo món ăn Việt, cân đối đạm, tinh bột, chất béo.'),
  tool('water-tracker', 'health', 'Theo dõi nước uống', 'Đặt mục tiêu và ghi lượng nước uống mỗi ngày, xem tiến độ và lịch sử nhiều ngày.'),
  tool('calo-burn', 'health', 'Calo tiêu hao vận động', 'Ước tính lượng calo tiêu hao theo môn thể thao, hoạt động, thời gian và cân nặng (chỉ số MET).'),
  tool('cycle-track', 'health', 'Theo dõi chu kỳ', 'Ghi và dự đoán chu kỳ kinh nguyệt, ngày rụng trứng và khoảng dễ thụ thai. Dữ liệu chỉ lưu trên máy bạn.'),

  // Giáo dục & giảng dạy
  tool('study-timetable', 'edu', 'Thời khoá biểu học tập', 'Lập thời khoá biểu theo tiết, theo buổi cho cả tuần; in hoặc lưu lại để dùng mỗi ngày.'),
  tool('quiz-bank', 'edu', 'Đề thi & câu hỏi trắc nghiệm', 'Soạn ngân hàng câu hỏi trắc nghiệm, trộn đề, làm thử chấm điểm ngay, in đề và đáp án.'),
  tool('attendance', 'edu', 'Điểm danh', 'Lập danh sách lớp, điểm danh theo buổi, thống kê số buổi vắng, đi muộn. Lưu được vào Google Sheet.'),
  tool('mindmap', 'edu', 'Sơ đồ tư duy & tóm tắt', 'Vẽ sơ đồ tư duy cho bài học và tự tóm tắt văn bản dài thành các ý chính.'),
  tool('teaching-pay', 'edu', 'Giờ giảng & thù lao', 'Ghi các buổi dạy, tính tổng số giờ và thù lao theo đơn giá, xuất bảng kê.'),

  // Công cụ thời gian
  tool('fullscreen-clock', 'time', 'Đồng hồ toàn màn hình', 'Đồng hồ số lớn toàn màn hình kèm bấm giờ (stopwatch) và đếm ngược, tuỳ chỉnh màu, phông, 12/24 giờ.'),
  tool('countdown-video', 'time', 'Đếm ngược tạo video', 'Tạo đồng hồ đếm ngược tuỳ chỉnh màu nền, màu số, phông và tải về video để chèn vào clip.'),
  tool('world-clock', 'time', 'Đồng hồ thế giới', 'Xem giờ hiện tại ở nhiều quốc gia cùng lúc và so sánh chênh lệch múi giờ giữa các nước.'),
  tool('workdays', 'time', 'Tính ngày làm việc', 'Đếm số ngày làm việc giữa hai mốc thời gian, trừ thứ Bảy, Chủ nhật và ngày lễ.'),
  tool('journal', 'time', 'Nhật ký online', 'Viết nhật ký mỗi ngày, lưu riêng vào Google Sheet của bạn, chỉ mình bạn đọc được.'),

  // Công cụ tin học
  tool('code-format', 'dev', 'Định dạng JS, HTML, CSS, JSON', 'Căn chỉnh, thụt lề gọn gàng cho mã JavaScript, HTML, CSS và JSON.'),
  tool('code-check', 'dev', 'Kiểm tra lỗi cú pháp', 'Tìm lỗi cú pháp, cấu trúc trong JavaScript, HTML, CSS, JSON và chỉ ra dòng, cột.'),
  tool('js-obfuscate', 'dev', 'Làm rối mã JavaScript', 'Mã hoá chuỗi, đổi tên biến, che giấu mã JavaScript để khó đọc, khó sao chép (JavaScript Obfuscator).'),
  tool('rsa-keys', 'dev', 'Khoá RSA & mã hoá', 'Tạo cặp khoá RSA (PEM), mã hoá văn bản bằng khoá công khai và giải mã bằng khoá bí mật ngay trên máy.'),
  tool('text-to-html', 'dev', 'Soạn văn bản thành HTML', 'Soạn thảo trực quan có in đậm, tiêu đề, danh sách, bảng, liên kết và lấy mã HTML sạch.'),
  tool('web-desktop', 'dev', 'Desktop online', 'Màn hình máy tính ngay trên trình duyệt: quản lý file, Notepad, xem ảnh, PDF, máy tính, lịch, thùng rác. File lưu vào Google Drive của bạn.'),

  // Kinh doanh online
  tool('inventory', 'business', 'Tồn kho & tính giá bán', 'Tính giá bán theo phí sàn, quảng cáo, biên lợi nhuận. Quản lý nhập xuất tồn, cảnh báo sắp hết hàng.'),
  tool('invoice', 'business', 'Hoá đơn & báo giá', 'Lập báo giá, hoá đơn bán hàng có logo, tự tính tổng tiền và đọc số tiền bằng chữ. In hoặc lưu PDF.'),
  tool('menu-qr', 'business', 'Thực đơn QR', 'Tạo thực đơn điện tử cho quán ăn, quán cà phê. Khách quét mã QR là xem được món và giá.'),
  tool('barcode', 'business', 'Tạo mã vạch', 'Tạo mã vạch Code 128, EAN‑13, EAN‑8, UPC‑A, Code 39 để in nhãn sản phẩm, kho hàng.', 'WFT'),

  // Tài chính & tính toán
  tool('loan', 'finance', 'Tính khoản vay', 'Số tiền trả hằng tháng, tổng lãi và lịch trả nợ cho vay mua nhà, mua xe, vay tiêu dùng.'),
  tool('compound', 'finance', 'Lãi kép & tích luỹ', 'Dự tính số tiền tích luỹ khi gửi tiết kiệm hoặc đầu tư đều đặn hằng tháng.'),
  tool('salary', 'finance', 'Lương Gross ↔ Net', 'Đổi lương Gross sang Net và ngược lại theo bảo hiểm, thuế thu nhập cá nhân năm 2026.'),
  tool('pit-tax', 'finance', 'Tính thuế TNCN và quyết toán năm', 'Tính thuế thu nhập cá nhân cả năm từ lương và thưởng Tết theo biểu thuế 5 bậc, giảm trừ 15,5 triệu; xem phải nộp thêm hay được hoàn khi quyết toán.'),
  tool('savings-bhxh', 'finance', 'Lãi tiết kiệm, lương hưu và BHXH', 'Tính lãi gửi tiết kiệm ngân hàng theo kỳ hạn, ước tính lương hưu hằng tháng và tiền BHXH một lần theo Luật Bảo hiểm xã hội 2024.'),

  // Tiếp thị
  tool('qr-code', 'marketing', 'Tạo mã QR', 'Tạo mã QR cho liên kết, văn bản, Wi‑Fi, email, số điện thoại. Tải về PNG hoặc SVG.', 'WFT'),
  tool('utm', 'marketing', 'Tạo link UTM', 'Gắn mã theo dõi chiến dịch vào liên kết để biết khách đến từ kênh nào.'),
  tool('colors', 'marketing', 'Bảng màu & mã màu', 'Tạo bảng màu hài hoà từ một màu gốc, lấy mã HEX, RGB, HSL và biến CSS.'),

  // Năng suất & đời sống
  tool('expense', 'life', 'Chi tiêu & ngân sách', 'Ghi thu chi hằng ngày, xem chi theo danh mục, đặt hạn mức để không vượt ngân sách.'),
  tool('habit', 'life', 'Thói quen & chuỗi ngày', 'Đánh dấu thói quen mỗi ngày, theo dõi chuỗi ngày liên tiếp để giữ kỷ luật.'),
  tool('cv', 'life', 'Tạo CV xin việc', 'Điền thông tin theo mẫu, xem trước trực tiếp, chọn mẫu và màu, in hoặc lưu PDF miễn phí.'),
  tool('currency-time', 'life', 'Tiền tệ & múi giờ', 'Đổi ngoại tệ theo tỷ giá mới nhất và xem giờ ở các thành phố trên thế giới.'),

  // Công cụ thêm ngày 27/10/2026 (nhóm theo trường group)
  tool('image-resize', 'image', 'Đổi kích thước ảnh', 'Thay đổi chiều rộng, chiều cao ảnh theo pixel hoặc phần trăm, giữ đúng tỉ lệ, xử lý nhiều ảnh cùng lúc.'),
  tool('image-crop', 'image', 'Cắt ảnh', 'Cắt ảnh theo khung tự chọn hoặc tỉ lệ 1:1, 4:3, 16:9, 9:16, xoay và lật ảnh trước khi tải về.'),
  tool('image-ocr', 'image', 'Lấy chữ từ ảnh (OCR)', 'Nhận dạng chữ trong ảnh chụp, ảnh màn hình, tài liệu scan thành văn bản sao chép được. Hỗ trợ tiếng Việt và hơn 30 ngôn ngữ.'),
  tool('heic-jpg', 'image', 'Chuyển HEIC sang JPG', 'Đổi ảnh HEIC chụp từ iPhone sang JPG hoặc PNG để mở được trên mọi máy, xử lý nhiều ảnh cùng lúc.'),
  tool('image-upscale', 'image', 'Làm nét & phóng to ảnh AI', 'Phóng to ảnh gấp 2 hoặc 4 lần và làm nét chi tiết bằng AI, phù hợp ảnh nhỏ, ảnh mờ, ảnh cũ.'),
  tool('image-to-pdf', 'file', 'Ảnh sang PDF', 'Ghép nhiều ảnh JPG, PNG thành một file PDF, sắp xếp thứ tự, chọn khổ giấy và lề.'),
  tool('pdf-to-image', 'file', 'PDF sang ảnh', 'Chuyển từng trang PDF thành ảnh JPG hoặc PNG sắc nét, chọn độ phân giải, tải từng ảnh hoặc cả file ZIP.'),
  tool('pdf-compress', 'file', 'Nén PDF', 'Giảm dung lượng file PDF để gửi email, nộp hồ sơ online. Chọn mức nén, xem dung lượng trước và sau.'),
  tool('pdf-to-word', 'file', 'PDF sang Word', 'Chuyển PDF thành file Word (.docx) chỉnh sửa được, giữ chữ và đoạn văn; tuỳ chọn giữ nguyên hình trang.'),
  tool('word-to-pdf', 'file', 'Word sang PDF', 'Chuyển file Word (.docx) sang PDF ngay trên trình duyệt, xem trước rồi tải về hoặc in.'),
  tool('pdf-sign', 'file', 'Ký tên lên PDF', 'Vẽ hoặc gõ chữ ký, thêm ảnh chữ ký và ngày tháng, đặt lên đúng vị trí trên trang PDF rồi tải về.'),
  tool('pdf-edit', 'file', 'Thêm chữ & điền form PDF', 'Gõ thêm chữ, đánh dấu, che thông tin trên PDF và điền các ô biểu mẫu có sẵn, hỗ trợ tiếng Việt.'),
  tool('case-convert', 'text', 'Đổi chữ hoa, chữ thường', 'Đổi văn bản sang CHỮ HOA, chữ thường, Viết Hoa Đầu Từ, kiểu câu, camelCase, snake_case, bỏ dấu tiếng Việt.'),
  tool('fancy-text', 'text', 'Tạo chữ kiểu đẹp', 'Biến chữ thường thành hơn 30 kiểu chữ đẹp để đặt tên game, bio Facebook, Instagram, TikTok; sao chép một chạm.'),
  tool('text-to-speech', 'text', 'Đọc văn bản thành giọng nói', 'Đọc to văn bản bằng giọng nói có sẵn trên máy, chọn giọng, tốc độ, cao độ; hỗ trợ tiếng Việt và nhiều ngôn ngữ.'),
  tool('speech-to-text', 'text', 'Nói thành chữ', 'Gõ văn bản bằng giọng nói: nói vào micro, chữ hiện ra ngay; chọn ngôn ngữ, sao chép hoặc tải về.'),
  tool('scientific-calc', 'calc', 'Máy tính khoa học', 'Máy tính online có lượng giác, logarit, luỹ thừa, căn, giai thừa, độ/radian, bộ nhớ và lịch sử phép tính.'),
  tool('percentage', 'calc', 'Tính phần trăm', 'Tính X% của Y, X là bao nhiêu % của Y, phần trăm tăng giảm, giá sau giảm giá; có giải thích từng bước.'),
  tool('unit-convert', 'calc', 'Đổi đơn vị đo', 'Đổi độ dài, khối lượng, nhiệt độ, diện tích, thể tích, tốc độ, thời gian, dữ liệu, áp suất, năng lượng.'),
  tool('age-calc', 'time', 'Tính tuổi', 'Tính tuổi chính xác theo năm, tháng, ngày từ ngày sinh; số ngày đã sống, ngày sinh nhật tiếp theo, cung hoàng đạo.'),
  tool('date-calc', 'time', 'Cộng trừ ngày tháng', 'Đếm số ngày giữa hai ngày, cộng hoặc trừ ngày, tuần, tháng, năm vào một ngày; xem thứ trong tuần.'),
  tool('gpa', 'edu', 'Tính điểm GPA', 'Tính điểm trung bình học kỳ, tích luỹ theo tín chỉ; thang 4, thang 10 và quy đổi điểm chữ A, B, C, D.'),
  tool('due-date', 'health', 'Tính ngày dự sinh', 'Tính ngày dự sinh và tuổi thai theo kỳ kinh cuối, ngày thụ thai hoặc siêu âm; xem các mốc khám thai quan trọng.'),
  tool('spin-wheel', 'entertainment', 'Vòng quay may mắn', 'Tạo vòng quay với tên, phần thưởng tuỳ ý; quay ngẫu nhiên công bằng, loại người đã trúng, toàn màn hình.'),
  tool('random-number', 'entertainment', 'Quay số ngẫu nhiên', 'Tạo số ngẫu nhiên trong khoảng tuỳ chọn, nhiều số cùng lúc, không trùng lặp; dùng cho bốc thăm, xổ số vui.'),
  tool('sudoku-9x9', 'entertainment', 'Sudoku 9x9', 'Chơi Sudoku 9x9 online với 10 cấp từ dễ đến khó, có ghi chú, gợi ý và kiểm tra lỗi.'),
  tool('sudoku-16x16', 'entertainment', 'Sudoku 16x16', 'Sudoku cỡ lớn 16x16 dùng số 1-9 và chữ A-G, 10 cấp từ dễ đến khó, có ghi chú và gợi ý.'),
  tool('chess', 'entertainment', 'Cờ vua', 'Chơi cờ vua với máy qua 10 cấp, hoặc mời bạn, ghép với người lạ qua mạng. Đủ luật nhập thành, bắt tốt qua đường và phong cấp.'),
  tool('xiangqi', 'entertainment', 'Cờ tướng', 'Chơi cờ tướng với máy qua 10 cấp, hoặc mời bạn, ghép với người lạ qua mạng. Đủ luật chân mã, cản tượng, pháo ăn, hai tướng không đối mặt.'),
  tool('co-up', 'entertainment', 'Cờ úp', 'Chơi cờ úp: quân úp ngẫu nhiên, đi xong mới lật. Đánh với máy 10 cấp hoặc mời bạn, ghép với người lạ qua mạng.'),
  tool('go-game', 'entertainment', 'Cờ vây', 'Chơi cờ vây với máy qua 10 cấp, hoặc mời bạn, ghép với người lạ qua mạng trên bàn 9x9, 13x13, 19x19. Tự chấm điểm khi kết thúc.'),
  tool('memory-shapes', 'entertainment', 'Ghi nhớ hình và màu', 'Các ô hình và màu lộ ra 5 giây rồi úp lại; nhớ và chọn đúng ô theo hình mẫu, 10 cấp từ dễ đến khó.'),
  tool('game-2048', 'entertainment', '2048', 'Trượt và gộp các ô số giống nhau để tạo ô 2048; 10 cấp từ mục tiêu 64 đến 8192, có đi lại.'),
  tool('minesweeper', 'entertainment', 'Dò mìn', 'Trò dò mìn cổ điển: mở ô, cắm cờ, đoán vị trí mìn qua các con số; 10 cấp từ bàn 8x8 đến 18x18, chơi được trên điện thoại.'),
  tool('block-puzzle', 'entertainment', 'Xếp gạch', 'Xoay và xếp các khối gạch rơi để lấp kín hàng; 10 cấp tốc độ tăng dần, chơi bằng bàn phím hoặc nút cảm ứng.'),
  tool('snake', 'entertainment', 'Rắn săn mồi', 'Điều khiển rắn ăn mồi để dài ra, tránh tường và thân mình; 10 cấp tăng tốc, có chướng ngại.'),
  tool('solitaire', 'entertainment', 'Xếp bài Solitaire', 'Solitaire Klondike cổ điển: xếp bài xen màu, đưa lên ô đích từ A đến K; rút 1 hoặc 3 lá, có đi lại và gợi ý.'),
  tool('spider-solitaire', 'entertainment', 'Xếp bài Nhện (Spider)', 'Spider Solitaire 1, 2 và 4 chất: xếp dãy K đến A cùng chất để gỡ khỏi bàn; 10 cấp, có đi lại và gợi ý.'),
  tool('freecell', 'entertainment', 'FreeCell', 'Xếp bài FreeCell: mọi lá đều ngửa, dùng các ô trống để sắp bài lên ô đích; 10 cấp với số ô trống giảm dần.'),
  tool('yukon', 'entertainment', 'Xếp bài Yukon', 'Yukon Solitaire: như Klondike nhưng không có chồng rút, kéo được cả cụm lá nằm dưới; 10 cấp, có đi lại và gợi ý.'),
  tool('chinese-checkers', 'entertainment', 'Cờ nhảy (Chinese Checkers)', 'Cờ nhảy sao 6 cánh đánh với máy: bước hoặc nhảy liên tiếp để đưa 10 quân sang góc đối diện trước; 10 cấp.'),
  tool('mau-binh', 'entertainment', 'Mậu binh (xếp 3 chi)', 'Mậu binh đấu với máy: xếp 13 lá thành 3 chi 5-5-3 mạnh dần, tránh binh lủng; 5 ván mỗi cấp, 10 cấp.'),
  tool('phom', 'entertainment', 'Phỏm (Tá lả)', 'Phỏm 2 người đấu với máy: bốc, ăn bài, hạ phỏm và đánh bài; ai ít điểm bài rác hơn thì thắng, có ù; 10 cấp.'),
  tool('shogi', 'entertainment', 'Shogi (cờ tướng Nhật)', 'Shogi online đánh với máy: thả quân bắt được, thăng cấp, chiếu bí Vua; 10 cấp, có đi lại.'),
  tool('janggi', 'entertainment', 'Janggi (cờ tướng Hàn Quốc)', 'Janggi online đánh với máy: cờ tướng kiểu Hàn có đường chéo trong cung, pháo nhảy một quân, tượng 3 bước; 10 cấp, có đi lại.'),
  tool('pinball', 'entertainment', 'Pinball (bắn bi)', 'Pinball online: gạt cần trái phải để giữ bóng, đập bumper lấy điểm đạt mục tiêu trước khi hết 3 bóng; 10 cấp.'),
  tool('cribbage', 'entertainment', 'Cribbage (đếm bài)', 'Cribbage 2 người đấu với máy: bỏ chuồn, đánh bài đến 31, đếm bài ăn điểm, chạy đua tới 61; 10 cấp.'),
  tool('tangram', 'entertainment', 'Tangram (xếp 7 mảnh)', 'Tangram online: kéo 7 mảnh ghép vừa khít vào hình bóng, xoay và lật mảnh; 10 cấp từ ít mảnh có viền gợi ý đến đủ 7 mảnh không gợi ý.'),
  tool('gomoku', 'entertainment', 'Cờ caro', 'Chơi cờ caro 5 quân liên tiếp với máy trên bàn 15x15, 10 cấp từ dễ đến khó, có đi lại.'),
  tool('reversi', 'entertainment', 'Cờ lật (Reversi)', 'Kẹp quân đối thủ để lật thành màu của mình; chơi Reversi 8x8 với máy qua 10 cấp.'),
  tool('connect-four', 'entertainment', 'Nối 4', 'Thả quân vào cột, nối 4 quân liên tiếp ngang, dọc hoặc chéo trước máy; 10 cấp từ dễ đến khó.'),
  tool('match-3', 'entertainment', 'Ghép 3 viên kẹo', 'Đổi chỗ các viên kẹo để ghép 3 viên cùng loại, nổ dây chuyền ghi điểm; 10 cấp có mục tiêu điểm và số lượt.'),
  tool('brick-breaker', 'entertainment', 'Phá gạch', 'Điều khiển thanh đỡ đánh bóng phá hết gạch; 10 màn bố cục khác nhau, chơi bằng chuột, chạm hoặc phím.'),
  tool('pyramid', 'entertainment', 'Bài Kim tự tháp', 'Gỡ hết 28 lá của kim tự tháp bằng cách ghép các cặp lá cộng đủ 13; 10 cấp với số lần lật lại chồng bài giảm dần.'),
  tool('tripeaks', 'entertainment', 'Bài Ba đỉnh (TriPeaks)', 'Gỡ hết ba đỉnh bài bằng cách nối các lá hơn kém nhau 1 bậc; 10 cấp từ dễ đến khó.'),
  tool('golf', 'entertainment', 'Bài Golf', 'Gỡ hết các cột bài bằng cách nối lá hơn kém nhau 1 bậc với lá đang lộ; 10 cấp, càng cao càng nhiều cột.'),
  tool('blackjack', 'entertainment', 'Xì dách (Blackjack)', 'Chơi Xì dách bằng xu ảo với nhà cái: gần 21 nhất mà không quá; gấp đôi, tách đôi; 10 cấp với mục tiêu xu tăng dần.'),
  tool('video-poker', 'entertainment', 'Video Poker', 'Poker 5 lá giữ và đổi bài bằng xu ảo (Jacks or Better); 10 cấp với bảng thưởng chặt dần.'),
  tool('checkers', 'entertainment', 'Cờ đam', 'Cờ đam 8x8 đánh với máy: bắt buộc ăn, ăn liên tiếp, phong Vua; 10 cấp từ dễ đến khó.'),
  tool('ludo', 'entertainment', 'Cờ cá ngựa', 'Cờ cá ngựa bốn màu: tung xúc xắc, đưa 4 quân về đích trước; chơi với 1 đến 3 máy qua 10 cấp.'),
  tool('o-an-quan', 'entertainment', 'Ô ăn quan', 'Trò dân gian Việt Nam: rải dân, ăn quan, đánh với máy qua 10 cấp từ dễ đến khó.'),
  tool('lights-out', 'entertainment', 'Lights Out', 'Tắt hết các bóng đèn: mỗi lần bấm đổi cả ô đó và 4 ô kề; 10 cấp với bàn lớn dần, có gợi ý.'),
  tool('fifteen', 'entertainment', 'Xếp số 15 (15-puzzle)', 'Trượt các ô số về đúng thứ tự; 10 cấp từ bàn 3x3 đến 5x5, chơi bằng chuột, chạm hoặc phím mũi tên.'),
  tool('flood-it', 'entertainment', 'Flood-it (Tô màu loang)', 'Tô màu loang từ góc để cả bàn cùng một màu trong số nước giới hạn; 10 cấp với bàn lớn và nhiều màu dần.'),
  tool('mastermind', 'entertainment', 'Mastermind (Đoán dãy màu)', 'Đoán dãy màu mà máy giấu dựa vào chấm đen/trắng gợi ý; 10 cấp với dãy dài và nhiều màu dần.'),
  tool('hanoi', 'entertainment', 'Tháp Hà Nội', 'Chuyển các đĩa từ cọc đầu sang cọc cuối, không đặt đĩa to lên đĩa nhỏ; 10 cấp từ 3 đĩa đến 12 đĩa 4 cọc.'),
  tool('pipes', 'entertainment', 'Nối ống', 'Xoay các đoạn ống để nối thành một mạng liền không đầu hở; 10 cấp với bàn lớn dần.'),
  tool('nonogram', 'entertainment', 'Nonogram (Picross)', 'Tô ô theo các số gợi ý ở hàng và cột để hiện ra bức tranh; 10 cấp từ bàn 5x5 đến 15x15.'),
  tool('sokoban', 'entertainment', 'Sokoban (Đẩy thùng)', 'Đẩy các thùng vào ô đích trong kho; mọi màn đều có lời giải, 10 cấp tăng dần số thùng và kích thước kho.'),
  tool('block-10x10', 'entertainment', 'Xếp khối 10x10', 'Đặt các mảnh vào lưới 10x10, lấp đầy hàng hoặc cột để xoá và đạt điểm mục tiêu; 10 cấp.'),
  tool('dots-boxes', 'entertainment', 'Nối điểm chiếm ô (Dots and Boxes)', 'Lần lượt nối các chấm để chiếm ô vuông, đánh với máy qua 10 cấp từ dễ đến khó.'),
  tool('ultimate-tictactoe', 'entertainment', 'Ultimate Tic-Tac-Toe (Caro 9 bàn)', 'Caro 3x3 lồng 9 bàn nhỏ: ô bạn chọn quyết định bàn đối thủ phải đi; đánh với máy qua 10 cấp.'),
  tool('pong', 'entertainment', 'Pong (Bóng bàn điện tử)', 'Đánh bóng qua mặt máy, ai ghi 5 điểm trước thì thắng; 10 cấp, máy nhanh và chính xác dần.'),
  tool('space-shooter', 'entertainment', 'Bắn phi thuyền', 'Lái tàu bắn hạ phi thuyền địch, tránh đạn và va chạm; 10 cấp với địch đông, bắn trả và tàu bền dần.'),
  tool('asteroids', 'entertainment', 'Tiểu hành tinh (Asteroids)', 'Xoay, tăng tốc và bắn vỡ đá vũ trụ; đá lớn vỡ thành đá nhỏ, 10 cấp càng lúc càng nhiều đá.'),
  tool('maze', 'entertainment', 'Mê cung', 'Tìm đường ra khỏi mê cung trước khi hết giờ; 10 cấp từ mê cung nhỏ đến lớn, có sương mù ở cấp cao.'),
  tool('road-cross', 'entertainment', 'Qua đường (Ếch qua đường)', 'Nhảy chú ếch qua đường xe cộ và sông gỗ trôi để về đích 3 lần; 10 cấp với xe nhanh và sông ở cấp cao.'),
  tool('flappy', 'entertainment', 'Chim bay (Flappy)', 'Chạm để vỗ cánh, bay qua khe giữa các ống; 10 cấp với khe hẹp dần và tốc độ tăng.'),
  tool('runner', 'entertainment', 'Khủng long chạy', 'Nhảy qua xương rồng, cúi tránh chim; chạy đủ quãng đường để qua cấp, 10 cấp tốc độ tăng dần.'),
  tool('whack-a-mole', 'entertainment', 'Đập chuột (Whack-a-mole)', 'Đập chuột nhô lên từ các hang trước khi hết giờ, tránh quả bom; 10 cấp từ chậm đến cực nhanh.'),
  tool('simon', 'entertainment', 'Simon (Nhớ dãy màu)', 'Nhớ và lặp lại dãy màu, âm thanh mà máy phát; dãy dài dần qua 10 cấp, từ cấp 7 có 6 nút.'),
  tool('aim-trainer', 'entertainment', 'Tập ngắm (Aim Trainer)', 'Bấm trúng các bia hiện ngẫu nhiên và biến mất nhanh; bia nhỏ dần qua 10 cấp, đo thời gian phản ứng.'),
  tool('quick-math', 'entertainment', 'Toán nhanh', 'Tính nhẩm phép cộng, trừ, nhân, chia dưới áp lực thời gian; 10 cấp từ phép tính đơn giản đến biểu thức.'),
  tool('reaction', 'entertainment', 'Thử phản xạ', 'Bấm ngay khi màn hình chuyển xanh; trung bình 5 lượt phải đạt ngưỡng của cấp, 10 cấp ngưỡng chặt dần.'),
  tool('kalah', 'entertainment', "Kalah (Mancala)", 'Rải hạt qua các ô, ăn hạt đối thủ và đi tiếp khi rơi vào kho; đánh với máy qua 10 cấp từ dễ đến khó.'),
  tool('snakes-ladders', 'entertainment', "Rắn và thang", 'Tung xúc xắc đi từ ô 1 đến ô 100, leo thang, tránh rắn và về đích trước đối thủ; 10 cấp.'),
  tool('nine-mens-morris', 'entertainment', "Cờ cối (Nine Men's Morris)", 'Đặt, di chuyển và bay quân để xếp ba quân thẳng hàng rồi bốc quân đối thủ; đánh với máy qua 10 cấp.'),
  tool('battleship', 'entertainment', "Hải chiến (Battleship)", 'Đoán vị trí và nhấn chìm hạm đội của máy trên lưới 10x10 trước khi bị nhấn chìm; 10 cấp, máy suy luận khôn dần.'),
  tool('bau-cua', 'entertainment', "Bầu cua tôm cá", 'Trò dân gian: đặt xu ảo vào các linh vật, lắc ba xúc xắc; đạt số xu mục tiêu qua 10 cấp (không dùng tiền thật).'),
  tool('baccarat', 'entertainment', "Baccarat", 'Cược Con, Cái hoặc Hoà với bài chia theo luật chuẩn bằng xu ảo; đạt xu mục tiêu qua 10 cấp (không dùng tiền thật).'),
  tool('bai-cao', 'entertainment', "Bài cào (ba lá)", 'Chia 3 lá so điểm với nhà cái: Sáp, Ba tiên rồi tới điểm 9 xuống 0; xu ảo, 10 cấp, không dùng tiền thật.'),
  tool('bingo', 'entertainment', "Bingo", 'Đánh dấu các số được gọi trên thẻ 5x5 và hô BINGO trước đối thủ máy; số gọi nhanh dần qua 10 cấp.'),
  tool('yahtzee', 'entertainment', "Yahtzee (Xúc xắc 5 viên)", 'Tung 5 xúc xắc, giữ viên tốt và ghi điểm vào 13 ô; đạt điểm mục tiêu qua 10 cấp.'),
  tool('crazy-eights', 'entertainment', "Bài 8 lá (Crazy Eights)", 'Đánh bài cùng chất hoặc cùng số, lá 8 đổi chất; hết bài trước 1 đến 3 máy qua 10 cấp.'),
  tool('car-race', 'entertainment', 'Đua xe né xe', 'Đổi làn để né xe phía trước, chạy đủ quãng đường; 10 cấp thêm làn và tăng tốc.'),
  tool('sky-jump', 'entertainment', 'Nhảy lên cao', 'Nảy từ bệ này sang bệ khác để leo thật cao, tránh rơi; 10 cấp bệ thưa dần, có bệ di động và bệ vỡ.'),
  tool('gold-miner', 'entertainment', 'Đào vàng', 'Thả móc câu kéo vàng, kim cương; tránh đá nặng; đạt tiền mục tiêu trong 60 giây, 10 cấp.'),
  tool('fruit-slice', 'entertainment', 'Cắt trái cây', 'Vuốt ngang để cắt trái cây bay lên, né bom; 10 cấp nhiều quả và bom hơn.'),
  tool('basketball', 'entertainment', 'Ném bóng rổ', 'Kéo và thả để ném bóng vào rổ trong số lần giới hạn; 10 cấp, rổ di chuyển từ cấp 4.'),
  tool('bubble-shooter', 'entertainment', 'Bắn bóng màu', 'Bắn bóng nối từ 3 cùng màu để làm nổ, xoá hết bóng trước khi chạm đáy; 10 cấp thêm màu.'),
  tool('dot-chase', 'entertainment', 'Ăn chấm', 'Ăn hết chấm trong mê cung, tránh ma đuổi theo; 10 cấp, thêm ma và ma thông minh dần.'),
  tool('kakuro', 'entertainment', 'Kakuro (Ô số tổng)', 'Điền số 1–9 vào ô trắng sao cho tổng từng dãy bằng gợi ý và không lặp số; 10 cấp, lưới từ 5x5 đến 9x9.'),
  tool('kenken', 'entertainment', 'KenKen (Ô số phép tính)', 'Điền số vào lưới không lặp ở hàng và cột, mỗi khung cho ra đúng kết quả của phép tính; 10 cấp, lưới từ 3x3 đến 6x6.'),
  tool('word-guess', 'entertainment', 'Đoán từ (kiểu Wordle)', 'Đoán từ tiếng Anh bí mật qua ô xanh, vàng, xám; 10 cấp, từ dài 4–6 chữ và ít lượt hơn.'),
  tool('hangman', 'entertainment', 'Hangman (Người treo cổ)', 'Đoán từ tiếng Anh từng chữ cái trước khi hết lượt sai; 10 cấp, từ dài hơn và ít lượt sai hơn.'),
  tool('word-scramble', 'entertainment', 'Xếp chữ (Anagram)', 'Sắp xếp chữ cái bị xáo trộn thành từ tiếng Anh trước khi hết giờ; 10 cấp, 5 từ mỗi cấp.'),
  tool('domino', 'entertainment', 'Domino (Cờ đô-mi-nô)', 'Ghép quân có số khớp vào hai đầu chuỗi, hết quân trước máy là thắng; 10 cấp, máy khôn dần.'),
  tool('hearts', 'entertainment', 'Hearts (Bài Cơ)', 'Né các lá cơ và Q bích trong 4 người chơi; điểm càng thấp càng tốt, 10 cấp với máy khôn dần.'),
  tool('texas-holdem', 'entertainment', "Texas Hold'em (Poker, xu ảo)", 'Poker tay đôi với máy bằng xu ảo: bỏ bài, theo hoặc tố; thắng khi máy hết xu; 10 cấp, không dùng tiền thật.'),
  tool('n-back', 'entertainment', 'N-Back (Luyện trí nhớ)', 'Nhìn ô sáng và bấm Giống! khi trùng với N lượt trước; 10 cấp, N tăng đến 4.'),
  tool('cookie-clicker', 'entertainment', 'Tiệm bánh (Bấm làm bánh)', 'Bấm làm bánh, mua máy làm bánh tự động và đạt mục tiêu trong 2 phút; 10 cấp.'),
  tool('tile-connect', 'entertainment', 'Nối cặp (kiểu Onet)', 'Nối hai ô giống nhau bằng đường không quá 2 góc rẽ để xoá hết bàn trước khi hết giờ; 10 cấp.'),
  tool('jigsaw', 'entertainment', 'Ghép hình', 'Đổi chỗ các mảnh bị xáo trộn để ghép lại bức tranh; 10 cấp từ 3x3 đến 6x6 mảnh.'),
  tool('mini-golf', 'entertainment', 'Golf mini', 'Kéo và thả để đánh bóng vào lỗ trong số gậy giới hạn; 10 sân có tường và cát.'),
  tool('backgammon', 'entertainment', 'Backgammon (Cờ xúc xắc)', 'Tung xúc xắc, đưa quân về nhà và ra khỏi bàn trước máy, bắt quân lẻ của đối phương; 10 cấp.'),
  tool('tien-len', 'entertainment', 'Tiến lên', 'Bài tiến lên 4 người: đánh lẻ, đôi, dãy, tứ quý để hết bài trước; 10 cấp, máy khôn dần.'),
  tool('tower-defense', 'entertainment', 'Thủ thành (Tower Defense)', 'Đặt và nâng cấp tháp bắn dọc đường đi để chặn mọi đợt kẻ địch; 10 cấp trên 3 bản đồ.'),
  tool('color-by-number', 'entertainment', 'Tô màu theo số', 'Tô mỗi ô bằng màu ứng với con số để hiện ra bức tranh; 10 tranh, càng lên cấp càng nhiều màu.'),
  tool('typing-test', 'device', 'Kiểm tra tốc độ gõ phím', 'Đo tốc độ gõ (từ/phút) và độ chính xác trong 30 giây đến 5 phút, có bài tiếng Việt và tiếng Anh.'),
  tool('cps-test', 'device', 'Đo tốc độ click chuột (CPS)', 'Đếm số lần click mỗi giây trong 1 đến 60 giây, lưu kỷ lục, thử cả phím cách và chạm màn hình.'),
  tool('webcam-test', 'device', 'Kiểm tra webcam', 'Kiểm tra camera có hoạt động không, xem độ phân giải, khung hình/giây, chọn camera, chụp ảnh thử.'),
  tool('screen-recorder', 'device', 'Quay màn hình', 'Quay màn hình máy tính, cửa sổ hoặc tab kèm âm thanh và micro, không cần cài phần mềm, tải video về máy.'),
  tool('video-compress', 'media', 'Nén video', 'Giảm dung lượng video MP4, MOV, WebM để gửi qua Zalo, email, đăng mạng; chọn độ phân giải và chất lượng.'),
  tool('video-to-mp3', 'media', 'Tách MP3 từ video', 'Lấy âm thanh từ video MP4, MOV, WebM thành file MP3, chọn chất lượng và cắt đoạn cần lấy.'),
  tool('guitar-tuner', 'media', 'Lên dây đàn guitar', 'Chỉnh dây guitar, ukulele, bass bằng micro: hiện nốt, độ lệch và kim chỉ chính xác; có âm mẫu từng dây.'),
  tool('excel-word-fill', 'excel', 'Điền nội dung Word từ Excel', 'Trích nội dung Excel đưa vào các đánh dấu trong file Word, tự tô đỏ dòng đề mục (1., 2., I., II.).'),
  tool('excel-cell-merge', 'excel', 'Gộp ô Excel nhiều sheet / nhiều file', 'Gộp nội dung cùng vị trí ô của nhiều sheet hoặc nhiều file Excel thành một file, báo những ô có dữ liệu từ 2 nguồn trở lên.'),
  tool('excel-row-concat', 'excel', 'Nối dòng Excel nhiều sheet / nhiều file', 'Ghép dọc nhiều sheet hoặc nhiều file Excel thành một bảng, giữ tiêu đề một lần, loại dòng rỗng và dòng công thức rỗng.'),
  tool('excel-formula-merge', 'excel', 'Trộn dữ liệu Excel theo công thức', 'Tổng hợp nhiều sheet hoặc nhiều file Excel bằng công thức cho từng ô: SUM, COUNT, IF, CONCAT, UNIQUE, lồng hàm, lưu công thức theo chuyên đề.'),
  tool('password-gen', 'dev', 'Tạo mật khẩu mạnh', 'Tạo mật khẩu ngẫu nhiên an toàn, chọn độ dài, loại ký tự, cụm từ dễ nhớ; đánh giá độ mạnh mật khẩu.'),
  tool('signature', 'business', 'Tạo chữ ký tay', 'Vẽ chữ ký bằng chuột, ngón tay hoặc gõ tên với kiểu chữ ký đẹp; tải PNG nền trong suốt để chèn vào tài liệu.'),
  tool('logo-maker', 'marketing', 'Tạo logo đơn giản', 'Tạo logo từ biểu tượng, tên thương hiệu, khẩu hiệu; chọn phông, màu, bố cục và tải SVG, PNG.'),
  tool('notepad', 'life', 'Sổ ghi chú online', 'Ghi chú nhanh tự động lưu trên trình duyệt, nhiều ghi chú, tìm kiếm, đếm chữ, tải về file TXT.'),
];
