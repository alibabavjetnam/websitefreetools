import { mountLayout } from '../layout';
import { mountBlocks } from '../lib/blocks-ui';

mountLayout({ activeTool: 'block-puzzle' });
mountBlocks('block-puzzle');
