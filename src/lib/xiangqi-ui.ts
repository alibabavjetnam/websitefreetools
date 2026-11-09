/**
 * Giao diện cờ tướng và cờ úp. Hai chế độ trong cùng trang:
 *  - Đánh với máy: người chơi cầm Đỏ (đi trước), máy cầm Đen, 10 cấp.
 *  - Chơi với người (online): ghép cặp qua OnlineRoom; ai cầm Đen thì bàn được xoay để quân mình ở dưới.
 */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { Position, xiangqiAiMove } from '../calc/xiangqi';
import { DarkPosition, darkAiMove, randomDeal, validDeal } from '../calc/xiangqi-dark';
import { clearBanner, gameShell, modeTabs, progressOf, renderLevelBar, showBanner, type GameMode } from './game-ui';
import { OnlineRoom, resultText, type Color, type OnlineResult } from './online';

const CELL = 60, PAD = 40;
const W = 8 * CELL + PAD * 2, H = 9 * CELL + PAD * 2;
const RED = ['', '帥', '仕', '相', '傌', '俥', '炮', '兵'];
const BLK = ['', '將', '士', '象', '馬', '車', '砲', '卒'];

interface XMove { from: number; to: number; cap: number; capHidden?: boolean; reveal?: boolean }
type AnyPos = Position | DarkPosition;

/** Gradient dùng chung: mặt gỗ bàn cờ, mặt quân ngà bóng, cạnh quân, vệt sáng, mặt lưng quân úp */
const DEFS = `<defs>
  <linearGradient id="xqWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2b8"/><stop offset=".55" stop-color="#efd29b"/><stop offset="1" stop-color="#e6c184"/></linearGradient>
  <radialGradient id="xqFace" cx=".42" cy=".36" r=".72"><stop offset="0" stop-color="#fffdf6"/><stop offset=".62" stop-color="#f7ead0"/><stop offset="1" stop-color="#e9d2a6"/></radialGradient>
  <linearGradient id="xqEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b47a"/><stop offset="1" stop-color="#a67a43"/></linearGradient>
  <radialGradient id="xqBackB" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="#5a7f8c"/><stop offset=".7" stop-color="#34525e"/><stop offset="1" stop-color="#243b45"/></radialGradient>
  <radialGradient id="xqBackR" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="#d0574a"/><stop offset=".7" stop-color="#a3302a"/><stop offset="1" stop-color="#7c201d"/></radialGradient>
  <linearGradient id="xqGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <filter id="xqSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>
</defs>`;

/** Vân gỗ mờ cố định (không ngẫu nhiên để bàn không "nhảy" khi vẽ lại) */
function grain(): string {
  let s = '';
  for (let k = 0; k < 16; k++) {
    const y = 18 + k * 39 + ((k * 37) % 13);
    const a = 6 + ((k * 11) % 9), b = 5 + ((k * 7) % 8);
    s += `<path d="M0 ${y} C ${W * 0.3} ${y - a}, ${W * 0.6} ${y + b}, ${W} ${y - 2}"/>`;
  }
  return `<g class="xq-grain">${s}</g>`;
}

function boardLines(px: (c: number) => number, py: (r: number) => number): string {
  let s = '';
  for (let r = 0; r < 10; r++) s += `<line x1="${px(0)}" y1="${py(r)}" x2="${px(8)}" y2="${py(r)}"/>`;
  for (let c = 0; c < 9; c++) {
    if (c === 0 || c === 8) s += `<line x1="${px(c)}" y1="${py(0)}" x2="${px(c)}" y2="${py(9)}"/>`;
    else s += `<line x1="${px(c)}" y1="${py(0)}" x2="${px(c)}" y2="${py(4)}"/><line x1="${px(c)}" y1="${py(5)}" x2="${px(c)}" y2="${py(9)}"/>`;
  }
  for (const r0 of [0, 7]) {
    s += `<line x1="${px(3)}" y1="${py(r0)}" x2="${px(5)}" y2="${py(r0 + 2)}"/><line x1="${px(5)}" y1="${py(r0)}" x2="${px(3)}" y2="${py(r0 + 2)}"/>`;
  }
  // Dấu góc nhỏ ở vị trí Pháo và Tốt
  const g = 5, l = 9;
  const mark = (r: number, c: number): string => {
    let m = '';
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      if ((c === 0 && dx < 0) || (c === 8 && dx > 0)) continue;
      const x = px(c) + dx * g, y = py(r) + dy * g;
      // px/py có thể đảo chiều khi xoay bàn: tính theo hướng thật trên màn hình
      const sx = Math.sign(x - px(c)), sy = Math.sign(y - py(r));
      m += `<path d="M${x} ${y + sy * l} V${y} H${x + sx * l}"/>`;
    }
    return m;
  };
  let marks = '';
  for (const [r, c] of [[2, 1], [2, 7], [7, 1], [7, 7], [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]]) marks += mark(r, c);
  s += `<g class="xq-marks">${marks}</g>`;
  const x0 = Math.min(px(0), px(8)), y0 = Math.min(py(0), py(9));
  s += `<rect class="xq-frame" x="${x0 - 7}" y="${y0 - 7}" width="${8 * CELL + 14}" height="${9 * CELL + 14}" rx="2"/>`;
  s += `<text class="xq-river" x="${PAD + 2 * CELL}" y="${PAD + 4.5 * CELL + 9}" text-anchor="middle">楚 河</text><text class="xq-river" x="${PAD + 6 * CELL}" y="${PAD + 4.5 * CELL + 9}" text-anchor="middle">漢 界</text>`;
  return s;
}

