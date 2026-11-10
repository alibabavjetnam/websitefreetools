import { mountLayout } from '../layout';
import { mountPuzzle } from '../lib/puzzle-ui';

mountLayout({ activeTool: 'mastermind' });
mountPuzzle('mastermind', 'mastermind');
