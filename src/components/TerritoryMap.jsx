import {
    useEffect,
    useContext,
} from '@wordpress/element';

import { MapContext } from './MapContext';
import CountySearch from './CountySearch';

const TerritoryMap = () => {

    const { mapRef, isLoading } = useContext(MapContext);

    useEffect(() => {

        // Guard against a double-init (effect re-run / fast remount).
        if (mapRef.current) {
            return;
        }

        // Created synchronously so sibling effects that run after this one
        // (MapProcessor's tile layer and county overlays) find the map ready.
        // MapProcessor adds the MapTiler basemap.
        mapRef.current = L.map('vos-map', {
            center: [39.8283, -98.5795],
            zoom: 4,
            // Minimal chrome — navigation is driven by search/legend/gestures.
            zoomControl: false,
            // Keep panning within the continental US.
            maxBounds: [
                [49.3849, -66.8859],
                [24.3963, -124.8489],
            ],
        });

    }, []);

    return (
        <div style={{ position: 'relative' }}>
            { isLoading && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.75)',
                }}>
                    <span>Loading map data…</span>
                </div>
            )}
            <div id="vos-map" style={{ height: '750px' }}></div>
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 1000,
                width: '280px',
            }}>
                <CountySearch />
            </div>
        </div>
    );
};

export default TerritoryMap;
