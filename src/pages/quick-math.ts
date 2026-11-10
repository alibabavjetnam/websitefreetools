import { mountLayout } from '../layout';
import { mountQuickMath } from '../lib/skill-ui';

mountLayout({ activeTool: 'quick-math' });
mountQuickMath('quick-math');
