/**
 * Build config for vos-territory.
 *
 * Extends the @wordpress/scripts default config (which provides the
 * JSX/Babel loaders and the DependencyExtractionWebpackPlugin that emits
 * each entry's `*.asset.php`) with this plugin's explicit entry points and
 * a copy step that deploys the production files into the local site.
 *
 * There are no block.json files, so blocks are registered from PHP and the
 * default block auto-detection does not apply — every bundle is listed
 * explicitly below. Output names match what the PHP expects:
 *   build/index.js                 (enqueue.json -> vos-territory-js)
 *   build/territory-map-block.js   (+ .asset.php) class-vos-admin.php
 *   build/branch-finder-block.js   (+ .asset.php) class-vos-admin.php
 *   build/branch-editor.js                        class-vos-branch.php
 *   build/playground-editor.js                    class-vos-playground.php
 *
 * Deploy target: set VOS_TM_DEPLOY_DIR to the served plugin dir of a local
 * WordPress install to build straight into it (no copy-timing race on
 * freshly emitted assets; the static PHP/CSS/asset files are copied with
 * absolute `to` paths). Without it, everything lands in this repo's own
 * ./deploy directory.
 */

const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const CopyWebpackPlugin = require( 'copy-webpack-plugin' );
const path = require( 'path' );

// Served plugin directory inside a local WordPress install (env override),
// or a local ./deploy folder by default.
const DEPLOY_DIR = process.env.VOS_TM_DEPLOY_DIR || path.resolve( __dirname, 'deploy' );

const config = {
	...defaultConfig,
	entry: {
		index: path.resolve( __dirname, 'src/index.js' ),
		'territory-map-block': path.resolve( __dirname, 'src/blocks/territory-map/index.js' ),
		'branch-finder-block': path.resolve( __dirname, 'src/blocks/branch-finder/index.js' ),
		'branch-editor': path.resolve( __dirname, 'src/editor/branch-editor.js' ),
		'playground-editor': path.resolve( __dirname, 'src/editor/playground-editor.js' ),
	},
	output: {
		...defaultConfig.output,
		path: path.join( DEPLOY_DIR, 'build' ),
		clean: true, // wipe stale bundles in <deploy>/build on each build
	},
	plugins: [
		...defaultConfig.plugins,
		new CopyWebpackPlugin( {
			patterns: [
				{
					from: path.resolve( __dirname, 'vos-territory.php' ),
					to: path.join( DEPLOY_DIR, 'vos-territory.php' ),
				},
				{
					from: path.resolve( __dirname, 'includes' ),
					to: path.join( DEPLOY_DIR, 'includes' ),
					// Dev-only scratch GeoJSON (~30 MB) — not part of the
					// production deploy, and copying it into the asset graph
					// drove the build out of memory.
					globOptions: { ignore: [ '**/assets/testing/**' ] },
				},
			],
		} ),
	],
};

// The production build minifies with several parallel Terser workers by
// default, which can exhaust system RAM on a memory-constrained machine
// (V8 "Zone Allocation failed" at a tiny heap = the OS denying memory to the
// worker processes). Serialize minification so the build fits in low memory.
if ( config.optimization && Array.isArray( config.optimization.minimizer ) ) {
	config.optimization.minimizer.forEach( ( m ) => {
		if ( m && m.options && Object.prototype.hasOwnProperty.call( m.options, 'parallel' ) ) {
			m.options.parallel = false;
		}
	} );
}

module.exports = config;
