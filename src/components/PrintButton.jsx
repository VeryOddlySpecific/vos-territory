import { Button } from '@wordpress/components';
import { useContext } from '@wordpress/element';
import * as turf from '@turf/turf';

import { MapContext } from './MapContext';

/**
 * Print Map
 *
 * Renders the current territory assignments as a standalone SVG, optimized
 * for a US Letter landscape page, and pops it into a print-dialog window.
 *
 * The output intentionally drops the basemap — it's a quick reference, not
 * a cartographic product. What it shows:
 *
 *   - A light fill + thicker outline for every "active" state (any state
 *     containing at least one branch-assigned county), so the overall
 *     geography reads at a glance.
 *   - Each assigned county filled with its branch's color (restricted
 *     counties get a red outline overlay to match the on-screen cue).
 *   - County name labels centered on each assigned county. Unassigned
 *     counties stay unlabeled.
 *   - A branch legend below the map.
 */
const PrintButton = () => {

    const { countyLayersRef, branches } = useContext( MapContext );

    const handleClick = () => {

        const layers = countyLayersRef.current || [];
        const assigned = layers.filter( l => l.branch && l.feature );

        if ( assigned.length === 0 ) {
            window.alert( 'No assigned counties to print.' );
            return;
        }

        // ---------------------------------------------------------------
        // 1. Build feature sets
        // ---------------------------------------------------------------

        // Counties that have a branch assigned — these carry the color + label.
        const countyFeatures = assigned.map( l => {
            // Clone the feature so we can decorate it without mutating the
            // live layer's feature object (Leaflet reuses that on re-render).
            return {
                type: 'Feature',
                geometry: l.feature.geometry,
                properties: {
                    geoid:        l.feature.properties.GEOID,
                    name:         l.options._vos_sr_name || l.feature.properties.Name,
                    stateFips:    l.options._vos_region,
                    branch:       String( l.branch ),
                    restrictions: !! l.options.restrictions,
                },
            };
        } );

        // Unique active states, derived from the assignment list.
        const activeStateFips = [ ...new Set( countyFeatures.map( f => f.properties.stateFips ) ) ];

        // Combine every county in each active state (assigned or not) into a
        // single state-shaped polygon so we can draw the state outline.
        const stateOutlines = activeStateFips.map( fips => {
            const stateCounties = layers
                .filter( l => l.feature && l.options._vos_region === fips )
                .map( l => ( {
                    type: 'Feature',
                    geometry: l.feature.geometry,
                    properties: {},
                } ) );

            if ( ! stateCounties.length ) return null;

            try {
                const combined = turf.combine( turf.featureCollection( stateCounties ) );
                return combined.features[0] || null;
            } catch ( _ ) {
                return null;
            }
        } ).filter( Boolean );

        // ---------------------------------------------------------------
        // 2. Project to SVG coordinates (Web Mercator, fit to page)
        // ---------------------------------------------------------------

        // US Letter landscape @ 96 DPI = 1056 x 816 px. We use a vector SVG
        // so the actual DPI is up to the printer — these numbers just fix
        // the aspect ratio.
        const PAGE_W   = 1056;
        const PAGE_H   = 816;
        const TITLE_H  = 32;
        const LEGEND_H = 120;
        const PAD_X    = 24;
        const MAP_H    = PAGE_H - TITLE_H - LEGEND_H;
        const MAP_W    = PAGE_W - PAD_X * 2;

        const allForBbox = turf.featureCollection( [ ...countyFeatures, ...stateOutlines ] );
        const [ minLng, minLat, maxLng, maxLat ] = turf.bbox( allForBbox );

        // Web Mercator Y in degrees (keeping X as degrees so scaling is uniform).
        const mercY = lat => {
            const clamped = Math.max( Math.min( lat, 85.05 ), -85.05 );
            return ( 180 / Math.PI ) * Math.log( Math.tan( Math.PI / 4 + ( clamped * Math.PI / 180 ) / 2 ) );
        };

        const projMinX = minLng;
        const projMaxX = maxLng;
        const projMinY = mercY( minLat );
        const projMaxY = mercY( maxLat );
        const projW    = projMaxX - projMinX;
        const projH    = projMaxY - projMinY;

        const scale   = Math.min( MAP_W / projW, MAP_H / projH );
        const renderW = projW * scale;
        const renderH = projH * scale;
        const offX    = PAD_X + ( MAP_W - renderW ) / 2;
        const offY    = TITLE_H + ( MAP_H - renderH ) / 2;

        const project = ( [ lng, lat ] ) => [
            offX + ( lng - projMinX ) * scale,
            offY + ( projMaxY - mercY( lat ) ) * scale,
        ];

        // ---------------------------------------------------------------
        // 3. Build SVG path strings
        // ---------------------------------------------------------------

        const ringToPath = ring => {
            let d = '';
            for ( let i = 0; i < ring.length; i++ ) {
                const [ x, y ] = project( ring[ i ] );
                d += ( i === 0 ? 'M' : 'L' ) + x.toFixed( 1 ) + ',' + y.toFixed( 1 ) + ' ';
            }
            return d + 'Z';
        };

        const featureToPath = feat => {
            const g = feat.geometry;
            const rings = [];

            if ( g.type === 'Polygon' ) {
                g.coordinates.forEach( r => rings.push( r ) );
            } else if ( g.type === 'MultiPolygon' ) {
                g.coordinates.forEach( poly => poly.forEach( r => rings.push( r ) ) );
            }

            return rings.map( ringToPath ).join( ' ' );
        };

        const xmlEscape = s => String( s ?? '' )
            .replace( /&/g, '&amp;' )
            .replace( /</g, '&lt;' )
            .replace( />/g, '&gt;' )
            .replace( /"/g, '&quot;' )
            .replace( /'/g, '&#39;' );

        // ---------------------------------------------------------------
        // 4. Compose SVG layers (draw order matters)
        // ---------------------------------------------------------------

        const parts = [];

        // State backdrop — light fill so empty counties have visual context.
        stateOutlines.forEach( s => {
            parts.push(
                `<path d="${ featureToPath( s ) }" fill="#f5f5f5" stroke="none"/>`
            );
        } );

        // Branch-colored county fills.
        countyFeatures.forEach( f => {
            const color = branches[ f.properties.branch ]?.color || '#888888';
            parts.push(
                `<path d="${ featureToPath( f ) }" fill="${ color }" fill-opacity="0.55" stroke="${ color }" stroke-width="0.4"/>`
            );
        } );

        // State outlines on top so they sit above the county fills.
        stateOutlines.forEach( s => {
            parts.push(
                `<path d="${ featureToPath( s ) }" fill="none" stroke="#333333" stroke-width="1.25"/>`
            );
        } );

        // Restricted-county red overlay.
        countyFeatures.filter( f => f.properties.restrictions ).forEach( f => {
            parts.push(
                `<path d="${ featureToPath( f ) }" fill="none" stroke="#c00" stroke-width="1" stroke-dasharray="3 2"/>`
            );
        } );

        // County name labels — assigned counties only.
        //
        // Sizing strategy (mirrors how paper atlases handle tight counties):
        //   1. Try fitting the full name on one line at the default font.
        //   2. If it overflows, wrap to two lines — splitting at a space
        //      when possible ("Fond du Lac" → "Fond du" / "Lac") or
        //      hyphenating near the middle for single-word names
        //      ("Menominee" → "Meno-" / "minee").
        //   3. If two lines still don't fit, shrink font down to FONT_MIN.
        //   4. Below that we accept some overflow rather than drop the
        //      label entirely — a readable tiny label still gives the
        //      team a way to identify the county.

        const FONT_DEFAULT = 4.5;
        const FONT_MIN     = 2.8;
        const CHAR_RATIO   = 0.55;   // approx avg char width / font size for sans-serif

        const approxWidth = ( str, fs ) => str.length * fs * CHAR_RATIO;

        // Pick the most balanced two-line split for a given name.
        const wrapName = name => {
            if ( name.includes( ' ' ) ) {
                const words = name.split( ' ' );
                let best = null;
                let bestScore = Infinity;
                for ( let i = 1; i < words.length; i++ ) {
                    const a = words.slice( 0, i ).join( ' ' );
                    const b = words.slice( i ).join( ' ' );
                    const score = Math.max( a.length, b.length );
                    if ( score < bestScore ) { bestScore = score; best = [ a, b ]; }
                }
                return best;
            }
            // Single word — split near the middle, with a trailing hyphen.
            const m = Math.ceil( name.length / 2 );
            return [ name.slice( 0, m ) + '-', name.slice( m ) ];
        };

        // County size in SVG units, derived from its projected bbox.
        const featPxSize = feat => {
            const b = turf.bbox( feat );
            const [ x1, y1 ] = project( [ b[ 0 ], b[ 3 ] ] );
            const [ x2, y2 ] = project( [ b[ 2 ], b[ 1 ] ] );
            return { w: Math.abs( x2 - x1 ), h: Math.abs( y2 - y1 ) };
        };

        countyFeatures.forEach( f => {
            if ( ! f.properties.name ) return;

            let centroid;
            try { centroid = turf.centerOfMass( f ).geometry.coordinates; }
            catch ( _ ) { return; }

            const [ cx, cy ] = project( centroid );
            const { w, h }   = featPxSize( f );
            const name       = f.properties.name;

            // Leave a 10% inner padding so labels don't kiss the border.
            const maxW = w * 0.9;
            const maxH = h * 0.9;

            let lines    = [ name ];
            let fontSize = FONT_DEFAULT;

            if ( approxWidth( name, fontSize ) > maxW ) {
                lines = wrapName( name );

                const longest   = Math.max( ...lines.map( l => l.length ) );
                const wrappedW  = longest * fontSize * CHAR_RATIO;
                const wrappedH  = lines.length * fontSize * 1.05;

                if ( wrappedW > maxW || wrappedH > maxH ) {
                    const shrinkW = maxW / wrappedW;
                    const shrinkH = maxH / wrappedH;
                    fontSize = Math.max( FONT_MIN, fontSize * Math.min( shrinkW, shrinkH, 1 ) );
                }
            }

            const lineH  = fontSize * 1.05;
            const n      = lines.length;
            const tspans = lines.map( ( line, i ) => {
                const y = cy + ( i - ( n - 1 ) / 2 ) * lineH;
                return `<tspan x="${ cx.toFixed( 1 ) }" y="${ y.toFixed( 1 ) }">${ xmlEscape( line ) }</tspan>`;
            } ).join( '' );

            parts.push(
                `<text font-size="${ fontSize.toFixed( 2 ) }" font-family="sans-serif" fill="#000" ` +
                `text-anchor="middle" dominant-baseline="central" ` +
                `style="paint-order:stroke;stroke:#fff;stroke-width:1;stroke-linejoin:round;">` +
                tspans +
                `</text>`
            );
        } );

        // ---------------------------------------------------------------
        // 5. Title + legend
        // ---------------------------------------------------------------

        const title = 'VOS Territory Map — ' + new Date().toLocaleDateString();
        const titleNode =
            `<text x="${ PAGE_W / 2 }" y="22" font-size="16" font-family="sans-serif" ` +
            `font-weight="bold" text-anchor="middle">${ xmlEscape( title ) }</text>`;

        // Only include branches that actually have assignments.
        const usedBranchIds = [ ...new Set( countyFeatures.map( f => f.properties.branch ) ) ];
        const legendItems = usedBranchIds
            .map( id => branches[ id ] )
            .filter( Boolean )
            .sort( ( a, b ) => ( a.label || '' ).localeCompare( b.label || '' ) );

        const LEGEND_COLS  = 4;
        const LEGEND_TOP   = PAGE_H - LEGEND_H + 18;
        const LEGEND_COL_W = ( PAGE_W - PAD_X * 2 ) / LEGEND_COLS;
        const ROW_H        = 18;

        const legendParts = [
            `<text x="${ PAD_X }" y="${ LEGEND_TOP - 8 }" font-size="11" font-family="sans-serif" font-weight="bold">Branches</text>`,
            `<line x1="${ PAD_X }" y1="${ LEGEND_TOP - 4 }" x2="${ PAGE_W - PAD_X }" y2="${ LEGEND_TOP - 4 }" stroke="#999" stroke-width="0.5"/>`,
        ];

        legendItems.forEach( ( b, i ) => {
            const col = i % LEGEND_COLS;
            const row = Math.floor( i / LEGEND_COLS );
            const x   = PAD_X + col * LEGEND_COL_W;
            const y   = LEGEND_TOP + 12 + row * ROW_H;

            legendParts.push(
                `<rect x="${ x }" y="${ y - 9 }" width="12" height="12" ` +
                `fill="${ b.color }" fill-opacity="0.55" stroke="${ b.color }" stroke-width="0.5"/>`
            );
            legendParts.push(
                `<text x="${ x + 18 }" y="${ y }" font-size="9" font-family="sans-serif" ` +
                `dominant-baseline="central">${ xmlEscape( b.label ) }</text>`
            );
        } );

        // ---------------------------------------------------------------
        // 6. Assemble + open print window
        // ---------------------------------------------------------------

        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ PAGE_W } ${ PAGE_H }" ` +
            `preserveAspectRatio="xMidYMid meet">` +
            titleNode +
            parts.join( '' ) +
            legendParts.join( '' ) +
            `</svg>`;

        const html =
            `<!DOCTYPE html><html><head><meta charset="utf-8">` +
            `<title>${ xmlEscape( title ) }</title>` +
            `<style>` +
            `@page { size: letter landscape; margin: 0.3in; }` +
            `html, body { margin: 0; padding: 0; background: #fff; }` +
            `svg { width: 100%; height: auto; display: block; }` +
            `@media screen { body { padding: 1rem; background: #eee; } svg { background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.15); } }` +
            `</style></head><body>` +
            svg +
            `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},250);});</script>` +
            `</body></html>`;

        const win = window.open( '', '_blank' );
        if ( ! win ) {
            window.alert( 'Popup blocked. Allow popups for this site to print the map.' );
            return;
        }
        win.document.open();
        win.document.write( html );
        win.document.close();

    };

    return (
        <Button isPrimary onClick={ handleClick }>
            Print Map
        </Button>
    );

};

export default PrintButton;
