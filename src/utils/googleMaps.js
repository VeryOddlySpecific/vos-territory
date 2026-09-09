/**
 * Google Maps loader + shared map config.
 *
 * The Google Maps JS API is brought in by the inline bootstrap loader that
 * PHP enqueues (VOS_Settings::enqueue_google_maps_loader), which defines
 * google.maps.importLibrary(). Because that inline script and our bundle are
 * both footer scripts, their execution order isn't guaranteed — so rather
 * than depend on script ordering, we poll briefly for importLibrary to
 * appear. This is the load-order safeguard for map init.
 */

/**
 * Waits for the bootstrap loader, then loads a Maps JS library
 * (e.g. 'maps', 'core', 'marker'). Resolves with that library's exports.
 *
 * @param {string} name Library name to import.
 * @return {Promise<Object>} The imported library namespace.
 */
export function importMapsLibrary( name = 'maps' ) {
	return waitForLoader().then( ( importLibrary ) => importLibrary( name ) );
}

function waitForLoader( timeoutMs = 8000 ) {
	return new Promise( ( resolve, reject ) => {
		if ( window.google?.maps?.importLibrary ) {
			resolve( window.google.maps.importLibrary );
			return;
		}

		const start = Date.now();
		const interval = setInterval( () => {
			if ( window.google?.maps?.importLibrary ) {
				clearInterval( interval );
				resolve( window.google.maps.importLibrary );
			} else if ( Date.now() - start > timeoutMs ) {
				clearInterval( interval );
				reject(
					new Error(
						'Google Maps failed to load — check that the API key is set and the Maps JavaScript API is enabled.'
					)
				);
			}
		}, 50 );
	} );
}

/**
 * Continental-US viewport bounds (mirrors the former Leaflet maxBounds).
 * Used to restrict panning and as a default fit target.
 */
export const US_BOUNDS = {
	north: 49.384,
	south: 24.396,
	east: -66.885,
	west: -124.848,
};

/**
 * Minimal, desaturated basemap styling approximating the MapTiler "dataviz"
 * look we used under Leaflet: light gray land, muted water, and the road /
 * POI / transit clutter stripped so the county overlay reads clearly. We use
 * an inline styles[] array (no Cloud mapId) so the look is version-controlled.
 */
export const MAP_STYLES = [
	{ elementType: 'geometry', stylers: [ { color: '#f5f5f5' } ] },
	{ elementType: 'labels.icon', stylers: [ { visibility: 'off' } ] },
	{ elementType: 'labels.text.fill', stylers: [ { color: '#616161' } ] },
	{ elementType: 'labels.text.stroke', stylers: [ { color: '#f5f5f5' } ] },
	{ featureType: 'administrative', elementType: 'geometry', stylers: [ { visibility: 'off' } ] },
	{ featureType: 'administrative.land_parcel', stylers: [ { visibility: 'off' } ] },
	{ featureType: 'administrative.neighborhood', stylers: [ { visibility: 'off' } ] },
	{ featureType: 'poi', stylers: [ { visibility: 'off' } ] },
	{ featureType: 'road', elementType: 'geometry', stylers: [ { color: '#ffffff' } ] },
	{ featureType: 'road', elementType: 'labels', stylers: [ { visibility: 'off' } ] },
	{ featureType: 'transit', stylers: [ { visibility: 'off' } ] },
	{ featureType: 'water', elementType: 'geometry', stylers: [ { color: '#c9e3ec' } ] },
	{ featureType: 'water', elementType: 'labels.text.fill', stylers: [ { color: '#9e9e9e' } ] },
];
