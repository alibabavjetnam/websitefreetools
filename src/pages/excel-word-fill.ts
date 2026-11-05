import { mountLayout } from '../layout';
import { $, downloadBlob } from '../ui';
import { pageText } from '../i18n';
import { global, loadScript } from '../lib/cdn';
import { loadXlsx, readFileBytes, readWorkbook, MAX_EXCEL_BYTES } from '../lib/excel-common';
import { bindPicker, pickerHtml, setStatus } from '../lib/excel-ui';

mountLayout({ activeTool: 'excel-word-fill' });
const T = pageText();

interface PizZipFile { asText(): string }
interface PizZipInst { files: Record<string, unknown>; file(name: string): PizZipFile | null; file(name: string, data: string): PizZipInst; generate(o: { type: 'blob'; mimeType: string }): Blob }
interface DocxInst { render(data: Record<string, string>): void; getZip(): PizZipInst }
type DocxCtor = new (zip: PizZipInst, o: { paragraphLoop: boolean; linebreaks: boolean; delimiters: { start: string; end: string }; nullGetter(part: { value?: string }): string }) => DocxInst;

async function loadDocxLibs(): Promise<{ PizZip: new (data: ArrayBuffer) => PizZipInst; Docx: DocxCtor }> {
  await loadScript('/vendor/pizzip.min.js', 'PizZip');
  await loadScript('/vendor/docxtemplater.js', 'docxtemplater');
  return { PizZip: global<new (data: ArrayBuffer) => PizZipInst>('PizZip'), Docx: global<DocxCtor>('docxtemplater') };
}

$('#tool-root').innerHTML = `
  <div class="workspace">
    <div class="panel">
      ${pickerHtml('word', T('word.label', '1. File Word (.docx)'), T('word.hint', 'File chứa các đánh dấu dạng &lt;&lt;&lt;a&gt;&gt;&gt;, &lt;&lt;&lt;b&gt;&gt;&gt;...'), '.docx', false, T('word.drop', 'Chọn file Word hoặc kéo thả vào đây'))}
      ${pickerHtml('xl', T('xl.label', '2. File Excel (.xlsx)'), T('xl.hint', 'Cấu trúc 4 cột: [TT | Đánh dấu | Mô tả | Nội dung nhập], dòng 1 là tiêu đề. Dòng trong nội dung bắt đầu bằng "1.", "2."... hoặc "I.", "II."... sẽ được tô đỏ.'), '.xlsx,.xls', false, T('xl.drop', 'Chọn file Excel hoặc kéo thả vào đây'))}
      <div class="actions"><button type="button" class="btn btn-primary" id="run">${T('run', 'Xử lý và tải xuống')}</button></div>
      <p class="note" id="status" hidden></p>
    </div>
    <section class="panel">
      <div class="panel-title">${T('how.title', 'Cách dùng')}</div>
      <ol class="note" style="padding-left:18px;display:flex;flex-direction:column;gap:6px">
        <li>${T('how.1', 'Trong file Word, gõ các đánh dấu cần điền, ví dụ &lt;&lt;&lt;ten&gt;&gt;&gt;, &lt;&lt;&lt;ngay&gt;&gt;&gt;.')}</li>
        <li>${T('how.2', 'Trong file Excel, cột B ghi tên đánh dấu (ten, ngay...) và cột D ghi nội dung sẽ điền vào.')}</li>
        <li>${T('how.3', 'Nội dung nhiều dòng sẽ giữ nguyên xuống dòng; dòng bắt đầu bằng "1.", "2." hoặc "I.", "II." được tô đỏ.')}</li>
        <li>${T('how.4', 'Đánh dấu có trong Word nhưng không có trong Excel sẽ để trống và được báo lại cho bạn.')}</li>
      </ol>
    </section>
  </div>
`;

const wordFiles = bindPicker('word', false);
const xlFiles = bindPicker('xl', false);

/** Dòng bắt đầu bằng "1.", "2."... hoặc số La Mã "I.", "II."... thì tô đỏ */
function isRedLine(line: string): boolean {
  const str = line.trim();
  // (?!\d): không tô đỏ dòng bắt đầu bằng số thập phân/số tiền như "1.500.000 đồng"
  if (/^([1-9][0-9]?|100)\.(?!\d)/.test(str)) return true;
  const roman = /^(C|XC|L?X{0,3})(IX|IV|V?I{0,3})\./i;
  return roman.test(str) && str.indexOf('.') > 0;
}

