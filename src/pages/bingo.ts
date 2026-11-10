import { mountLayout } from '../layout';
import { mountBingo } from '../lib/play5-ui';

mountLayout({ activeTool: 'bingo' });
mountBingo('bingo');
