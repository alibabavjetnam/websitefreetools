import { mountLayout } from '../layout';
import { mountWhack } from '../lib/skill-ui';

mountLayout({ activeTool: 'whack-a-mole' });
mountWhack('whack-a-mole');
