/** Lưu ván cờ online (JSON) vào thư mục WFTools/Games trong Google Drive của chính người chơi */
import { gfetch, getToken, hasLiveToken, isSignedIn } from '../google/auth';
import { ensureFolder } from '../google/sheets';

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

let gamesFolder: Promise<string> | null = null;

function folder(): Promise<string> {
  gamesFolder ??= (async () => {
    const parent = await ensureFolder();
    const q = `'${parent}' in parents and appProperties has { key='wft' and value='games' } and mimeType='${FOLDER_MIME}' and trashed=false`;
    const res = await gfetch<{ files: { id: string }[] }>(`${DRIVE}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
    if (res.files[0]) return res.files[0].id;
    const made = await gfetch<{ id: string }>(`${DRIVE}?fields=id`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Games', mimeType: FOLDER_MIME, parents: [parent], appProperties: { wft: 'games' } }),
    });
    return made.id;
  })().catch((e) => {
    gamesFolder = null;
    throw e;
  });
  return gamesFolder;
}

export const canSaveGames = (): boolean => isSignedIn();
/** Lưu ngay không cần mở cửa sổ Google */
export const canSaveSilently = (): boolean => isSignedIn() && hasLiveToken();

export async function saveGameRecord(name: string, record: unknown): Promise<void> {
  const parent = await folder();
  const token = await getToken();
  const boundary = `wft${Math.random().toString(36).slice(2)}`;
  const meta = { name, mimeType: 'application/json', parents: [parent], appProperties: { wftg: '1' } };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(record, null, 1)}\r\n--${boundary}--`;
  const res = await fetch(`${UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(String(res.status));
}
