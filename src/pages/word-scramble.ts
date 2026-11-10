import { mountLayout } from '../layout';
import { mountScramble } from '../lib/wordgames-ui';

mountLayout({ activeTool: 'word-scramble' });
mountScramble('word-scramble');
