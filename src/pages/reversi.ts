import { mountLayout } from '../layout';
import { mountDuel } from '../lib/duel-ui';

mountLayout({ activeTool: 'reversi' });
mountDuel('reversi', 'reversi');
