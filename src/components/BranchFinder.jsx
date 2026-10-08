import { useState, useMemo } from '@wordpress/element';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

import { safeUrl } from '../utils/sanitize';

/**
 * Branch Finder
 *
 * User enters an address → server-side /vos/v1/geocode resolves it via
 * MapTiler → we fetch the matching state's county GeoJSON, run a point-in-
 * polygon against each county, then look up the assigned branch from the
 * pre-localized `subregions` option.
 *
 * Fallback path: if the geocoder can't resolve the address, or the matched
 * county isn't assigned to a branch, we compute Haversine distance from the
 * geocoded point to each branch's stored coordinates and pick the nearest.
 * A restrictions flag on the subregion is surfaced to the user so the UI
 * can warn about non-standard service.
 */

// --- helpers ----------------------------------------------------------------

// Haversine great-circle distance in miles. Good enough for "nearest branch"
// ranking — we don't need driving distance here.
const MILES_PER_RAD = 3958.8;
const toRad = d => ( d * Math.PI ) / 180;

const haversineMiles = ( a, b ) => {
    const dLat = toRad( b.lat - a.lat );
    const dLng = toRad( b.lng - a.lng );
    const lat1 = toRad( a.lat );
    const lat2 = toRad( b.lat );

    const h =
        Math.sin( dLat / 2 ) ** 2 +
        Math.cos( lat1 ) * Math.cos( lat2 ) * Math.sin( dLng / 2 ) ** 2;
    return 2 * MILES_PER_RAD * Math.asin( Math.min( 1, Math.sqrt( h ) ) );
};

// Normalize whatever the option-stored subregions value is into an array.
// wp_localize_script sometimes passes this as a JSON-encoded string.
const parseSubregions = raw => {
    if ( Array.isArray( raw ) ) return raw;
    if ( typeof raw === 'string' ) {
        try { return JSON.parse( raw ) ?? []; } catch ( _ ) { return []; }
    }
    return [];
};

// --- component --------------------------------------------------------------

