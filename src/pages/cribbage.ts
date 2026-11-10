import { mountLayout } from '../layout';
import { mountCribbage } from '../lib/cribbage-ui';

mountLayout({ activeTool: 'cribbage' });
mountCribbage('cribbage');