async function readExcelData(file: File): Promise<Record<string, string>> {
  const X = await loadXlsx();
  const wb = readWorkbook(X, await readFileBytes(file));
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error(T('err.noSheet', 'File Excel không có trang tính dữ liệu.'));
  // raw:false lấy đúng chữ đang hiển thị (ngày, số có phân cách) thay vì số serial
  const rows = X.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
  const result: Record<string, string> = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    // Cột Nội dung (D) để trống vẫn phải nhận để thẻ trong Word được thay bằng rỗng
    let key = String(row[1] ?? '').trim();
    key = key.replace(/^<{3}/, '').replace(/>{3}$/, '').trim();
    if (!key) continue;
    const value = String(row[3] ?? '').replace(/\r\n?/g, '\n');
    result[key] = value.split('\n').map((line) => (isRedLine(line) ? `__START_RED__${line}__END_RED__` : line)).join('\n');
  }
  return result;
}

function applyRed(zip: PizZipInst): void {
  for (const f of Object.keys(zip.files).filter((n) => n.endsWith('.xml'))) {
    const content = zip.file(f)?.asText() ?? '';
    if (!content.includes('__START_RED__')) continue;
    const segs = content.split(/<w:r\b/);
    let out = segs[0];
    for (let i = 1; i < segs.length; i++) {
      let seg = '<w:r' + segs[i];
      if (seg.includes('__START_RED__')) {
        // Chỉ lấy rPr của chính run này (trước <w:t>), không lấy nhầm rPr của đoạn văn kế tiếp
        const head = seg.split(/<w:t[\s>]/)[0];
        const m = head.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/);
        const rPr = m ? m[0] : '';
        const red = rPr ? rPr.replace(/<w:color [^>]*\/>/g, '').replace('</w:rPr>', '<w:color w:val="FF0000"/></w:rPr>') : '<w:rPr><w:color w:val="FF0000"/></w:rPr>';
        seg = seg.split('__START_RED__').join(`</w:t></w:r><w:r>${red}<w:t xml:space="preserve">`)
          .split('__END_RED__').join(`</w:t></w:r><w:r>${rPr}<w:t xml:space="preserve">`);
      }
      out += seg;
    }
    zip.file(f, out);
  }
}

$('#run').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('#run');
  const w = wordFiles()[0], x = xlFiles()[0];
  if (!w || !x) return setStatus('status', T('err.need', 'Hãy chọn cả file Word và file Excel.'), 'error');
  if (w.size > MAX_EXCEL_BYTES || x.size > MAX_EXCEL_BYTES) return setStatus('status', T('err.big', 'File lớn hơn 40 MB.'), 'error');
  btn.disabled = true;
  setStatus('status', T('working', 'Đang xử lý…'), '');
  try {
    const data = await readExcelData(x);
    const { PizZip, Docx } = await loadDocxLibs();
    const zip = new PizZip(await readFileBytes(w));
    const missing = new Set<string>();
    const doc = new Docx(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '<<<', end: '>>>' },
      // Mặc định thẻ không có trong Excel bị in ra chữ "undefined"; đổi thành rỗng và báo lại
      nullGetter(part) { if (part?.value) missing.add(part.value); return ''; },
    });
    doc.render(data);
    const outZip = doc.getZip();
    applyRed(outZip);
    const blob = outZip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    downloadBlob(blob, 'filled-document.docx');
    let msg = T('done', 'Hoàn thành, file Word kết quả đã được tải xuống.');
    if (missing.size) msg += ` ${T('missing', 'Lưu ý: các đánh dấu sau có trong Word nhưng không có trong Excel nên để trống:')} ${[...missing].map((k) => `<<<${k}>>>`).join(', ')}`;
    setStatus('status', msg, missing.size ? 'warn' : 'ok');
  } catch (e) {
    console.error(e);
    const err = e as Error & { properties?: { errors?: { message?: string; properties?: { explanation?: string } }[] } };
    let detail = err.message;
    // Lỗi cú pháp thẻ của docxtemplater nằm trong properties.errors
    const list = err.properties?.errors;
    if (Array.isArray(list) && list.length) detail = list.map((x) => x.properties?.explanation || x.message).join(' | ');
    setStatus('status', `${T('err.generic', 'Không xử lý được')}: ${detail}`, 'error');
  } finally {
    btn.disabled = false;
  }
});
