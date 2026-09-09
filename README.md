# VOS Territory Map

A WordPress plugin that renders an interactive US county map for assigning
and displaying branch territory coverage. Built on Leaflet, Turf, and
React (via `@wordpress/element`).

- **Plugin slug:** `vos-territory`
- **Author:** Alexander Steadman (VOS)
- **License:** GPL-2.0
- **Current version:** see `vos-territory.php` header

## Display

When the admin page loads, the app displays a panel consisting of:

- **Region Selector** — toggles which regions (states) are active
- **Map Legend** — shows the available branches, their colors, and lets
  the user focus the view on a single branch
- **Subregion Data** — the working panel for the current selection:
  - Clear the active selection of subregions
  - Save the map's current state to the database
  - Print the map to a `.png` file
  - See the list of currently selected counties
  - Activate or deactivate those counties
  - Assign selected counties to a branch
  - Add restrictions to selected counties
- **Map Display**:
  - Active regions
  - All subregions within active regions
  - Altered styles for active subregions and subregions with restrictions

The public-side view (`#vos-territory-public` mount) renders the map and
legend in read-only mode and supports the branch finder.

## Requirements

- WordPress 6.x or later
- PHP 7.4 or later
- Node.js 18+ and npm (for building the front-end)
- A MapTiler API key (configured in the plugin settings page)

## Installation

1. Build the plugin (`npm install && npm run build`) or use the packaged
   zip from `npm run plugin-zip`.
2. Upload via **Plugins → Add New → Upload Plugin** or copy into
   `wp-content/plugins/`.
3. Activate.
4. Set the MapTiler key under the VOS Territory Map settings page.

The plugin registers a `vos_territory_manager` ("Map Manager") role on init and
grants the territory + branch/playground capabilities to administrators and that
role only. (Older versions blanket-granted the map-edit capability to every
role; that legacy grant is now scrubbed on upgrade.)

## Development

```bash
npm install
npm run start      # watch + rebuild on change
npm run build      # production build → build/index.js
npm run plugin-zip # package the plugin as a zip
```

Front-end source lives under `src/`, gets bundled by `wp-scripts` (see
`webpack.config.js`), and is loaded by the plugin via
`includes/assets/enqueue.json`.

## Project Layout

```
vos-territory.php            # Plugin entry: header, constants, bootstrap
includes/
  class-vos-territory.php        # Top-level controller (admin + public)
  admin/                         # Admin display, settings, branch CPT, REST routes
  public/                        # Public-facing enqueue and shortcode/block hooks
  assets/
    states/{FIPS}.geojson        # Per-state county FeatureCollections
    enqueue.json                 # Script/style manifest
  styles/                        # Plugin CSS
src/
  index.js                       # React entry, mounts admin or public root
  components/                    # Active React components
    TerritoryMap.jsx             # Leaflet map container
    MapProcessor.jsx             # GeoJSON load, viewport tooltip sync,
                                 #   click handling, style management
    MapProvider.jsx / MapContext.jsx
    Layout.jsx                   # Admin and public layouts
    RegionSelector.jsx           # State toggle UI
    SubregionData.jsx            # County assignment + restrictions panel
    MapLegend.jsx                # Branch legend + filter
    BranchProcessor.jsx          # Persists city/branch data on save
    BranchProcessorDrivingDistance.jsx  # Placeholder for routing-based assignment
    BranchFinder.jsx             # Public-side branch search
    CountySearch.jsx             # County name lookup
    ImportButton.jsx / ExportButton.jsx
    SaveButton.jsx / PrintButton.jsx
    GetCities.jsx
  blocks/                        # Gutenberg blocks (territory-map, branch-finder)
  editor/                        # Block editor controls (branch color panel etc.)
  utils/
    branchStyles.js              # Branch style helpers (derived from color)
  assets/
    fips.json                    # State FIPS → name/abbr lookup
```

## Data

- **GeoJSON:** US Census county boundaries, one FeatureCollection per
  state, keyed by state FIPS. Features carry `Name`, `GEOID`, `STATEFP`,
  `COUNTYFP`, `ALAND`, `AWATER`. Geometry is `Polygon` or `MultiPolygon`.
- **Branches:** Managed as a custom post type (`vos_branch`) in WordPress.
  `VOS_Branch::get_branches_for_js()` exposes them to the front-end via
  `wp_localize_script` as `vosTm.branches`, keyed by post ID with
  `{ id, label, color, coordinates, url }`.
- **Persistence:** Selected states and county/branch assignments are saved
  to the WordPress options table and re-injected on page load.
- **Tiles:** MapTiler `dataviz` raster tiles. The key is read from plugin
  settings and injected via `vosTm.maptilerKey`.

## Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/).

The version is set in three places that must stay in sync:

1. `vos-territory.php` — the `Version:` plugin header
2. `vos-territory.php` — the `VOS_TM_VERSION` constant
3. `package.json` — the `version` field (used by `npm run plugin-zip` for
   the output zip filename)

The PHP plugin header is the source of truth: WordPress reads it directly
from the comment block via regex, so it must be a literal string and
cannot be generated at build time. The other two should be updated to
match whenever the header is bumped.

