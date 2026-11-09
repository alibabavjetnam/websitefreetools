import { mountLayout } from '../layout';
import { mountXiangqi } from '../lib/xiangqi-ui';

mountLayout({ activeTool: 'co-up' });
mountXiangqi('co-up', 'dark');
