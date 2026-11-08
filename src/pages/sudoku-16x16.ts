import { mountLayout } from '../layout';
import { mountSudoku } from '../lib/sudoku-ui';

mountLayout({ activeTool: 'sudoku-16x16' });
mountSudoku(16, 'sudoku-16x16');
