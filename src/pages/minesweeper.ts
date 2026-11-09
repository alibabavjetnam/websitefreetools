import { mountLayout } from '../layout';
import { mountMines } from '../lib/mines-ui';

mountLayout({ activeTool: 'minesweeper' });
mountMines('minesweeper');
