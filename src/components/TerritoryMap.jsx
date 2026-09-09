import {
    useEffect,
    useContext,
} from '@wordpress/element';

import { MapContext } from './MapContext';
import CountySearch from './CountySearch';
import { importMapsLibrary, US_BOUNDS, MAP_STYLES } from '../utils/googleMaps';

const TerritoryMap = () => {

    const { mapRef, isLoading } = useContext(MapContext);

    useEffect(() => {

        let cancelled = false;

        importMapsLibrary('maps')
            .then(({ Map }) => {
                // Guard against a double-init (effect re-run / fast remount).
                if (cancelled || mapRef.current) {
                    return;
                }

                mapRef.current = new Map(document.getElementById('vos-map'), {
                    center: { lat: 39.8283, lng: -98.5795 },
                    zoom: 4,
                    // Minimal chrome, matching the old Leaflet (zoomControl:false)
                    // map — navigation is driven by search/legend/gestures.
                    disableDefaultUI: true,
                    // Keep panning within the continental US, like the former
                    // Leaflet maxBounds (loose so edge counties stay reachable).
                    restriction: {
                        latLngBounds: US_BOUNDS,
                        strictBounds: false,
                    },
                    styles: MAP_STYLES,
                });
            })
            .catch((err) => {
                // eslint-disable-next-line no-console
                console.error('VOS Territory Map:', err.message);
            });

        return () => {
            cancelled = true;
        };

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
