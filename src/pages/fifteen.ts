import { mountLayout } from '../layout';
import { mountPuzzle } from '../lib/puzzle-ui';

mountLayout({ activeTool: 'fifteen' });
mountPuzzle('fifteen', 'fifteen');