## Changelog

### 2.8.1 — 2026-09-03

Cleanup release — no new features, backward-compatible fixes and removals, so
this is a PATCH bump.

**Changed**
- Plugin slug renamed from `vos-territory-map` to `vos-territory` (main file,
  admin page slug, mount element id, and package name all follow). Folded into
  this unreleased version rather than a separate bump.
- `VOS_Settings::get_branch_id()` now resolves a branch from the `vos_branch`
  CPT by its `_vos_branch_url` meta instead of reading the legacy static
  `includes/assets/branches.json`, aligning `/vos/v1/get-branch-cities` with
  the CPT-backed branch model. Returns null (and the route returns an empty
  set) when no branch matches, instead of erroring on a missing entry.

**Removed**
- Legacy static branch data (`includes/assets/branches.json`,
  `src/assets/branches.json`, `src/assets/branchesAlt.json`) — superseded by
  the `vos_branch` CPT since the 2.x rebuild.
- `src/components/LayerStyles.jsx` — imported but never rendered; its style
  logic lives in `MapProcessor.jsx` (flagged for removal in 2.7.2).
- The `/vos/v1/get-service-cities` REST route — its callback was an empty
  stub that returned null.
- The frozen pre-rebuild 2.6.0 zip archive from the repo root.
- `package.json` renamed to the current plugin slug and brought in line with
  the plugin license.

### 2.8.0 — 2026-05-29

Two new features (a Playgrounds territory layer with a view toggle, and an Excel
export of branch counties) plus a security fix. Backward compatible — `viewMode`
defaults to `branches` and existing saved data loads unchanged — so this is a
MINOR bump.

**Added**
- **Playgrounds territory layer.** A new `vos_playground` custom post type
  (managed under Territory Map alongside Branches, with a color quick-edit column
  and a block-editor color panel) plus a `_vos_tm_playground_subregions` option
  holding their county assignments. Playgrounds are independent of branches — a
  county can belong to a branch *and* a playground at the same time.
- **Branches ↔ Playgrounds view toggle** (`src/components/ViewToggle.jsx`) on both
  the admin and public maps. Flipping the view recolors the counties and switches
  the legend (and, on admin, the assignment/save target) between the two layers.
  Hidden when no playgrounds exist.
- **Excel (.xlsx) export of counties within branches**
  (`src/components/ExcelExportButton.jsx`, in the Subregion Data panel). Each
  branch becomes a column with its counties listed beneath as `County, ST`; a
  county's restriction note is appended as ` - {note}`. Exports the active view.
  SheetJS is lazy-loaded so it stays out of the public bundle.

**Security**
- `POST /vos/v1/save` (`VOS_Settings::save_map_settings()`) now allowlists the
  option key it writes. Previously it passed an arbitrary key to `update_option()`,
  so any user with `edit_vos_territory` (the Map Manager role) could overwrite *any*
  WordPress option — a privilege-escalation hole.

**Fixed**
- `GET /vos/v1/get-cities` was returning its JSON as a string, double-encoding the
  response and breaking the Turf city computation in Save; it now decodes before
  responding.
- `VOS_Settings::rest_get_state()` returns a 404 for a missing state file instead of
  emitting a PHP warning and a null body.
- Added defensive `isset` guards to `save_branch_cities()` / `get_branch_cities()`.

**Changed**
- `includes/assets/enqueue.json`: pinned jsPDF to `2.5.1` (was `@latest`, a
  supply-chain/reproducibility risk) and bumped the Leaflet stylesheet to `1.9.4`
  to match the Leaflet JS version.

### 2.7.2 — 2026-05-13

**Fixed**
- County tooltips for `MultiPolygon` features now anchor to the largest
  polygon by area, computed via `turf.area`, with the anchor point set to
  that polygon's `turf.centerOfMass`. Previously, Leaflet's default
  `getBounds().getCenter()` placed the tooltip on the bbox center of all
  rings combined, which for counties with a small detached island (or
  several scattered fragments) could land the label on the island or in
  open water between fragments. The fix applies to both the shared
  hover-tooltip path and the viewport-scoped permanent-tooltip path in
  `src/components/MapProcessor.jsx`. Polygon features also benefit, since
  `centerOfMass` handles concave shapes better than the bounding-box
  center.

**Changed**
- `src/components_alt/LayerStyles.jsx` moved into `src/components/`
  (`components_alt/` is now removed). The other two files in that folder
  (an older `MapProcessor.jsx` and `SubregionData.jsx`) were unreferenced
  and have been deleted. Note: the moved `LayerStyles.jsx` itself still
  appears to be largely redundant with style-management logic now living
  in `MapProcessor.jsx`; flagged for a future cleanup pass.

**Internal**
- Root `package.json` `version` brought in line with the plugin header
  (previously stuck at `1.0.0`).
- Added this README, restoring and expanding the prior repo-root README
  with sections for build, layout, data, and versioning.

### 2.7.1 and earlier

Prior history not captured in this file. See git history for details.
