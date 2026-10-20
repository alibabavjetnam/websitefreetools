import { mountLayout, toolHref, toolIcon } from '../layout';
import { GROUPS, TOOLS } from '../tools';

mountLayout({ activeNav: 'home' });

// Mỗi nhóm là một khung (groupbox) chứa danh sách công cụ của nhóm đó
const container = document.getElementById('tool-groups') as HTMLElement;
container.innerHTML = GROUPS.map((g) => {
  const tools = TOOLS.filter((t) => t.group === g.id);
  if (!tools.length) return '';
  const rows = tools
    .map(
      (t) => `
      <li>
        <a class="tool-row" href="${toolHref(t)}">
          <span class="tool-icon" aria-hidden="true">${toolIcon(t)}</span>
          <span class="tool-text">
            <span class="tool-name">${t.name}</span>
            <span class="tool-desc">${t.description}</span>
          </span>
        </a>
      </li>`,
    )
    .join('');
  return `
    <section class="groupbox" aria-labelledby="group-${g.id}">
      <header class="groupbox-head">
        <h3 id="group-${g.id}">${g.name}</h3>
        <p>${g.description}</p>
      </header>
      <ul class="tool-list">${rows}</ul>
    </section>`;
}).join('');
