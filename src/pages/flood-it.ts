import { mountLayout } from '../layout';
import { mountPuzzle } from '../lib/puzzle-ui';

mountLayout({ activeTool: 'flood-it' });
mountPuzzle('flood-it', 'flood-it');
