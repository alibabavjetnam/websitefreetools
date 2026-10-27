import { mountLayout } from '../layout';
import { $, copyText, escapeHtml, storage } from '../ui';
import { pageText } from '../i18n';
import { FANCY_STYLES, WHOLE_STYLES, applyFancy } from '../calc/fancytext';

mountLayout({ activeTool: 'fancy-text' });
const T = pageText();

/** Tên kiểu chữ theo ngôn ngữ (khoá cố định, để dịch được) */
const NAMES: Record<string, string> = {
  bold: T('st.bold', 'In đậm'),
  italic: T('st.italic', 'In nghiêng'),
  boldItalic: T('st.boldItalic', 'Đậm nghiêng'),
  sans: T('st.sans', 'Không chân'),
  sansBold: T('st.sansBold', 'Không chân đậm'),
  sansItalic: T('st.sansItalic', 'Không chân nghiêng'),
  sansBoldItalic: T('st.sansBoldItalic', 'Không chân đậm nghiêng'),
  script: T('st.script', 'Viết tay'),
  scriptBold: T('st.scriptBold', 'Viết tay đậm'),
  fraktur: T('st.fraktur', 'Gothic'),
  frakturBold: T('st.frakturBold', 'Gothic đậm'),
  double: T('st.double', 'Nét đôi'),
  mono: T('st.mono', 'Đánh máy'),
  bubble: T('st.bubble', 'Bong bóng'),
  bubbleDark: T('st.bubbleDark', 'Bong bóng đen'),
  squared: T('st.squared', 'Ô vuông'),
  squaredDark: T('st.squaredDark', 'Ô vuông đen'),
  fullwidth: T('st.fullwidth', 'Giãn rộng'),
  smallCaps: T('st.smallCaps', 'Chữ hoa nhỏ'),
  superscript: T('st.superscript', 'Chữ nhỏ trên cao'),
  strike: T('st.strike', 'Gạch ngang'),
  underline: T('st.underline', 'Gạch chân'),
  doubleUnderline: T('st.doubleUnderline', 'Gạch chân đôi'),
  slash: T('st.slash', 'Gạch chéo'),
  dots: T('st.dots', 'Chấm dưới'),
  hearts: T('st.hearts', 'Trái tim'),
  stars: T('st.stars', 'Ngôi sao'),
  upsideDown: T('st.upsideDown', 'Lộn ngược'),
  mirror: T('st.mirror', 'Viết ngược'),
  wings: T('st.wings', 'Cánh thiên thần'),
  sparkle: T('st.sparkle', 'Lấp lánh'),
  brackets: T('st.brackets', 'Ngoặc vuông'),
  crown: T('st.crown', 'Vương miện'),
  arrows: T('st.arrows', 'Mũi tên'),
};

const saved = storage<string>('fancy-text', '');
$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:28px">
    <label class="field"><span class="field-label">${T('input', 'Nhập chữ của bạn')}</span>
      <input type="text" id="src" maxlength="300" placeholder="${T('placeholder', 'Ví dụ: Hoàng Anh')}" autocomplete="off" />
    </label>
    <p class="note">${T('tip', 'Bấm vào một dòng để sao chép. Kiểu chữ dùng ký tự Unicode đặc biệt nên có máy, có ứng dụng sẽ không hiển thị đủ; nên thử trước khi đặt tên. Chữ có dấu được giữ dấu nhưng một số kiểu có thể hiển thị lệch dấu.')}</p>
  </div>
  <div class="fancy-list" id="list" style="margin-top:16px"></div>
`;

const src = $<HTMLInputElement>('#src');
src.value = saved.get() || T('sample', 'WFTools Xin chào');

function render(): void {
  const text = src.value || T('sample', 'WFTools Xin chào');
  saved.set(src.value);
  const rows = [
    ...FANCY_STYLES.map((s) => ({ id: s.id, out: applyFancy(text, s) })),
    ...WHOLE_STYLES.map((s) => ({ id: s.id, out: s.fn(text) })),
  ];
  $('#list').innerHTML = rows
    .map((r) => `<button type="button" class="fancy-item" data-copy="${escapeHtml(r.out)}" title="${T('clickCopy', 'Bấm để sao chép')}"><b>${escapeHtml(NAMES[r.id] ?? r.id)}</b><span>${escapeHtml(r.out)}</span></button>`)
    .join('');
}

$('#list').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
  if (b) void copyText(b.dataset.copy as string, T('copied', 'Đã sao chép, dán vào nơi bạn cần'));
});
src.addEventListener('input', render);
render();
