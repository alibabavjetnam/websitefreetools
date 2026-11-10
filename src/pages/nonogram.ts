import { mountLayout } from '../layout';
import { mountNonogram } from '../lib/nonogram-ui';

mountLayout({ activeTool: 'nonogram' });
mountNonogram('nonogram');
