import { mountLayout } from '../layout';
import { mountPuzzle } from '../lib/puzzle-ui';

mountLayout({ activeTool: 'hanoi' });
mountPuzzle('hanoi', 'hanoi');
