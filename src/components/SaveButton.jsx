import { Button } from '@wordpress/components';
import * as turf from '@turf/turf';
import {
    useContext,
    useState,
} from '@wordpress/element';

import { MapContext } from './MapContext';

const SaveButton = () => {

    const {
        activeSubregions,
        activePlaygroundSubregions,
        activeRegions,
        viewMode,
        mapRef,
    } = useContext(MapContext);

    const [ isSaving, setIsSaving ] = useState(false);

    const saveApiRoute = vosTm.apiBase + '/save';

    const saveData = async (data, key) => {
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

            await response.json();
        } catch (error) {
            console.error('Error saving map:', error);
        }
    };

    const handleClick = async () => {

        setIsSaving(true);

        // Playgrounds persist their own county assignments to a separate option.
        // City computation is branch-only, so it's skipped in this mode.
        if ( viewMode === 'playgrounds' ) {
            const playgroundSubregions = activePlaygroundSubregions.map( subregion => ( {
                playground:         subregion.playground,
                geoid:              subregion.feature.properties.GEOID,
                restrictions:       subregion.options.playgroundRestrictions,
                restrictionDetails: subregion.options.playgroundRestrictionDetails,
            } ) );

            await Promise.all( [
                saveData( JSON.stringify( activeRegions ),        '_vos_tm_active_regions' ),
                saveData( JSON.stringify( playgroundSubregions ), '_vos_tm_playground_subregions' ),
            ] );

            setIsSaving( false );
            return;
        }

        // Fetch city data on demand rather than bundling it — it's only needed
        // at save time and is 7MB, so there's no point carrying it on page load.
        let cityData;
        try {
            const citiesResponse = await fetch(vosTm.apiBase + '/get-cities');
            cityData = await citiesResponse.json();
        } catch (error) {
            console.error('Error fetching city data:', error);
            setIsSaving(false);
            return;
        }

        const newBranchGroups = [];
        const branchCities    = [];

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

        newBranchGroups.forEach(group => {

            const groupFeatures = group.subregions.map(subregion => subregion.feature);

            let featureCollection  = turf.featureCollection(groupFeatures);
            let combinedFeature    = turf.combine(featureCollection);
            let featureMask        = turf.mask(combinedFeature);
            let featurePolygon     = turf.polygon([featureMask.geometry.coordinates[1]]);
            let citiesInBranchArea = turf.pointsWithinPolygon(cityData, featurePolygon);

            branchCities.push({
                branch: group.branch,
                cities: citiesInBranchArea,
            });

        });

        const subregions = activeSubregions.map(subregion => ({
            branch:             subregion.branch,
            geoid:              subregion.feature.properties.GEOID,
            restrictions:       subregion.options.restrictions,
            restrictionDetails: subregion.options.restrictionDetails,
        }));

        await Promise.all([
            saveData(JSON.stringify(activeRegions),  '_vos_tm_active_regions'),
            saveData(JSON.stringify(subregions),     '_vos_tm_active_subregions'),
            saveData(JSON.stringify(branchCities),   '_vos_tm_branch_cities'),
        ]);

        setIsSaving(false);
    };

    return (
        <Button
            variant="primary"
            onClick={ handleClick }
            isBusy={ isSaving }
            disabled={ isSaving }
        >
            { isSaving ? 'Saving...' : 'Save Map' }
        </Button>
    );

};

export default SaveButton;
