import { mountLayout } from '../layout';
import { mountYahtzee } from '../lib/play5-ui';

mountLayout({ activeTool: 'yahtzee' });
mountYahtzee('yahtzee');
