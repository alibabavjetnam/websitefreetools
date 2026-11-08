import { mountLayout } from '../layout';
import { mountXiangqi } from '../lib/xiangqi-ui';

mountLayout({ activeTool: 'xiangqi' });
mountXiangqi('xiangqi');
