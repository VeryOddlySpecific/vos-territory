<?php

class VOS_Admin_Display {

    public function enqueue_styles_scripts() {

        $enqueue_items = json_decode( file_get_contents( VOS_TM_PATH . 'includes/assets/enqueue.json' ), true );

        foreach ( $enqueue_items as $item ) {

            $handle = $item['handle'];
            $src    = $this->resolve_src( $item['src'] );
            $deps   = $item['deps'];
            $ver    = $item['ver'];

            if ( $item['type'] === 'style' ) {

                wp_enqueue_style( $handle, $src, $deps, $ver );

            } else {

                if ( $item['in_footer'] === null ) {

                    wp_enqueue_script( $handle, $src, $deps, $ver );

                } else {

                    $in_footer = $item['in_footer'];
                    wp_enqueue_script( $handle, $src, $deps, $ver, $in_footer );
                }

                if ( isset( $item['localize'] ) && $item['localize'] === true ) {

                    $obj = array(
                        'ajax_url'    => admin_url( 'admin-ajax.php' ),
                        'regions'     => get_option( '_vos_tm_active_regions' ),
                        'subregions'  => get_option( '_vos_tm_active_subregions' ),
                        'apiBase'     => rest_url( 'vos/v1' ),
                        'restUrl'     => rest_url(),
                        'nonce'       => wp_create_nonce( 'wp_rest' ),
                        'statesUrl'   => $this->states_url(),
                        'mapData'     => get_option( '_vos_tm_map_data' ),
                        'mapLayers'   => get_option( '_vos_tm_map_layers' ),
                        'branches'    => VOS_Branch::get_branches_for_js(),
                        'playgrounds'          => VOS_Playground::get_playgrounds_for_js(),
                        'playgroundSubregions' => get_option( '_vos_tm_playground_subregions' ),
                        'googleMapsKey' => VOS_Settings::google_maps_key(),
                    );

                    wp_localize_script( $handle, 'vosTm', $obj );

                }

            }

        }

        VOS_Settings::enqueue_google_maps_loader();

    }

    /**
     * Returns the URL for the static states directory, rewritten to match the
     * scheme and host:port that the browser is actually using.
     *
     * plugin_dir_url() is based on the site URL stored in the database, which
     * may differ from the real request origin (e.g. Local by Flywheel serves
     * the admin on a different port).  Fetching a static file from a different
     * port is a cross-origin request and will be blocked by CORS policy.
     *
     * By rebuilding the URL from $_SERVER we guarantee it always shares the
     * same origin as the page, so no CORS header is needed.
     */
    private function states_url() {

        // Return a root-relative URL so the browser always resolves it
        // against the current page's origin (scheme, host, *and port*).
        // Local by Flywheel proxies requests, so $_SERVER['HTTP_HOST'] can
        // miss the port the browser is actually on, which triggers CORS.
        $plugin_path = wp_parse_url( VOS_TM_URL, PHP_URL_PATH );

        return $plugin_path . 'includes/assets/states/';

    }

    private function resolve_src( $src ) {

        if ( strpos( $src, 'http' ) === 0 ) {

            return $src;

        } else {

            return VOS_TM_URL . $src;

        }

    }

}
