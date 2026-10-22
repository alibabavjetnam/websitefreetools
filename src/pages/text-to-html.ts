import { mountLayout } from '../layout';
import { $, copyText, downloadBlob, toast } from '../ui';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'text-to-html' });
const T = pageText();

interface Btn { cmd?: string; val?: string; act?: string; label: string; title: string }
const GROUPS: Btn[][] = [
  [
    { cmd: 'formatBlock', val: 'H1', label: 'H1', title: T('t.h1', 'Tiêu đề lớn') },
    { cmd: 'formatBlock', val: 'H2', label: 'H2', title: T('t.h2', 'Tiêu đề vừa') },
    { cmd: 'formatBlock', val: 'H3', label: 'H3', title: T('t.h3', 'Tiêu đề nhỏ') },
    { cmd: 'formatBlock', val: 'P', label: '¶', title: T('t.p', 'Đoạn văn thường') },
  ],
  [
    { cmd: 'bold', label: '<b>B</b>', title: T('t.bold', 'In đậm') },
    { cmd: 'italic', label: '<i>I</i>', title: T('t.italic', 'In nghiêng') },
    { cmd: 'underline', label: '<u>U</u>', title: T('t.underline', 'Gạch chân') },
    { cmd: 'strikeThrough', label: '<s>S</s>', title: T('t.strike', 'Gạch ngang') },
  ],
  [
    { cmd: 'insertUnorderedList', label: '• ≡', title: T('t.ul', 'Danh sách dấu chấm') },
    { cmd: 'insertOrderedList', label: '1. ≡', title: T('t.ol', 'Danh sách đánh số') },
    { cmd: 'formatBlock', val: 'BLOCKQUOTE', label: '❝', title: T('t.quote', 'Trích dẫn') },
    { cmd: 'formatBlock', val: 'PRE', label: '&lt;/&gt;', title: T('t.code', 'Khối mã') },
  ],
  [
    { act: 'link', label: '🔗', title: T('t.link', 'Chèn liên kết') },
    { cmd: 'unlink', label: '⛓', title: T('t.unlink', 'Bỏ liên kết') },
    { act: 'table', label: '▦', title: T('t.table', 'Chèn bảng') },
    { cmd: 'insertHorizontalRule', label: '―', title: T('t.hr', 'Đường kẻ ngang') },
  ],
  [
    { cmd: 'removeFormat', label: '⌫', title: T('t.removeFormat', 'Xoá định dạng chữ') },
    { act: 'clear', label: T('t.clearLabel', 'Xoá hết'), title: T('t.clear', 'Xoá toàn bộ nội dung') },
  ],
];

const SAMPLE_VI = `<h2>Chào mừng đến với WFTools</h2><p>Đây là trình soạn thảo <strong>trực quan</strong>. Bạn gõ như trong Word, công cụ tự tạo <em>mã HTML sạch</em>.</p><ul><li>Bôi đen chữ rồi bấm nút trên thanh công cụ</li><li>Sao chép mã HTML ở ô bên dưới</li></ul>`;

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel editor-toolbar" id="toolbar">
    ${GROUPS.map((g) => `<div class="tb-group">${g.map((b) => `<button type="button" class="tb-btn" title="${b.title}" aria-label="${b.title}"${b.cmd ? ` data-cmd="${b.cmd}"${b.val ? ` data-val="${b.val}"` : ''}` : ''}${b.act ? ` data-act="${b.act}"` : ''}>${b.label}</button>`).join('')}</div>`).join('')}
  </div>
  <div class="editor-wrap">
    <div class="field">
      <span class="field-label">${T('editorLabel','Soạn thảo')}</span>
      <div id="editor" class="editor" contenteditable="true" spellcheck="false"></div>
    </div>
    <div class="field">
      <span class="field-label">${T('htmlLabel','Mã HTML')}</span>
      <textarea id="src" class="mono code-area" rows="14" spellcheck="false"></textarea>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="copy">${T('copy','Sao chép HTML')}</button>
        <button type="button" class="btn" id="dl">${T('dl','Tải file .html')}</button>
        <button type="button" class="btn" id="apply">${T('apply','Áp dụng mã HTML vào trình soạn thảo')}</button>
      </div>
    </div>
  </div>
  <p class="note">${T('note','Mã HTML được làm sạch: bỏ thuộc tính <code>style</code> rác, đổi thẻ <code>&lt;b&gt;</code>/<code>&lt;i&gt;</code> sang <code>&lt;strong&gt;</code>/<code>&lt;em&gt;</code>. Dán mã có sẵn vào ô HTML rồi bấm Áp dụng để xem và chỉnh tiếp.')}</p>
