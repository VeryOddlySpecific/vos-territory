import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { ColorPicker } from '@wordpress/components';
import { useEntityProp } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';

const BranchColorPanel = () => {

    const postType = useSelect(
        ( select ) => select( 'core/editor' ).getCurrentPostType()
    );

    const [ meta, setMeta ] = useEntityProp( 'postType', 'vos_branch', 'meta' );

    // Guard: only render on vos_branch edit screens.
    if ( postType !== 'vos_branch' ) return null;

    const color = meta?._vos_branch_color || '#000000';

    return (
        <PluginDocumentSettingPanel
            name="vos-branch-color"
            title="Branch Color"
        >
            <ColorPicker
                color={ color }
                onChange={ ( newColor ) =>
                    setMeta( { ...meta, _vos_branch_color: newColor } )
                }
                enableAlpha={ false }
            />
        </PluginDocumentSettingPanel>
    );

};

export default BranchColorPanel;
