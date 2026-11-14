import { mountLayout } from '../layout';
import { $, escapeHtml, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { input, el, privacyNote, val, onChange } from '../lib/devkit';

mountLayout({ activeTool: 'http-status' });
const T = pageText();
const CODES: [number, string, string][] = [
  [100, 'Continue', T('c100', 'Máy chủ đã nhận phần đầu yêu cầu, máy khách gửi tiếp phần thân.')],
  [101, 'Switching Protocols', T('c101', 'Chuyển sang giao thức khác, ví dụ nâng cấp lên WebSocket.')],
  [200, 'OK', T('c200', 'Thành công, phản hồi chứa dữ liệu yêu cầu.')],
  [201, 'Created', T('c201', 'Đã tạo mới tài nguyên (thường sau POST).')],
  [202, 'Accepted', T('c202', 'Đã nhận yêu cầu, sẽ xử lý sau (chưa xong).')],
  [204, 'No Content', T('c204', 'Thành công nhưng không có nội dung trả về.')],
  [206, 'Partial Content', T('c206', 'Trả về một phần file (tải tiếp, tua video).')],
  [301, 'Moved Permanently', T('c301', 'Trang đã chuyển hẳn sang địa chỉ mới; Google chuyển sức mạnh SEO sang địa chỉ mới.')],
  [302, 'Found', T('c302', 'Chuyển hướng tạm thời; địa chỉ cũ vẫn được giữ trong kết quả tìm kiếm.')],
  [303, 'See Other', T('c303', 'Xem kết quả ở địa chỉ khác bằng GET (sau khi gửi biểu mẫu).')],
  [304, 'Not Modified', T('c304', 'Nội dung không đổi, trình duyệt dùng bản lưu đệm.')],
  [307, 'Temporary Redirect', T('c307', 'Chuyển hướng tạm thời, giữ nguyên phương thức (POST vẫn là POST).')],
  [308, 'Permanent Redirect', T('c308', 'Chuyển hướng vĩnh viễn, giữ nguyên phương thức.')],
  [400, 'Bad Request', T('c400', 'Yêu cầu sai cú pháp hoặc thiếu dữ liệu bắt buộc.')],
  [401, 'Unauthorized', T('c401', 'Chưa đăng nhập hoặc token hết hạn.')],
  [402, 'Payment Required', T('c402', 'Cần thanh toán (ít dùng, một số API báo hết hạn mức).')],
  [403, 'Forbidden', T('c403', 'Đã nhận diện nhưng không có quyền truy cập.')],
  [404, 'Not Found', T('c404', 'Không tìm thấy trang hoặc tài nguyên.')],
  [405, 'Method Not Allowed', T('c405', 'Phương thức (GET, POST…) không được hỗ trợ ở địa chỉ này.')],
  [406, 'Not Acceptable', T('c406', 'Không có định dạng phản hồi phù hợp với yêu cầu Accept.')],
  [408, 'Request Timeout', T('c408', 'Máy khách gửi yêu cầu quá chậm, máy chủ ngừng chờ.')],
  [409, 'Conflict', T('c409', 'Xung đột dữ liệu, ví dụ trùng tên hoặc phiên bản cũ.')],
  [410, 'Gone', T('c410', 'Tài nguyên đã bị xoá vĩnh viễn.')],
  [411, 'Length Required', T('c411', 'Thiếu tiêu đề Content-Length.')],
  [413, 'Content Too Large', T('c413', 'Dữ liệu gửi lên quá lớn (file vượt giới hạn).')],
  [414, 'URI Too Long', T('c414', 'Địa chỉ URL quá dài.')],
  [415, 'Unsupported Media Type', T('c415', 'Định dạng dữ liệu gửi lên không được hỗ trợ.')],
  [418, "I'm a teapot", T('c418', 'Mã đùa trong tiêu chuẩn: máy chủ là ấm trà, không pha cà phê.')],
  [422, 'Unprocessable Content', T('c422', 'Đúng cú pháp nhưng dữ liệu không hợp lệ (lỗi kiểm tra biểu mẫu).')],
  [425, 'Too Early', T('c425', 'Máy chủ chưa muốn xử lý yêu cầu có thể bị gửi lại.')],
  [428, 'Precondition Required', T('c428', 'Cần điều kiện kèm theo (If-Match) để tránh ghi đè.')],
  [429, 'Too Many Requests', T('c429', 'Gửi quá nhiều yêu cầu, bị giới hạn tốc độ; thử lại sau.')],
  [431, 'Request Header Fields Too Large', T('c431', 'Tiêu đề yêu cầu quá lớn (thường do cookie quá nhiều).')],
  [451, 'Unavailable For Legal Reasons', T('c451', 'Bị chặn vì lý do pháp lý.')],
  [500, 'Internal Server Error', T('c500', 'Lỗi chung phía máy chủ (lỗi mã nguồn, cấu hình).')],
  [501, 'Not Implemented', T('c501', 'Máy chủ chưa hỗ trợ chức năng này.')],
  [502, 'Bad Gateway', T('c502', 'Máy chủ trung gian nhận phản hồi lỗi từ máy chủ phía sau.')],
  [503, 'Service Unavailable', T('c503', 'Máy chủ quá tải hoặc đang bảo trì.')],
  [504, 'Gateway Timeout', T('c504', 'Máy chủ trung gian chờ máy chủ phía sau quá lâu.')],
  [505, 'HTTP Version Not Supported', T('c505', 'Phiên bản HTTP không được hỗ trợ.')],
  [507, 'Insufficient Storage', T('c507', 'Máy chủ hết dung lượng lưu trữ.')],
  [511, 'Network Authentication Required', T('c511', 'Cần đăng nhập mạng (Wi-Fi quán cà phê, khách sạn).')],
];
const MIME: [string, string][] = [
  ['.html .htm', 'text/html'], ['.css', 'text/css'], ['.js .mjs', 'text/javascript'], ['.json', 'application/json'], ['.xml', 'application/xml'], ['.txt', 'text/plain'], ['.csv', 'text/csv'], ['.md', 'text/markdown'],
  ['.png', 'image/png'], ['.jpg .jpeg', 'image/jpeg'], ['.gif', 'image/gif'], ['.webp', 'image/webp'], ['.avif', 'image/avif'], ['.svg', 'image/svg+xml'], ['.ico', 'image/x-icon'], ['.heic', 'image/heic'],
  ['.mp3', 'audio/mpeg'], ['.wav', 'audio/wav'], ['.ogg', 'audio/ogg'], ['.m4a', 'audio/mp4'], ['.mp4', 'video/mp4'], ['.webm', 'video/webm'], ['.mov', 'video/quicktime'],
  ['.pdf', 'application/pdf'], ['.zip', 'application/zip'], ['.rar', 'application/vnd.rar'], ['.7z', 'application/x-7z-compressed'], ['.gz', 'application/gzip'],
  ['.doc', 'application/msword'], ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['.xls', 'application/vnd.ms-excel'], ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.ppt', 'application/vnd.ms-powerpoint'], ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'], ['.woff', 'font/woff'], ['.woff2', 'font/woff2'], ['.ttf', 'font/ttf'], ['.otf', 'font/otf'],
  ['.wasm', 'application/wasm'], ['.webmanifest', 'application/manifest+json'], ['.apk', 'application/vnd.android.package-archive'], ['.exe', 'application/vnd.microsoft.portable-executable'], ['.bin', 'application/octet-stream'],
];
const GROUP: Record<number, string> = { 1: T('g1', '1xx — Thông tin'), 2: T('g2', '2xx — Thành công'), 3: T('g3', '3xx — Chuyển hướng'), 4: T('g4', '4xx — Lỗi phía người dùng'), 5: T('g5', '5xx — Lỗi phía máy chủ') };

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="status">${T('tab.status', 'Mã trạng thái HTTP')}</button>
    <button type="button" role="tab" data-tab="mime">${T('tab.mime', 'Kiểu MIME')}</button>
  </div>
  <div class="tool-body">
    <div class="panel" data-panel="status">
      ${input('q', T('search', 'Tìm theo mã hoặc từ khoá'), { ph: '404, redirect, timeout…' })}
      <div id="list"></div>
    </div>
    <div class="panel" data-panel="mime" hidden>
      ${input('mq', T('msearch', 'Tìm theo đuôi file hoặc kiểu MIME'), { ph: '.webp, pdf, video…' })}
      <table class="data-table data-table--compact"><thead><tr><th>${T('ext', 'Đuôi file')}</th><th>MIME type</th></tr></thead><tbody id="mlist"></tbody></table>
    </div>
  </div>
  ${privacyNote()}
