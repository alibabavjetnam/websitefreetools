/**
 * Chơi cờ online giữa hai người, dùng chung cho cờ vua, cờ tướng, cờ úp, cờ vây.
 *
 * Nước đi chuyển qua một máy chủ MQTT công cộng miễn phí (không cần đăng nhập). Máy chủ không lưu ván:
 *  - Mỗi bàn có mã GUID nằm trên địa chỉ trang (?id=...). Ai mở cùng địa chỉ thì vào cùng bàn; đủ 2 người thì bắt đầu.
 *  - Nội dung trong bàn được mã hoá AES-GCM bằng khoá suy ra từ mã bàn, chủ đề cũng là mã băm: người không có link
 *    không đọc được, không chèn được nước đi.
 *  - Bàn công khai được ghi lên "danh sách bàn chờ" (tin nhắn retain). Máy chủ tự xoá mục đó khi người mở bàn rời trang
 *    (di chúc MQTT), và trang tự xoá khi đã đủ người. Bàn riêng không lên danh sách.
 *  - Khi cả hai rời trang, không còn gì trên máy chủ. Tải lại trang thì ván được khôi phục từ sessionStorage
 *    và từ người còn lại.
 */
import { escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { MqttClient, textOf } from './mqtt';
import { canSaveGames, canSaveSilently, saveGameRecord } from './game-history';

export type Color = 0 | 1;
export type EndReason = 'mate' | 'stalemate' | 'resign' | 'draw' | 'agreed' | 'score' | 'repetition';
export interface OnlineResult {
  /** Màu thắng, null = hoà */
  winner: Color | null;
  reason: EndReason;
  detail?: string;
}

export interface OnlineStart {
  myColor: Color;
  setup: unknown;
  opts: Record<string, unknown>;
  /** Nước đi đã có (khi khôi phục ván) */
  moves: unknown[];
  opponent: string;
  result: OnlineResult | null;
}

export interface OnlineGameDef {
  game: 'chess' | 'xiangqi' | 'co-up' | 'co-up-x' | 'go';
  /** Tên màu: [bên đi trước, bên đi sau] */
  colorNames: () => [string, string];
  /** Chủ bàn tạo dữ liệu đầu ván (cách xáo quân cờ úp…); null nếu không cần */
  makeSetup: (opts: Record<string, unknown>) => unknown;
  validSetup: (s: unknown, opts: Record<string, unknown>) => boolean;
  /** Tuỳ chọn khi tạo bàn (cờ vây: cỡ bàn) */
  optionsHtml?: () => string;
  readOptions?: (root: HTMLElement) => Record<string, unknown>;
  validOptions?: (o: Record<string, unknown>) => boolean;
  describeOptions?: (o: Record<string, unknown>) => string;
  /** Bắt đầu / khôi phục ván: vẽ lại bàn và đi lại các nước đã có */
  onStart: (s: OnlineStart) => void;
  /** Nước của đối thủ: trả false nếu không hợp lệ (bỏ qua) */
  onRemoteMove: (mv: unknown) => boolean;
  /** Ván kết thúc vì đầu hàng / hoà thoả thuận (kết thúc theo luật thì trang tự biết) */
  onEnd: (r: OnlineResult) => void;
  /** Rời bàn: trang quay về trạng thái chờ */
  onLeave: () => void;
}

type Phase = 'off' | 'connecting' | 'error' | 'idle' | 'waiting' | 'playing' | 'ended' | 'full';

interface Msg {
  t: string;
  cid: string;
  [k: string]: unknown;
}

interface Record_ {
  cid: string;
  seq: number;
  players: [string, string] | null;
  names: Record<string, string>;
  setup: unknown;
  opts: Record<string, unknown>;
  moves: unknown[];
  result: OnlineResult | null;
  pub: boolean;
}

const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const ROOT = 'wft/g1';
const LOBBY_TTL = 80_000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const uuid = (): string =>
  typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : hex(crypto.getRandomValues(new Uint8Array(16)).buffer).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
const isId = (s: string | null): s is string => !!s && /^[0-9a-f-]{16,64}$/i.test(s);

function brokerList(): string[] {
  try {
    const o = localStorage.getItem('wft:mqtt-url');
    if (o && /^wss?:\/\//.test(o)) return [o];
  } catch { /* bỏ qua */ }
  return BROKERS;
}

function guestName(): string {
  const key = 'wft:guest-no';
  let n = '';
  try {
    n = localStorage.getItem(key) ?? '';
    if (!/^\d{4}$/.test(n)) {
      n = String(1000 + Math.floor(Math.random() * 9000));
      localStorage.setItem(key, n);
    }
  } catch {
    n = String(1000 + Math.floor(Math.random() * 9000));
  }
  return `${t('lib.online.guest', 'Khách')} ${n}`;
}

interface RoomKey { key: CryptoKey; topic: string }

async function roomKey(game: string, id: string): Promise<RoomKey> {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`wft-room-key:${id}`));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const th = hex(await crypto.subtle.digest('SHA-256', enc.encode(`wft-room-topic:${id}`))).slice(0, 32);
  return { key, topic: `${ROOT}/${game}/r/${th}` };
}

