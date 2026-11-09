import { mountLayout } from '../layout';
import { mount2048 } from '../lib/g2048-ui';

mountLayout({ activeTool: 'game-2048' });
mount2048('game-2048');
