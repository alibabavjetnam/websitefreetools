import { mountLayout } from '../layout';
import { mountWordGuess } from '../lib/wordgames-ui';

mountLayout({ activeTool: 'word-guess' });
mountWordGuess('word-guess');
