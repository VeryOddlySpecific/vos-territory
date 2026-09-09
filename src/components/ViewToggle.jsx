import { MapContext } from './MapContext';
import { useContext } from '@wordpress/element';
import {
    Card,
    CardBody,
    ButtonGroup,
    Button,
} from '@wordpress/components';

/**
 * Flips the map + legend between the Branches and Playgrounds territory layers.
 * Rendered on both the admin and public layouts. Hidden when no playgrounds are
 * defined, so the map behaves exactly as before for sites without them.
 */
const ViewToggle = () => {

    const { viewMode, setViewMode, playgrounds } = useContext( MapContext );

    if ( ! playgrounds || ! Object.keys( playgrounds ).length ) return null;

    return (
        <Card>
            <CardBody>
                <ButtonGroup>
                    <Button
                        variant={ viewMode === 'branches' ? 'primary' : 'secondary' }
                        onClick={ () => setViewMode( 'branches' ) }
                    >
                        Branches
                    </Button>
                    <Button
                        variant={ viewMode === 'playgrounds' ? 'primary' : 'secondary' }
                        onClick={ () => setViewMode( 'playgrounds' ) }
                    >
                        Playgrounds
                    </Button>
                </ButtonGroup>
            </CardBody>
        </Card>
    );

};

export default ViewToggle;
