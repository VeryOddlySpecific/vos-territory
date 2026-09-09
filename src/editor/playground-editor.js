import { registerPlugin } from '@wordpress/plugins';
import PlaygroundColorPanel from './PlaygroundColorPanel';

registerPlugin( 'vos-playground-editor', {
    render: PlaygroundColorPanel,
} );
