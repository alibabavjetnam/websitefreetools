import { mountLayout } from '../layout';
import { mountSolitaire } from '../lib/solitaire-ui';

mountLayout({ activeTool: 'spider-solitaire' });
mountSolitaire('spider-solitaire', 'spider');
