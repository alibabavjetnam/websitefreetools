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
  { id: 'file', name: 'File & hình ảnh', description: 'Nén, đổi định dạng và xử lý file ngay trên máy.' },
  { id: 'business', name: 'Kinh doanh online', description: 'Công cụ cho shop online, hộ kinh doanh, freelancer.' },
  { id: 'finance', name: 'Tài chính & tính toán', description: 'Tính toán chính xác theo công thức và quy định hiện hành.' },
  { id: 'marketing', name: 'Tiếp thị', description: 'Mã QR, liên kết chiến dịch, màu sắc thương hiệu.' },
  { id: 'life', name: 'Năng suất & đời sống', description: 'Tiện ích dùng hằng ngày.' },
  { id: 'dev', name: 'Công cụ kỹ thuật tin học', description: 'Tiện ích tra cứu, định dạng dữ liệu cho dân kỹ thuật.' },
];

const tool = (id: string, group: string, name: string, description: string, iconSample?: string): ToolInfo => ({
  id, group, name, description, path: `tools/${id}.html`, iconSample,
});

export const TOOLS: ToolInfo[] = [
  // File & hình ảnh
  tool('image-convert', 'file', 'Nén ảnh', 'Giảm dung lượng ảnh, thu nhỏ kích thước nhiều ảnh cùng lúc để đăng web, gửi email nhanh hơn.'),
  tool('image-format', 'file', 'Chuyển đổi định dạng ảnh', 'Đổi ảnh qua lại giữa JPG, PNG, WebP, AVIF, BMP, ICO (favicon) cho website, ứng dụng hoặc lưu trữ.'),
  tool('image-base64', 'file', 'Ảnh sang Base64', 'Chuyển ảnh thành chuỗi Base64 để nhúng vào HTML, CSS, mã nguồn, và đổi Base64 ngược lại thành ảnh.'),
  tool('bg-remove', 'file', 'Xoá nền ảnh', 'Xoá nền trắng hoặc nền một màu khỏi ảnh sản phẩm, logo, ảnh đại diện. Xử lý tức thì ngay trên máy.'),
  tool('watermark', 'file', 'Thêm watermark vào ảnh', 'Chèn chữ, logo hoặc dấu bản quyền lên một hoặc nhiều ảnh cùng lúc.'),

  // Công cụ kỹ thuật tin học
  tool('dev-tools', 'dev', 'JSON, Base64, Regex', 'Định dạng và kiểm tra JSON, mã hoá Base64, thử biểu thức chính quy.'),
  tool('cron-time', 'dev', 'Cron & Unix timestamp', 'Tạo và đọc biểu thức cron, xem các lần chạy tiếp theo, đổi timestamp sang ngày giờ.'),

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
];
