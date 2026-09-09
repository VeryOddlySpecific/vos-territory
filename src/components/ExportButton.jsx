import { Button } from '@wordpress/components';
import { useContext } from '@wordpress/element';
import { MapContext } from './MapContext';

/**
 * Exports active county/branch data as a downloadable JSON file.
 *
 * Output shape:
 * {
 *   exportedAt: ISO string,
 *   activeStates: [ "31", "19", ... ],   // FIPS codes of loaded states
 *   branches: [
 *     {
 *       id: "42",
 *       label: "La Vista, Nebraska",
 *       color: "#2f4f4f",
 *       counties: [
 *         {
 *           geoid: "31055",
 *           name: "Douglas",
 *           stateFips: "31",
 *           restrictions: false,
 *           restrictionDetails: null
 *         },
 *         ...
 *       ]
 *     },
 *     ...
 *   ]
 * }
 */
const ExportButton = () => {

    const { activeSubregions, activeRegions, branches } = useContext( MapContext );

    const handleClick = () => {

        // Group counties by branch ID.
        const branchMap = {};

        activeSubregions.forEach( layer => {

            const branchId = layer.branch;
            const branch   = branches[ branchId ];

            if ( ! branchMap[ branchId ] ) {
                branchMap[ branchId ] = {
                    id:       branchId,
                    label:    branch?.label    ?? 'Unassigned',
                    color:    branch?.color    ?? null,
                    counties: [],
                };
            }

            const geoid = String( layer.feature.properties.GEOID );

            branchMap[ branchId ].counties.push( {
                geoid:              geoid,
                name:               layer.feature.properties.Name,
                stateFips:          geoid.slice( 0, 2 ),
                restrictions:       layer.options.restrictions       ?? false,
                restrictionDetails: layer.options.restrictionDetails ?? null,
            } );

        } );

        // Sort counties within each branch alphabetically by name.
        Object.values( branchMap ).forEach( branch => {
            branch.counties.sort( ( a, b ) => a.name.localeCompare( b.name ) );
        } );

        const payload = {
            exportedAt:   new Date().toISOString(),
            activeStates: activeRegions,
            branches:     Object.values( branchMap ),
        };

        const blob     = new Blob( [ JSON.stringify( payload, null, 2 ) ], { type: 'application/json' } );
        const url      = URL.createObjectURL( blob );
        const anchor   = document.createElement( 'a' );
        const filename = `territory-export-${ new Date().toISOString().slice( 0, 10 ) }.json`;

        anchor.href     = url;
        anchor.download = filename;
        anchor.click();

        URL.revokeObjectURL( url );

    };

    return (
        <Button
            variant="secondary"
            onClick={ handleClick }
            disabled={ ! activeSubregions.length }
        >
            Export JSON
        </Button>
    );

};

export default ExportButton;
