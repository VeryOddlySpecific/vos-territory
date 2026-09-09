# Dev Notes

Running log of non-obvious development detail. Newest first. Commit messages
stay terse; the reasoning lives here.

## 2026-06-03 — Phase 3a: basemap on Google Maps

`TerritoryMap.jsx` now creates `new google.maps.Map` instead of `L.map`: center
as `{lat,lng}`, US `restriction` (from `US_BOUNDS`, replaces Leaflet maxBounds),
`disableDefaultUI` (mirrors the old `zoomControl:false`), inline `MAP_STYLES`
(dataviz-like gray; no Cloud mapId). Dropped the vestigial `vosTm.mapData` branch
(it assigned parsed option JSON to the map ref — never a valid map).

New `src/utils/googleMaps.js`: `importMapsLibrary()` polls for
`google.maps.importLibrary` before loading a library — this is the load-order
safeguard (the inline loader and our bundle are both footer scripts with no
guaranteed order), so no enqueue dependency juggling needed. Also exports
`US_BOUNDS` and `MAP_STYLES` for reuse.

`MapProcessor` still drives Leaflet against the shared map ref, so it's
temporarily disabled in both `Layout` trees to keep the 3a basemap clean; it's
rewritten and re-enabled in 3b.

Live render is gated on the key's HTTP-referrer allowlist including the Local
origin (`http://territorymap.local/*`) — config, not code.

## 2026-06-03 — Phase 2: Google key to client + dead-dep purge

Key plumbing: promoted the key resolver to `VOS_Settings::google_maps_key()`
(public static; reads `_vos_tm_google_maps_key`, falls back to the legacy
`_vos_tm_maptiler_key` so the already-pasted key keeps working). Both enqueues
now localize `vosTm.googleMapsKey` (was `maptilerKey`). Renamed the settings
field/handler/nonce/action to Google (`save_google_maps_key`,
`_vos_tm_google_maps_key`, `google_maps_saved`), prefilled from the resolver so
no re-entry is needed. Admin-post hook renamed in `class-vos-admin.php`.

Maps JS loader: `VOS_Settings::enqueue_google_maps_loader()` injects Google's
official inline bootstrap loader (NOWDOC, key injected as JSON) so
`google.maps.importLibrary()` is available for Phase 3. It's lazy — the API
script isn't fetched until the first `importLibrary` call (Phase 3), so nothing
visible loads yet. **Phase 3 follow-up:** ensure load order — either make
`vos-territory-js` depend on `vos-google-maps-loader` or await availability at
runtime before map init.

Purge (all confirmed unused in src/): removed `geojson2svg`, `geojson-extent`,
`proj4`, `proj4leaflet`, `jsPDF` from `enqueue.json`; removed
`@mapbox/geojson-extent`, `@turf/convex`, `geojson2svg`, `leaflet.bigimage`,
`leaflet.browser.print`, `parse-svg`, `proj4leaflet` from `package.json`
(resynced lock via `npm install`); deleted `includes/assets/{proj4,proj4leaflet,
geojson-extent}.js` and `includes/assets/dist/leaflet.browser.print*.js`. Leaflet
itself (`leaflet-js`/`leaflet-css`) stays until Phase 3 swaps the engine.

Build memory: machine had ~1.9 GB free of 16 GB; the 4 parallel Terser workers
hit V8 "Zone Allocation failed" (OS denying memory, not a heap-size limit).
Fixed in `webpack.config.js` by serializing Terser (`parallel = false`) and
excluding dev-only `includes/assets/testing/**` (~30 MB) from the deploy copy.

## 2026-06-03 — Migrate geocoding to Google (dormant)

Rewrote `rest_geocode()` to call the Google Geocoding API instead of MapTiler:
swapped the request URL (`components=country:US`), parse `address_components[]`
for state name/abbr and `postal_code` instead of MapTiler's `context[]`, read
coordinates from the `{lat,lng}` object, and handle Google's body-level status
(`ZERO_RESULTS` → 404; other → 502 with `error_message` surfaced). The response
payload shape, transient cache, and `state_abbr_to_fips()` are unchanged, so the
BranchFinder client and the FIPS/point-in-polygon path need no changes.

Added the shared `_vos_tm_google_maps_key` option plus a `geocode_api_key()`
helper that falls back to the legacy `_vos_tm_maptiler_key` slot during the
migration.

**Dormant for now:** per scope decision, the one Google key is for basemap
(Maps JS) only and stays HTTP-referrer restricted, so server-side geocoding is
shelved. This path is complete and was verified against the live API (it
correctly surfaced `REQUEST_DENIED` for the referrer-restricted key), but it
won't be exercised — and BranchFinder address search stays non-functional —
until address lookup is revisited.

## 2026-06-03 — Restore build config + deploy step (branch `3.0-google-maps`)

`webpack.config.js` was committed empty (0 bytes) in the 2.8.0 rebuild, which
dropped the JSX/Babel loaders (build failed) and the copy-to-site step.

Rebuilt it on top of the `@wordpress/scripts` default config with the five
explicit entry points the PHP loads — there are no `block.json` files, so
blocks are registered from PHP and auto-detection doesn't apply:
`index`, `territory-map-block`, `branch-finder-block`, `branch-editor`,
`playground-editor`.

Built JS is emitted straight into the Local site's `build/` dir (avoids a
copy-timing race on freshly emitted assets), and the production PHP/CSS/asset
files are copied there via `CopyWebpackPlugin`. Deploy target is hardcoded:
`G:\Local Sites\territorymap\app\public\wp-content\plugins\vos-territory`.
Pinned `copy-webpack-plugin@^10.2.4`, which was only present transitively.

Known follow-up: the copy pulls the whole `includes/` tree, including dev-only
`includes/assets/testing/**` (~30 MB). Trim from the copy patterns later.
