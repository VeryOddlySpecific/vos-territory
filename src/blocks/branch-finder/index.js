import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';

registerBlockType( 'vos/branch-finder', {
    title:       'Branch Finder',
    description: 'Lets site visitors look up the branch that covers a given address.',
    category:    'embed',
    icon:        'search',
    keywords:    [ 'branch', 'finder', 'address', 'territory' ],
    supports: {
        html:  false,
        align: [ 'wide' ],
    },
    attributes: {},

    edit: Edit,

    // Dynamic block — PHP render_callback emits the mount div.
    save: () => null,
} );
