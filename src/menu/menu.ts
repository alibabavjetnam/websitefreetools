/**
 * Menu QR: menu được nén và gói vào phần "#…" của đường link, nên không cần máy chủ lưu menu.
 * Dữ liệu trên link là dữ liệu ngoài (ai cũng sửa được) nên khi hiển thị luôn escape và kiểm tra kiểu.
 */
import { escapeHtml } from '../ui';

export interface MenuItem { name: string; price: number; desc: string }
export interface MenuCategory { title: string; items: MenuItem[] }
export interface Menu {
  name: string;
  info: string;
  note: string;
  accent: string;
  categories: MenuCategory[];
}

export const VIEWER_URL = 'https://websitefreetools.com/m/';
const MAX_ITEMS = 300;

/* ---------- Ngôn ngữ trang khách xem menu ----------
 * Trang /m/ không nạp từ điển của site (khách chỉ quét QR), nên chuỗi nằm sẵn ở đây.
 * Ngôn ngữ: theo trang công cụ nếu có (__WFT_LANG__), nếu không thì theo ngôn ngữ trình duyệt của khách. */
export type MenuLang = 'vi' | 'en' | 'ja' | 'zh' | 'es' | 'de' | 'ru' | 'fr' | 'pt' | 'it' | 'tr' | 'nl';
export function menuLang(): MenuLang {
  const w = window as unknown as { __WFT_LANG__?: string };
  const raw = (w.__WFT_LANG__ || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en').slice(0, 2).toLowerCase();
  return ['vi', 'ja', 'zh', 'es', 'de', 'ru', 'fr', 'pt', 'it', 'tr', 'nl'].includes(raw) ? (raw as MenuLang) : 'en';
}
const MENU_TEXT: Record<MenuLang, Record<string, string>> = {
  vi: {
    shop: 'Tên quán', cat: 'Món', title: 'Thực đơn', loading: 'Đang mở thực đơn…', credit: 'Tạo thực đơn QR miễn phí tại',
    noMenu: 'Đường link chưa có thực đơn. Hãy quét lại mã QR của quán.',
    openFail: 'Không mở được thực đơn:', rescan: 'Hãy quét lại mã QR của quán.',
    invalid: 'Dữ liệu menu không hợp lệ.', tooLong: 'Đường link menu quá dài.',
    oldBrowser: 'Trình duyệt này quá cũ để mở menu. Hãy cập nhật trình duyệt.', badLink: 'Đường link menu không đúng.',
  },
  en: {
    shop: 'Restaurant name', cat: 'Items', title: 'Menu', loading: 'Opening the menu…', credit: 'Make a free QR menu at',
    noMenu: 'This link has no menu. Please scan the restaurant\'s QR code again.',
    openFail: 'Could not open the menu:', rescan: 'Please scan the restaurant\'s QR code again.',
    invalid: 'The menu data is not valid.', tooLong: 'The menu link is too long.',
    oldBrowser: 'This browser is too old to open the menu. Please update your browser.', badLink: 'The menu link is not correct.',
  },
  ja: {
    shop: 'お店の名前', cat: 'メニュー', title: 'メニュー', loading: 'メニューを開いています…', credit: '無料でQRメニューを作る：',
    noMenu: 'このリンクにはメニューがありません。お店のQRコードをもう一度読み取ってください。',
    openFail: 'メニューを開けませんでした：', rescan: 'お店のQRコードをもう一度読み取ってください。',
    invalid: 'メニューのデータが正しくありません。', tooLong: 'メニューのリンクが長すぎます。',
    oldBrowser: 'お使いのブラウザは古いためメニューを開けません。ブラウザを更新してください。', badLink: 'メニューのリンクが正しくありません。',
  },
  es: {
    shop: 'Nombre del local', cat: 'Platos', title: 'Carta', loading: 'Abriendo la carta…', credit: 'Crea una carta QR gratis en',
    noMenu: 'Este enlace no tiene carta. Vuelve a escanear el código QR del local.',
    openFail: 'No se pudo abrir la carta:', rescan: 'Vuelve a escanear el código QR del local.',
    invalid: 'Los datos de la carta no son válidos.', tooLong: 'El enlace de la carta es demasiado largo.',
    oldBrowser: 'Este navegador es demasiado antiguo para abrir la carta. Actualiza el navegador.', badLink: 'El enlace de la carta no es correcto.',
  },
  de: {
    shop: 'Name des Lokals', cat: 'Gerichte', title: 'Speisekarte', loading: 'Speisekarte wird geöffnet …', credit: 'Erstelle kostenlos eine QR-Speisekarte auf',
    noMenu: 'Dieser Link enthält keine Speisekarte. Scanne den QR-Code des Lokals erneut.',
    openFail: 'Die Speisekarte konnte nicht geöffnet werden:', rescan: 'Scanne den QR-Code des Lokals erneut.',
    invalid: 'Die Daten der Speisekarte sind ungültig.', tooLong: 'Der Link zur Speisekarte ist zu lang.',
    oldBrowser: 'Dieser Browser ist zu alt, um die Speisekarte zu öffnen. Aktualisiere den Browser.', badLink: 'Der Link zur Speisekarte ist nicht korrekt.',
  },
  ru: {
    shop: 'Название заведения', cat: 'Блюда', title: 'Меню', loading: 'Открываем меню…', credit: 'Создайте QR-меню бесплатно на',
    noMenu: 'В этой ссылке нет меню. Отсканируйте QR-код заведения ещё раз.',
    openFail: 'Не удалось открыть меню:', rescan: 'Отсканируйте QR-код заведения ещё раз.',
    invalid: 'Данные меню недействительны.', tooLong: 'Ссылка на меню слишком длинная.',
    oldBrowser: 'Этот браузер слишком старый, чтобы открыть меню. Обновите браузер.', badLink: 'Ссылка на меню неверна.',
  },
  fr: {
    shop: 'Nom de l’établissement', cat: 'Plats', title: 'Carte', loading: 'Ouverture de la carte…', credit: 'Créez gratuitement une carte QR sur',
    noMenu: 'Ce lien ne contient pas de carte. Scannez à nouveau le code QR de l’établissement.',
    openFail: 'Impossible d’ouvrir la carte :', rescan: 'Scannez à nouveau le code QR de l’établissement.',
    invalid: 'Les données de la carte ne sont pas valides.', tooLong: 'Le lien de la carte est trop long.',
    oldBrowser: 'Ce navigateur est trop ancien pour ouvrir la carte. Mettez-le à jour.', badLink: 'Le lien de la carte n’est pas correct.',
  },
  pt: {
    shop: 'Nome do estabelecimento', cat: 'Pratos', title: 'Cardápio', loading: 'Abrindo o cardápio…', credit: 'Crie um cardápio QR grátis em',
    noMenu: 'Este link não tem cardápio. Escaneie novamente o QR code do estabelecimento.',
    openFail: 'Não foi possível abrir o cardápio:', rescan: 'Escaneie novamente o QR code do estabelecimento.',
    invalid: 'Os dados do cardápio não são válidos.', tooLong: 'O link do cardápio é longo demais.',
    oldBrowser: 'Este navegador é antigo demais para abrir o cardápio. Atualize o navegador.', badLink: 'O link do cardápio não está correto.',
  },
  it: {
    shop: 'Nome del locale', cat: 'Piatti', title: 'Menu', loading: 'Apertura del menu…', credit: 'Crea gratis un menu QR su',
    noMenu: 'Questo link non contiene un menu. Scansiona di nuovo il codice QR del locale.',
    openFail: 'Impossibile aprire il menu:', rescan: 'Scansiona di nuovo il codice QR del locale.',
    invalid: 'I dati del menu non sono validi.', tooLong: 'Il link del menu è troppo lungo.',
    oldBrowser: 'Questo browser è troppo vecchio per aprire il menu. Aggiornalo.', badLink: 'Il link del menu non è corretto.',
  },
  tr: {
    shop: 'Mekân adı', cat: 'Yemekler', title: 'Menü', loading: 'Menü açılıyor…', credit: 'Ücretsiz QR menü oluşturun:',
    noMenu: 'Bu bağlantıda menü yok. Mekânın QR kodunu yeniden okutun.',
    openFail: 'Menü açılamadı:', rescan: 'Mekânın QR kodunu yeniden okutun.',
    invalid: 'Menü verisi geçerli değil.', tooLong: 'Menü bağlantısı çok uzun.',
    oldBrowser: 'Bu tarayıcı menüyü açmak için çok eski. Tarayıcınızı güncelleyin.', badLink: 'Menü bağlantısı doğru değil.',
  },
  nl: {
    shop: 'Naam van de zaak', cat: 'Gerechten', title: 'Menukaart', loading: 'Menukaart openen…', credit: 'Maak gratis een QR-menukaart op',
    noMenu: 'Deze link bevat geen menukaart. Scan de QR-code van de zaak opnieuw.',
    openFail: 'Kon de menukaart niet openen:', rescan: 'Scan de QR-code van de zaak opnieuw.',
    invalid: 'De gegevens van de menukaart zijn ongeldig.', tooLong: 'De link naar de menukaart is te lang.',
    oldBrowser: 'Deze browser is te oud om de menukaart te openen. Werk de browser bij.', badLink: 'De link naar de menukaart is niet correct.',
  },
  zh: {
    shop: '店名', cat: '菜品', title: '菜单', loading: '正在打开菜单…', credit: '免费制作二维码菜单：',
    noMenu: '此链接中没有菜单，请重新扫描店铺的二维码。',
    openFail: '无法打开菜单：', rescan: '请重新扫描店铺的二维码。',
    invalid: '菜单数据无效。', tooLong: '菜单链接过长。',
    oldBrowser: '当前浏览器版本过低，无法打开菜单，请更新浏览器。', badLink: '菜单链接不正确。',
  },
};
export const menuText = (key: string): string => MENU_TEXT[menuLang()][key] ?? MENU_TEXT.vi[key] ?? key;
const PRICE_LOCALE: Record<MenuLang, string> = { vi: 'vi-VN', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', de: 'de-DE', ru: 'ru-RU', fr: 'fr-FR', pt: 'pt-BR', it: 'it-IT', tr: 'tr-TR', nl: 'nl-NL' };

/* ---------- Dạng gọn để link ngắn: mảng thay cho object ---------- */
type Compact = [string, string, string, string, [string, [string, number, string][]][]];

function toCompact(m: Menu): Compact {
  return [m.name, m.info, m.note, m.accent, m.categories.map((c) => [c.title, c.items.map((i) => [i.name, i.price, i.desc] as [string, number, string])])];
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, 1e12) : 0);

function fromCompact(c: unknown): Menu {
  if (!Array.isArray(c)) throw new Error(menuText('invalid'));
  let count = 0;
  const cats = Array.isArray(c[4]) ? c[4] : [];
  return {
    name: str(c[0], 120),
    info: str(c[1], 300),
    note: str(c[2], 500),
    accent: /^#[0-9a-f]{6}$/i.test(String(c[3])) ? String(c[3]) : '#0d6efd',
    categories: cats.slice(0, 50).map((cat: unknown) => {
      const arr = Array.isArray(cat) ? cat : [];
      const items = Array.isArray(arr[1]) ? arr[1] : [];
      return {
        title: str(arr[0], 80),
        items: items
          .filter(() => ++count <= MAX_ITEMS)
          .map((it: unknown) => {
            const x = Array.isArray(it) ? it : [];
            return { name: str(x[0], 120), price: num(x[1]), desc: str(x[2], 300) };
          }),
      };
    }),
  };
}

/* ---------- Nén + base64url ---------- */
const toB64 = (bytes: Uint8Array) => {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (s: string) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Mã hoá menu thành chuỗi đặt sau dấu # ; tiền tố "z" là đã nén, "j" là JSON thường (trình duyệt cũ) */
export async function encodeMenu(m: Menu): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(toCompact(m)));
  if (typeof CompressionStream !== 'undefined') {
    return 'z' + toB64(await pipe(bytes, new CompressionStream('deflate-raw')));
  }
  return 'j' + toB64(bytes);
}