`;
setupTabs($('#tool-root'));
function status(): void {
  const q = val('q').toLowerCase().trim();
  const hit = CODES.filter(([c, n, d]) => !q || String(c).startsWith(q) || n.toLowerCase().includes(q) || d.toLowerCase().includes(q));
  el('list').innerHTML = [1, 2, 3, 4, 5].map((g) => {
    const rows = hit.filter(([c]) => Math.floor(c / 100) === g);
    return rows.length ? `<h2 class="panel-title">${GROUP[g]}</h2><table class="data-table data-table--compact"><tbody>${rows.map(([c, n, d]) => `<tr><th style="width:64px" class="mono hs-${g}">${c}</th><td style="width:34%"><b>${escapeHtml(n)}</b></td><td>${d}</td></tr>`).join('')}</tbody></table>` : '';
  }).join('') || `<p class="note">${T('none', 'Không có mã nào khớp.')}</p>`;
}
function mime(): void {
  const q = val('mq').toLowerCase().trim();
  el('mlist').innerHTML = MIME.filter(([e, m]) => !q || e.includes(q) || m.includes(q)).map(([e, m]) => `<tr><td class="mono">${e}</td><td class="mono">${m}</td></tr>`).join('');
}
onChange(['q'], status, 60);
onChange(['mq'], mime, 60);
status(); mime();
