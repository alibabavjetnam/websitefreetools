import { mountLayout } from '../layout';
import { mountCheckers } from '../lib/checkers-ui';

mountLayout({ activeTool: 'checkers' });
mountCheckers('checkers');
