import { MapContext } from "./MapContext";

import {
    useEffect,
    useState,
    useContext,
    useRef,
} from "@wordpress/element"

import { branchStyle, branchActiveStyle } from "../utils/branchStyles";
import * as turf from "@turf/turf";

/**
 * Returns the LatLng to anchor a county tooltip at.
 *
 * For MultiPolygon features, picks the largest polygon by area so the
 * tooltip lands on the main body of the county rather than on Leaflet's
 * default bounds-center — which can fall between a mainland and a distant
 * island, or in open water between fragments.
 *
 * For Polygon features, returns the center of mass, which is a better
 * anchor than the bounding-box center for concave shapes.
 */
const getTooltipAnchor = (feature) => {
    let target = feature;

    if (feature.geometry.type === 'MultiPolygon') {
        let largestCoords = null;
        let largestArea  = -Infinity;

        feature.geometry.coordinates.forEach((polygonCoords) => {
            const polygon = turf.polygon(polygonCoords);
            const area    = turf.area(polygon);
            if (area > largestArea) {
                largestArea   = area;
                largestCoords = polygonCoords;
            }
        });

        if (largestCoords) {
            target = turf.polygon(largestCoords);
        }
    }

    const center = turf.centerOfMass(target);
    const [lng, lat] = center.geometry.coordinates;
    return L.latLng(lat, lng);
};

// County style when a county is not assigned in the active view mode.
const UNASSIGNED_STYLE = {
    color: '#0a1944',
    weight: 1,
    opacity: .25,
    fillColor: '#fff',
    fillOpacity: 0.25,
};

// County style for an unassigned county that is part of the active click-selection.
const UNASSIGNED_SELECTED_STYLE = {
    color: '#0a1944',
    weight: 2,
    opacity: 1,
    fillColor: '#fff',
    fillOpacity: 0.95,
};

