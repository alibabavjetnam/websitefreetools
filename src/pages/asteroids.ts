import { mountLayout } from '../layout';
import { mountAsteroids } from '../lib/arcade4-ui';

mountLayout({ activeTool: 'asteroids' });
mountAsteroids('asteroids');
