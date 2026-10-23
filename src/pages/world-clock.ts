import { mountLayout } from '../layout';
import { $, escapeHtml, storage } from '../ui';
import { COUNTRIES, offsetHours, tzOffsetMinutes, type Zone } from '../data/timezones';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'world-clock' });
const T = pageText();
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', de: 'de-DE' } as Record<string, string>)[currentLang()] || 'en-US';

const DEFAULT_ZONES = T('defaultZones', 'Asia/Ho_Chi_Minh,Asia/Tokyo,Europe/London,America/New_York').split(',').map((x) => x.trim()).filter(Boolean);
const store = storage<string[]>('world-clock', DEFAULT_ZONES);
const cfg = storage<{ h24: boolean }>('world-clock-cfg', { h24: true });

const regionNames = (() => { try { return new Intl.DisplayNames([currentLang()], { type: 'region' }); } catch { return null; } })();
/** Tên nước theo ngôn ngữ trang (tiếng Việt giữ tên trong dữ liệu, ngôn ngữ khác dùng Intl.DisplayNames). */
const countryName = (c: { country: string; code: string }): string => (currentLang() === 'vi' ? c.country : (regionNames?.of(c.code) ?? c.country));
const cityName = (z: Zone): string => T('city.' + z.tz, z.city);
const allZones: (Zone & { country: string; flag: string })[] = COUNTRIES.flatMap((c) => c.zones.map((z) => ({ ...z, city: cityName(z), country: countryName(c), flag: c.flag })));
const zoneOf = (tz: string) => allZones.find((z) => z.tz === tz);

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel code-toolbar">
    <label class="field field--inline" style="flex:1"><span class="field-label">${T('addCountry','Thêm quốc gia')}</span>
      <select id="add"><option value="">${T('choose','— Chọn —')}</option>${COUNTRIES.map((c) => `<optgroup label="${c.flag} ${escapeHtml(countryName(c))}">${c.zones.map((z) => `<option value="${z.tz}">${escapeHtml(cityName(z))}</option>`).join('')}</optgroup>`).join('')}</select>
    </label>
    <label class="check"><input type="checkbox" id="h24" /><span>${T('h24','Định dạng 24 giờ')}</span></label>
  </div>
  <div class="clock-grid" id="clocks"></div>

  <section class="panel compare-panel" style="margin-top:24px">
    <div class="panel-title">${T('compareTitle','So sánh giờ giữa các nước')}</div>
    <div class="field-row">
      <label class="field"><span class="field-label">${T('baseAt','Mốc giờ tại')}</span><select id="cmp-base"></select></label>
      <label class="field"><span class="field-label">${T('at','Lúc')}</span><input type="time" id="cmp-time" /></label>
    </div>
    <div class="table-wrap" style="margin-top:12px"><table class="data-table" id="cmp-table"></table></div>
  </section>
`;

const fmtTime = (tz: string, d: Date) => d.toLocaleTimeString(LOCALE, { timeZone: tz, hour12: !cfg.get().h24, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDate = (tz: string, d: Date) => d.toLocaleDateString(LOCALE, { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit' });

function renderClocks(): void {
  const list = store.get();
  const now = new Date();
  $('#clocks').innerHTML = list.length
    ? list.map((tz) => {
        const z = zoneOf(tz);
        if (!z) return '';
        const diff = offsetHours(tz, now); // chênh lệch so với giờ VN
        return `<div class="clock-card"><div class="clock-head"><span class="clock-flag">${z.flag}</span><div><b>${escapeHtml(z.country)}</b><span class="clock-city">${escapeHtml(z.city)}</span></div>
          <button type="button" class="clock-rm" data-rm="${tz}" aria-label="${T('remove','Bỏ')}">✕</button></div>
          <div class="clock-time" data-clock="${tz}">${fmtTime(tz, now)}</div>
          <div class="clock-date">${fmtDate(tz, now)} · ${diff === 0 ? T('sameVN','cùng giờ VN') : `${diff > 0 ? '+' : ''}${diff}h ${T('vsVN','so với VN')}`}</div></div>`;
      }).join('')
    : `<p class="note">${T('empty','Chưa có đồng hồ nào. Chọn quốc gia ở ô phía trên để thêm.')}</p>`;
  renderCompareBase();
}

function tick(): void {
  const now = new Date();
  root.querySelectorAll<HTMLElement>('[data-clock]').forEach((el) => { el.textContent = fmtTime(el.dataset.clock!, now); });
}

function renderCompareBase(): void {
  const list = store.get();
  const sel = $<HTMLSelectElement>('#cmp-base');
  const cur = sel.value;
  sel.innerHTML = list.map((tz) => { const z = zoneOf(tz); return z ? `<option value="${tz}">${z.flag} ${escapeHtml(z.country)} — ${escapeHtml(z.city)}</option>` : ''; }).join('');
  if (list.includes(cur)) sel.value = cur;
  renderCompare();
}

function renderCompare(): void {
  const list = store.get();
  const baseTz = $<HTMLSelectElement>('#cmp-base').value || list[0];
  const t = $<HTMLInputElement>('#cmp-time').value;
  if (!baseTz || !t) { $('#cmp-table').innerHTML = ''; return; }
  const [hh, mm] = t.split(':').map(Number);
  // Dựng thời điểm UTC ứng với "đồng hồ treo tường ở baseTz = hh:mm hôm nay"
  const now = new Date();
  const baseOffMin = tzOffsetMinutes(baseTz, now);
  const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm) - baseOffMin * 60000);
  $('#cmp-table').innerHTML = `<thead><tr><th>${T('th.country','Quốc gia')}</th><th>${T('th.time','Giờ tương ứng')}</th><th>${T('th.date','Ngày')}</th></tr></thead><tbody>${list.map((tz) => {
    const z = zoneOf(tz);
    if (!z) return '';
    return `<tr${tz === baseTz ? ' class="cmp-base-row"' : ''}><td>${z.flag} ${escapeHtml(z.country)}</td><td><b>${fmtTime(tz, at)}</b></td><td>${fmtDate(tz, at)}</td></tr>`;
  }).join('')}</tbody>`;
}

$('#add').addEventListener('change', () => {
  const tz = $<HTMLSelectElement>('#add').value;
  if (tz && !store.get().includes(tz)) store.set([...store.get(), tz]);
  $<HTMLSelectElement>('#add').value = '';
  renderClocks();
});
$('#clocks').addEventListener('click', (e) => {
  const rm = (e.target as HTMLElement).closest<HTMLElement>('[data-rm]')?.dataset.rm;
  if (!rm) return;
  store.set(store.get().filter((t) => t !== rm));
  renderClocks();
});
$('#h24').addEventListener('change', () => { cfg.set({ h24: $<HTMLInputElement>('#h24').checked }); renderClocks(); renderCompare(); });
$('#cmp-base').addEventListener('change', renderCompare);
$('#cmp-time').addEventListener('input', renderCompare);

$<HTMLInputElement>('#h24').checked = cfg.get().h24;
const nowLocal = new Date();
$<HTMLInputElement>('#cmp-time').value = `${String(nowLocal.getHours()).padStart(2, '0')}:${String(nowLocal.getMinutes()).padStart(2, '0')}`;
renderClocks();
setInterval(tick, 1000);