const MapProcessor = () => {
    const importedSubregions = [];
    const importedRegions = [];

    if (vosTm.subregions && vosTm.subregions.length > 0) {
        const adminSubregionsData = JSON.parse(vosTm.subregions);
        adminSubregionsData.forEach(subregion => {
            importedSubregions.push(subregion);
        });
    }

    if (vosTm.regions) {
        const adminRegionsData = JSON.parse(vosTm.regions);
        adminRegionsData.forEach(region => {
            importedRegions.push(region);
        });
    }

    // Playground county assignments (parallel to importedSubregions). A county
    // can appear in both — the two layers are kept independent.
    const importedPlaygroundSubregions = [];
    if (vosTm.playgroundSubregions && vosTm.playgroundSubregions.length > 0) {
        const adminPlaygroundData = JSON.parse(vosTm.playgroundSubregions);
        adminPlaygroundData.forEach(subregion => {
            importedPlaygroundSubregions.push(subregion);
        });
    }

    const {
        mapRef,
        countyLayersRef,
        branches,
        playgrounds,
        viewMode,
        activeRegions,
        setActiveRegions,
        activeSubregions,
        setActiveSubregions,
        activeSelection,
        setActiveSelection,
        activePlaygroundSubregions,
        setActivePlaygroundSubregions,
        activePlaygroundSelection,
        setActivePlaygroundSelection,
        toggledRegion,
        legendKeyClicked,
        setLegendKeyClicked,
        setIsLoading,
    } = useContext(MapContext);

    const [ mapLayers, setMapLayers ] = useState([]);
    const [ subregion, setSubregion ] = useState(null);
    const [ isClicked, setIsClicked ] = useState(false);

    // Single Leaflet tooltip instance reused for every hover. Replaces the
    // old model of pre-binding a tooltip to each of ~3000 counties.
    const hoverTooltipRef  = useRef(null);
    // Tracks which county layers currently have a permanent tooltip bound
    // (only those intersecting the viewport while zoomed past the threshold).
    const permanentBoundRef = useRef(new Set());
    // Zoom threshold above which we switch from on-hover labeling to
    // permanent viewport-scoped labels.
    const TOOLTIP_ZOOM_THRESHOLD = 7;

    // Always-current view mode for closures/handlers that outlive the render
    // that created them (region rendering, layer event callbacks).
    const viewModeRef = useRef(viewMode);
    useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

    /**
     * Styles a county layer for the given view mode: its assigned entity's color
     * (red outline if that county is restricted in this mode), or the neutral
     * unassigned style. Used for the initial paint and on every view-mode flip.
     */
    const styleLayerForMode = (layer, mode) => {
        const isPg     = mode === 'playgrounds';
        const id       = isPg ? layer.playground : layer.branch;
        const entities = isPg ? playgrounds : branches;

        if (id) {
            layer.setStyle(branchStyle(entities[id]?.color));
            const restricted = isPg ? layer.options.playgroundRestrictions : layer.options.restrictions;
            if (restricted) layer.setStyle({ color: '#f00' });
        } else {
            layer.setStyle(UNASSIGNED_STYLE);
        }
    };

    /**
     * Returns the direct static URL for a state's GeoJSON file.
     * Bypasses the PHP REST endpoint entirely — static files are served
     * directly by the web server, get proper browser caching, and skip
     * the WordPress bootstrap overhead on every request.
     */
    const stateUrl = (rFips) => vosTm.statesUrl + rFips + '.geojson';

    /**
     * Fetches GeoJSON for a single state and renders it onto the map.
     * Used when the user manually toggles a state on after initial load.
     */
    const handleRegionData = async (rFips) => {
        try {
            const response = await fetch(stateUrl(rFips));
            const data = await response.json();
            renderRegionData(data, rFips);
        } catch (error) {
            console.error('Error loading state ' + rFips + ':', error);
        }
    }

    /**
     * Renders a state's GeoJSON onto the map. Separated from the fetch so
     * initData can fetch all states in parallel then render them all at once,
     * eliminating the sequential pop-in effect.
     */
    const renderRegionData = (data, rFips) => {
        const combined             = turf.combine(data);
        const maskPolygon          = turf.mask(combined, null);
        const maskPolygonCoords    = maskPolygon.geometry.coordinates[1];
        const interiorMaskPolygon  = turf.polygon([maskPolygonCoords]);

        const regionShapeLayer = L.geoJson(interiorMaskPolygon, {
            style: {
                color: '#0a1944',
                weight: 2,
                opacity: 1,
                fillColor: 'transparent',
                fillOpacity: 0,
            },
            _vos_id: 'shape-' + rFips
        });
        regionShapeLayer.addTo(mapRef.current);

        setActiveRegions((prev) => [...prev, rFips]);

        const subregionsLayer = L.geoJson(data, {
            onEachFeature: (feature, layer) => {
                const fGeoid = feature.properties.GEOID;

                // Branch assignment for this county (if any).
                const branchSr = importedSubregions.find(sr => Number(sr.geoid) === Number(fGeoid));
                if (branchSr) {
                    layer.branch = branchSr.branch;
                    if (branchSr.restrictions) {
                        layer.options.restrictions       = branchSr.restrictions;
                        layer.options.restrictionDetails = branchSr.restrictionDetails;
                    }
                    setActiveSubregions((prev) => [...prev, layer]);
                }

                // Playground assignment (independent of branch — a county can
                // belong to both). Restriction state lives in separate slots so
                // the two layers never clobber each other.
                const playgroundSr = importedPlaygroundSubregions.find(sr => Number(sr.geoid) === Number(fGeoid));
                if (playgroundSr) {
                    layer.playground = playgroundSr.playground;
                    if (playgroundSr.restrictions) {
                        layer.options.playgroundRestrictions       = playgroundSr.restrictions;
                        layer.options.playgroundRestrictionDetails = playgroundSr.restrictionDetails;
                    }
                    setActivePlaygroundSubregions((prev) => [...prev, layer]);
                }

                // Initial paint for whichever layer is currently shown.
                styleLayerForMode(layer, viewModeRef.current);

                layer.options._vos_sr_name = feature.properties.Name;
                layer.options._vos_region  = rFips;

                // Anchor the tooltip on the largest polygon for MultiPolygon
                // counties so the label lands on the main body rather than on
                // a distant island or in open water between fragments. Stashed
                // on layer.options for the hover handler, and assigned to
                // layer.getCenter so the permanent bindTooltip (which reads
                // getCenter for its position) uses the same point.
                const tooltipAnchor = getTooltipAnchor(feature);
                layer.options._vos_tooltipAnchor = tooltipAnchor;
                layer.getCenter = () => tooltipAnchor;

                // Show a label on hover *only* when zoomed out. When zoomed
                // past the threshold, the viewport-scoped permanent tooltips
                // already display the county names, so hover would just be
                // visual noise.
                layer.on('mouseover', () => {
                    if ( mapRef.current.getZoom() > TOOLTIP_ZOOM_THRESHOLD ) return;
                    if ( ! hoverTooltipRef.current ) return;
                    hoverTooltipRef.current
                        .setLatLng( layer.options._vos_tooltipAnchor )
                        .setContent( layer.options._vos_sr_name + ' County' )
                        .openOn( mapRef.current );
                });
                layer.on('mouseout', () => {
                    if ( ! hoverTooltipRef.current ) return;
                    mapRef.current.closeTooltip( hoverTooltipRef.current );
                });

                layer.on('click', (e) => {
                    setSubregion(e.target);
                    setIsClicked(true);
                });

                countyLayersRef.current.push(layer);
            },
            _vos_id: 'subregions-' + rFips,
        });
        subregionsLayer.addTo(mapRef.current);

        setMapLayers((prev) => [...prev, regionShapeLayer, subregionsLayer]);
    }

    /**
     * Fetches all saved regions in parallel, then renders them all at once.
     * This replaces the old forEach approach where each state would pop in
     * individually as its request completed.
     */
    const initData = async () => {
        if (!importedRegions.length) return;

        setIsLoading(true);
        try {
            const results = await Promise.all(
                importedRegions.map(rFips =>
                    fetch(stateUrl(rFips))
                        .then(r => r.json())
                        .then(data => ({ data, rFips }))
                )
            );
            results.forEach(({ data, rFips }) => renderRegionData(data, rFips));
        } catch (error) {
            console.error('Error loading regions:', error);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        // Key comes from the admin Settings page and is injected via
        // wp_localize_script. If it's missing the tile layer request will
        // 403 — log a warning so the missing-config cause is obvious.
        const maptilerKey = vosTm.maptilerKey || '';
        if ( ! maptilerKey ) {
            console.warn( 'VOS Territory Map: MapTiler key is not configured. Set it in the plugin settings.' );
        }

        L.tileLayer(`https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=${ maptilerKey }`, {
            attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
            maxZoom: 19,
        }).addTo(mapRef.current);

        // Single shared tooltip used for every hover. Reused across all
        // counties so we keep at most one tooltip DOM node alive for hover.
        hoverTooltipRef.current = L.tooltip({ direction: 'center', sticky: false });

        // Hide the vector overlay (canvas with the county polygons) during
        // the zoom animation. Leaflet CSS-scales the canvas while animating,
        // which smears our thin strokes into blurry thick lines until the
        // redraw at zoomend. Hiding the pane and restoring it when the new
        // frame is ready avoids the visual artifact entirely.
        const overlayPane = mapRef.current.getPane('overlayPane');

        // Bind/unbind permanent tooltips so only counties currently in the
        // viewport carry one. Called on zoomend and moveend. Idempotent.
        const syncPermanentTooltips = () => {
            const zoom  = mapRef.current.getZoom();
            const bound = permanentBoundRef.current;

            // Below the threshold: no permanent tooltips. Tear down whatever
            // is still bound and exit — hover handlers will cover labels.
            if ( zoom <= TOOLTIP_ZOOM_THRESHOLD ) {
                bound.forEach( layer => layer.unbindTooltip() );
                bound.clear();
                return;
            }

            const visible = mapRef.current.getBounds();

            countyLayersRef.current.forEach( layer => {
                const inView = visible.intersects( layer.getBounds() );
                if ( inView && ! bound.has( layer ) ) {
                    layer.bindTooltip(
                        layer.options._vos_sr_name + ' County',
                        { permanent: true, direction: 'center' }
                    );
                    bound.add( layer );
                } else if ( ! inView && bound.has( layer ) ) {
                    layer.unbindTooltip();
                    bound.delete( layer );
                }
            });

            // Drop any stale entries (layers that were removed entirely, e.g.
            // when a region is toggled off) so the set doesn't grow unbounded.
            const currentLayers = new Set( countyLayersRef.current );
            bound.forEach( layer => {
                if ( ! currentLayers.has( layer ) ) bound.delete( layer );
            });
        };

        const onZoomStart = () => {
            // Temporarily disabled to see how the zoom transition looks with
            // the county shapes visible throughout (CSS-scaled by Leaflet).
            // Re-enable if the blurry/thick-lines artifact reappears.
            // if ( overlayPane ) overlayPane.style.visibility = 'hidden';
            // Close any hover tooltip that might be open mid-interaction;
            // the canvas is about to disappear anyway.
            if ( hoverTooltipRef.current ) {
                mapRef.current.closeTooltip( hoverTooltipRef.current );
            }
        };

        const onZoomEnd = () => {
            // Paired with the onZoomStart hide; disabled alongside it.
            // if ( overlayPane ) overlayPane.style.visibility = '';
            syncPermanentTooltips();
        };

        const onMoveEnd = () => {
            // Only matters while we're in the permanent-label zoom band.
            // zoomend already triggers moveend, so calling here keeps
            // viewport-driven binding in sync as the user pans.
            if ( mapRef.current.getZoom() > TOOLTIP_ZOOM_THRESHOLD ) {
                syncPermanentTooltips();
            }
        };

        mapRef.current.on('zoomstart', onZoomStart);
        mapRef.current.on('zoomend', onZoomEnd);
        mapRef.current.on('moveend', onMoveEnd);

        initData();

        return () => {
            mapRef.current.off('zoomstart', onZoomStart);
            mapRef.current.off('zoomend', onZoomEnd);
            mapRef.current.off('moveend', onMoveEnd);
        };
    }, []);

    // Recolor every loaded county when the view mode flips, and clear any
    // selection carried over from the other mode so highlights don't linger.
    useEffect(() => {
        countyLayersRef.current.forEach((layer) => styleLayerForMode(layer, viewMode));
        setActiveSelection([]);
        setActivePlaygroundSelection([]);
    }, [viewMode]);

    useEffect(() => {
        if (subregion && isClicked) {
            const isPg         = viewModeRef.current === 'playgrounds';
            const key          = isPg ? 'playground' : 'branch';
            const entities     = isPg ? playgrounds : branches;
            const selection    = isPg ? activePlaygroundSelection : activeSelection;
            const setSelection = isPg ? setActivePlaygroundSelection : setActiveSelection;

            const fEntity            = subregion[key];
            const layerIsInSelection = selection.includes(subregion);

            if (!layerIsInSelection) {
                if (fEntity) {
                    subregion.setStyle(branchActiveStyle(entities[fEntity]?.color));
                } else {
                    subregion.setStyle(UNASSIGNED_SELECTED_STYLE);
                }
                setSelection([...selection, subregion]);
            } else {
                if (fEntity) {
                    subregion.setStyle(branchStyle(entities[fEntity]?.color));
                } else {
                    subregion.setStyle(UNASSIGNED_STYLE);
                }
                setSelection(selection.filter(item => item !== subregion));
            }

            setIsClicked(false);
        }
    }, [subregion, isClicked]);

    /**
     * useEffect runs on a change in toggledRegion
     * toggledRegion will contain the region code and a boolean value of its active state
     * if the region is active, it will call handleRegionData with the apiRoute and region code
     * if the region is not active, it will:
     *      remove the region shape layer from the map
     *      remove the subregions layers from the map
     *      remove the region code from the activeRegions array
     */
    useEffect(() => {
        if (toggledRegion) {
            if (toggledRegion.active) {
                handleRegionData(toggledRegion.fips);
            } else if (activeRegions.includes(toggledRegion.fips)) {
                const shapeLayer = mapLayers.find(layer => layer.options._vos_id === 'shape-' + toggledRegion.fips);
                const subregionsLayers = mapLayers.filter(layer => layer.options._vos_id === 'subregions-' + toggledRegion.fips);
                mapRef.current.removeLayer(shapeLayer);
                subregionsLayers.forEach(layer => {
                    mapRef.current.removeLayer(layer);
                });
                // Remove this region's county layers from the ref so the zoom
                // listener no longer tries to update their tooltips.
                countyLayersRef.current = countyLayersRef.current.filter(
                    layer => layer.options._vos_region !== toggledRegion.fips
                );
                setActiveRegions(activeRegions.filter(region => region !== toggledRegion.fips));
            }
        }
    }, [toggledRegion])

    /**
     * runs on a change in activeSubregions or legendKeyClicked
     * checks if a legend key was clicked and if there are active subregions
     * if there are active subregions, it will:
     *     loop through the active subregions
     *     if the subregion has a branch and the branch matches the legend key clicked, set the subregion style to the active style
     *     if the subregion has a branch and the branch does not match the legend key clicked, set the subregion style to the default style
     *     if the subregion has no branch, set the subregion style to the default style
     */
    useEffect(() => {

        const isPg         = viewModeRef.current === 'playgrounds';
        const key          = isPg ? 'playground' : 'branch';
        const entities     = isPg ? playgrounds : branches;
        const activeSet    = isPg ? activePlaygroundSubregions : activeSubregions;
        const selection    = isPg ? activePlaygroundSelection : activeSelection;
        const setSelection = isPg ? setActivePlaygroundSelection : setActiveSelection;

        if (legendKeyClicked && activeSet.length) {
            const matched = [];
            activeSet.forEach(subregion => {
                if (subregion[key] && subregion[key] === legendKeyClicked) {
                    subregion.setStyle(branchActiveStyle(entities[subregion[key]]?.color));
                    matched.push(subregion);
                } else if (subregion[key]) {
                    subregion.setStyle(branchStyle(entities[subregion[key]]?.color));
                } else {
                    subregion.setStyle(UNASSIGNED_STYLE);
                }
            })
            selection.forEach(subregion => {
                if (!matched.includes(subregion)) {
                    if (subregion[key]) {
                        subregion.setStyle(branchStyle(entities[subregion[key]]?.color));
                    } else {
                        subregion.setStyle(UNASSIGNED_STYLE);
                    }
                }
            })
            setLegendKeyClicked(null);
            setSelection(matched);
            if (matched.length) {
                mapRef.current.flyToBounds(matched.map(subregion => subregion.getBounds()));
            }
        }

    }, [activeSelection, activePlaygroundSelection, legendKeyClicked])


}

export default MapProcessor;
