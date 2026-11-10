import { mountLayout } from '../layout';
import { mountPinball } from '../lib/pinball-ui';

mountLayout({ activeTool: 'pinball' });
mountPinball('pinball');
