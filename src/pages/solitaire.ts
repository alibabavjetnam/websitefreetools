import { mountLayout } from '../layout';
import { mountSolitaire } from '../lib/solitaire-ui';

mountLayout({ activeTool: 'solitaire' });
mountSolitaire('solitaire', 'klondike');
