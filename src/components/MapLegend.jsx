import { MapContext } from './MapContext';

import {
    useContext,
} from '@wordpress/element';

import {
    Card,
    CardHeader,
    CardBody,
    __experimentalHeading as Heading,
    __experimentalText as Text,
    __experimentalGrid as Grid,
    Button,
} from '@wordpress/components';

/**
 * shows the map legend, with buttons to toggle the visibility of the branches
 * the buttons have the names of the branches, and the color of the branch
 * 
 * @returns {JSX.Element}
 */
const MapLegend = () => {

    const {
        branches,
        playgrounds,
        viewMode,
        setLegendKeyClicked,
    } = useContext(MapContext);

    // Show branches or playgrounds depending on the active view mode.
    const entities = viewMode === 'playgrounds' ? playgrounds : branches;

    /**
     * When a branch button is clicked, set the legendKeyClicked in the MapContext
     * legendKeyClicked is processed in MapProcessor.jsx
     * 
     * @param {number} key - the key of the branch that was clicked 
     */
    const handleClick = (key) => {
        setLegendKeyClicked(key);
    }

    return (
        
        <Card>

            <CardHeader>
                <Heading>Legend</Heading>
            </CardHeader>

            <CardBody>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: '0.5rem',
                    }}
                >
                {
                    Object.keys(entities).map(branchKey => {

                        const branchColor = entities[branchKey].color;
                        const branchName  = entities[branchKey].label;
                        const branchOpac  = 0.65;
                        const branchWght  = 2;

                        var [city, state] = branchName.split(', ');

                        // make cityState two lines, one with the city name, and the second with the state
                        const cityState = (
                            <>
                                <Text>{city}</Text>
                                <br />
                                <Text>{state}</Text>
                            </>
                        )

                        return (

                            <div style={{ fill: branchColor }}>
                                <Button 
                                    style={{ 
                                        backgroundColor: branchColor + String(branchOpac * 100),
                                        border: branchWght + 'px solid ' + branchColor,
                                        borderRadius: '5px',
                                        width: '100%',
                                        padding: '.25rem',
                                    }}
                                    onClick={ handleClick.bind(this, branchKey) }
                                    text={<Text style={{margin: '0 auto'}}>{cityState}</Text>}
                                />
                                
                            
                            </div>

                        )                

                    })
                }
                </div>
            </CardBody>

        </Card>
        

    )

}

export default MapLegend;