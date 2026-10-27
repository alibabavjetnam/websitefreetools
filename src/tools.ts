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
  { id: 'text', name: 'Xử lý văn bản', description: 'Đổi kiểu chữ, chữ đẹp mạng xã hội, đọc văn bản và gõ bằng giọng nói.' },
  { id: 'business', name: 'Kinh doanh online', description: 'Công cụ cho shop online, hộ kinh doanh, freelancer.' },
  { id: 'finance', name: 'Tài chính & tính toán', description: 'Tính toán chính xác theo công thức và quy định hiện hành.' },
  { id: 'calc', name: 'Máy tính & chuyển đổi', description: 'Máy tính khoa học, tính phần trăm, đổi đơn vị đo.' },
  { id: 'marketing', name: 'Tiếp thị', description: 'Mã QR, liên kết chiến dịch, màu sắc thương hiệu.' },
  { id: 'life', name: 'Năng suất & đời sống', description: 'Tiện ích dùng hằng ngày.' },
  { id: 'random', name: 'Ngẫu nhiên & bốc thăm', description: 'Vòng quay may mắn, quay số ngẫu nhiên cho trò chơi, bốc thăm trúng thưởng.' },
  { id: 'health', name: 'Tiện ích sức khoẻ', description: 'Theo dõi cân nặng, dinh dưỡng, nước uống, vận động, chu kỳ.' },
  { id: 'edu', name: 'Giáo dục & giảng dạy', description: 'Thời khoá biểu, đề thi, điểm danh, sơ đồ tư duy, thù lao.' },
  { id: 'time', name: 'Công cụ thời gian', description: 'Đồng hồ, đếm ngược, múi giờ, ngày làm việc, nhật ký.' },
  { id: 'device', name: 'Kiểm tra thiết bị', description: 'Thử webcam, quay màn hình, đo tốc độ gõ phím và tốc độ click chuột.' },
  { id: 'media', name: 'Âm thanh & video', description: 'Nén video, tách nhạc MP3 và lên dây đàn guitar ngay trên trình duyệt.' },
  { id: 'dev', name: 'Công cụ tin học', description: 'Định dạng, kiểm lỗi, mã hoá và chuyển đổi mã nguồn.' },
];

const tool = (id: string, group: string, name: string, description: string, iconSample?: string): ToolInfo => ({
  id, group, name, description, path: `tools/${id}.html`, iconSample,
});

