import { mountLayout } from '../layout';
import { mountDuel } from '../lib/duel-ui';

mountLayout({ activeTool: 'gomoku' });
mountDuel('gomoku', 'gomoku');
