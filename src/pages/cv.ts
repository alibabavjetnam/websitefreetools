import { mountLayout } from '../layout';
import { $, escapeHtml, storage, toast } from '../ui';
import { SheetStore, newId } from '../google/sync';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'cv' });
const T = pageText();

interface Entry { title: string; place: string; from: string; to: string; desc: string }
interface CV {
  name: string;
  headline: string;
  email: string;
  phone: string;
  address: string;
  link: string;
  summary: string;
  experience: Entry[];
  education: Entry[];
  skills: string;
  languages: string;
  extras: string;
  template: 'classic' | 'modern';
  accent: string;
}
interface SavedCV { id: string; title: string; updated: string; json: string }
type Data = { cvs: SavedCV[] };

const ACCENTS = ['#0d6efd', '#16233a', '#b9000e', '#0e7a55', '#6b4bc4', '#c2570c'];
const MAX_PHOTO_BYTES = 400 * 1024;

const store = new SheetStore<Data>({
  tag: 'cv',
  title: 'WFTools - CV',
  empty: { cvs: [] },
  tables: {
    cvs: { sheet: 'CV', columns: [{ key: 'id', label: 'Mã' }, { key: 'title', label: 'Tên CV' }, { key: 'updated', label: 'Cập nhật' }, { key: 'json', label: 'Dữ liệu (không sửa tay)' }] },
  },
});

const sample = (): CV => ({
  name: T('sm.name', 'Nguyễn Văn An'),
  headline: T('sm.headline', 'Nhân viên kinh doanh'),
  email: T('sm.email', 'an.nguyen@email.com'),
  phone: T('sm.phone', '0901 234 567'),
  address: T('sm.address', 'Quận 3, TP. Hồ Chí Minh'),
  link: '',
  summary: T('sm.summary', 'Hơn 3 năm kinh nghiệm bán hàng B2B, quen chăm sóc khách hàng doanh nghiệp và lập báo giá. Mong muốn phát triển lên vị trí trưởng nhóm kinh doanh.'),
  experience: [
    { title: T('sm.exp1.title', 'Nhân viên kinh doanh'), place: T('sm.exp1.place', 'Công ty TNHH ABC'), from: '03/2023', to: T('sm.present', 'Hiện tại'), desc: T('sm.exp1.desc', 'Quản lý 40 khách hàng doanh nghiệp\nĐạt 120% chỉ tiêu doanh số năm 2025') },
    { title: T('sm.exp2.title', 'Nhân viên chăm sóc khách hàng'), place: T('sm.exp2.place', 'Cửa hàng XYZ'), from: '06/2021', to: '02/2023', desc: T('sm.exp2.desc', 'Tư vấn và xử lý đơn hàng qua điện thoại, Zalo') },
  ],
  education: [{ title: T('sm.edu.title', 'Cử nhân Quản trị kinh doanh'), place: T('sm.edu.place', 'Trường Đại học Kinh tế'), from: '2017', to: '2021', desc: '' }],
  skills: T('sm.skills', 'Đàm phán, Lập báo giá, Excel, CRM, Thuyết trình'),
  languages: T('sm.languages', 'Tiếng Anh giao tiếp (TOEIC 750)'),
  extras: '',
  template: 'modern',
  accent: '#0d6efd',
});

const draft = storage<CV | null>('cv-draft', null);
const photoPref = storage<string>('cv-photo', '');
let cv: CV = draft.get() ?? sample();
let currentId: string | null = null;

const entryEditor = (kind: 'experience' | 'education') => `
  <div class="entries" data-list="${kind}"></div>
  <button type="button" class="btn btn-sm" data-add="${kind}">${kind === 'experience' ? T('add.exp', '+ Thêm kinh nghiệm') : T('add.edu', '+ Thêm học vấn')}</button>`;

