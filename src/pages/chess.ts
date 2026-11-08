import { mountLayout } from '../layout';
import { mountChess } from '../lib/chess-ui';

mountLayout({ activeTool: 'chess' });
mountChess('chess');
