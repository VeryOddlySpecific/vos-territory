import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';

registerBlockType( 'vos/territory-map', {
    title:       'Territory Map',
    description: 'Embeds the VOS territory map.',
    category:    'embed',
    icon:        'location-alt',
    keywords:    [ 'map', 'territory', 'branch' ],
    supports: {
        html:  false,
        align: [ 'wide', 'full' ],
    },
    attributes: {},

    edit: Edit,

    // Dynamic block — PHP render_callback handles frontend output.
    save: () => null,
} );
