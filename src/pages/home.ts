import { mountLayout, toolHref, toolIcon } from '../layout';
import { GROUPS, TOOLS } from '../tools';
import { groupDesc, groupName, t, toolDesc, toolName } from '../i18n';

mountLayout({ activeNav: 'home' });

const esc = (s: string): string => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);

// Dịch tiêu đề mục và phần giới thiệu nếu có từ điển
const titleEl = document.getElementById('tools-title');
if (titleEl) titleEl.textContent = t('home.toolsTitle', titleEl.textContent ?? '');

// Mỗi nhóm là một khung (groupbox) chứa danh sách công cụ của nhóm đó
const container = document.getElementById('tool-groups') as HTMLElement;
container.innerHTML = GROUPS.map((g) => {
  const tools = TOOLS.filter((x) => x.group === g.id);
  if (!tools.length) return '';
  const rows = tools
    .map(
      (tool) => `
      <li>
        <a class="tool-row" href="${toolHref(tool)}">
          <span class="tool-icon" aria-hidden="true">${toolIcon(tool)}</span>
          <span class="tool-text">
            <span class="tool-name">${esc(toolName(tool.id, tool.name))}</span>
            <span class="tool-desc">${esc(toolDesc(tool.id, tool.description))}</span>
          </span>
        </a>
      </li>`,
    )
    .join('');
  return `
    <section class="groupbox" aria-labelledby="group-${g.id}">
      <header class="groupbox-head">
        <h3 id="group-${g.id}">${esc(groupName(g.id, g.name))}</h3>
        <p>${esc(groupDesc(g.id, g.description))}</p>
      </header>
      <ul class="tool-list">${rows}</ul>
    </section>`;
}).join('');
