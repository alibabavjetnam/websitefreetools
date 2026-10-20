/**
 * Đăng nhập Google bằng Google Identity Services (luồng token phía trình duyệt, không cần máy chủ).
 * Dữ liệu của người dùng nằm trong Google Drive của chính họ; WFTools chỉ xin quyền drive.file
 * (chỉ thấy các file do WFTools tạo). Quyền Forms/Calendar chỉ xin khi công cụ cần đến.
 */

/** Client ID không phải bí mật: Google chỉ chấp nhận nó từ các tên miền đã đăng ký */
export const GOOGLE_CLIENT_ID = '867291461453-5spub4rjvn0alvqs4kcchtiqtgn5rssk.apps.googleusercontent.com';

export const SCOPES = {
  base: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.file'],
  forms: 'https://www.googleapis.com/auth/forms.body',
  calendar: 'https://www.googleapis.com/auth/calendar.events',
};

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

interface TokenState {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; scope?: string; include_granted_scopes?: boolean; hint?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(cfg: {
            client_id: string;
            scope: string;
            include_granted_scopes?: boolean;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type: string; message?: string }) => void;
          }): TokenClient;
          revoke(token: string, done?: () => void): void;
        };
      };
    };
  }
}

export class GoogleAuthError extends Error {}

// Token lưu trong sessionStorage (mất khi đóng trình duyệt) để chuyển giữa các trang công cụ không phải đăng nhập lại.
const TOKEN_KEY = 'wft:gtoken';
const USER_KEY = 'wft:guser';

function readToken(): TokenState | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    const t = raw ? (JSON.parse(raw) as TokenState) : null;
    return t && t.expiresAt > Date.now() + 60_000 ? t : null;
  } catch {
    return null;
  }
}

function writeToken(t: TokenState | null): void {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* trình duyệt chặn bộ nhớ: token chỉ sống trong trang hiện tại */
  }
}

let memoryToken: TokenState | null = readToken();

export function currentUser(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as GoogleUser) : null;
  } catch {
    return null;
  }
}

function saveUser(u: GoogleUser | null): void {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new CustomEvent('wft-auth-change', { detail: u }));
}

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new GoogleAuthError('Không tải được dịch vụ đăng nhập Google. Kiểm tra kết nối mạng hoặc trình chặn quảng cáo.'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** Mở cửa sổ Google để xin token với các quyền cần thiết. Phải gọi từ một cú bấm của người dùng. */
async function requestToken(scopes: string[], prompt: '' | 'consent' | 'select_account'): Promise<TokenState> {
  await loadGis();
  const oauth2 = window.google?.accounts.oauth2;
  if (!oauth2) throw new GoogleAuthError('Dịch vụ đăng nhập Google chưa sẵn sàng.');
  return new Promise<TokenState>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: scopes.join(' '),
      include_granted_scopes: true,
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new GoogleAuthError(r.error === 'access_denied' ? 'Bạn chưa cấp quyền cho WFTools.' : `Đăng nhập không thành công (${r.error_description ?? r.error}).`));
          return;
        }
        resolve({
          accessToken: r.access_token,
          expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000,
          scopes: (r.scope ?? '').split(' ').filter(Boolean),
        });
      },
      error_callback: (e) =>
        reject(new GoogleAuthError(e.type === 'popup_closed' ? 'Bạn đã đóng cửa sổ đăng nhập.' : e.type === 'popup_failed_to_open' ? 'Trình duyệt chặn cửa sổ đăng nhập. Hãy cho phép cửa sổ bật lên.' : 'Đăng nhập không thành công.')),
    });
    client.requestAccessToken({ prompt, hint: currentUser()?.email });
  });
}

function hasScopes(t: TokenState | null, scopes: string[]): boolean {
  if (!t) return false;
  // Google trả về tên rút gọn cho openid/email/profile
  const alias: Record<string, string> = {
    email: 'https://www.googleapis.com/auth/userinfo.email',
    profile: 'https://www.googleapis.com/auth/userinfo.profile',
  };
  return scopes.every((s) => s === 'openid' || t.scopes.includes(s) || t.scopes.includes(alias[s] ?? s));
}

export async function signIn(extraScopes: string[] = []): Promise<GoogleUser> {
  const scopes = [...SCOPES.base, ...extraScopes];
  const t = await requestToken(scopes, currentUser() ? '' : 'select_account');
  if (!hasScopes(t, [SCOPES.base[3], ...extraScopes]))
    throw new GoogleAuthError('Bạn cần tích chọn cho phép WFTools lưu file vào Google Drive để dùng tính năng này.');
  memoryToken = t;
  writeToken(t);
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${t.accessToken}` } });
  if (!res.ok) throw new GoogleAuthError('Không đọc được thông tin tài khoản Google.');
  const info = (await res.json()) as { email: string; name?: string; picture?: string };
  const user: GoogleUser = { email: info.email, name: info.name || info.email, picture: info.picture };
  saveUser(user);
  return user;
}

export function signOut(): void {
  const t = memoryToken;
  memoryToken = null;
  writeToken(null);
  saveUser(null);
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t.accessToken);
}

/** Đã đăng nhập trước đó (có thông tin tài khoản) — token có thể đã hết hạn */
export const isSignedIn = (): boolean => currentUser() !== null;

/**
 * Lấy token còn hạn có đủ quyền. Nếu hết hạn hoặc thiếu quyền, mở lại cửa sổ Google (thường tự đóng ngay
 * vì người dùng đã cho phép trước đó). Gọi từ cú bấm của người dùng để trình duyệt không chặn cửa sổ.
 */
export async function getToken(extraScopes: string[] = []): Promise<string> {
  const need = [SCOPES.base[3], ...extraScopes];
  if (!hasScopes(memoryToken, need) || (memoryToken && memoryToken.expiresAt < Date.now() + 60_000)) {
    const t = await requestToken([...SCOPES.base, ...extraScopes], '');
    if (!hasScopes(t, need)) throw new GoogleAuthError('Bạn chưa cấp đủ quyền cho tính năng này.');
    memoryToken = t;
    writeToken(t);
  }
  return (memoryToken as TokenState).accessToken;
}

/** Có token còn hạn để gọi API ngay mà không cần mở cửa sổ */
export const hasLiveToken = (extraScopes: string[] = []): boolean =>
  hasScopes(memoryToken, [SCOPES.base[3], ...extraScopes]) && !!memoryToken && memoryToken.expiresAt > Date.now() + 60_000;

/** Gọi Google API kèm token; tự xử lý lỗi thường gặp thành thông báo tiếng Việt */
export async function gfetch<T>(url: string, init: RequestInit = {}, extraScopes: string[] = []): Promise<T> {
  const token = await getToken(extraScopes);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (res.status === 401) {
    memoryToken = null;
    writeToken(null);
    throw new GoogleAuthError('Phiên đăng nhập Google đã hết hạn. Hãy bấm lại để tiếp tục.');
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '';
    } catch {
      /* không có nội dung lỗi */
    }
    throw new GoogleAuthError(res.status === 403 ? `Google từ chối yêu cầu (${detail || 'không đủ quyền'}).` : `Lỗi từ Google (${res.status}${detail ? `: ${detail}` : ''}).`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
