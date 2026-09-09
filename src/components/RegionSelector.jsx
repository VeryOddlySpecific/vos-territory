import {
    Card,
    CardHeader,
    CardBody,
    ToggleControl,
    __experimentalHeading as Heading,
    __experimentalGrid as Grid,
} from '@wordpress/components';

import RegionData from '../assets/fips.json';

import { MapContext } from './MapContext';
import { useContext } from '@wordpress/element';

/**
 * returns the region selector component
 * 
 * @returns {JSX.Element}
 */
const RegionSelector = () => {

    const { 
        activeRegions,
        setToggledRegion,
    } = useContext(MapContext);

    /**
     * receives a region code
     * checks if that region code is in the activeRegions array (i.e. if it is active)
     * sets that region data to an object containing the region code and a boolean value of the opposite of its current state (i.e. it's resultant active state)
     * passes that object to the setToggledRegion function
     * toggledRegion is set in MapContext, and is used in:
     *     MapProcessor.jsx (useEffect)
     * 
     * @param {number} region 
     */
    const toggleRegion = (region) => {
        const regionIsActive = activeRegions.includes(region);
        const regionData = {
            fips: region,
            active: !regionIsActive
        }

        setToggledRegion(regionData);
    }

    return (
        <>
        <Card>

            <CardHeader>
                <Heading>Region Selector</Heading>
                
            </CardHeader>

            <CardBody>
                <Grid
                    columns={6}
                    gap={2}
                >
                    
                    {
                    RegionData.map((region) => {
    
                        return (
                            <ToggleControl
                                key={region.fips}
                                label={region.name}
                                checked={activeRegions.includes(region.fips)}
                                onChange={() => toggleRegion(region.fips)}
                            />
                        )
    
                    })
                    }
                </Grid>

            </CardBody>

        </Card>
        </>

    )

}

export default RegionSelector;
