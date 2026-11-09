import { mountLayout } from '../layout';
import { mountSolitaire } from '../lib/solitaire-ui';

mountLayout({ activeTool: 'freecell' });
mountSolitaire('freecell', 'freecell');
