import { mountLayout } from '../layout';
import { mountSnakes } from '../lib/board5-ui';

mountLayout({ activeTool: 'snakes-ladders' });
mountSnakes('snakes-ladders');
