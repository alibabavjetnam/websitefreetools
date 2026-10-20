/** Biểu tượng nét mảnh (24×24) cho các công cụ không vẽ bằng mã thật */

const PATHS: Record<string, string> = {
  // khung ảnh với mũi tên thu nhỏ
  'image-convert':
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 9"/>',
  // dấu ngoặc nhọn
  'dev-tools': '<path d="M8 4c-2 0-2.5 1-2.5 3v2c0 1.5-.8 2.5-2.5 3 1.7.5 2.5 1.5 2.5 3v2c0 2 .5 3 2.5 3"/><path d="M16 4c2 0 2.5 1 2.5 3v2c0 1.5.8 2.5 2.5 3-1.7.5-2.5 1.5-2.5 3v2c0 2-.5 3-2.5 3"/>',
  // đồng hồ
  'cron-time': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  // ngôi nhà và đồng xu
  loan: '<path d="M3 11l9-7 9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
  // cột tăng dần
  compound: '<path d="M4 20h16"/><path d="M6 20v-4M10 20v-7M14 20v-10M18 20V5"/>',
  // phong bì lương
  salary: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
  // mắt xích liên kết
  utm: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  // bảng pha màu
  colors:
    '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.9 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 21 9.8C21 6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  // hộp hàng
  inventory: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
  // ví tiền
  expense: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7z"/><path d="M4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.2"/>',
  // lịch có dấu tích
  habit: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M9 14.5l2 2 4-4"/>',
  // tờ hoá đơn
  invoice: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  // đĩa và dao nĩa
  'menu-qr': '<circle cx="12" cy="13" r="6"/><path d="M4 4v6M2.5 4v3.5a1.5 1.5 0 0 0 3 0V4M20 4c-1.2 1-1.8 2.6-1.8 4.5V11H20V4zM20 11v9M4 10v10"/>',
  // hồ sơ cá nhân
  cv: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="9" r="2.5"/><path d="M8 16c.7-1.8 2.2-2.8 4-2.8s3.3 1 4 2.8"/>',
  // địa cầu
  'currency-time': '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
};

export function lineIcon(id: string, size = 28): string {
  const body = PATHS[id];
  if (!body) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
