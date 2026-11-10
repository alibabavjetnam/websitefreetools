import { mountLayout } from '../layout';
import { mountBattleship } from '../lib/board5-ui';

mountLayout({ activeTool: 'battleship' });
mountBattleship('battleship');
