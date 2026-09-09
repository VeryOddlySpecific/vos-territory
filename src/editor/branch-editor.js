import { registerPlugin } from '@wordpress/plugins';
import BranchColorPanel from './BranchColorPanel';

registerPlugin( 'vos-branch-editor', {
    render: BranchColorPanel,
} );
