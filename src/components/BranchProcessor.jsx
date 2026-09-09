import * as turf from '@turf/turf';
import { MapContext } from './MapContext';

import {
    useContext
} from '@wordpress/element';

const BranchProcessor = () => {

    const {
        branches,
        activeSubregions,
    } = useContext(MapContext);

    const branchKeys = Object.keys(branches);

    const saveData = async (data, key) => {

        let saveApiRoute = vosTm.apiBase + '/save';
        const payload = {
            id: key,
            data: data
        }

        try {
            const response = await fetch(saveApiRoute, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Nonce is required for WP cookie auth — the /save route
                    // gates on edit_vos_territory and rejects anonymous writes.
                    'X-WP-Nonce': vosTm.nonce,
                },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.error('Error saving map in try:', response);
            }

            const responseData = await response.json();
        } catch (error) {
            console.error('Error saving map:', error);
        }
    };

    const handleClick = async () => {

        // Fetch city data on demand rather than bundling it — it's only needed
        // at save time and is 7MB, so there's no point carrying it on page load.
        let cities;
        try {
            const citiesResponse = await fetch(vosTm.apiBase + '/get-cities');
            cities = await citiesResponse.json();
        } catch (error) {
            console.error('Error fetching city data:', error);
            return;
        }

        branchKeys.forEach(key => {

            let branchSubregions = activeSubregions.filter(subregion => subregion.branch === key);

            branchSubregions.forEach(subregion => {

                let subregionCities = turf.pointsWithinPolygon(cities, subregion.feature);

                saveData(JSON.stringify(subregionCities), "_vos_tm_branch_" + key + "_cities");

            });
        });

    };

    return (
        <>
        </>
    )

}

export default BranchProcessor;