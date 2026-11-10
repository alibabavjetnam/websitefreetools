import { mountLayout } from '../layout';
import { mountSokoban } from '../lib/sokoban-ui';

mountLayout({ activeTool: 'sokoban' });
mountSokoban('sokoban');
