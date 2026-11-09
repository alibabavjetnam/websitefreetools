import { mountLayout } from '../layout';
import { mountSnake } from '../lib/snake-ui';

mountLayout({ activeTool: 'snake' });
mountSnake('snake');