const BranchFinder = () => {

    const [ address, setAddress ] = useState( '' );
    const [ status, setStatus ]   = useState( 'idle' ); // idle|loading|success|error
    const [ result, setResult ]   = useState( null );
    const [ error, setError ]     = useState( null );

    // subregions lookup: GEOID → { branch, restrictions, restrictionDetails }
    const subregionsByGeoid = useMemo( () => {
        const map = {};
        for ( const sr of parseSubregions( vosTm.subregions ) ) {
            if ( sr && sr.geoid ) map[ String( sr.geoid ) ] = sr;
        }
        return map;
    }, [] );

    const branches = vosTm.branches || {};

    const findNearestBranch = ( lat, lng ) => {
        let best = null;
        for ( const id of Object.keys( branches ) ) {
            const b = branches[ id ];
            if ( ! b?.coordinates ) continue;
            const { lat: bLat, lng: bLng } = b.coordinates;
            if ( typeof bLat !== 'number' || typeof bLng !== 'number' ) continue;

            const d = haversineMiles( { lat, lng }, { lat: bLat, lng: bLng } );
            if ( ! best || d < best.distance ) {
                best = { branch: b, distance: d };
            }
        }
        return best;
    };

    const handleSubmit = async ( e ) => {
        e.preventDefault();
        const trimmed = address.trim();
        if ( ! trimmed ) return;

        setStatus( 'loading' );
        setError( null );
        setResult( null );

        try {
            // 1. Geocode via our server (keeps the MapTiler key off the client).
            const geoRes = await fetch(
                `${ vosTm.apiBase }/geocode?address=${ encodeURIComponent( trimmed ) }`,
                { headers: { 'X-WP-Nonce': vosTm.nonce || '' } }
            );
            const geo = await geoRes.json();
            if ( ! geoRes.ok ) {
                throw new Error( geo?.message || 'Could not locate that address.' );
            }

            const { lat, lng, state_fips, address: placeName, zip } = geo;
            const pt = point( [ lng, lat ] );

            // 2. If we have a state FIPS, try point-in-polygon against its counties.
            let matchedGeoid = null;
            if ( state_fips ) {
                const gjRes = await fetch( `${ vosTm.statesUrl }${ state_fips }.geojson` );
                if ( gjRes.ok ) {
                    const gj = await gjRes.json();
                    for ( const feature of ( gj.features || [] ) ) {
                        try {
                            if ( booleanPointInPolygon( pt, feature ) ) {
                                matchedGeoid =
                                    feature?.properties?.GEOID ??
                                    feature?.properties?.geoid ??
                                    null;
                                break;
                            }
                        } catch ( _ ) { /* skip malformed features */ }
                    }
                }
            }

            // 3. Resolve to a branch. Prefer the county's assigned branch; fall back
            //    to the geographically nearest branch when unassigned / unmatched.
            const sr = matchedGeoid ? subregionsByGeoid[ matchedGeoid ] : null;
            let branch = sr ? branches[ String( sr.branch ) ] : null;
            let distance = null;
            let fallback = false;

            if ( ! branch ) {
                const nearest = findNearestBranch( lat, lng );
                if ( nearest ) {
                    branch   = nearest.branch;
                    distance = nearest.distance;
                    fallback = true;
                }
            } else if ( branch.coordinates?.lat && branch.coordinates?.lng ) {
                distance = haversineMiles(
                    { lat, lng },
                    { lat: branch.coordinates.lat, lng: branch.coordinates.lng }
                );
            }

            if ( ! branch ) {
                setStatus( 'error' );
                setError( 'No branches are configured yet.' );
                return;
            }

            setResult( {
                branch,
                distance,
                fallback,
                restrictions:        sr?.restrictions ?? false,
                restrictionDetails:  sr?.restrictionDetails ?? null,
                placeName,
                zip,
            } );
            setStatus( 'success' );

        } catch ( err ) {
            setStatus( 'error' );
            setError( err.message || 'Something went wrong.' );
        }
    };

    return (
        <div style={ { maxWidth: '520px' } }>
            <form onSubmit={ handleSubmit } style={ { display: 'flex', gap: '0.5rem' } }>
                <input
                    type="text"
                    value={ address }
                    onChange={ e => setAddress( e.target.value ) }
                    placeholder="Enter an address, city, or ZIP"
                    aria-label="Address"
                    style={ {
                        flex: 1,
                        padding: '0.6rem 0.75rem',
                        fontSize: '1rem',
                        border: '1px solid #949494',
                        borderRadius: '3px',
                    } }
                />
                <button
                    type="submit"
                    disabled={ status === 'loading' || ! address.trim() }
                    style={ {
                        padding: '0.6rem 1rem',
                        fontSize: '1rem',
                        border: 'none',
                        borderRadius: '3px',
                        background: '#0a1944',
                        color: '#fff',
                        cursor: 'pointer',
                        opacity: status === 'loading' ? 0.6 : 1,
                    } }
                >
                    { status === 'loading' ? 'Searching…' : 'Find Branch' }
                </button>
            </form>

            { status === 'error' && (
                <p style={ { marginTop: '1rem', color: '#b32d2e' } }>{ error }</p>
            ) }

            { status === 'success' && result && (
                <div
                    style={ {
                        marginTop: '1rem',
                        padding: '1rem',
                        border: `2px solid ${ result.branch.color || '#0a1944' }`,
                        borderRadius: '4px',
                        background: '#fff',
                    } }
                >
                    <div style={ { fontSize: '0.8rem', color: '#646970', marginBottom: '0.25rem' } }>
                        Matched: { result.placeName }
                    </div>
                    <h3 style={ { margin: '0 0 0.25rem 0', color: result.branch.color || '#0a1944' } }>
                        { result.branch.label }
                    </h3>

                    { result.distance !== null && (
                        <div style={ { fontSize: '0.9rem', color: '#646970' } }>
                            { result.distance.toFixed( 1 ) } miles away
                        </div>
                    ) }

                    { result.fallback && (
                        <div style={ { marginTop: '0.5rem', fontSize: '0.85rem', color: '#8a6d3b' } }>
                            This location isn't inside a defined service area — showing
                            the nearest branch.
                        </div>
                    ) }

                    { result.restrictions && (
                        <div
                            style={ {
                                marginTop: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                background: '#fff4e5',
                                border: '1px solid #f0b849',
                                borderRadius: '3px',
                                fontSize: '0.85rem',
                            } }
                        >
                            <strong>Service restrictions apply.</strong>
                            { result.restrictionDetails && (
                                <div style={ { marginTop: '0.25rem' } }>
                                    { result.restrictionDetails }
                                </div>
                            ) }
                        </div>
                    ) }

                    { safeUrl( result.branch.url ) && (
                        <p style={ { marginTop: '0.75rem', marginBottom: 0 } }>
                            <a href={ safeUrl( result.branch.url ) }>Visit branch site →</a>
                        </p>
                    ) }
                </div>
            ) }
        </div>
    );
};

export default BranchFinder;
