import { mountLayout } from '../layout';
import { mountSudoku } from '../lib/sudoku-ui';

mountLayout({ activeTool: 'sudoku-9x9' });
mountSudoku(9, 'sudoku-9x9');
