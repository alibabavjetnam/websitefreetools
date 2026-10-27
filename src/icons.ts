/** Biểu tượng nét mảnh (24×24) cho các công cụ không vẽ bằng mã thật */

const PATHS: Record<string, string> = {
  // khung ảnh với mũi tên thu nhỏ
  'image-convert':
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 9"/>',
  // hai mũi tên đổi chiều
  'image-format': '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><path d="M15 4h3a2 2 0 0 1 2 2v3M18 7l2 2 2-2M9 20H6a2 2 0 0 1-2-2v-3M6 17l-2-2-2 2"/>',
  // mã nhị phân
  'image-base64': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9v6M10 9h2v6h-2zM15 9v6M17 9v6"/>',
  // cây kéo cắt nền
  'bg-remove': '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2.5"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18c1-2.8 3.1-4.2 5.5-4.2s4.5 1.4 5.5 4.2"/>',
  // con dấu bản quyền
  watermark: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M13.6 10.6a2 2 0 1 0 0 2.8"/>',
  // hai trang giấy ghép
  'pdf-merge': '<path d="M5 3h8l4 4v6"/><path d="M13 3v4h4"/><rect x="9" y="13" width="11" height="8" rx="1"/><path d="M5 3v14h4"/>',
  // màn chiếu sang trang giấy
  'pptx-pdf': '<rect x="2.5" y="4" width="10" height="7.5" rx="1"/><path d="M7.5 11.5V14"/><path d="M14 13h7.5v8H14z"/><path d="M14.5 6h4a2 2 0 0 1 2 2v2M18.5 8l2 2 2-2"/>',
  // hai cột văn bản đối chiếu
  'file-diff': '<rect x="3" y="3" width="8" height="18" rx="1.5"/><rect x="13" y="3" width="8" height="18" rx="1.5"/><path d="M5.5 8h3M5.5 12h3M15.5 8h3M15.5 12h3M15.5 16h3"/>',
  // trang văn bản có kính lúp
  'text-analysis': '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"/><path d="M8 8h6M8 12h4"/><circle cx="16.5" cy="15.5" r="3.5"/><path d="M19 18l2.5 2.5"/>',
  // bảng dữ liệu có mũi tên
  'data-convert': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/><path d="M12.5 14.5h5M15.5 12.5l2 2-2 2"/>',
  'bmi-bmr': '<path d="M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M6 21v-5a6 6 0 0 1 12 0v5"/><path d="M9 14l1.5 1.5M15 14l-1.5 1.5"/>',
  'meal-calo': '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v8.5l5.5 3"/><path d="M8.5 8.5h3"/>',
  'water-tracker': '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M8.5 14a3.5 3.5 0 0 0 3.5 3.5"/>',
  'calo-burn': '<path d="M12 3c2 3 4 4.5 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3 .5 2 1.5 2.5 1.5 2.5S10 9 12 3z"/><path d="M7 19h10"/>',
  'cycle-track': '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v4h-4"/><circle cx="12" cy="12" r="1.6"/>',
  'study-timetable': '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9h17M9 4.5v16M3.5 14.5h17"/>',
  'quiz-bank': '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9.5 9a2.5 2.5 0 1 1 3 2.5V13"/><path d="M12 16v.01"/>',
  'attendance': '<path d="M4 6h10M4 12h10M4 18h7"/><path d="M17 7.5l1.6 1.6L22 5.5M17 16.5l1.6 1.6L22 14.5"/>',
  'mindmap': '<circle cx="5" cy="12" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/><circle cx="18" cy="12" r="2.2"/><path d="M7.2 12H16M7 11l9-4M7 13l9 4"/>',
  'teaching-pay': '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9v.01M17.5 15v.01"/>',
  'fullscreen-clock': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16" opacity=".5"/><path d="M11 9v3.5l2.5 1.5"/><circle cx="13" cy="12" r="4.5"/>',
  'countdown-video': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 8.5V12l2.2 1.3"/><circle cx="12" cy="12" r="3.6"/><path d="M3 9l-1 2 1 2" opacity=".5"/>',
  'world-clock': '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
  'workdays': '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8 14l2.5 2.5L16 12"/>',
  'journal': '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4z"/><path d="M5 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2" opacity=".5"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  // dấu ngoặc nhọn với gạch căn
  'code-format': '<path d="M8 6l-4 6 4 6M16 6l4 6-4 6"/><path d="M4 4h16" opacity=".55"/>',
  // dấu ngoặc nhọn với dấu tích
  'code-check': '<path d="M9 7l-4 5 4 5M15 7l4 5-4 5" opacity=".55"/><path d="M9.5 12.2l1.7 1.8 3.3-3.6"/>',
  // ổ khoá trên dòng mã
  'js-obfuscate': '<rect x="4" y="10.5" width="16" height="9" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14v2"/>',
  // chìa khoá
  'rsa-keys': '<circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13l9-9M16 7l2 2M13.5 9.5l2 2"/>',
  // trang văn bản sang thẻ
  'text-to-html': '<path d="M5 4h9l5 5v2"/><path d="M14 4v5h5" opacity=".55"/><path d="M8 20l-2.5-2.5L8 15M16 15l2.5 2.5L16 20M13 14l-2 7" transform="translate(0 .5)"/>',

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

  // ---- Công cụ thêm 27/10/2026
  // khung ảnh với mũi tên kéo giãn góc
  'image-resize': '<rect x="3" y="7" width="12" height="14" rx="1.5"/><path d="M14 3h7v7M21 3l-7 7"/>',
  // hai góc vuông cắt chéo
  'image-crop': '<path d="M6 2v16h16"/><path d="M2 6h16v16"/>',
  // khung quét với dòng chữ
  'image-ocr': '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M7.5 9h9M7.5 12h9M7.5 15h5"/>',
  // máy ảnh điện thoại sang ảnh
  'heic-jpg': '<rect x="3" y="5" width="9" height="14" rx="2"/><circle cx="7.5" cy="10" r="1.8"/><path d="M14 12h6M18 9.5l2.5 2.5-2.5 2.5"/>',
  // người với nền ô kẻ và tia sáng
  'ai-bg-remove': '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="2 2.5"/><circle cx="11" cy="10" r="3"/><path d="M5.5 19c1-2.6 3-4 5.5-4s4.5 1.4 5.5 4"/><path d="M18 3.5v3M16.5 5h3"/>',
  // ảnh nhỏ phóng to có tia sáng
  'image-upscale': '<rect x="3" y="12" width="9" height="9" rx="1.5"/><path d="M12 3h9v9" stroke-dasharray="2.5 2"/><path d="M10 14l8-8M14 6h4v4"/>',
  // ảnh đi vào trang giấy
  'image-to-pdf': '<rect x="2.5" y="4" width="9" height="8" rx="1"/><path d="M5 10l2-2 2.5 2.5"/><path d="M13 9h4l4 4v8h-8z"/><path d="M15.5 16.5h3M15.5 19h2"/>',
  // trang giấy đi ra ảnh
  'pdf-to-image': '<path d="M3 3h6l3 3v8H3z"/><path d="M5 9h4M5 11.5h3"/><rect x="12.5" y="12" width="9" height="9" rx="1"/><path d="M14.5 19l2-2 2.5 2.5"/>',
  // trang giấy bị ép bởi hai mũi tên
  'pdf-compress': '<path d="M7 4h7l4 4v12H7z"/><path d="M12 9v3M10.5 10.5L12 12l1.5-1.5M12 18v-3M10.5 16.5L12 15l1.5 1.5"/>',
  // trang PDF sang chữ W
  'pdf-to-word': '<path d="M4 3h7l3 3v8H4z"/><path d="M12 15h9v6h-9z"/><path d="M13.5 16.5l1 3 1-2 1 2 1-3"/>',
  // chữ W sang trang giấy
  'word-to-pdf': '<rect x="3" y="3" width="9" height="7" rx="1"/><path d="M4.5 4.5l1 4 1-2.5 1 2.5 1-4"/><path d="M13 11h5l3 3v7h-8z"/><path d="M15 17h4M15 19h3"/>',
  // trang giấy với nét chữ ký
  'pdf-sign': '<path d="M5 3h9l5 5v13H5z"/><path d="M8 16c1.2-2.6 2.2-2.6 2.6-.6s1.5 1.6 2.4.2 1.6-1 2.5.4"/><path d="M8 19h8" opacity=".5"/>',
  // trang giấy với bút chì
  'pdf-edit': '<path d="M5 3h9l5 5v5"/><path d="M5 3v18h7"/><path d="M8 9h5M8 12h4"/><path d="M14.5 21l.5-2.5 5-5 2 2-5 5z"/>',
  // chữ Aa
  'case-convert': '<path d="M3 18l4.5-12L12 18M4.7 14h5.6"/><circle cx="17.5" cy="15" r="3"/><path d="M20.5 12v6"/>',
  // chữ T có ngôi sao lấp lánh
  'fancy-text': '<path d="M4 6h11M9.5 6v13"/><path d="M18 3l.9 2.1L21 6l-2.1.9L18 9l-.9-2.1L15 6l2.1-.9z"/><path d="M16.5 15.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
  // loa phát sóng âm
  'text-to-speech': '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  // micro với dòng chữ
  'speech-to-text': '<rect x="6" y="3" width="6" height="11" rx="3"/><path d="M3.5 11a5.5 5.5 0 0 0 11 0M9 16.5V20"/><path d="M16 9h5M16 13h5M16 17h3"/>',
  // máy tính bỏ túi
  'scientific-calc': '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8v3H8z"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>',
  // dấu phần trăm
  percentage: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  // thước kẻ
  'unit-convert': '<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6 8v3M9.5 8v4.5M13 8v3M16.5 8v4.5M20 8v3"/>',
  // bánh sinh nhật
  'age-calc': '<path d="M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 15c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0"/><path d="M12 11V8M12 4.5c.8.8.8 1.8 0 2.5-.8-.7-.8-1.7 0-2.5z"/>',
  // lịch với dấu cộng trừ
  'date-calc': '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7 15h4M9 13v4M14 15h3"/>',
  // mũ tốt nghiệp
  gpa: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/><path d="M22 9v6"/>',
  // em bé trong vòng tròn
  'due-date': '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="2.6"/><path d="M8 17c.8-2 2.2-3 4-3s3.2 1 4 3"/>',
  // vòng quay có kim chỉ
  'spin-wheel': '<circle cx="12" cy="13" r="8"/><path d="M12 5v16M4 13h16M6.3 7.3l11.4 11.4M17.7 7.3L6.3 18.7"/><path d="M10 2h4l-2 3z"/>',
  // xúc xắc
  'random-number': '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>',
  // bàn phím
  'typing-test': '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10"/>',
  // con trỏ chuột với vạch nhấp
  'cps-test': '<path d="M9 9l11 4-4.5 1.5L14 19z"/><path d="M5 3.5l1.5 2.5M3 8.5l3 .5M9.5 2.5L9 5.5"/>',
  // webcam
  'webcam-test': '<circle cx="12" cy="10" r="6.5"/><circle cx="12" cy="10" r="2.5"/><path d="M8 20h8M12 16.5V20"/>',
  // màn hình với chấm ghi hình
  'screen-recorder': '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10.5" r="2.5"/>',
  // cuộn phim có mũi tên thu nhỏ
  'video-compress': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14" opacity=".5"/><path d="M10 9.5l2 2 2-2M10 14.5l2-2 2 2"/>',
  // nốt nhạc
  'video-to-mp3': '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  // âm thoa / mặt đàn
  'guitar-tuner': '<path d="M12 21a7 7 0 0 1-7-7"/><path d="M19 14a7 7 0 0 0-7-7 7 7 0 0 0-7 7"/><path d="M12 14l4-5"/><circle cx="12" cy="14" r="1.2"/>',
  // ổ khoá với dấu sao
  'password-gen': '<rect x="3" y="10" width="18" height="10" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/><path d="M8 15h.01M12 15h.01M16 15h.01"/>',
  // nét chữ ký trên dòng
  signature: '<path d="M3 16c2-5 4-9 5-8s-2 8 0 8 3-5 5-5 1 4 3 4 2-2 5-2"/><path d="M3 20h18" opacity=".5"/>',
  // hình tròn và tam giác lồng nhau
  'logo-maker': '<circle cx="9" cy="9" r="5.5"/><path d="M15 9.5l6 10.5H9z"/>',
  // cuốn sổ có dòng kẻ
  notepad: '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M8 3v18" opacity=".5"/><path d="M11 8h5.5M11 12h5.5M11 16h3.5"/>',
};

export function lineIcon(id: string, size = 28): string {
  const body = PATHS[id];
  if (!body) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
