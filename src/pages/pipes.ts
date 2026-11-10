import { mountLayout } from '../layout';
import { mountPuzzle } from '../lib/puzzle-ui';

mountLayout({ activeTool: 'pipes' });
mountPuzzle('pipes', 'pipes');
