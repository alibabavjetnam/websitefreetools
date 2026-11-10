import { mountLayout } from '../layout';
import { mountKenKen } from '../lib/numpuz-ui';

mountLayout({ activeTool: 'kenken' });
mountKenKen('kenken');