const root = $('#tool-root');
root.innerHTML = `
  <div class="row no-print" style="margin-top:20px">
    <div class="segmented" role="radiogroup" aria-label="${T('aria.template','Mẫu CV')}">
      <label><input type="radio" name="template" value="modern" /><span>${T('tpl.modern','Mẫu hiện đại')}</span></label>
      <label><input type="radio" name="template" value="classic" /><span>${T('tpl.classic','Mẫu cổ điển')}</span></label>
    </div>
    <div class="row" role="radiogroup" aria-label="${T('aria.accent','Màu nhấn')}" id="accents">
      ${ACCENTS.map((c) => `<button type="button" class="accent-dot" data-accent="${c}" style="background:${c}" aria-label="${T('color','Màu')} ${c}"></button>`).join('')}
    </div>
    <button type="button" class="btn" id="new">${T('blank','CV trống')}</button>
    <button type="button" class="btn" id="save">${T('save','Lưu')}</button>
    <button type="button" class="btn btn-primary" id="print">${T('print','In / Lưu PDF')}</button>
  </div>

  <div class="doc-layout">
    <form class="panel no-print" id="cv-form" novalidate>
      <details class="options" open>
        <summary>${T('sec.personal','Thông tin cá nhân')}</summary>
        <div class="options-body form-grid">
          <label class="field span-all"><span class="field-label">${T('f.name','Họ và tên')}</span><input name="name" type="text" maxlength="80" /></label>
          <label class="field span-all"><span class="field-label">${T('f.headline','Vị trí ứng tuyển')}</span><input name="headline" type="text" maxlength="100" /></label>
          <label class="field"><span class="field-label">${T('f.email','Email')}</span><input name="email" type="email" maxlength="100" /></label>
          <label class="field"><span class="field-label">${T('f.phone','Điện thoại')}</span><input name="phone" type="tel" maxlength="30" /></label>
          <label class="field"><span class="field-label">${T('f.address','Địa chỉ')}</span><input name="address" type="text" maxlength="120" /></label>
          <label class="field"><span class="field-label">${T('f.link','LinkedIn, website')}</span><input name="link" type="text" maxlength="120" /></label>
          <label class="field span-all"><span class="field-label">${T('f.photo','Ảnh chân dung (không bắt buộc, tối đa 400 KB)')}</span><input id="photo" type="file" accept="image/png,image/jpeg,image/webp" /></label>
          <div class="row span-all"><button type="button" class="btn btn-sm" id="photo-clear">${T('photo.clear','Bỏ ảnh')}</button></div>
        </div>
      </details>
      <details class="options" open>
        <summary>${T('sec.summary','Giới thiệu bản thân')}</summary>
        <div class="options-body"><label class="field"><span class="visually-hidden">${T('sec.intro','Giới thiệu')}</span><textarea name="summary" rows="4" maxlength="800"></textarea></label>
        <p class="note">${T('summary.hint','2–3 câu: bạn có kinh nghiệm gì, giỏi điều gì, muốn làm gì tiếp theo.')}</p></div>
      </details>
      <details class="options" open>
        <summary>${T('sec.exp','Kinh nghiệm làm việc')}</summary>
        <div class="options-body">${entryEditor('experience')}</div>
      </details>
      <details class="options" open>
        <summary>${T('sec.edu','Học vấn')}</summary>
        <div class="options-body">${entryEditor('education')}</div>
      </details>
      <details class="options" open>
        <summary>${T('sec.skills','Kỹ năng và thông tin thêm')}</summary>
        <div class="options-body form-grid">
          <label class="field span-all"><span class="field-label">${T('f.skills','Kỹ năng (cách nhau bằng dấu phẩy)')}</span><input name="skills" type="text" maxlength="400" /></label>
          <label class="field span-all"><span class="field-label">${T('f.languages','Ngoại ngữ')}</span><input name="languages" type="text" maxlength="200" /></label>
          <label class="field span-all"><span class="field-label">${T('f.extras','Chứng chỉ, giải thưởng, hoạt động (mỗi dòng một mục)')}</span><textarea name="extras" rows="3" maxlength="800"></textarea></label>
        </div>
      </details>
      <p class="note">${T('tip','Mẹo: mỗi dòng mô tả công việc nên bắt đầu bằng động từ và có con số cụ thể, ví dụ Tăng doanh số 20%.')}</p>
    </form>
    <div class="doc-preview-wrap"><article class="print-doc cv-doc" id="preview" aria-label="${T('aria.preview','Xem trước CV')}"></article></div>
  </div>

  <h2 class="section-title no-print" style="margin-top:28px">${T('saved.title','CV đã lưu')}</h2>
  <div class="table-wrap no-print"><table class="data-table" id="saved"></table></div>
`;
store.mount(root);
const form = $<HTMLFormElement>('#cv-form');

function renderEntries(kind: 'experience' | 'education'): void {
  const list = cv[kind];
  const label = kind === 'experience' ? [T('e.title.exp', 'Chức danh'), T('e.place.exp', 'Công ty')] : [T('e.title.edu', 'Bằng cấp, chuyên ngành'), T('e.place.edu', 'Trường')];
  root.querySelector<HTMLElement>(`[data-list="${kind}"]`)!.innerHTML = list
    .map(
      (e, i) => `<fieldset class="entry" data-kind="${kind}" data-i="${i}">
      <div class="form-grid">
        <label class="field"><span class="field-label">${label[0]}</span><input data-f="title" type="text" value="${escapeHtml(e.title)}" maxlength="100" /></label>
        <label class="field"><span class="field-label">${label[1]}</span><input data-f="place" type="text" value="${escapeHtml(e.place)}" maxlength="100" /></label>
        <label class="field"><span class="field-label">${T('e.from','Từ')}</span><input data-f="from" type="text" value="${escapeHtml(e.from)}" placeholder="${T('e.fromPh','03/2023')}" maxlength="20" /></label>
        <label class="field"><span class="field-label">${T('e.to','Đến')}</span><input data-f="to" type="text" value="${escapeHtml(e.to)}" placeholder="${T('e.toPh','Hiện tại')}" maxlength="20" /></label>
        <label class="field span-all"><span class="field-label">${T('e.desc','Mô tả (mỗi dòng một ý)')}</span><textarea data-f="desc" rows="3" maxlength="800">${escapeHtml(e.desc)}</textarea></label>
      </div>
      <div class="row"><button type="button" class="btn btn-sm" data-move="-1">${T('e.up','Lên')}</button><button type="button" class="btn btn-sm" data-move="1">${T('e.down','Xuống')}</button><button type="button" class="btn btn-sm" data-del>${T('e.del','Xoá mục này')}</button></div>
    </fieldset>`,
    )
    .join('');
}

