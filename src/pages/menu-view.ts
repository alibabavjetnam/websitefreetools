// Trang khách quét mã QR để xem thực đơn: không dùng khung menu của site
import '../menu/menu.css';
import { bindMenuNav, decodeMenu, menuHtml } from '../menu/menu';

const root = document.getElementById('menu') as HTMLElement;

async function show(): Promise<void> {
  if (location.hash.length < 3) {
    root.innerHTML = '<p class="mv-loading">Đường link chưa có thực đơn. Hãy quét lại mã QR của quán.</p>';
    return;
  }
  try {
    const menu = await decodeMenu(location.hash);
    document.title = menu.name ? `Thực đơn ${menu.name}` : 'Thực đơn';
    document.documentElement.style.setProperty('--mv-accent', menu.accent);
    root.innerHTML = menuHtml(menu);
  } catch (e) {
    root.innerHTML = `<p class="mv-loading">Không mở được thực đơn: ${(e as Error).message.replace(/[<>&]/g, '')} Hãy quét lại mã QR của quán.</p>`;
  }
}

bindMenuNav(root);
window.addEventListener('hashchange', () => void show());
void show();