export const TOOLS: ToolInfo[] = [
  // Xử lý hình ảnh
  tool('image-convert', 'image', 'Nén ảnh', 'Giảm dung lượng ảnh, thu nhỏ kích thước nhiều ảnh cùng lúc để đăng web, gửi email nhanh hơn.'),
  tool('image-format', 'image', 'Chuyển đổi định dạng ảnh', 'Đổi ảnh qua lại giữa JPG, PNG, WebP, AVIF, BMP, ICO (favicon) cho website, ứng dụng hoặc lưu trữ.'),
  tool('image-base64', 'image', 'Ảnh sang Base64', 'Chuyển ảnh thành chuỗi Base64 để nhúng vào HTML, CSS, mã nguồn, và đổi Base64 ngược lại thành ảnh.'),
  tool('bg-remove', 'image', 'Xoá nền ảnh', 'Xoá nền trắng hoặc nền một màu khỏi ảnh sản phẩm, logo, ảnh đại diện. Xử lý tức thì ngay trên máy.'),
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

  // Kinh doanh online
  tool('inventory', 'business', 'Tồn kho & tính giá bán', 'Tính giá bán theo phí sàn, quảng cáo, biên lợi nhuận. Quản lý nhập xuất tồn, cảnh báo sắp hết hàng.'),
  tool('invoice', 'business', 'Hoá đơn & báo giá', 'Lập báo giá, hoá đơn bán hàng có logo, tự tính tổng tiền và đọc số tiền bằng chữ. In hoặc lưu PDF.'),
  tool('menu-qr', 'business', 'Thực đơn QR', 'Tạo thực đơn điện tử cho quán ăn, quán cà phê. Khách quét mã QR là xem được món và giá.'),
  tool('barcode', 'business', 'Tạo mã vạch', 'Tạo mã vạch Code 128, EAN‑13, EAN‑8, UPC‑A, Code 39 để in nhãn sản phẩm, kho hàng.', 'WFT'),

  // Tài chính & tính toán
  tool('loan', 'finance', 'Tính khoản vay', 'Số tiền trả hằng tháng, tổng lãi và lịch trả nợ cho vay mua nhà, mua xe, vay tiêu dùng.'),
  tool('compound', 'finance', 'Lãi kép & tích luỹ', 'Dự tính số tiền tích luỹ khi gửi tiết kiệm hoặc đầu tư đều đặn hằng tháng.'),
  tool('salary', 'finance', 'Lương Gross ↔ Net', 'Đổi lương Gross sang Net và ngược lại theo bảo hiểm, thuế thu nhập cá nhân năm 2026.'),

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
  tool('ai-bg-remove', 'image', 'Xoá nền ảnh bằng AI', 'Tách người, sản phẩm, con vật khỏi mọi loại nền bằng trí tuệ nhân tạo chạy ngay trên máy, tải ảnh PNG nền trong suốt.'),
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
  tool('spin-wheel', 'random', 'Vòng quay may mắn', 'Tạo vòng quay với tên, phần thưởng tuỳ ý; quay ngẫu nhiên công bằng, loại người đã trúng, toàn màn hình.'),
  tool('random-number', 'random', 'Quay số ngẫu nhiên', 'Tạo số ngẫu nhiên trong khoảng tuỳ chọn, nhiều số cùng lúc, không trùng lặp; dùng cho bốc thăm, xổ số vui.'),
  tool('typing-test', 'device', 'Kiểm tra tốc độ gõ phím', 'Đo tốc độ gõ (từ/phút) và độ chính xác trong 30 giây đến 5 phút, có bài tiếng Việt và tiếng Anh.'),
  tool('cps-test', 'device', 'Đo tốc độ click chuột (CPS)', 'Đếm số lần click mỗi giây trong 1 đến 60 giây, lưu kỷ lục, thử cả phím cách và chạm màn hình.'),
  tool('webcam-test', 'device', 'Kiểm tra webcam', 'Kiểm tra camera có hoạt động không, xem độ phân giải, khung hình/giây, chọn camera, chụp ảnh thử.'),
  tool('screen-recorder', 'device', 'Quay màn hình', 'Quay màn hình máy tính, cửa sổ hoặc tab kèm âm thanh và micro, không cần cài phần mềm, tải video về máy.'),
  tool('video-compress', 'media', 'Nén video', 'Giảm dung lượng video MP4, MOV, WebM để gửi qua Zalo, email, đăng mạng; chọn độ phân giải và chất lượng.'),
  tool('video-to-mp3', 'media', 'Tách MP3 từ video', 'Lấy âm thanh từ video MP4, MOV, WebM thành file MP3, chọn chất lượng và cắt đoạn cần lấy.'),
  tool('guitar-tuner', 'media', 'Lên dây đàn guitar', 'Chỉnh dây guitar, ukulele, bass bằng micro: hiện nốt, độ lệch và kim chỉ chính xác; có âm mẫu từng dây.'),
  tool('password-gen', 'dev', 'Tạo mật khẩu mạnh', 'Tạo mật khẩu ngẫu nhiên an toàn, chọn độ dài, loại ký tự, cụm từ dễ nhớ; đánh giá độ mạnh mật khẩu.'),
  tool('signature', 'business', 'Tạo chữ ký tay', 'Vẽ chữ ký bằng chuột, ngón tay hoặc gõ tên với kiểu chữ ký đẹp; tải PNG nền trong suốt để chèn vào tài liệu.'),
  tool('logo-maker', 'marketing', 'Tạo logo đơn giản', 'Tạo logo từ biểu tượng, tên thương hiệu, khẩu hiệu; chọn phông, màu, bố cục và tải SVG, PNG.'),
  tool('notepad', 'life', 'Sổ ghi chú online', 'Ghi chú nhanh tự động lưu trên trình duyệt, nhiều ghi chú, tìm kiếm, đếm chữ, tải về file TXT.'),
];