/** Một quân cờ nổi khối: bóng đổ, cạnh dày, mặt ngà bóng, vòng khắc màu phe, vệt sáng */
function piece(x: number, y: number, cls: string, label: string, hidden: boolean): string {
  return `<g class="${cls}">
    <ellipse class="sh" cx="${x + 1}" cy="${y + 5}" rx="25" ry="23"/>
    <circle class="edge" cx="${x}" cy="${y + 2.6}" r="25"/>
    <circle class="face" cx="${x}" cy="${y}" r="24"/>
    <circle class="ring" cx="${x}" cy="${y}" r="${hidden ? 21 : 19.5}"/>
    ${hidden ? `<path class="emb" d="M${x} ${y - 7} L${x + 7} ${y} L${x} ${y + 7} L${x - 7} ${y} Z"/>` : `<text x="${x}" y="${y + 9}" text-anchor="middle">${label}</text>`}
    <ellipse class="gloss" cx="${x - 5}" cy="${y - 11}" rx="14" ry="7"/>
  </g>`;
}

export function mountXiangqi(id: string, variant: 'classic' | 'dark' = 'classic'): void {
  const dark = variant === 'dark';
  const note = dark
    ? t('lib.game.darkNote', 'Cờ úp: hai Tướng ngửa, các quân khác úp ngẫu nhiên. Quân úp đi theo quân của vị trí nó đứng (đứng chỗ Xe thì đi như Xe), đi xong thì lật lên và từ đó đi theo quân thật. Sĩ và Tượng được đi khắp bàn. Chiếu bí hoặc hết nước đi là thua.')
    : t('lib.game.xqNote', 'Bạn cầm quân Đỏ (phía dưới), đi trước. Bấm quân của bạn rồi bấm ô muốn đến. Hai tướng không được đối mặt nhau; chiếu bí hoặc hết nước đi là thua.');
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="xq-status"></b></div>
        <svg class="xq-board${dark ? ' is-dark' : ''}" id="xq-board" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(dark ? t('lib.game.darkBoard', 'Bàn cờ úp') : t('lib.game.xiangqi', 'Bàn cờ tướng'))}"></svg>
        <div class="xq-caps" id="xq-caps"></div>
      </div>
      <div class="game-side">
        <div class="ai-only">
          <div class="row">
            <button type="button" class="btn btn-sm" id="xq-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
            <button type="button" class="btn btn-sm" id="xq-resign">${escapeHtml(t('lib.game.resign', 'Đầu hàng'))}</button>
            <button type="button" class="btn btn-sm" id="xq-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
          </div>
        </div>
        <div class="online-only" id="xq-online"></div>
        <p class="note${dark ? '' : ' ai-only'}">${escapeHtml(note)}</p>
      </div>
    </div>`);
  const svg = $('#xq-board');
  const statusEl = $('#xq-status');
  const capsEl = $('#xq-caps');
  const colorNames = (): [string, string] => [t('lib.online.red', 'Đỏ'), t('lib.online.black', 'Đen')];

  let mode: GameMode = 'ai';
  let level = progressOf(id).unlocked;
  let pos: AnyPos = dark ? DarkPosition.start() : Position.start();
  let moves: XMove[] = [];
  let sel = -1;
  let legal: XMove[] = [];
  let thinking = false;
  let over = false;
  let token = 0;
  /** Màu của người chơi trên máy này: 0 = Đỏ, 1 = Đen */
  let me: Color = 0;
  let onlineReady = false;

  const fresh = (deal?: number[]): AnyPos => (dark ? DarkPosition.start(deal) : Position.start());
  const turnColor = (): Color => (pos.turn === 1 ? 0 : 1);
  const legalMoves = (): XMove[] => pos.legalMoves() as XMove[];
  const make = (m: XMove) => (pos as DarkPosition).makeMove(m as never);
  const unmake = (m: XMove) => (pos as DarkPosition).unmakeMove(m as never);
  const flip = () => me === 1;
  const px = (c: number) => PAD + (flip() ? 8 - c : c) * CELL;
  const py = (r: number) => PAD + (flip() ? 9 - r : r) * CELL;
  const hiddenAt = (i: number) => dark && (pos as DarkPosition).hidden[i] === 1;
  const myTurn = (): boolean => {
    if (over || thinking) return false;
    if (mode === 'ai') return pos.turn === 1;
    return onlineReady && room.playing && turnColor() === me;
  };

  /* --------------------------- Vẽ bàn --------------------------- */

  function render(): void {
    const last = moves[moves.length - 1];
    const checkSq = pos.inCheck() ? pos.kingSq[pos.turn === 1 ? 0 : 1] : -1;
    const targets = new Set(legal.map((m) => m.to));
    let s = `${DEFS}<rect class="xq-bg" width="${W}" height="${H}" rx="12"/>${grain()}<g class="xq-lines">${boardLines(px, py)}</g>`;
    if (last) for (const q of [last.from, last.to]) s += `<circle class="xq-last${q === last.to ? '' : ' from'}" cx="${px(q % 9)}" cy="${py(Math.floor(q / 9))}" r="${q === last.to ? 30 : 11}"/>`;
    for (let i = 0; i < 90; i++) {
      const v = pos.b[i], r = Math.floor(i / 9), c = i % 9;
      if (v) {
        const red = v > 0;
        const hid = hiddenAt(i);
        const cls = `xq-pc ${red ? 'red' : 'blk'}${hid ? ' hid' : ''}${i === sel ? ' sel' : ''}${i === checkSq ? ' check' : ''}`;
        s += piece(px(c), py(r), cls, (red ? RED : BLK)[Math.abs(v)], hid);
      }
      if (targets.has(i)) s += v ? `<circle class="xq-cap" cx="${px(c)}" cy="${py(r)}" r="28.5"/>` : `<circle class="xq-dot" cx="${px(c)}" cy="${py(r)}" r="7"/>`;
      s += `<circle class="xq-hit" data-i="${i}" cx="${px(c)}" cy="${py(r)}" r="28"/>`;
    }
    svg.innerHTML = s;
    // Quân đã bị ăn (cờ úp: quân úp bị ăn được lộ ra)
    const taken = { red: [] as number[], blk: [] as number[] };
    for (const m of moves) if (m.cap) (m.cap > 0 ? taken.red : taken.blk).push(Math.abs(m.cap));
    const row = (arr: number[], red: boolean) => arr.sort((a, b) => b - a).map((x) => `<span class="xq-mini ${red ? 'red' : 'blk'}">${(red ? RED : BLK)[x]}</span>`).join('');
    capsEl.innerHTML = taken.red.length || taken.blk.length ? `<span class="xq-caps-l">${escapeHtml(t('lib.game.captured', 'Quân đã bị ăn'))}:</span> ${row(taken.red, true)} ${row(taken.blk, false)}` : '';
    if (over) return;
    statusEl.textContent = statusText();
  }

  function statusText(): string {
    const check = pos.inCheck() ? ` — ${t('lib.game.xqCheck', 'Chiếu tướng!')}` : '';
    if (mode === 'ai') return thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn') + check;
    if (!onlineReady || !room.playing) return t('lib.online.pickTable', 'Tìm đối thủ hoặc mở bàn ở bên cạnh để bắt đầu.');
    return (turnColor() === me ? t('lib.game.yourTurn', 'Đến lượt bạn') : t('lib.online.theirTurn', 'Đến lượt đối thủ')) + check;
  }

  /* --------------------------- Chế độ đánh với máy --------------------------- */

  function startAi(lv: number): void {
    level = lv; token++;
    me = 0;
    pos = fresh(); moves = []; sel = -1; legal = []; thinking = false; over = false;
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, startAi);
    render();
  }

  function endAi(kind: 'win' | 'lose' | 'draw', text: string, status: string): void {
    statusEl.textContent = status;
    showBanner(banner, kind, id, level, text, startAi, () => startAi(level));
    renderLevelBar(levelBar, id, level, startAi);
  }

  /** Sau mỗi nước (của ai cũng vậy): kiểm tra kết thúc ván */
  /** Online: kiểm tra kết thúc ván theo luật (cả hai máy tính ra như nhau) */
  function onlineCheckEnd(): void {
    const st = pos.status();
    if (st === 'play') { render(); return; }
    over = true;
    // Chiếu bí / hết nước: bên vừa đi thắng
    const mover: Color = turnColor() === 0 ? 1 : 0;
    const res: OnlineResult = st === 'draw' ? { winner: null, reason: 'repetition' } : { winner: mover, reason: st === 'checkmate' ? 'mate' : 'stalemate' };
    room.finish(res);
    render();
    statusEl.textContent = resultText(res, me, colorNames());
  }

  function afterMove(byMe: boolean): void {
    pos.record();
    sel = -1; legal = [];
    if (mode === 'online') { onlineCheckEnd(); return; }
    const st = pos.status();
    if (st === 'play') {
      if (byMe) { thinking = true; render(); const my = token; setTimeout(() => aiTurn(my), 40); } else { thinking = false; render(); }
      return;
    }
    over = true; thinking = false; render();
    if (st === 'draw') { endAi('draw', tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level }), t('lib.game.chessDraw', 'Ván cờ hoà.')); return; }
    const msg = st === 'checkmate' ? (byMe ? t('lib.game.xqMateWin', 'Chiếu bí! Bạn thắng.') : t('lib.game.xqMateLose', 'Bạn bị chiếu bí.'))
      : (byMe ? t('lib.game.xqStaleWin', 'Quân Đen hết nước đi — bạn thắng.') : t('lib.game.xqStaleLose', 'Bạn hết nước đi — bạn thua.'));
    if (byMe) endAi('win', tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), msg);
    else endAi('lose', tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), msg);
  }

  function aiTurn(my: number): void {
    if (my !== token) return;
    const m = (dark ? darkAiMove(pos as DarkPosition, level) : xiangqiAiMove(pos as Position, level)) as XMove | null;
    if (my !== token || !m) return;
    make(m); moves.push(m);
    afterMove(false);
  }

  /* --------------------------- Chế độ online --------------------------- */

  const room = new OnlineRoom(
    {
      game: dark ? 'co-up' : 'xiangqi',
      colorNames,
      makeSetup: () => (dark ? randomDeal() : null),
      validSetup: (s) => (dark ? validDeal(s) : s === null || s === undefined),
      onStart: (g) => {
        token++;
        me = g.myColor;
        pos = fresh(dark ? (g.setup as number[]) : undefined);
        moves = []; sel = -1; legal = []; thinking = false; over = false;
        for (const raw of g.moves) if (!applyRemote(raw, false)) break;
        onlineReady = true;
        clearBanner(banner);
        render();
        if (g.result) {
          over = true;
          statusEl.textContent = resultText(g.result, me, colorNames());
        } else onlineCheckEnd();
      },
      onRemoteMove: (mv) => applyRemote(mv, true),
      onEnd: (r) => {
        over = true; sel = -1; legal = [];
        render();
        statusEl.textContent = resultText(r, me, colorNames());
      },
      onLeave: () => resetOnlineBoard(),
    },
    $('#xq-online'),
  );

  function applyRemote(raw: unknown, live: boolean): boolean {
    const o = raw as { f?: unknown; t?: unknown };
    const m = legalMoves().find((x) => x.from === o?.f && x.to === o?.t);
    if (!m) return false;
    make(m); moves.push(m);
    if (live) afterMove(false);
    else pos.record();
    return true;
  }

  function resetOnlineBoard(): void {
    token++;
    me = 0; onlineReady = false;
    pos = fresh(); moves = []; sel = -1; legal = []; thinking = false; over = false;
    clearBanner(banner);
    render();
  }

  function setMode(m: GameMode): void {
    mode = m;
    if (m === 'online') {
      levelBar.hidden = true;
      resetOnlineBoard();
      void room.open();
    } else {
      room.close();
      levelBar.hidden = false;
      startAi(level);
    }
  }

  /* --------------------------- Thao tác --------------------------- */

  svg.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<SVGElement>('.xq-hit');
    if (!el || !myTurn()) return;
    const i = Number(el.dataset.i);
    const mv = legal.find((m) => m.to === i);
    if (sel >= 0 && mv) {
      make(mv); moves.push(mv);
      if (mode === 'online') room.sendMove({ f: mv.from, t: mv.to });
      afterMove(true);
      return;
    }
    const mine = pos.b[i] * pos.turn > 0;
    if (mine) { sel = i; legal = legalMoves().filter((m) => m.from === i); } else { sel = -1; legal = []; }
    render();
  });

  $('#xq-undo').addEventListener('click', () => {
    if (mode !== 'ai' || thinking || !moves.length) return;
    token++;
    do { const m = moves.pop() as XMove; pos.unrecord(); unmake(m); } while (moves.length && pos.turn !== 1);
    over = false; sel = -1; legal = [];
    clearBanner(banner); render();
  });
  $('#xq-resign').addEventListener('click', () => {
    if (mode !== 'ai' || over) return;
    over = true; token++; thinking = false; render();
    endAi('lose', tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), t('lib.game.resigned', 'Bạn đã đầu hàng.'));
  });
  $('#xq-new').addEventListener('click', () => startAi(level));

  const tabs = modeTabs(setMode);
  if (tabs.initial === 'online') setMode('online');
  else startAi(level);
}