export async function decodeMenu(hash: string): Promise<Menu> {
  const s = hash.replace(/^#/, '');
  if (s.length > 20000) throw new Error(menuText('tooLong'));
  const kind = s.charAt(0);
  let bytes: Uint8Array = fromB64(s.slice(1));
  if (kind === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error(menuText('oldBrowser'));
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } else if (kind !== 'j') throw new Error(menuText('badLink'));
  return fromCompact(JSON.parse(new TextDecoder().decode(bytes)));
}

const fmtPrice = (n: number) => (n ? new Intl.NumberFormat(PRICE_LOCALE[menuLang()]).format(n) : '');

/**
 * HTML của menu (dùng cho trang khách xem và phần xem trước trong công cụ).
 * Thanh danh mục dùng nút [data-jump] thay vì link "#…", vì phần "#…" của trang đang chứa dữ liệu menu.
 */
export function menuHtml(m: Menu): string {
  const cats = m.categories.filter((c) => c.title || c.items.some((i) => i.name));
  return `
    <header class="mv-head" style="--mv-accent:${m.accent}">
      <h1>${escapeHtml(m.name || menuText('shop'))}</h1>
      ${m.info ? `<p>${escapeHtml(m.info).replace(/\n/g, '<br />')}</p>` : ''}
    </header>
    ${cats.length > 1 ? `<nav class="mv-nav">${cats.map((c, i) => `<button type="button" data-jump="mv-${i}">${escapeHtml(c.title || menuText('cat'))}</button>`).join('')}</nav>` : ''}
    ${cats
      .map(
        (c, i) => `<section class="mv-cat" id="mv-${i}">
        <h2 style="color:${m.accent}">${escapeHtml(c.title)}</h2>
        <ul>${c.items
          .filter((it) => it.name)
          .map((it) => `<li><div class="mv-item"><span class="mv-name">${escapeHtml(it.name)}</span><span class="mv-dots"></span><span class="mv-price">${fmtPrice(it.price)}</span></div>${it.desc ? `<p>${escapeHtml(it.desc)}</p>` : ''}</li>`)
          .join('')}</ul>
      </section>`,
      )
      .join('')}
    ${m.note ? `<p class="mv-note">${escapeHtml(m.note).replace(/\n/g, '<br />')}</p>` : ''}`;
}

/** Gắn xử lý cuộn tới danh mục khi bấm thanh danh mục */
export function bindMenuNav(root: HTMLElement): void {
  root.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-jump]')?.dataset.jump;
    if (id) root.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
