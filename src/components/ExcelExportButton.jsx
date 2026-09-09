import { Button } from '@wordpress/components';
import { useContext } from '@wordpress/element';

import { MapContext } from './MapContext';
import fipsData from '../assets/fips.json';

/**
 * Exports the current view's counties grouped by entity (branch or playground)
 * as a downloadable .xlsx file.
 *
 * Layout matches the lead-gen team's preferred format: each entity is a column,
 * its name is the header (row 1), and its counties are listed beneath as
 * "County, ST". A county carrying a restriction note renders the note as a
 * " - {note}" suffix (e.g. "Allen, KS - 200+").
 *
 * viewMode + playground data come from the playgrounds feature; this component
 * falls back to the branches view so it works standalone and stays
 * forward-compatible once those context values exist.
 */

// FIPS (2-digit state code) -> USPS abbreviation, built once from the shared asset.
const FIPS_TO_ABBR = fipsData.reduce( ( map, state ) => {
    map[ state.fips ] = state.abbr;
    return map;
}, {} );

const ExcelExportButton = () => {

    const ctx = useContext( MapContext );

    const { branches, activeSubregions } = ctx;

    const viewMode                   = ctx.viewMode || 'branches';
    const playgrounds                = ctx.playgrounds || {};
    const activePlaygroundSubregions = ctx.activePlaygroundSubregions || [];

    const isPlayground = viewMode === 'playgrounds';

    const entities         = isPlayground ? playgrounds                : branches;
    const layers           = isPlayground ? activePlaygroundSubregions : activeSubregions;
    const assignKey        = isPlayground ? 'playground'         : 'branch';
    const restrictedFlag   = isPlayground ? 'playgroundRestrictions'       : 'restrictions';
    const restrictionNote  = isPlayground ? 'playgroundRestrictionDetails' : 'restrictionDetails';

    const handleClick = async () => {

        // Load SheetJS on demand so it isn't bundled into the main bundle (which
        // also serves the public map — the export button is admin-only).
        const { utils, writeFile } = await import( 'xlsx' );

        // Group county strings by the entity they're assigned to.
        const columnsById = {};

        layers.forEach( layer => {

            const id = layer[ assignKey ];
            if ( ! id ) return;

            if ( ! columnsById[ id ] ) {
                columnsById[ id ] = {
                    label:    entities[ id ]?.label ?? 'Unassigned',
                    counties: [],
                };
            }

            const props = layer.feature.properties;
            const geoid = String( props.GEOID );
            const abbr  = FIPS_TO_ABBR[ geoid.slice( 0, 2 ) ] || '';

            let cell = abbr ? `${ props.Name }, ${ abbr }` : props.Name;

            const note = layer.options[ restrictionNote ];
            if ( layer.options[ restrictedFlag ] && note ) {
                cell += ` - ${ note }`;
            }

            columnsById[ id ].counties.push( cell );

        } );

        const columns = Object.values( columnsById );
        if ( ! columns.length ) return;

        // Sort counties within each column, then transpose into rows so each
        // entity occupies its own column (name on top, counties beneath).
        columns.forEach( col => col.counties.sort( ( a, b ) => a.localeCompare( b ) ) );

        const header  = columns.map( col => col.label );
        const maxRows = columns.reduce( ( max, col ) => Math.max( max, col.counties.length ), 0 );

        const rows = [];
        for ( let r = 0; r < maxRows; r++ ) {
            rows.push( columns.map( col => col.counties[ r ] ?? '' ) );
        }

        const ws = utils.aoa_to_sheet( [ header, ...rows ] );

        // Size each column to its widest cell so "County, ST - note" stays readable.
        ws['!cols'] = columns.map( col => {
            const widest = Math.max(
                col.label.length,
                ...col.counties.map( c => c.length ),
            );
            return { wch: Math.min( widest + 2, 40 ) };
        } );

        const wb        = utils.book_new();
        const sheetName = isPlayground ? 'Playgrounds' : 'Branches';
        utils.book_append_sheet( wb, ws, sheetName );

        const date     = new Date().toISOString().slice( 0, 10 );
        const filename = `${ isPlayground ? 'playgrounds' : 'branches' }-counties-${ date }.xlsx`;

        writeFile( wb, filename );

    };

    return (
        <Button
            variant="secondary"
            onClick={ handleClick }
            disabled={ ! layers.length }
        >
            Export Excel
        </Button>
    );

};

export default ExcelExportButton;
