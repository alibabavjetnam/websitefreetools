import { mountLayout } from '../layout';
import { mountDuel } from '../lib/duel-ui';

mountLayout({ activeTool: 'connect-four' });
mountDuel('connect-four', 'connect4');
