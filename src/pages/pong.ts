import { mountLayout } from '../layout';
import { mountPong } from '../lib/arcade4-ui';

mountLayout({ activeTool: 'pong' });
mountPong('pong');
