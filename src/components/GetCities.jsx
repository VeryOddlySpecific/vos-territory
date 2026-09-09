import { Button } from '@wordpress/components';
import { useState, useEffect, useContext } from '@wordpress/element';

import { MapContext } from './MapContext';

import cityData from '../assets/citydata.json';

const GetCities = () => {

    const { mapRef } = useContext(MapContext);
    const [ branchGroups, setBranchGroups ] = useState([]);

    const subregionBounds = (groups) => {

        const bounds = [];

        groups.forEach(group => {
            
            let groupFeatures = [];

            group.subregions.forEach(subregion => {
                groupFeatures.push(subregion.feature);
            });

            let featureCollection   = turf.featureCollection(groupFeatures);
            let combinedFeature     = turf.combine(featureCollection);
            let featureMask         = turf.mask(combinedFeature);
            let featurePolygon      = turf.polygon([featureMask.geometry.coordinates[1]]);

            let citiesInBranchArea  = turf.pointsWithinPolygon(cityData, featurePolygon);

            console.log(citiesInBranchArea);
            
        });

    }

    const handleClick = () => {

        const newBranchGroups = [];

        mapRef.current.eachLayer((layer) => {

            if (layer.branch) {

                const branchGroup = newBranchGroups.find(group => group.branch === layer.branch);

                if (branchGroup) {

                    branchGroup.subregions.push(layer);

                } else {

                    newBranchGroups.push({
                        branch: layer.branch,
                        subregions: [layer]
                    });

                }

            }

        });

        setBranchGroups(newBranchGroups);

    }

    useEffect(() => {

        if (branchGroups.length > 0) {
            subregionBounds(branchGroups);
        }
        

    }, [branchGroups]);

    return (
        <Button
            variant='primary'
            onClick={ handleClick }
        >
            Get Cities
        </Button>
    )

}

export default GetCities;