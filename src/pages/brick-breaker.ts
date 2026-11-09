import { mountLayout } from '../layout';
import { mountBreakout } from '../lib/breakout-ui';

mountLayout({ activeTool: 'brick-breaker' });
mountBreakout('brick-breaker');
