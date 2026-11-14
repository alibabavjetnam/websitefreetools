import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText } from '../i18n';
import { area, select, check, button, bindCopy, bindDownload, dk, el, privacyNote, val, setVal, checked, onChange } from '../lib/devkit';
import { formatSql, minifySql } from '../calc/devconv';

mountLayout({ activeTool: 'sql-format' });
const T = pageText();
const SAMPLE = `select u.id, u.name, count(o.id) as total_orders, sum(o.amount) as revenue from users u left join orders o on o.user_id = u.id and o.status = 'paid' where u.created_at >= '2026-01-01' and u.country in ('VN','US') group by u.id, u.name having sum(o.amount) > 1000 order by revenue desc limit 20;`;

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <div class="row">
      ${select('indent', T('indent', 'Thụt lề'), [['2', T('i.2', '2 dấu cách')], ['4', T('i.4', '4 dấu cách')], ['tab', 'Tab']], '2')}
      ${check('upper', T('upper', 'Viết hoa từ khoá (SELECT, FROM…)'), true)}
    </div>
    <div class="workspace" style="margin-top:0">
      ${area('in', T('src', 'Câu lệnh SQL'), { rows: 18, value: SAMPLE })}
      ${area('out', dk.output(), { rows: 18, ro: true })}
    </div>
    <div class="row">${button('fmt', T('format', 'Định dạng'), true)}${button('min', T('minify', 'Rút gọn một dòng'))}${button('copy', dk.copy())}${button('dl', dk.download())}</div>
    <p class="note">${T('note', 'Hỗ trợ cú pháp SQL chung của MySQL, PostgreSQL, SQL Server, SQLite: SELECT, JOIN, truy vấn con, INSERT, UPDATE, DELETE. Nội dung trong dấu nháy và chú thích được giữ nguyên.')}</p>
  </div>
  ${privacyNote()}
`;
const fmt = () => setVal('out', formatSql(val('in'), val('indent') === 'tab' ? '\t' : ' '.repeat(Number(val('indent'))), checked('upper')));
el('fmt').addEventListener('click', fmt);
el('min').addEventListener('click', () => setVal('out', minifySql(val('in'))));
onChange(['in', 'indent', 'upper'], fmt, 200);
bindCopy('copy', () => val('out'));
bindDownload('dl', () => val('out'), () => 'query.sql');
fmt();