function fillForm(): void {
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[name]').forEach((el) => {
    el.value = String((cv as unknown as Record<string, unknown>)[el.name] ?? '');
  });
  root.querySelectorAll<HTMLInputElement>('input[name="template"]').forEach((r) => (r.checked = r.value === cv.template));
  root.querySelectorAll<HTMLElement>('[data-accent]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.accent === cv.accent)));
  renderEntries('experience');
  renderEntries('education');
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const period = (e: Entry) => [e.from, e.to].filter(Boolean).join(' – ');

function renderPreview(): void {
  const photo = photoPref.get();
  const contact = [cv.phone, cv.email, cv.address, cv.link].filter(Boolean).map((x) => `<span>${escapeHtml(x)}</span>`).join('');
  const entries = (list: Entry[]) =>
    list
      .filter((e) => e.title || e.place)
      .map((e) => `<div class="cv-entry">
        <div class="cv-entry-head"><b>${escapeHtml(e.title)}</b><span>${escapeHtml(period(e))}</span></div>
        ${e.place ? `<div class="cv-place">${escapeHtml(e.place)}</div>` : ''}
        ${lines(e.desc).length ? `<ul>${lines(e.desc).map((l) => `<li>${escapeHtml(l.replace(/^[-•]\s*/, ''))}</li>`).join('')}</ul>` : ''}
      </div>`)
      .join('');
  const skills = cv.skills.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const section = (title: string, body: string) => (body ? `<section class="cv-section"><h3>${title}</h3>${body}</section>` : '');
  const side = `
    ${section(T('p.skills','Kỹ năng'), skills.length ? `<ul class="cv-tags">${skills.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : '')}
    ${section(T('p.languages','Ngoại ngữ'), cv.languages ? `<p>${escapeHtml(cv.languages)}</p>` : '')}
    ${section(T('p.extras','Chứng chỉ, hoạt động'), lines(cv.extras).length ? `<ul>${lines(cv.extras).map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : '')}`;
  const main = `
    ${section(T('p.summary','Giới thiệu'), cv.summary ? `<p>${escapeHtml(cv.summary)}</p>` : '')}
    ${section(T('p.exp','Kinh nghiệm làm việc'), entries(cv.experience))}
    ${section(T('p.edu','Học vấn'), entries(cv.education))}`;

  const el = $('#preview');
  el.className = `print-doc cv-doc cv-${cv.template}`;
  el.style.setProperty('--cv-accent', cv.accent);
  el.innerHTML = `
    <header class="cv-head">
      ${photo ? `<img src="${photo}" alt="" class="cv-photo" />` : ''}
      <div>
        <h2>${escapeHtml(cv.name || T('p.namePh', 'Họ và tên'))}</h2>
        ${cv.headline ? `<p class="cv-headline">${escapeHtml(cv.headline)}</p>` : ''}
        <p class="cv-contact">${contact}</p>
      </div>
    </header>
    ${cv.template === 'modern' ? `<div class="cv-cols"><div class="cv-main">${main}</div><aside class="cv-side">${side}</aside></div>` : `${main}${side}`}`;
  draft.set(cv);
}

function renderSaved(): void {
  const list = [...store.get().cvs].sort((a, b) => b.updated.localeCompare(a.updated));
  $('#saved').innerHTML = list.length
    ? `<thead><tr><th>${T('th.cv','CV')}</th><th>${T('th.updated','Cập nhật')}</th><th></th></tr></thead><tbody>${list
        .map((c) => `<tr><td>${escapeHtml(c.title)}</td><td>${escapeHtml(c.updated)}</td><td class="row">
          <button type="button" class="btn btn-sm" data-open="${escapeHtml(c.id)}">${T('open','Mở')}</button><button type="button" class="btn btn-sm" data-delete="${escapeHtml(c.id)}">${T('del','Xoá')}</button></td></tr>`)
        .join('')}</tbody>`
    : `<tbody><tr><td class="note">${T('saved.empty','Chưa lưu CV nào. Bạn có thể lưu nhiều bản CV cho từng vị trí ứng tuyển.')}</td></tr></tbody>`;
}

form.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const entry = el.closest<HTMLElement>('.entry');
  if (entry && el.dataset.f) {
    const list = cv[entry.dataset.kind as 'experience' | 'education'];
    (list[Number(entry.dataset.i)] as unknown as Record<string, string>)[el.dataset.f] = el.value;
  } else if (el.name) {
    (cv as unknown as Record<string, string>)[el.name] = el.value;
  }
  renderPreview();
});
form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const add = t.closest<HTMLElement>('[data-add]')?.dataset.add as 'experience' | 'education' | undefined;
  const entry = t.closest<HTMLElement>('.entry');
  if (add) {
    cv[add].push({ title: '', place: '', from: '', to: '', desc: '' });
    renderEntries(add);
  } else if (entry && (t.closest('[data-del]') || t.closest('[data-move]'))) {
    const kind = entry.dataset.kind as 'experience' | 'education';
    const i = Number(entry.dataset.i);
    const list = cv[kind];
    if (t.closest('[data-del]')) list.splice(i, 1);
    else {
      const j = i + Number(t.closest<HTMLElement>('[data-move]')!.dataset.move);
      if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
    }
    renderEntries(kind);
  } else return;
  renderPreview();
});

