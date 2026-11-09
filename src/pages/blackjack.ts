import { mountLayout } from '../layout';
import { mountBlackjack } from '../lib/casino-ui';

mountLayout({ activeTool: 'blackjack' });
mountBlackjack('blackjack');
