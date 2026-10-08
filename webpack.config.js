/**
 * Build config for vos-territory.
 *
 * Extends the @wordpress/scripts default config (which provides the
 * JSX/Babel loaders and the DependencyExtractionWebpackPlugin that emits
 * each entry's `*.asset.php`) with this plugin's explicit entry points and
 * an optional copy step that packages the production files for deploy.
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
 * Output targets:
 *   npm run build / npm start  -> ./build, in place. The repo is the plugin
 *                                 dir WordPress serves, so a refresh picks
 *                                 up the new bundles. No copy step.
 *   npm run build:deploy       -> ./deploy (build/, includes/,
 *                                 vos-territory.php), a standalone copy
 *                                 of the plugin for shipping.
 *   VOS_TM_DEPLOY_DIR=<dir>    -> same as build:deploy, into <dir>, e.g. the
 *                                 served plugin dir of another WordPress
 *                                 install. Never point it at this repo: the
 *                                 copy step would write includes/ onto itself.
 */

const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const CopyWebpackPlugin = require( 'copy-webpack-plugin' );
const path = require( 'path' );

// npm sets npm_lifecycle_event to the script name, which keeps
// build:deploy cross-platform (no inline env var syntax in package.json).
const DEPLOY_DIR = process.env.VOS_TM_DEPLOY_DIR
	|| ( process.env.npm_lifecycle_event === 'build:deploy' ? path.resolve( __dirname, 'deploy' ) : null );

const OUTPUT_DIR = DEPLOY_DIR ? path.join( DEPLOY_DIR, 'build' ) : path.resolve( __dirname, 'build' );

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
		path: OUTPUT_DIR,
		clean: true, // wipe stale bundles in the output dir on each build
	},
	plugins: [
		...defaultConfig.plugins,
		DEPLOY_DIR && new CopyWebpackPlugin( {
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
	].filter( Boolean ),
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
