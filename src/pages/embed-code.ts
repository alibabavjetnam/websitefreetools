import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { area, input, select, check, button, bindCopy, el, privacyNote, val, setVal, checked, onChange, showError, errorBox } from '../lib/devkit';

mountLayout({ activeTool: 'embed-code' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="workspace" style="margin-top:24px">
    <div class="panel">
      ${input('url', T('url', 'Link YouTube, Vimeo, Google Maps, Google Drive/Docs hoặc trang web bất kỳ'), { mono: true, value: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=30s' })}
      ${errorBox('err')}
      <div class="form-grid">
        ${select('ratio', T('ratio', 'Tỉ lệ khung'), [['16/9', '16:9'], ['4/3', '4:3'], ['1/1', '1:1'], ['9/16', T('r.vertical', '9:16 (video dọc, Shorts)')], ['21/9', '21:9']], '16/9')}
        ${input('maxw', T('maxw', 'Chiều rộng tối đa (px, 0 = không giới hạn)'), { type: 'number', value: '0', attrs: 'min="0"' })}
        ${input('title', T('title', 'Tiêu đề (cho trình đọc màn hình)'), { value: T('s.title', 'Video giới thiệu') })}
      </div>
      <div class="row">${check('lazy', T('lazy', 'Tải chậm (lazy) để trang mở nhanh'), true)}${check('auto', T('auto', 'Tự phát (tắt tiếng)'))}${check('loop', T('loop', 'Lặp lại'))}${check('ctl', T('ctl', 'Ẩn thanh điều khiển'))}${check('nocookie', T('nocookie', 'YouTube không cookie (riêng tư hơn)'), true)}</div>
      ${area('out', T('code', 'Mã nhúng'), { rows: 10, ro: true })}
      <div class="row">${button('copy', T('copy', 'Sao chép mã'), true)}</div>
    </div>
    <div class="panel"><span class="field-label">${T('preview', 'Xem trước')}</span><div id="prev"></div><p class="note" id="kind"></p></div>
  </div>
  ${privacyNote()}
`;
function src(raw: string): { src: string; kind: string; start?: number } {
  const u = new URL(raw.trim());
  const h = u.hostname.replace(/^www\.|^m\./, '');
  const sec = (t: string | null) => { if (!t) return 0; const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/); return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0; };
  if (h === 'youtu.be' || h.endsWith('youtube.com')) {
    const id = h === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1];
    if (!id) throw new Error('yt');
    const p = new URLSearchParams();
    const st = sec(u.searchParams.get('t') || u.searchParams.get('start'));
    if (st) p.set('start', String(st));
    if (checked('auto')) { p.set('autoplay', '1'); p.set('mute', '1'); }
    if (checked('loop')) { p.set('loop', '1'); p.set('playlist', id); }
    if (checked('ctl')) p.set('controls', '0');
    p.set('rel', '0');
    return { src: `https://www.${checked('nocookie') ? 'youtube-nocookie' : 'youtube'}.com/embed/${id}${p.toString() ? '?' + p : ''}`, kind: 'YouTube' };
  }
  if (h.endsWith('vimeo.com')) {
    const id = u.pathname.match(/(\d{6,})/)?.[1];
    if (!id) throw new Error('vimeo');
    const p = new URLSearchParams();
    if (checked('auto')) { p.set('autoplay', '1'); p.set('muted', '1'); }
    if (checked('loop')) p.set('loop', '1');
    if (checked('ctl')) p.set('controls', '0');
    return { src: `https://player.vimeo.com/video/${id}${p.toString() ? '?' + p : ''}`, kind: 'Vimeo' };
  }
  if (h === 'drive.google.com') { const id = u.pathname.match(/\/d\/([\w-]+)/)?.[1] || u.searchParams.get('id'); if (id) return { src: `https://drive.google.com/file/d/${id}/preview`, kind: 'Google Drive' }; }
  if (h === 'docs.google.com') return { src: raw.replace(/\/(edit|view)(\?.*)?(#.*)?$/, '/preview'), kind: 'Google Docs' };
  if (h.startsWith('google.') && u.pathname.startsWith('/maps') || h === 'maps.google.com') {
    const q = u.pathname.match(/\/place\/([^/]+)/)?.[1] || u.searchParams.get('q') || '';
    return { src: `https://maps.google.com/maps?q=${encodeURIComponent(decodeURIComponent(q.replace(/\+/g, ' ')))}&output=embed`, kind: 'Google Maps' };
  }
  return { src: u.toString(), kind: T('web', 'Trang web (một số trang không cho nhúng)') };
}
function run(): void {
  showError('err', '');
  let s: { src: string; kind: string };
  try { s = src(val('url')); } catch { showError('err', T('bad', 'Link chưa đúng. Hãy dán đầy đủ địa chỉ bắt đầu bằng https://')); setVal('out', ''); el('prev').innerHTML = ''; return; }
  const ratio = val('ratio');
  const maxw = Number(val('maxw')) || 0;
  const allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
  const ifr = `<iframe src="${escapeHtml(s.src)}" title="${escapeHtml(val('title'))}" style="position:absolute;inset:0;width:100%;height:100%;border:0"${checked('lazy') ? ' loading="lazy"' : ''} allow="${allow}" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  const code = `<div style="position:relative;width:100%;${maxw ? `max-width:${maxw}px;` : ''}aspect-ratio:${ratio};margin:0 auto">\n  ${ifr}\n</div>`;
  setVal('out', code);
  el('prev').innerHTML = code;
  el('kind').textContent = T('detected', 'Nhận diện: {k}').replace('{k}', s.kind);
}
onChange(['url', 'ratio', 'maxw', 'title', 'lazy', 'auto', 'loop', 'ctl', 'nocookie'], run, 300);
bindCopy('copy', () => val('out'));
run();
