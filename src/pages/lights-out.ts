import { mountLayout } from '../layout';
import { mountPuzzle } from '../lib/puzzle-ui';

mountLayout({ activeTool: 'lights-out' });
mountPuzzle('lights-out', 'lights-out');
