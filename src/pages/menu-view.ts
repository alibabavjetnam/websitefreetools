// Trang khách quét mã QR để xem thực đơn: không dùng khung menu của site
import '../menu/menu.css';
import { bindMenuNav, decodeMenu, menuHtml, menuLang, menuText } from '../menu/menu';

const root = document.getElementById('menu') as HTMLElement;
const lang = menuLang();
document.documentElement.lang = lang;
document.title = menuText('title');
root.innerHTML = `<p class="mv-loading">${menuText('loading')}</p>`;
const credit = document.querySelector<HTMLElement>('.mv-credit');
if (credit) credit.innerHTML = `${menuText('credit')} <a href="/${lang}/tools/menu-qr.html">WFTools</a>`;

async function show(): Promise<void> {
  if (location.hash.length < 3) {
    root.innerHTML = `<p class="mv-loading">${menuText('noMenu')}</p>`;
    return;
  }
  try {
    const menu = await decodeMenu(location.hash);
    document.title = menu.name ? (lang === 'vi' ? `Thực đơn ${menu.name}` : `${menu.name} - ${menuText('title')}`) : menuText('title');
    document.documentElement.style.setProperty('--mv-accent', menu.accent);
    root.innerHTML = menuHtml(menu);
  } catch (e) {
    root.innerHTML = `<p class="mv-loading">${menuText('openFail')} ${(e as Error).message.replace(/[<>&]/g, '')} ${menuText('rescan')}</p>`;
  }
}

bindMenuNav(root);
window.addEventListener('hashchange', () => void show());
void show();
