import { mountLayout } from '../layout';
import { mountVideoPoker } from '../lib/casino-ui';

mountLayout({ activeTool: 'video-poker' });
mountVideoPoker('video-poker');
