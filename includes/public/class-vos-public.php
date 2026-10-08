<?php

class VOS_Public {

    public function enqueue_styles_scripts() {

        $enqueue_items = json_decode( file_get_contents( VOS_TM_PATH . 'includes/assets/enqueue.json' ), true );

        foreach ( $enqueue_items as $item ) {

            $handle = $item['handle'];
            $src    = $item['src'];
            $deps   = $item['deps'];
            $ver    = $item['ver'];

            if ( $item['type'] === 'style' ) {

                wp_enqueue_style( $handle, $src, $deps, $ver );

            } else {

                $in_footer = $item['in_footer'];
                wp_enqueue_script( $handle, $src, $deps, $ver, $in_footer );

                if ( isset( $item['localize'] ) && $item['localize'] === true ) {

                    $obj = array(
                        'ajax_url'    => admin_url( 'admin-ajax.php' ),
                        'regions'     => get_option( '_vos_tm_active_regions' ),
                        'subregions'  => get_option( '_vos_tm_active_subregions' ),
                        'apiBase'     => rest_url( 'vos/v1' ),
                        'restUrl'     => rest_url(),
                        'nonce'       => wp_create_nonce( 'wp_rest' ),
                        'statesUrl'   => $this->states_url(),
                        'branches'    => VOS_Branch::get_branches_for_js(),
                        'playgrounds'          => VOS_Playground::get_playgrounds_for_js(),
                        'playgroundSubregions' => get_option( '_vos_tm_playground_subregions' ),
                        'maptilerKey' => VOS_Settings::maptiler_key(),
                    );

                    wp_localize_script( $handle, 'vosTm', $obj );

                }

            }

        }


    }

    /** @see VOS_Admin_Display::states_url() for rationale. */
    private function states_url() {

        $plugin_path = wp_parse_url( VOS_TM_URL, PHP_URL_PATH );

        return $plugin_path . 'includes/assets/states/';

    }

    public function run() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_styles_scripts' ) );
    }

}
