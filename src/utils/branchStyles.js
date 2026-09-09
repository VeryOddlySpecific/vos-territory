/**
 * Computes Leaflet style objects from a branch color.
 *
 * Centralising this here means the style logic only lives in one place —
 * previously it was duplicated across branchesAlt.json (static) and would
 * have been duplicated again in every component that needed it.
 */

export const branchStyle = ( color ) => ({
    color,
    weight:      2,
    opacity:     0.65,
    fillColor:   color,
    fillOpacity: 0.25,
});

export const branchActiveStyle = ( color ) => ({
    color:       '#0a1944',
    weight:      2,
    opacity:     1,
    fillColor:   color,
    fillOpacity: 0.95,
});
