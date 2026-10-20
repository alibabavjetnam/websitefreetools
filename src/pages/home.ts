import { mountLayout, toolHref, toolIcon } from '../layout';
import { TOOLS } from '../tools';

mountLayout({ activeNav: 'home' });

const list = document.getElementById('tool-list') as HTMLUListElement;
list.innerHTML = TOOLS.map(
  (t) => `
  <li>
    <a class="tool-row" href="${toolHref(t)}">
      <span class="tool-icon" aria-hidden="true">${toolIcon(t)}</span>
      <span class="tool-text">
        <span class="tool-name">${t.name}</span>
        <span class="tool-desc">${t.description}</span>
      </span>
      <span class="tool-cat">${t.category}</span>
    </a>
  </li>`,
).join('');
