import {
    useContext,
    useState,
    useRef,
    useEffect,
} from '@wordpress/element';

import { MapContext } from './MapContext';
import fipsData from '../assets/fips.json';

// Build a fast FIPS → { name, abbr } lookup from the existing fips.json asset.
const fipsToState = {};
fipsData.forEach( s => { fipsToState[ s.fips ] = s; } );

const MIN_CHARS  = 2;   // don't search until the user has typed this many chars
const MAX_RESULTS = 15; // cap the dropdown so it stays manageable

const CountySearch = () => {

    const { mapRef, countyLayersRef } = useContext( MapContext );

    const [ query, setQuery ]               = useState( '' );
    const [ results, setResults ]           = useState( [] );
    const [ isOpen, setIsOpen ]             = useState( false );
    const [ highlightedIdx, setHighlightedIdx ] = useState( -1 );

    const containerRef = useRef();
    const inputRef     = useRef();

    // Close the dropdown when the user clicks outside the component.
    useEffect( () => {
        const handleOutsideClick = ( e ) => {
            if ( containerRef.current && ! containerRef.current.contains( e.target ) ) {
                setIsOpen( false );
            }
        };
        document.addEventListener( 'mousedown', handleOutsideClick );
        return () => document.removeEventListener( 'mousedown', handleOutsideClick );
    }, [] );

    const handleChange = ( e ) => {
        const val = e.target.value;
        setQuery( val );

        if ( val.length < MIN_CHARS ) {
            setResults( [] );
            setIsOpen( false );
            return;
        }

        const lower = val.toLowerCase();

        const matches = countyLayersRef.current
            .filter( layer => layer.options._vos_sr_name?.toLowerCase().includes( lower ) )
            .map( layer => {
                const fips  = layer.options._vos_region;
                const state = fipsToState[ fips ] ?? { name: fips, abbr: fips };
                return {
                    layer,
                    name:      layer.options._vos_sr_name,
                    stateName: state.name,
                    stateAbbr: state.abbr,
                };
            } )
            // Sort: exact prefix matches first, then alphabetically by state.
            .sort( ( a, b ) => {
                const aStarts = a.name.toLowerCase().startsWith( lower );
                const bStarts = b.name.toLowerCase().startsWith( lower );
                if ( aStarts !== bStarts ) return aStarts ? -1 : 1;
                return a.stateName.localeCompare( b.stateName );
            } )
            .slice( 0, MAX_RESULTS );

        setResults( matches );
        setIsOpen( matches.length > 0 );
        setHighlightedIdx( -1 );
    };

    const handleSelect = ( item ) => {
        const bounds  = item.layer.getBounds();
        const padding = [ 60, 60 ];
        // Zoom one level less than the tightest fit so the county doesn't
        // fill the entire viewport — keeps a little surrounding context.
        const fitZoom = mapRef.current.getBoundsZoom( bounds, false, padding );
        mapRef.current.flyToBounds( bounds, {
            padding,
            maxZoom: Math.max( fitZoom - 1, 0 ),
        } );
        setQuery( `${ item.name } County, ${ item.stateAbbr }` );
        setIsOpen( false );
        setResults( [] );
    };

    const handleKeyDown = ( e ) => {
        if ( ! isOpen ) return;

        if ( e.key === 'ArrowDown' ) {
            e.preventDefault();
            setHighlightedIdx( i => Math.min( i + 1, results.length - 1 ) );
        } else if ( e.key === 'ArrowUp' ) {
            e.preventDefault();
            setHighlightedIdx( i => Math.max( i - 1, 0 ) );
        } else if ( e.key === 'Enter' && highlightedIdx >= 0 ) {
            e.preventDefault();
            handleSelect( results[ highlightedIdx ] );
        } else if ( e.key === 'Escape' ) {
            setIsOpen( false );
            inputRef.current?.blur();
        }
    };

    const handleClear = () => {
        setQuery( '' );
        setResults( [] );
        setIsOpen( false );
        inputRef.current?.focus();
    };

    return (
        <div
            ref={ containerRef }
            style={ { position: 'relative', marginBottom: '0.75rem' } }
        >
            <div style={ { position: 'relative' } }>
                <input
                    ref={ inputRef }
                    type="text"
                    value={ query }
                    onChange={ handleChange }
                    onKeyDown={ handleKeyDown }
                    onFocus={ () => results.length && setIsOpen( true ) }
                    placeholder="Search counties…"
                    aria-label="Search for a county"
                    aria-autocomplete="list"
                    aria-expanded={ isOpen }
                    style={ {
                        width: '100%',
                        padding: '6px 28px 6px 10px',
                        fontSize: '13px',
                        border: '1px solid #949494',
                        borderRadius: isOpen ? '3px 3px 0 0' : '3px',
                        boxSizing: 'border-box',
                        outline: 'none',
                    } }
                />
                { query && (
                    <button
                        onClick={ handleClear }
                        aria-label="Clear search"
                        style={ {
                            position: 'absolute',
                            right: '6px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#757575',
                            fontSize: '16px',
                            lineHeight: 1,
                            padding: '0 2px',
                        } }
                    >×</button>
                ) }
            </div>

            { isOpen && (
                <ul
                    role="listbox"
                    style={ {
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        background: '#fff',
                        border: '1px solid #949494',
                        borderTop: 'none',
                        borderRadius: '0 0 3px 3px',
                        margin: 0,
                        padding: 0,
                        listStyle: 'none',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        boxShadow: '0 4px 10px rgba(0,0,0,.12)',
                    } }
                >
                    { results.map( ( item, i ) => (
                        <li
                            key={ item.layer._leaflet_id ?? i }
                            role="option"
                            aria-selected={ i === highlightedIdx }
                            // Use onMouseDown (not onClick) so the dropdown doesn't
                            // close from the input's blur event before the click fires.
                            onMouseDown={ () => handleSelect( item ) }
                            onMouseEnter={ () => setHighlightedIdx( i ) }
                            style={ {
                                padding: '7px 10px',
                                cursor: 'pointer',
                                background: i === highlightedIdx ? '#e8f0fe' : 'transparent',
                                fontSize: '13px',
                                borderBottom: '1px solid #f0f0f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            } }
                        >
                            <span>
                                <strong>{ item.name } County</strong>
                            </span>
                            <span style={ { color: '#646970', fontSize: '12px' } }>
                                { item.stateName }
                            </span>
                        </li>
                    ) ) }
                </ul>
            ) }
        </div>
    );

};

export default CountySearch;
