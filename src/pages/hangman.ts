import { mountLayout } from '../layout';
import { mountHangman } from '../lib/wordgames-ui';

mountLayout({ activeTool: 'hangman' });
mountHangman('hangman');
