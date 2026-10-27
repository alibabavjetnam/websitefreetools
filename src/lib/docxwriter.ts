/** Tạo file Word (.docx) tối giản: đoạn văn, tiêu đề, ngắt trang, ảnh. Đóng gói bằng JSZip (makeZip). */
import { makeZip } from './files';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

export type Block =
  | { kind: 'p'; text: string; size?: number; bold?: boolean; align?: 'left' | 'center' | 'right' }
  | { kind: 'break' }
  | { kind: 'image'; data: Uint8Array; widthPt: number; heightPt: number };

export interface DocxOptions { pageWpt: number; pageHpt: number; marginPt: number; font?: string }

const EMU = 12700; // 1 pt
const TW = 20; // 1 pt = 20 twip

export async function buildDocx(blocks: Block[], o: DocxOptions): Promise<Blob> {
  const media: { name: string; data: Uint8Array }[] = [];
  let pic = 0;
  const body = blocks.map((b) => {
    if (b.kind === 'break') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    if (b.kind === 'image') {
      pic++;
      const name = `image${pic}.jpg`;
      media.push({ name, data: b.data });
      const cx = Math.round(b.widthPt * EMU), cy = Math.round(b.heightPt * EMU);
      return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${pic}" name="Picture ${pic}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${pic}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rImg${pic}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
    const rpr = `${b.bold ? '<w:b/>' : ''}${b.size ? `<w:sz w:val="${Math.round(b.size * 2)}"/><w:szCs w:val="${Math.round(b.size * 2)}"/>` : ''}`;
    const ppr = `<w:pPr><w:spacing w:after="120"/>${b.align && b.align !== 'left' ? `<w:jc w:val="${b.align === 'center' ? 'center' : 'right'}"/>` : ''}</w:pPr>`;
    // Giữ xuống dòng trong đoạn bằng <w:br/>
    const runs = b.text.split('\n').map((line, i) => `${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(line)}</w:t>`).join('');
    return `<w:p>${ppr}<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}${runs}</w:r></w:p>`;
  }).join('');

  const m = Math.round(o.marginPt * TW);
  const font = o.font ?? 'Times New Roman';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="${Math.round(o.pageWpt * TW)}" w:h="${Math.round(o.pageHpt * TW)}"${o.pageWpt > o.pageHpt ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${media.map((x, i) => `<Relationship Id="rImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${x.name}"/>`).join('')}</Relationships>`;

  const zip = await makeZip([
    { name: '[Content_Types].xml', data: types },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: doc },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/_rels/document.xml.rels', data: docRels },
    ...media.map((x) => ({ name: `word/media/${x.name}`, data: x.data })),
  ]);
  return new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