root.querySelectorAll<HTMLInputElement>('input[name="template"]').forEach((r) =>
  r.addEventListener('change', () => { cv.template = r.value as CV['template']; renderPreview(); }),
);
$('#accents').addEventListener('click', (e) => {
  const c = (e.target as HTMLElement).closest<HTMLElement>('[data-accent]')?.dataset.accent;
  if (!c) return;
  cv.accent = c;
  root.querySelectorAll<HTMLElement>('[data-accent]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.accent === c)));
  renderPreview();
});
$<HTMLInputElement>('#photo').addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast(T('toast.imgType','Ảnh cần là PNG, JPG hoặc WebP'));
  if (file.size > MAX_PHOTO_BYTES) return toast(T('toast.imgBig','Ảnh lớn hơn 400 KB, hãy dùng công cụ Nén ảnh trước'));
  const reader = new FileReader();
  reader.onload = () => { photoPref.set(String(reader.result)); renderPreview(); };
  reader.readAsDataURL(file);
});
$('#photo-clear').addEventListener('click', () => { photoPref.set(''); $<HTMLInputElement>('#photo').value = ''; renderPreview(); });

$('#new').addEventListener('click', () => {
  cv = { ...sample(), name: '', headline: '', email: '', phone: '', address: '', summary: '', experience: [{ title: '', place: '', from: '', to: '', desc: '' }], education: [{ title: '', place: '', from: '', to: '', desc: '' }], skills: '', languages: '', extras: '' };
  currentId = null;
  fillForm();
  renderPreview();
});
$('#save').addEventListener('click', () => {
  currentId ??= newId();
  const title = [cv.name, cv.headline].filter(Boolean).join(' · ') || T('untitled', 'CV chưa đặt tên');
  const d = store.get();
  store.set({ cvs: [...d.cvs.filter((c) => c.id !== currentId), { id: currentId, title, updated: new Date().toLocaleString('sv-SE').slice(0, 16), json: JSON.stringify(cv) }] });
  renderSaved();
  toast(T('toast.saved','Đã lưu CV'));
});
$('#print').addEventListener('click', () => {
  document.title = `CV ${cv.name || ''}`.trim();
  window.print();
});
$('#saved').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const open = t.closest<HTMLElement>('[data-open]')?.dataset.open;
  const del = t.closest<HTMLButtonElement>('[data-delete]');
  const d = store.get();
  if (open) {
    const s = d.cvs.find((c) => c.id === open);
    try {
      cv = { ...sample(), ...(JSON.parse(s?.json ?? '') as CV) };
    } catch {
      return toast(T('toast.badData','Dữ liệu CV bị lỗi (có thể đã bị sửa tay trên Google Sheets)'));
    }
    currentId = open;
    fillForm();
    renderPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (del) {
    if (del.dataset.confirm !== '1') {
      del.dataset.confirm = '1';
      del.textContent = T('del.confirm','Bấm lần nữa để xoá');
      setTimeout(() => { del.dataset.confirm = ''; del.textContent = T('del','Xoá'); }, 3000);
      return;
    }
    store.set({ cvs: d.cvs.filter((c) => c.id !== del.dataset.delete) });
    if (currentId === del.dataset.delete) currentId = null;
    renderSaved();
  }
});

store.onChange(renderSaved);
fillForm();
renderPreview();
renderSaved();
