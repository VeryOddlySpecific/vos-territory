import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { ColorPicker } from '@wordpress/components';
import { useEntityProp } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';

const PlaygroundColorPanel = () => {

    const postType = useSelect(
        ( select ) => select( 'core/editor' ).getCurrentPostType()
    );

    const [ meta, setMeta ] = useEntityProp( 'postType', 'vos_playground', 'meta' );

    // Guard: only render on vos_playground edit screens.
    if ( postType !== 'vos_playground' ) return null;

    const color = meta?._vos_playground_color || '#000000';

    return (
        <PluginDocumentSettingPanel
            name="vos-playground-color"
            title="Playground Color"
        >
            <ColorPicker
                color={ color }
                onChange={ ( newColor ) =>
                    setMeta( { ...meta, _vos_playground_color: newColor } )
                }
                enableAlpha={ false }
            />
        </PluginDocumentSettingPanel>
    );

};

export default PlaygroundColorPanel;