`;

const editor = $('#editor') as HTMLElement;
try {
  document.execCommand('defaultParagraphSeparator', false, 'p');
  document.execCommand('styleWithCSS', false, 'false');
} catch { /* một số trình duyệt không hỗ trợ, bỏ qua */ }

const INLINE = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SPAN', 'CODE', 'BR', 'SUB', 'SUP', 'MARK', 'SMALL', 'IMG']);
const VOID = new Set(['BR', 'HR', 'IMG']);

/** Dọn cây DOM: bỏ style/class rác, đổi b/i sang strong/em, bỏ thẻ rỗng */
function clean(node: Node): void {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      el.removeAttribute('style');
      el.removeAttribute('class');
      el.removeAttribute('id');
      if (el.tagName === 'FONT' || el.tagName === 'SPAN') {
        // thay bằng nội dung bên trong
        clean(el);
        el.replaceWith(...el.childNodes);
        continue;
      }
      clean(el);
    }
  }
}

function tidyHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  clean(doc.body);
  let out = doc.body.innerHTML
    .replace(/<b>/g, '<strong>').replace(/<\/b>/g, '</strong>')
    .replace(/<i>/g, '<em>').replace(/<\/i>/g, '</em>')
    .replace(/<div>/g, '<p>').replace(/<\/div>/g, '</p>')
    .replace(/<p><br><\/p>/g, '').replace(/<p><\/p>/g, '');
  return prettyHtml(out);
}

/** Thụt lề HTML theo khối cho dễ đọc */
function prettyHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const lines: string[] = [];
  const serialize = (node: Node, depth: number): void => {
    const pad = '  '.repeat(depth);
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (t) lines.push(pad + t);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const attrs = [...el.attributes].map((a) => ` ${a.name}="${a.value}"`).join('');
        if (VOID.has(el.tagName)) { lines.push(`${pad}<${tag}${attrs}>`); continue; }
        const onlyInline = [...el.childNodes].every((n) => n.nodeType === Node.TEXT_NODE || INLINE.has((n as HTMLElement).tagName));
        if (onlyInline) {
          lines.push(`${pad}<${tag}${attrs}>${el.innerHTML.replace(/\s+/g, ' ').trim()}</${tag}>`);
        } else {
          lines.push(`${pad}<${tag}${attrs}>`);
          serialize(el, depth + 1);
          lines.push(`${pad}</${tag}>`);
        }
      }
    }
  };
  serialize(doc.body, 0);
  return lines.join('\n');
}

function syncSource(): void {
  $<HTMLTextAreaElement>('#src').value = tidyHtml(editor.innerHTML);
}

function insertTable(): void {
  const r = Math.min(20, Math.max(1, Number(prompt(T('rowsPrompt','Số hàng?'), '2') ?? '0')));
  const c = Math.min(12, Math.max(1, Number(prompt(T('colsPrompt','Số cột?'), '2') ?? '0')));
  if (!r || !c) return;
  let html = '<table><thead><tr>';
  for (let j = 0; j < c; j++) html += `<th>${T('colWord','Cột')} ${j + 1}</th>`;
  html += '</tr></thead><tbody>';
  for (let i = 0; i < r; i++) { html += '<tr>'; for (let j = 0; j < c; j++) html += '<td> </td>'; html += '</tr>'; }
  html += '</tbody></table><p></p>';
  editor.focus();
  document.execCommand('insertHTML', false, html);
  syncSource();
}

$('#toolbar').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!b) return;
  editor.focus();
  if (b.dataset.cmd) {
    document.execCommand(b.dataset.cmd, false, b.dataset.val);
  } else if (b.dataset.act === 'link') {
    const url = prompt(T('linkPrompt','Nhập địa chỉ liên kết (URL):'), 'https://');
    if (url && url !== 'https://') document.execCommand('createLink', false, url);
  } else if (b.dataset.act === 'table') {
    insertTable();
    return;
  } else if (b.dataset.act === 'clear') {
    editor.innerHTML = '<p></p>';
  }
  syncSource();
});

editor.addEventListener('input', syncSource);
editor.addEventListener('blur', syncSource);
// Dán dưới dạng văn bản thuần để tránh rác định dạng từ Word, web
editor.addEventListener('paste', (e) => {
  const html = e.clipboardData?.getData('text/html');
  if (html) {
    e.preventDefault();
    document.execCommand('insertHTML', false, tidyHtml(html));
    syncSource();
  }
});

$('#apply').addEventListener('click', () => {
  editor.innerHTML = $<HTMLTextAreaElement>('#src').value || '<p></p>';
  syncSource();
  toast(T('toast.applied','Đã áp dụng mã HTML'));
});
$('#copy').addEventListener('click', () => {
  const v = $<HTMLTextAreaElement>('#src').value;
  if (v) void copyText(v);
});
$('#dl').addEventListener('click', () => {
  const body = $<HTMLTextAreaElement>('#src').value;
  const doc = `<!doctype html>\n<html lang="${currentLang()}">\n<head>\n<meta charset="utf-8">\n<title>${T('docTitle','Tài liệu')}</title>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
  downloadBlob(new Blob([doc], { type: 'text/html;charset=utf-8' }), T('fn.doc', 'tai-lieu.html'));
  toast(T('toast.dl','Đã tải file HTML'));
});

editor.innerHTML = T('sample', SAMPLE_VI);
syncSource();
