import { mountLayout } from '../layout';
import { mountShogi } from '../lib/shogi-ui';

mountLayout({ activeTool: 'shogi' });
mountShogi('shogi');
