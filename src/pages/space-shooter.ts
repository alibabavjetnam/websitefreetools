import { mountLayout } from '../layout';
import { mountShmup } from '../lib/arcade4-ui';

mountLayout({ activeTool: 'space-shooter' });
mountShmup('space-shooter');
