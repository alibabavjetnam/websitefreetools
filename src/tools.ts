/**
 * Danh sách công cụ — nguồn dữ liệu duy nhất cho menu trái và trang chủ.
 * Thêm công cụ mới: tạo trang trong /tools, thêm một mục vào đây và khai báo input trong vite.config.ts.
 */

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  /** Đường dẫn tính từ thư mục gốc của site */
  path: string;
  category: string;
  /** Nội dung mẫu để vẽ biểu tượng bằng chính mã thật */
  iconSample: string;
}

export const TOOLS: ToolInfo[] = [
  {
    id: 'qr-code',
    name: 'Tạo mã QR',
    description: 'Tạo mã QR cho liên kết, văn bản, Wi‑Fi, email, số điện thoại. Tải về PNG hoặc SVG.',
    path: 'tools/qr-code.html',
    category: 'Mã & nhãn',
    iconSample: 'WFT',
  },
  {
    id: 'barcode',
    name: 'Tạo mã vạch',
    description: 'Tạo mã vạch Code 128, EAN‑13, EAN‑8, UPC‑A, Code 39 để in nhãn sản phẩm, kho hàng.',
    path: 'tools/barcode.html',
    category: 'Mã & nhãn',
    iconSample: 'WFT',
  },
  {
    id: 'stock-chart',
    name: 'Biểu đồ stock',
    description: 'Biểu đồ giá cập nhật theo thời gian thực, cho biết xu hướng tăng giảm và tín hiệu mua bán. Kèm thống kê thắng thua của tín hiệu.',
    path: 'tools/stock-chart.html',
    category: 'Tài chính',
    iconSample: '',
  },
];

export const CATEGORIES = [...new Set(TOOLS.map((t) => t.category))];
