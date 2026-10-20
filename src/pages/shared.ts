/** Chạy lại vệt "quét" màu đỏ một lần mỗi khi mã mới được tạo */
export function pulseScan(frame: HTMLElement): void {
  const line = frame.parentElement?.querySelector<HTMLElement>('.scan-line');
  if (!line) return;
  line.classList.remove('is-scanning');
  void line.offsetWidth; // ép trình duyệt khởi động lại animation
  line.classList.add('is-scanning');
}