const ICON = {
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
};
const svg = (inner: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export class OnlineRoom {
  private mq: MqttClient | null = null;
  private broker = 0;
  private phase: Phase = 'off';
  private roomId = '';
  private rk: RoomKey | null = null;
  private rec: Record_ | null = null;
  private lobbyKey = uuid().slice(0, 12);
  private lobby = new Map<string, { room: string; name: string; ts: number; opts: Record<string, unknown> }>();
  private offRoom: (() => void) | null = null;
  private offLobby: (() => void) | null = null;
  private timers: number[] = [];
  private lastSeen = 0;
  private drawOffered = false;
  private drawIncoming = false;
  private againMine = false;
  private againTheirs = false;
  private lastHello = 0;
  private quickTries = 0;
  private saved: 'no' | 'yes' | 'saving' | 'err' = 'no';
  private errMsg = '';
  private myName = guestName();
  private lobbyOpenedAt = 0;
  private lastLobbyAt = 0;
  private resignArmed = false;
  private joinTimer = 0;
  private shownOnline: boolean | null = null;

  constructor(private def: OnlineGameDef, private host: HTMLElement) {
    host.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('pagehide', () => this.pageHide());
    // Trang được khôi phục từ bộ nhớ đệm (bấm Quay lại): socket đã đóng, nối lại
    window.addEventListener('pageshow', (e) => {
      if (e.persisted && this.phase !== 'off') this.lostConnection();
    });
    this.timers.push(window.setInterval(() => this.tick(), 5000));
  }

  /* ------------------------- Trạng thái cho trang ------------------------- */

  get playing(): boolean {
    return this.phase === 'playing';
  }
  get myColor(): Color | null {
    const r = this.rec;
    if (!r?.players) return null;
    return r.players[0] === r.cid ? 0 : 1;
  }
  get active(): boolean {
    return this.phase !== 'off';
  }

  /** Vào chế độ online: kết nối máy chủ; nếu địa chỉ có ?id= thì vào bàn đó */
  async open(): Promise<void> {
    if (this.phase !== 'off' && this.phase !== 'error') return;
    this.phase = 'connecting';
    this.render();
    const ok = await this.connect();
    if (!ok) return;
    const id = new URLSearchParams(location.search).get('id');
    if (isId(id)) await this.enter(id.toLowerCase(), false);
    else this.toIdle();
  }

  /** Rời chế độ online (chuyển sang đánh với máy) */
  close(): void {
    this.leaveRoom(true);
    this.offLobby?.();
    this.offLobby = null;
    this.mq?.close(true);
    this.mq = null;
    this.phase = 'off';
    this.render();
  }

  private async connect(): Promise<boolean> {
    const list = brokerList();
    const s = Number(new URLSearchParams(location.search).get('s') ?? '0');
    const order = list.map((_, i) => (i + (s > 0 && s < list.length ? s : 0)) % list.length);
    for (const i of order) {
      const mq = new MqttClient({
        url: list[i],
        clientId: `wft-${uuid().slice(0, 18)}`,
        keepAlive: 30,
        will: { topic: `${ROOT}/${this.def.game}/lobby/${this.lobbyKey}`, payload: '', retain: true },
      });
      try {
        await mq.connect();
        this.mq = mq;
        this.broker = i;
        mq.onClose = () => this.lostConnection();
        return true;
      } catch {
        /* thử máy chủ kế */
      }
    }
    this.phase = 'error';
    this.errMsg = t('lib.online.connFail', 'Không kết nối được máy chủ chơi online. Kiểm tra mạng (hoặc tắt trình chặn quảng cáo) rồi bấm Thử lại.');
    this.render();
    return false;
  }

  private lostConnection(): void {
    this.mq = null;
    const id = this.roomId;
    this.offRoom = null;
    this.offLobby = null;
    this.phase = 'connecting';
    this.render();
    // Tự nối lại sau 2 giây; nếu đang trong bàn thì vào lại bàn (khôi phục ván)
    window.setTimeout(async () => {
      if (this.phase !== 'connecting') return;
      if (!(await this.connect())) return;
      if (id) await this.enter(id, this.rec?.pub ?? false);
      else this.toIdle();
    }, 2000);
  }

  /* ------------------------- Danh sách bàn công khai ------------------------- */

  private toIdle(): void {
    this.phase = 'idle';
    this.roomId = '';
    this.rec = null;
    this.setUrl(null);
    if (!this.offLobby && this.mq) {
      this.lobby.clear();
      this.lobbyOpenedAt = Date.now();
      this.offLobby = this.mq.subscribe(`${ROOT}/${this.def.game}/lobby/+`, (topic, payload) => {
        const key = topic.split('/').pop() as string;
        if (!payload.length) {
          this.lobby.delete(key);
        } else {
          try {
            const e = JSON.parse(textOf(payload)) as { room?: string; name?: string; ts?: number; opts?: Record<string, unknown> };
            if (isId(e.room ?? null) && typeof e.ts === 'number' && key !== this.lobbyKey) {
              const opts = e.opts && typeof e.opts === 'object' ? e.opts : {};
              if (!this.def.validOptions || this.def.validOptions(opts)) this.lobby.set(key, { room: (e.room as string).toLowerCase(), name: String(e.name ?? '').slice(0, 40), ts: e.ts, opts });
            }
          } catch { /* bỏ qua tin lạ */ }
        }
        if (this.phase === 'idle') this.render();
      });
    }
    this.render();
  }

  private openTables(): { key: string; room: string; name: string; ts: number; opts: Record<string, unknown> }[] {
    const now = Date.now();
    return [...this.lobby.entries()]
      .map(([key, e]) => ({ key, ...e }))
      .filter((e) => now - e.ts < LOBBY_TTL && e.room !== this.roomId)
      .sort((a, b) => a.ts - b.ts);
  }

  private publishLobby(): void {
    if (!this.mq || !this.rec?.pub || this.phase !== 'waiting') return;
    this.lastLobbyAt = Date.now();
    this.mq.publish(`${ROOT}/${this.def.game}/lobby/${this.lobbyKey}`, JSON.stringify({ room: this.roomId, name: this.myName, ts: Date.now(), opts: this.rec.opts }), true);
  }

  private clearLobby(): void {
    this.mq?.publish(`${ROOT}/${this.def.game}/lobby/${this.lobbyKey}`, '', true);
  }

  /** Tìm đối thủ: vào bàn công khai đang chờ cùng tuỳ chọn, không có thì mở bàn công khai mới */
  private async quickMatch(): Promise<void> {
    const wait = 1500 - (Date.now() - this.lobbyOpenedAt);
    if (wait > 0) {
      this.phase = 'connecting';
      this.render();
      await new Promise((r) => window.setTimeout(r, wait));
    }
    const opts = this.currentOptions();
    const want = JSON.stringify(opts);
    const hit = this.openTables().find((e) => JSON.stringify(e.opts) === want);
    if (hit) {
      this.lobby.delete(hit.key);
      this.quickTries++;
      await this.joinListed(hit.room);
    } else {
      this.quickTries = 0;
      await this.create(true);
    }
  }

  private currentOptions(): Record<string, unknown> {
    return this.def.readOptions ? this.def.readOptions(this.host) : {};
  }

  /* ------------------------- Vào / tạo bàn ------------------------- */

  private async create(pub: boolean): Promise<void> {
    const id = uuid().toLowerCase();
    await this.enter(id, pub, this.currentOptions());
  }

  private loadRecord(id: string): Record_ | null {
    try {
      const raw = sessionStorage.getItem(`wft:room:${id}`);
      return raw ? (JSON.parse(raw) as Record_) : null;
    } catch {
      return null;
    }
  }

  private saveRecord(): void {
    if (!this.rec || !this.roomId) return;
    try {
      sessionStorage.setItem(`wft:room:${this.roomId}`, JSON.stringify(this.rec));
    } catch { /* bỏ qua */ }
  }

  private async enter(id: string, pub: boolean, opts: Record<string, unknown> = {}): Promise<void> {
    if (!this.mq) return;
    this.offLobby?.();
    this.offLobby = null;
    this.leaveRoom(false);
    this.roomId = id;
    this.rk = await roomKey(this.def.game, id);
    const saved = this.loadRecord(id);
    this.rec = saved ?? { cid: uuid(), seq: 0, players: null, names: {}, setup: null, opts, moves: [], result: null, pub };
    this.rec.names[this.rec.cid] = this.myName;
    this.drawOffered = this.drawIncoming = this.againMine = this.againTheirs = false;
    this.saved = 'no';
    this.setUrl(id);
    this.offRoom = this.mq.subscribe(this.rk.topic, (_t, payload) => void this.onRoomData(payload));
    if (this.rec.players) {
      // Khôi phục ván sau khi tải lại trang
      this.phase = this.rec.result ? 'ended' : 'playing';
      this.startGame();
    } else {
      this.phase = 'waiting';
      this.publishLobby();
    }
    this.lastSeen = 0;
    this.saveRecord();
    this.render();
    // Chờ một nhịp để lệnh SUBSCRIBE tới máy chủ trước khi chào
    window.setTimeout(() => this.hello(), 250);
  }

  /** Vào bàn từ danh sách / Tìm đối thủ: nếu sau 4 giây không thấy chủ bàn (đã rời đi) thì quay lại */
  private async joinListed(room: string): Promise<void> {
    await this.enter(room, false, this.lobby.get([...this.lobby.entries()].find(([, e]) => e.room === room)?.[0] ?? '')?.opts ?? {});
    window.clearTimeout(this.joinTimer);
    this.joinTimer = window.setTimeout(() => {
      if (this.phase !== 'waiting' || this.roomId !== room || this.rec?.players) return;
      this.leaveRoom(true);
      this.toIdle();
      if (this.quickTries > 0 && this.quickTries < 3) void this.quickMatch();
      else this.flash(t('lib.online.tableGone', 'Người mở bàn đã rời đi. Hãy chọn bàn khác hoặc mở bàn mới.'));
    }, 4000);
  }

  private hello(): void {
    this.lastHello = Date.now();
    void this.send({ t: 'hello', name: this.myName, n: this.rec?.moves.length ?? 0, seq: this.rec?.seq ?? 0, opts: this.rec?.opts ?? {} });
  }

  private leaveRoom(final: boolean): void {
    if (this.roomId && this.rk) {
      if (final) void this.send({ t: 'bye' });
      if (this.rec?.pub && this.phase === 'waiting') this.clearLobby();
      if (final) {
        try { sessionStorage.removeItem(`wft:room:${this.roomId}`); } catch { /* bỏ qua */ }
      }
    }
    this.offRoom?.();
    this.offRoom = null;
    this.roomId = '';
    this.rk = null;
  }

  private pageHide(): void {
    // Không gửi "bye": người chơi có thể chỉ tải lại trang. Đóng socket đột ngột để máy chủ chạy di chúc (xoá bàn chờ).
    this.mq?.close(false);
  }

  private setUrl(id: string | null): void {
    const u = new URL(location.href);
    if (id) {
      u.searchParams.set('id', id);
      if (this.broker > 0) u.searchParams.set('s', String(this.broker));
      else u.searchParams.delete('s');
    } else {
      u.searchParams.delete('id');
      u.searchParams.delete('s');
    }
    if (u.href !== location.href) history.replaceState(history.state, '', u.href);
  }

  private inviteUrl(): string {
    const u = new URL(location.href);
    u.hash = '';
    return u.href;
  }

  /* ------------------------- Gửi / nhận ------------------------- */

  private async send(body: Record<string, unknown>): Promise<void> {
    // Giữ lại khoá và kết nối của bàn hiện tại: rời bàn ngay sau khi gửi vẫn gửi được tin cuối
    const mq = this.mq, rk = this.rk, rec = this.rec;
    if (!mq || !rk || !rec) return;
    const msg = JSON.stringify({ ...body, cid: rec.cid });
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, rk.key, enc.encode(msg)));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    mq.publish(rk.topic, out);
  }

  private async onRoomData(payload: Uint8Array): Promise<void> {
    const rk = this.rk;
    if (!rk || payload.length < 13) return;
    let m: Msg;
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: payload.slice(0, 12) }, rk.key, payload.slice(12));
      m = JSON.parse(dec.decode(plain)) as Msg;
    } catch {
      return;
    }
    if (rk !== this.rk || !this.rec || typeof m.cid !== 'string' || m.cid === this.rec.cid) return;
    this.handle(m);
  }

  private opponent(): string | null {
    const r = this.rec;
    if (!r?.players) return null;
    return r.players[0] === r.cid ? r.players[1] : r.players[0];
  }

  private handle(m: Msg): void {
    const r = this.rec as Record_;
    const opp = this.opponent();
    if (opp && m.cid === opp) this.lastSeen = Date.now();
    if (typeof m.name === 'string' && (!opp || m.cid === opp)) r.names[m.cid] = m.name.slice(0, 40);

    switch (m.t) {
      case 'hello':
        if (r.players) {
          if (r.players.includes(m.cid)) this.sendSync();
          else void this.send({ t: 'full', to: m.cid });
        } else if (this.phase === 'waiting') {
          this.lastSeen = Date.now();
          // Người vào bằng link chưa biết tuỳ chọn bàn (cỡ bàn cờ vây…): lấy theo người mở bàn
          const mo = m.opts;
          if (!Object.keys(r.opts ?? {}).length && mo && typeof mo === 'object' && Object.keys(mo).length && (!this.def.validOptions || this.def.validOptions(mo as Record<string, unknown>))) r.opts = mo as Record<string, unknown>;
          if (r.cid < m.cid && (Object.keys(r.opts ?? {}).length || !this.def.optionsHtml)) this.newGame([r.cid, m.cid], 1);
          else if (r.cid < m.cid) this.hello();
          else if (Date.now() - this.lastHello > 800) this.hello();
        }
        break;
      case 'start': {
        const players = m.players as [string, string];
        if (!Array.isArray(players) || players.length !== 2 || !players.includes(r.cid) || !players.includes(m.cid)) {
          if (!r.players && this.phase === 'waiting' && Array.isArray(players) && !players.includes(r.cid)) this.toFull();
          break;
        }
        const seq = Number(m.seq);
        const opts = (m.opts && typeof m.opts === 'object' ? m.opts : {}) as Record<string, unknown>;
        if (!(seq > r.seq) || !this.def.validSetup(m.setup, opts)) break;
        r.seq = seq;
        r.players = players;
        r.setup = m.setup;
        r.opts = opts;
        r.moves = [];
        r.result = null;
        this.afterStart();
        break;
      }
      case 'sync': {
        if (!r.players || !r.players.includes(m.cid)) {
          // Mình vừa tải lại mà mất bản ghi: nhận lại ván từ đối thủ
          const players = m.players as [string, string];
          if (Array.isArray(players) && players.includes(r.cid) && this.def.validSetup(m.setup, (m.opts ?? {}) as Record<string, unknown>)) {
            Object.assign(r, { seq: Number(m.seq), players, setup: m.setup, opts: m.opts ?? {}, moves: Array.isArray(m.moves) ? m.moves : [], result: (m.result as OnlineResult) ?? null });
            this.afterStart();
          }
          break;
        }
        const seq = Number(m.seq);
        const moves = Array.isArray(m.moves) ? m.moves : [];
        if (seq > r.seq || (seq === r.seq && moves.length > r.moves.length) || (seq === r.seq && !r.result && m.result)) {
          if (seq > r.seq && !this.def.validSetup(m.setup, (m.opts ?? {}) as Record<string, unknown>)) break;
          Object.assign(r, { seq, setup: m.setup, opts: m.opts ?? r.opts, moves, result: (m.result as OnlineResult) ?? null });
          this.afterStart();
        } else if (seq < r.seq || moves.length < r.moves.length) {
          this.sendSync();
        }
        this.render();
        break;
      }
      case 'move': {
        if (m.cid !== opp || Number(m.seq) !== r.seq || r.result) break;
        const n = Number(m.n);
        if (n < r.moves.length) break;
        if (n > r.moves.length) {
          void this.send({ t: 'hello', name: this.myName });
          break;
        }
        if (this.def.onRemoteMove(m.mv)) {
          r.moves.push(m.mv);
          this.drawOffered = this.drawIncoming = false;
          this.saveRecord();
          this.render();
        }
        break;
      }
      case 'resign':
        if (m.cid !== opp || Number(m.seq) !== r.seq || r.result) break;
        this.end({ winner: this.myColor, reason: 'resign' }, true);
        break;
      case 'draw?':
        if (m.cid !== opp || Number(m.seq) !== r.seq || r.result) break;
        this.drawIncoming = true;
        this.render();
        break;
      case 'draw!':
        if (m.cid !== opp || Number(m.seq) !== r.seq || r.result || !this.drawOffered) break;
        this.end({ winner: null, reason: 'agreed' }, true);
        break;
      case 'draw-':
        if (m.cid !== opp) break;
        this.drawOffered = false;
        this.flash(t('lib.online.drawDeclined', 'Đối thủ không đồng ý hoà.'));
        break;
      case 'again':
        if (m.cid !== opp || Number(m.seq) !== r.seq) break;
        this.againTheirs = true;
        this.maybeRematch();
        this.render();
        break;
      case 'full':
        if (m.to === r.cid && !r.players) this.toFull();
        break;
      case 'bye':
        if (m.cid === opp) {
          this.lastSeen = -1;
          this.render();
        }
        break;
      case 'ping':
        if (m.cid === opp) this.render();
        break;
    }
  }

  private toFull(): void {
    const quick = this.quickTries > 0 && this.quickTries < 3;
    this.leaveRoom(false);
    if (quick) {
      this.toIdle();
      void this.quickMatch();
      return;
    }
    this.phase = 'full';
    this.setUrl(null);
    this.render();
  }

  private sendSync(): void {
    const r = this.rec;
    if (!r) return;
    void this.send({ t: 'sync', name: this.myName, seq: r.seq, players: r.players, setup: r.setup, opts: r.opts, moves: r.moves, result: r.result });
  }

  /** Chủ bàn (mã nhỏ hơn) chia màu ngẫu nhiên lúc đầu, các ván sau đổi màu */
  private newGame(pair: [string, string], seq: number, prev?: [string, string]): void {
    const r = this.rec as Record_;
    const players: [string, string] = prev ? [prev[1], prev[0]] : Math.random() < 0.5 ? pair : [pair[1], pair[0]];
    const opts = r.opts ?? {};
    const setup = this.def.makeSetup(opts);
    r.seq = seq;
    r.players = players;
    r.setup = setup;
    r.moves = [];
    r.result = null;
    void this.send({ t: 'start', name: this.myName, seq, players, setup, opts });
    this.afterStart();
  }

  private afterStart(): void {
    const r = this.rec as Record_;
    if (r.pub) this.clearLobby();
    this.phase = r.result ? 'ended' : 'playing';
    this.drawOffered = this.drawIncoming = this.againMine = this.againTheirs = false;
    this.saved = 'no';
    this.quickTries = 0;
    if (!this.lastSeen) this.lastSeen = Date.now();
    this.saveRecord();
    this.startGame();
    this.render();
  }

  private startGame(): void {
    const r = this.rec as Record_;
    const opp = this.opponent() ?? '';
    this.def.onStart({ myColor: this.myColor as Color, setup: r.setup, opts: r.opts, moves: [...r.moves], opponent: r.names[opp] ?? t('lib.online.opponent', 'Đối thủ'), result: r.result });
  }

  private maybeRematch(): void {
    const r = this.rec;
    if (!r?.players || !this.againMine || !this.againTheirs) return;
    // Người vừa đi trước tạo ván mới và đổi màu
    if (r.players[0] === r.cid) this.newGame(r.players, r.seq + 1, r.players);
  }

  /* ------------------------- Trang báo cho bàn ------------------------- */

  /** Gửi nước đi của mình (trang đã kiểm tra hợp lệ và đã đi trên bàn) */
  sendMove(mv: unknown): void {
    const r = this.rec;
    if (!r?.players || r.result) return;
    r.moves.push(mv);
    this.drawOffered = this.drawIncoming = false;
    this.saveRecord();
    void this.send({ t: 'move', seq: r.seq, n: r.moves.length - 1, mv });
    this.render();
  }

  /** Ván kết thúc theo luật (chiếu bí, hết nước, chấm điểm…): cả hai máy tự tính ra như nhau */
  finish(res: OnlineResult): void {
    this.end(res, false);
  }

  private end(res: OnlineResult, notify: boolean): void {
    const r = this.rec;
    if (!r || r.result) return;
    r.result = res;
    this.phase = 'ended';
    this.saveRecord();
    if (notify) this.def.onEnd(res);
    if (canSaveSilently()) void this.saveToDrive();
    this.render();
  }

  private async saveToDrive(): Promise<void> {
    const r = this.rec;
    if (!r?.players || !r.result) return;
    this.saved = 'saving';
    this.render();
    const [c0, c1] = this.def.colorNames();
    const me = this.myColor as Color;
    const opp = this.opponent() ?? '';
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    try {
      await saveGameRecord(`${this.def.game} ${stamp}.json`, {
        game: this.def.game,
        date: d.toISOString(),
        me: { color: me === 0 ? c0 : c1, name: this.myName },
        opponent: { color: me === 0 ? c1 : c0, name: r.names[opp] ?? '' },
        options: r.opts,
        setup: r.setup,
        moves: r.moves,
        result: { winner: r.result.winner === null ? null : r.result.winner === 0 ? c0 : c1, reason: r.result.reason, detail: r.result.detail ?? '' },
      });
      this.saved = 'yes';
    } catch {
      this.saved = 'err';
    }
    this.render();
  }

  /* ------------------------- Giao diện bảng điều khiển ------------------------- */

  private flashMsg = '';
  private flash(msg: string): void {
    this.flashMsg = msg;
    this.render();
    window.setTimeout(() => {
      if (this.flashMsg === msg) {
        this.flashMsg = '';
        this.render();
      }
    }, 5000);
  }

  private tick(): void {
    if (!this.mq) return;
    if (this.roomId && (this.phase === 'playing' || this.phase === 'ended' || this.phase === 'waiting')) {
      void this.send({ t: 'ping' });
      if (this.phase === 'waiting' && Date.now() - this.lastLobbyAt > 30_000) this.publishLobby();
    }
    if (this.phase === 'idle') this.render();
    else if ((this.phase === 'playing' || this.phase === 'ended') && this.oppOnline() !== this.shownOnline) this.render();
  }

  private oppOnline(): boolean {
    return this.lastSeen > 0 && Date.now() - this.lastSeen < 30_000;
  }

  private onClick(e: Event): void {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-on]');
    if (!b || !this.host.contains(b)) return;
    const a = b.dataset.on;
    const r = this.rec;
    if (a === 'retry') void this.open();
    else if (a === 'quick') void this.quickMatch();
    else if (a === 'public') void this.create(true);
    else if (a === 'private') void this.create(false);
    else if (a === 'join' && b.dataset.room) {
      this.quickTries = 0;
      void this.joinListed(b.dataset.room);
    } else if (a === 'leave') {
      this.leaveRoom(true);
      this.def.onLeave();
      this.toIdle();
    } else if (a === 'back') {
      this.def.onLeave();
      this.toIdle();
    } else if (a === 'copy') {
      const url = this.inviteUrl();
      void navigator.clipboard?.writeText(url).then(() => this.flash(t('lib.online.copied', 'Đã chép link. Gửi cho bạn của bạn để cùng chơi.')), () => {
        (this.host.querySelector('.on-link') as HTMLInputElement | null)?.select();
      });
    } else if (a === 'share') {
      void navigator.share?.({ title: document.title, url: this.inviteUrl() }).catch(() => undefined);
    } else if (a === 'resign' && r?.players && !r.result) {
      if (!this.resignArmed) {
        this.resignArmed = true;
        this.render();
        window.setTimeout(() => {
          this.resignArmed = false;
          this.render();
        }, 4000);
        return;
      }
      this.resignArmed = false;
      void this.send({ t: 'resign', seq: r.seq });
      const me = this.myColor as Color;
      this.end({ winner: me === 0 ? 1 : 0, reason: 'resign' }, true);
    } else if (a === 'draw' && r?.players && !r.result) {
      if (this.drawIncoming) {
        void this.send({ t: 'draw!', seq: r.seq });
        this.end({ winner: null, reason: 'agreed' }, true);
      } else {
        this.drawOffered = true;
        void this.send({ t: 'draw?', seq: r.seq });
        this.render();
      }
    } else if (a === 'decline' && r) {
      this.drawIncoming = false;
      void this.send({ t: 'draw-', seq: r.seq });
      this.render();
    } else if (a === 'again' && r?.players) {
      this.againMine = true;
      void this.send({ t: 'again', seq: r.seq });
      this.maybeRematch();
      this.render();
    } else if (a === 'save') void this.saveToDrive();
  }

  render(): void {
    const h = this.host;
    if (this.phase === 'off') {
      h.innerHTML = '';
      return;
    }
    const T = (k: string, f: string) => escapeHtml(t(`lib.online.${k}`, f));
    const r = this.rec;
    const [c0, c1] = this.def.colorNames();
    this.shownOnline = this.oppOnline();
    let html = '';
    const flash = this.flashMsg ? `<p class="on-flash" role="status">${escapeHtml(this.flashMsg)}</p>` : '';
    switch (this.phase) {
      case 'connecting':
        html = `<p class="on-status"><span class="on-spin" aria-hidden="true"></span>${T('connecting', 'Đang kết nối máy chủ chơi online…')}</p>`;
        break;
      case 'error':
        html = `<p class="on-status on-err" role="alert">${escapeHtml(this.errMsg)}</p><button type="button" class="btn btn-primary btn-sm" data-on="retry">${T('retry', 'Thử lại')}</button>`;
        break;
      case 'idle': {
        const tables = this.openTables();
        html = `
          <h3 class="on-h"><span class="on-count">${tables.length}</span> <span class="on-ht">${T('openTables', 'Bàn chờ bạn')}</span></h3>
          ${
            tables.length
              ? `<ul class="on-list">${tables
                  .map(
                    (e) => `<li><span>${escapeHtml(e.name || t('lib.online.guest', 'Khách'))}${this.def.describeOptions ? ` · ${escapeHtml(this.def.describeOptions(e.opts))}` : ''}<small>${escapeHtml(tf('lib.online.waitingFor', 'đang chờ {n} giây', { n: Math.max(1, Math.round((Date.now() - e.ts) / 1000)) }))}</small></span><button type="button" class="btn btn-sm btn-primary" data-on="join" data-room="${escapeHtml(e.room)}">${T('join', 'Vào chơi')}</button></li>`,
                  )
                  .join('')}</ul>`
              : `<p class="note">${T('noTables', 'Chưa có bàn nào đang chờ. Bấm "Tìm đối thủ" hoặc mở bàn mới.')}</p>`
          }
          <div class="on-actions">
            <button type="button" class="btn btn-primary" data-on="quick">${T('quick', 'Tìm đối thủ')}</button>
            <button type="button" class="btn" data-on="public">${T('createPublic', 'Mở bàn công khai')}</button>
            <button type="button" class="btn" data-on="private">${T('createPrivate', 'Mở bàn riêng, mời bạn')}</button>
          </div>
          <p class="note">${T('modesHint', 'Bàn công khai hiện trong danh sách để người khác vào chơi. Bàn riêng chỉ ai có link mời mới vào được.')}</p>
          <p class="note on-privacy">${T('privacy', 'Nước đi được chuyển qua máy chủ MQTT công cộng miễn phí và được mã hoá theo từng bàn; máy chủ không lưu ván. Đăng nhập Google để lưu ván đã chơi vào Drive của bạn.')}</p>`;
        break;
      }
      case 'waiting':
        html = `
          <p class="on-status"><span class="on-spin" aria-hidden="true"></span>${r?.pub ? T('waitingPublic', 'Bàn công khai: đang chờ người vào chơi…') : T('waitingPrivate', 'Bàn riêng: gửi link này cho bạn của bạn. Khi bạn ấy mở link, ván cờ bắt đầu.')}</p>
          ${this.linkBox()}
          <div class="on-actions"><button type="button" class="btn btn-sm" data-on="leave">${T('leave', 'Rời bàn')}</button></div>`;
        break;
      case 'full':
        html = `<p class="on-status on-err" role="alert">${T('full', 'Bàn này đã đủ 2 người. Hãy tìm bàn khác hoặc mở bàn mới.')}</p><button type="button" class="btn btn-primary btn-sm" data-on="back">${T('backToList', 'Về danh sách bàn')}</button>`;
        break;
      case 'playing':
      case 'ended': {
        const me = this.myColor as Color;
        const opp = this.opponent() ?? '';
        const oppName = escapeHtml(r?.names[opp] ?? t('lib.online.opponent', 'Đối thủ'));
        const online = this.oppOnline();
        html = `
          <div class="on-players">
            <div><span class="on-dot is-on"></span><b>${T('you', 'Bạn')}</b> · ${escapeHtml(me === 0 ? c0 : c1)}</div>
            <div><span class="on-dot ${online ? 'is-on' : ''}"></span><b>${oppName}</b> · ${escapeHtml(me === 0 ? c1 : c0)}${online ? '' : ` <small class="on-off">${this.lastSeen < 0 ? T('oppLeft', 'đã rời bàn') : T('oppOffline', 'mất kết nối')}</small>`}</div>
          </div>
          ${this.drawIncoming && this.phase === 'playing' ? `<div class="on-offer" role="alert">${T('drawOffer', 'Đối thủ xin hoà.')} <button type="button" class="btn btn-sm btn-primary" data-on="draw">${T('accept', 'Đồng ý')}</button> <button type="button" class="btn btn-sm" data-on="decline">${T('decline', 'Từ chối')}</button></div>` : ''}
          ${
            this.phase === 'playing'
              ? `<div class="on-actions">
                  <button type="button" class="btn btn-sm" data-on="draw" ${this.drawOffered ? 'disabled' : ''}>${this.drawOffered ? T('drawSent', 'Đã xin hoà…') : T('offerDraw', 'Xin hoà')}</button>
                  <button type="button" class="btn btn-sm${this.resignArmed ? ' btn-danger' : ''}" data-on="resign">${this.resignArmed ? T('resignConfirm', 'Bấm lần nữa để đầu hàng') : T('resign', 'Đầu hàng')}</button>
                  <button type="button" class="btn btn-sm" data-on="leave">${T('leave', 'Rời bàn')}</button>
                </div>`
              : `<div class="on-actions">
                  <button type="button" class="btn btn-sm btn-primary" data-on="again" ${this.againMine ? 'disabled' : ''}>${this.againMine ? T('againSent', 'Đang chờ đối thủ đồng ý…') : this.againTheirs ? T('againAccept', 'Đối thủ muốn chơi tiếp — Chơi ván mới') : T('again', 'Chơi ván mới (đổi màu)')}</button>
                  <button type="button" class="btn btn-sm" data-on="leave">${T('leave', 'Rời bàn')}</button>
                </div>
                ${this.saveHtml()}`
          }
          ${this.linkBox(true)}`;
        break;
      }
    }
    // Vùng tuỳ chọn (cỡ bàn cờ vây…) giữ nguyên giữa các lần vẽ lại để không mất lựa chọn đang mở
    let panel = h.querySelector<HTMLElement>(':scope > .on-panel');
    if (!panel) {
      h.innerHTML = '<div class="on-panel"><div class="on-opts" hidden></div><div class="on-body"></div></div>';
      panel = h.querySelector('.on-panel') as HTMLElement;
    }
    const opts = panel.querySelector('.on-opts') as HTMLElement;
    if (this.phase === 'idle' && this.def.optionsHtml) {
      if (!opts.childElementCount) opts.innerHTML = this.def.optionsHtml();
      opts.hidden = false;
    } else opts.hidden = true;
    (panel.querySelector('.on-body') as HTMLElement).innerHTML = html + flash;
  }

  private linkBox(small = false): string {
    const T = (k: string, f: string) => escapeHtml(t(`lib.online.${k}`, f));
    const url = escapeHtml(this.inviteUrl());
    return `<div class="on-invite${small ? ' is-small' : ''}">
      <label>${T('inviteLink', 'Link mời')}<input class="on-link" type="text" readonly value="${url}" /></label>
      <button type="button" class="btn btn-sm" data-on="copy">${svg(ICON.copy)} ${T('copy', 'Chép link')}</button>
      ${typeof navigator.share === 'function' ? `<button type="button" class="btn btn-sm" data-on="share">${T('share', 'Chia sẻ')}</button>` : ''}
    </div>`;
  }

  private saveHtml(): string {
    if (!canSaveGames()) return '';
    const T = (k: string, f: string) => escapeHtml(t(`lib.online.${k}`, f));
    if (this.saved === 'yes') return `<p class="note on-saved">${T('saved', 'Đã lưu ván vào Google Drive (thư mục WFTools/Games).')}</p>`;
    if (this.saved === 'saving') return `<p class="note">${T('saving', 'Đang lưu ván vào Google Drive…')}</p>`;
    return `<p class="note">${this.saved === 'err' ? `${T('saveFail', 'Chưa lưu được ván vào Drive.')} ` : ''}<button type="button" class="btn btn-sm" data-on="save">${T('save', 'Lưu ván vào Google Drive')}</button></p>`;
  }
}

/** Câu kết quả để trang hiện lên thanh trạng thái */
export function resultText(r: OnlineResult, me: Color, names: [string, string]): string {
  if (r.winner === null) return r.reason === 'agreed' ? t('lib.online.drawAgreed', 'Hai bên đồng ý hoà.') : t('lib.online.draw', 'Ván cờ hoà.');
  const won = r.winner === me;
  void names;
  if (r.reason === 'resign') return won ? t('lib.online.oppResigned', 'Đối thủ đầu hàng — bạn thắng!') : t('lib.online.youResigned', 'Bạn đã đầu hàng.');
  return won ? t('lib.online.youWin', 'Bạn thắng!') : t('lib.online.youLose', 'Bạn thua.');
}
