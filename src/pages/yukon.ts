import { mountLayout } from '../layout';
import { mountSolitaire } from '../lib/solitaire-ui';

mountLayout({ activeTool: 'yukon' });
mountSolitaire('yukon', 'yukon');
