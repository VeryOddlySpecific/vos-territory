<?php

class VOS_Settings {

    public function register_settings() {

        register_setting( 'vos_tm_settings', '_vos_tm_active_regions' );
        register_setting( 'vos_tm_settings', '_vos_tm_active_subregions' );
        register_setting( 'vos_tm_settings', '_vos_tm_playground_subregions' );
        // Google Maps Platform key for server-side Geocoding (rest_geocode()).
        // The geocoder is dormant: address lookup is shelved, and the key has
        // no admin field. The basemap no longer uses Google (see
        // maptiler_key()).
        register_setting( 'vos_tm_settings', '_vos_tm_google_maps_key', array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '',
            'show_in_rest'      => false,
        ) );

        // MapTiler key for the Leaflet basemap tiles. Localized as
        // vosTm.maptilerKey, so it's visible in the page source: restrict
        // it to your domain under Allowed HTTP origins in the MapTiler
        // dashboard.
        register_setting( 'vos_tm_settings', '_vos_tm_maptiler_key', array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '',
            'show_in_rest'      => false,
        ) );

    }

    /**
     * Returns the MapTiler key used for the basemap tiles.
     */
    public static function maptiler_key() {

        return (string) get_option( '_vos_tm_maptiler_key', '' );

    }

    /**
     * Returns the Google Maps Platform key used by the dormant server-side
     * geocoder. Not sent to the browser.
     */
    public static function google_maps_key() {

        return (string) get_option( '_vos_tm_google_maps_key', '' );

    }

    /**
     * Handles the vos_tm_save_maptiler_key admin-post action.
     *
     * Stores the MapTiler key in wp_options. The key is localized to the
     * client for the tile URLs, so restrict it to your domain in the
     * MapTiler dashboard.
     */
    public function save_maptiler_key() {

        if ( ! isset( $_POST['vos_tm_maptiler_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['vos_tm_maptiler_nonce'] ) ), 'vos_tm_save_maptiler_key' ) ) {
            wp_die( 'Security check failed.' );
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Insufficient permissions.' );
        }

        $key = isset( $_POST['_vos_tm_maptiler_key'] ) ? sanitize_text_field( wp_unslash( $_POST['_vos_tm_maptiler_key'] ) ) : '';

        update_option( '_vos_tm_maptiler_key', $key );

        wp_safe_redirect( admin_url( 'admin.php?page=vos-territory&maptiler_saved=1' ) );
        exit;

    }

    public function save_settings() {

        // No frontend currently posts to this admin-post action — the live
        // save path goes through /vos/v1/save. Kept for back-compat but
        // gated on nonce + cap so it can't be abused as an open write.
        if ( ! isset( $_POST['vos_tm_settings_nonce'] ) || ! wp_verify_nonce( $_POST['vos_tm_settings_nonce'], 'save_vos_tm_settings' ) ) {
            wp_die( 'Security check failed.' );
        }

        if ( ! current_user_can( 'edit_vos_territory' ) ) {
            wp_die( 'Insufficient permissions.' );
        }

        $subregions = isset( $_POST['_vos_tm_active_subregions'] ) ? wp_unslash( $_POST['_vos_tm_active_subregions'] ) : '';
        $regions    = isset( $_POST['_vos_tm_active_regions'] )    ? wp_unslash( $_POST['_vos_tm_active_regions'] )    : '';

        update_option( '_vos_tm_active_subregions', $subregions );
        update_option( '_vos_tm_active_regions',    $regions );

        wp_redirect( admin_url( 'admin.php?page=vos-territory' ) );
        exit;

    }

    public function get_settings() {

        $settings = array(
            'regions'    => get_option( '_vos_tm_active_regions' ),
            'subregions' => get_option( '_vos_tm_active_subregions' ),
        );

        return $settings;

    }

    public function add_settings_sections() {

        add_settings_section(
            'vos_tm_settings',
            'Territory Settings',
            array( $this, 'add_settings_fields' ),
            'vos-territory'
        );

    }

    public function add_settings_fields() {

        add_settings_field(
            'vos_tm_territory_selection',
            'Territory Selection',
            array( $this, 'render_territory_selection' ),
            'vos-territory',
            'vos_tm_settings'
        );

    }

    public function render_territory_selection() {

        echo '<div id="vos-territory"></div>';

    }

    public function render_settings_page() {

        $import_success  = isset( $_GET['imported'] ) && $_GET['imported'] === '1';
        $import_error    = isset( $_GET['import_error'] ) ? urldecode( sanitize_text_field( $_GET['import_error'] ) ) : null;
        $maptiler_saved  = isset( $_GET['maptiler_saved'] ) && $_GET['maptiler_saved'] === '1';
        $maptiler_key    = self::maptiler_key();

        ?>
        <div id="vos-territory"></div>

        <div style="max-width:600px;margin:2rem 0;padding:1.5rem;background:#fff;border:1px solid #c3c4c7;border-radius:4px;">
            <h2 style="margin-top:0;">MapTiler API Key</h2>

            <?php if ( $maptiler_saved ) : ?>
                <div class="notice notice-success inline"><p>MapTiler key saved.</p></div>
            <?php endif; ?>

            <p style="color:#646970;margin-bottom:1rem;">
                Used for the basemap tiles. Create one in your
                <a href="https://cloud.maptiler.com/account/keys/" target="_blank" rel="noopener">MapTiler account</a>.
                The key is exposed in the page source, so restrict it to your
                domain under Allowed HTTP origins.
            </p>

            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                <?php wp_nonce_field( 'vos_tm_save_maptiler_key', 'vos_tm_maptiler_nonce' ); ?>
                <input type="hidden" name="action" value="vos_tm_save_maptiler_key">
                <p>
                    <label for="_vos_tm_maptiler_key"><strong>API key</strong></label><br>
                    <input
                        type="text"
                        id="_vos_tm_maptiler_key"
                        name="_vos_tm_maptiler_key"
                        value="<?php echo esc_attr( $maptiler_key ); ?>"
                        style="width:100%;max-width:420px;margin-top:0.4rem;font-family:monospace;"
                        autocomplete="off"
                        spellcheck="false"
                    >
                </p>
                <p>
                    <input type="submit" class="button button-primary" value="Save Key">
                </p>
            </form>
        </div>

        <div style="max-width:600px;margin:2rem 0;padding:1.5rem;background:#fff;border:1px solid #c3c4c7;border-radius:4px;">
            <h2 style="margin-top:0;">Import Branch / County Data</h2>

            <?php if ( $import_success ) : ?>
                <div class="notice notice-success inline"><p>Import successful. The map has been updated.</p></div>
            <?php elseif ( $import_error ) : ?>
                <div class="notice notice-error inline"><p><?php echo esc_html( $import_error ); ?></p></div>
            <?php endif; ?>

            <p style="color:#646970;margin-bottom:1.5rem;">
                Upload a JSON file containing an array of branch objects. Each object needs a
                <code>location</code> field (matched against existing branch titles) and a
                <code>subregions</code> array of county GEOIDs. An optional <code>color</code>
                field (e.g. <code>"#8b4513"</code>) seeds the branch color on create and
                overwrites it on re-import if provided. Branches that don't exist yet
                will be created automatically.
            </p>

            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data">
                <?php wp_nonce_field( 'vos_tm_import_json', 'vos_tm_import_nonce' ); ?>
                <input type="hidden" name="action" value="vos_tm_import_json">
                <p>
                    <label for="vos_tm_import_file"><strong>JSON file</strong></label><br>
                    <input type="file" name="vos_tm_import_file" id="vos_tm_import_file" accept=".json" required style="margin-top:0.4rem;">
                </p>
                <p>
                    <input type="submit" class="button button-primary" value="Import">
                </p>
            </form>
        </div>
        <?php

    }

    /**
     * Handles the vos_tm_import_json admin-post action.
     *
     * - Parses the uploaded JSON file.
     * - For each item, finds an existing vos_branch post by title (location)
     *   or creates one.
     * - Merges the county GEOID assignments into _vos_tm_active_subregions.
     * - Merges any new state FIPS codes into _vos_tm_active_regions.
     * - Redirects back to the map admin page.
     */
    public function handle_import() {

        if ( ! isset( $_POST['vos_tm_import_nonce'] ) || ! wp_verify_nonce( $_POST['vos_tm_import_nonce'], 'vos_tm_import_json' ) ) {
            wp_die( 'Security check failed.' );
        }

        if ( ! current_user_can( 'edit_vos_territory' ) ) {
            wp_die( 'Insufficient permissions.' );
        }

        $redirect = admin_url( 'admin.php?page=vos-territory' );

        // Validate upload.
        if ( empty( $_FILES['vos_tm_import_file']['tmp_name'] ) ) {
            wp_redirect( $redirect . '&import_error=' . rawurlencode( 'No file uploaded.' ) );
            exit;
        }

        $raw  = file_get_contents( $_FILES['vos_tm_import_file']['tmp_name'] );
        $data = json_decode( $raw, true );

        if ( ! is_array( $data ) ) {
            wp_redirect( $redirect . '&import_error=' . rawurlencode( 'Invalid JSON — expected a top-level array.' ) );
            exit;
        }

        // Load existing saved data.
        $saved_subregions = json_decode( get_option( '_vos_tm_active_subregions', '[]' ), true );
        if ( ! is_array( $saved_subregions ) ) $saved_subregions = [];

        $saved_regions = json_decode( get_option( '_vos_tm_active_regions', '[]' ), true );
        if ( ! is_array( $saved_regions ) ) $saved_regions = [];

        // Index existing subregions by GEOID so we can update in place.
        $index_by_geoid = [];
        foreach ( $saved_subregions as $i => $sr ) {
            $index_by_geoid[ (string) $sr['geoid'] ] = $i;
        }

        // Build a label → post ID map for existing branches (case-insensitive).
        $all_branch_posts = get_posts( array(
            'post_type'   => 'vos_branch',
            'post_status' => 'publish',
            'numberposts' => -1,
        ) );

        $branch_by_label = [];
        foreach ( $all_branch_posts as $post ) {
            $branch_by_label[ strtolower( trim( $post->post_title ) ) ] = $post->ID;
        }

        $new_regions = [];

        foreach ( $data as $item ) {

            $location = isset( $item['location'] )   ? trim( $item['location'] )   : '';
            $geoids   = isset( $item['subregions'] ) ? (array) $item['subregions'] : [];

            if ( ! $location || ! $geoids ) continue;

            $label_key = strtolower( $location );

            // Accept an optional "color" field on each item — normalize to
            // #rrggbb. Anything not matching that pattern is ignored.
            $color = null;
            if ( isset( $item['color'] ) ) {
                $candidate = trim( (string) $item['color'] );
                // Allow leading "#" to be optional.
                if ( $candidate !== '' && $candidate[0] !== '#' ) $candidate = '#' . $candidate;
                if ( preg_match( '/^#[0-9a-f]{6}$/i', $candidate ) ) {
                    $color = strtolower( $candidate );
                }
            }

            // Find or create the branch post.
            if ( isset( $branch_by_label[ $label_key ] ) ) {
                $branch_id = (string) $branch_by_label[ $label_key ];

                // Existing branch — only overwrite color if one was supplied
                // in the JSON, so re-imports don't stomp on manual edits.
                if ( $color ) {
                    update_post_meta( $branch_id, '_vos_branch_color', $color );
                }
            } else {
                $post_id = wp_insert_post( array(
                    'post_type'   => 'vos_branch',
                    'post_title'  => $location,
                    'post_status' => 'publish',
                ) );

                if ( is_wp_error( $post_id ) ) continue;

                // Use supplied color if valid, otherwise fall back to the
                // placeholder grey so the branch is visible on the map.
                update_post_meta( $post_id, '_vos_branch_color', $color ?: '#888888' );

                $branch_id                     = (string) $post_id;
                $branch_by_label[ $label_key ] = $post_id;
            }

            // Merge each county into the subregions list.
            foreach ( $geoids as $geoid ) {
                $geoid      = (string) $geoid;
                $state_fips = substr( $geoid, 0, 2 );
                $new_regions[] = $state_fips;

                $entry = array(
                    'branch'             => $branch_id,
                    'geoid'              => $geoid,
                    'restrictions'       => false,
                    'restrictionDetails' => null,
                );

                if ( isset( $index_by_geoid[ $geoid ] ) ) {
                    // County already exists — update its branch assignment.
                    $saved_subregions[ $index_by_geoid[ $geoid ] ] = $entry;
                } else {
                    $saved_subregions[]             = $entry;
                    $index_by_geoid[ $geoid ]        = count( $saved_subregions ) - 1;
                }
            }
        }

        // Merge new state FIPS codes into active regions.
        $all_regions = array_values( array_unique( array_merge( $saved_regions, $new_regions ) ) );

        update_option( '_vos_tm_active_subregions', wp_json_encode( $saved_subregions ) );
        update_option( '_vos_tm_active_regions',    wp_json_encode( $all_regions ) );

        wp_redirect( $redirect . '&imported=1' );
        exit;

    }

    public function add_settings_page() {

        add_menu_page(
            'VOS Territory Map',
            'Territory Map',
            'edit_vos_territory',
            'vos-territory',
            array( $this, 'render_settings_page' ),
            'dashicons-location-alt',
            6
        );

        // Re-add the parent slug as an explicit submenu so we can control
        // its label — without this, WP auto-generates a submenu whose label
        // duplicates the parent ("Territory Map › Territory Map").
        add_submenu_page(
            'vos-territory',
            'VOS Territory Map',
            'Map',
            'edit_vos_territory',
            'vos-territory',
            array( $this, 'render_settings_page' )
        );

    }

    public function register_rest_routes() {

        // Permission callback reused by every mutating route below. Gate
        // on edit_vos_territory so only admins and Map Managers can
        // overwrite map state.
        $can_edit_map = function () {
            return current_user_can( 'edit_vos_territory' );
        };

        register_rest_route(
            'vos/v1',
            '/state/(?P<id>\d+)',
            array(
                'methods'             => 'GET',
                'callback'            => array( $this, 'rest_get_state' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            'vos/v1',
            '/save',
            array(
                'methods'             => 'POST',
                'callback'            => array( $this, 'save_map_settings' ),
                'permission_callback' => $can_edit_map,
            )
        );

        register_rest_route(
            'vos/v1',
            '/save-branch-cities',
            array(
                'methods'             => 'POST',
                'callback'            => array( $this, 'save_branch_cities' ),
                'permission_callback' => $can_edit_map,
            )
        );

        register_rest_route(
            'vos/v1',
            '/get-branch-cities',
            array(
                'methods'             => 'GET',
                'callback'            => array( $this, 'get_branch_cities' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            'vos/v1',
            '/get-cities',
            array(
                'methods'             => 'GET',
                'callback'            => array( $this, 'get_cities' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            'vos/v1',
            '/geocode',
            array(
                'methods'             => 'GET',
                'callback'            => array( $this, 'rest_geocode' ),
                'permission_callback' => '__return_true',
                'args'                => array(
                    'address' => array(
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            )
        );

    }

    /**
     * GET /vos/v1/geocode?address=...
     *
     * Server-side Google Geocoding so the API key stays out of the browser
     * for this path. Responses are cached in a transient for 24 hours keyed
     * on a hash of the normalized address — Google meters per request, and
     * the same address often gets typed repeatedly.
     *
     * The response payload shape is unchanged from the MapTiler era
     * (lat, lng, address, state_name, state_abbr, state_fips, zip, cached)
     * so the BranchFinder client and FIPS/point-in-polygon path are
     * untouched.
     */
    public function rest_geocode( $request ) {

        $address = trim( (string) $request->get_param( 'address' ) );

        if ( $address === '' ) {
            return new WP_Error( 'vos_tm_no_address', 'Address is required.', array( 'status' => 400 ) );
        }

        $key = self::google_maps_key();

        if ( $key === '' ) {
            return new WP_Error( 'vos_tm_no_key', 'Google Maps API key is not configured.', array( 'status' => 500 ) );
        }

        $cache_key = 'vos_tm_geo_' . md5( strtolower( $address ) );
        $cached    = get_transient( $cache_key );

        if ( is_array( $cached ) ) {
            $cached['cached'] = true;
            return rest_ensure_response( $cached );
        }

        // Restrict to US — components=country:US is Google's hard filter,
        // so a bare ZIP or city resolves to the US match.
        $url = add_query_arg(
            array(
                'address'    => rawurlencode( $address ),
                'components' => 'country:US',
                'language'   => 'en',
                'region'     => 'us',
                'key'        => $key,
            ),
            'https://maps.googleapis.com/maps/api/geocode/json'
        );

        $response = wp_remote_get( $url, array( 'timeout' => 8 ) );

        if ( is_wp_error( $response ) ) {
            return new WP_Error( 'vos_tm_geocode_failed', $response->get_error_message(), array( 'status' => 502 ) );
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( $code !== 200 || ! is_array( $body ) ) {
            return new WP_Error( 'vos_tm_geocode_bad_response', 'Geocoding service returned an error.', array( 'status' => 502 ) );
        }

        // Google returns HTTP 200 with a status string in the body. ZERO_RESULTS
        // is a clean "no match"; REQUEST_DENIED/OVER_QUERY_LIMIT mean the key or
        // billing is misconfigured — surface error_message to help diagnose.
        $status = isset( $body['status'] ) ? (string) $body['status'] : '';

        if ( $status === 'ZERO_RESULTS' ) {
            return new WP_Error( 'vos_tm_no_match', 'Address could not be located.', array( 'status' => 404 ) );
        }

        if ( $status !== 'OK' ) {
            $detail = isset( $body['error_message'] ) ? ' ' . (string) $body['error_message'] : '';
            return new WP_Error( 'vos_tm_geocode_bad_response', 'Geocoding service returned an error (' . $status . ').' . $detail, array( 'status' => 502 ) );
        }

        $result = isset( $body['results'][0] ) ? $body['results'][0] : null;

        if ( ! $result ) {
            return new WP_Error( 'vos_tm_no_match', 'Address could not be located.', array( 'status' => 404 ) );
        }

        // Google returns coordinates as a {lat, lng} object, not a GeoJSON pair.
        $location = isset( $result['geometry']['location'] ) ? $result['geometry']['location'] : null;

        if ( ! is_array( $location ) || ! isset( $location['lat'], $location['lng'] ) ) {
            return new WP_Error( 'vos_tm_no_coords', 'Match has no coordinates.', array( 'status' => 502 ) );
        }

        // Walk address_components to pull out state + zip when present.
        $state_name = null;
        $state_abbr = null;
        $zip        = null;

        $components = isset( $result['address_components'] ) && is_array( $result['address_components'] )
            ? $result['address_components']
            : array();

        foreach ( $components as $comp ) {
            if ( ! is_array( $comp ) ) continue;

            $types = isset( $comp['types'] ) && is_array( $comp['types'] ) ? $comp['types'] : array();

            if ( in_array( 'administrative_area_level_1', $types, true ) ) {
                $state_name = isset( $comp['long_name'] ) ? (string) $comp['long_name'] : $state_name;
                $state_abbr = isset( $comp['short_name'] ) ? (string) $comp['short_name'] : $state_abbr;
            }

            if ( in_array( 'postal_code', $types, true ) ) {
                $zip = isset( $comp['long_name'] ) ? (string) $comp['long_name'] : $zip;
            }
        }

        $state_fips = $state_abbr ? $this->state_abbr_to_fips( $state_abbr ) : null;

        $payload = array(
            'lat'         => (float) $location['lat'],
            'lng'         => (float) $location['lng'],
            'address'     => isset( $result['formatted_address'] ) ? (string) $result['formatted_address'] : $address,
            'state_name'  => $state_name,
            'state_abbr'  => $state_abbr,
            'state_fips'  => $state_fips,
            'zip'         => $zip,
            'cached'      => false,
        );

        set_transient( $cache_key, $payload, DAY_IN_SECONDS );

        return rest_ensure_response( $payload );

    }

    /**
     * Maps a US state's two-letter abbreviation to its FIPS code using
     * the existing fips.json asset. Used by rest_geocode() so the client
     * can correlate a geocoded address back to the matching state GeoJSON.
     */
    private function state_abbr_to_fips( $abbr ) {

        static $map = null;

        if ( $map === null ) {
            $map  = array();
            $path = VOS_TM_PATH . 'src/assets/fips.json';

            if ( ! file_exists( $path ) ) {
                // Fallback path — the asset may ship in includes/assets/ too.
                $alt = VOS_TM_PATH . 'includes/assets/fips.json';
                if ( file_exists( $alt ) ) $path = $alt;
            }

            if ( file_exists( $path ) ) {
                $raw = json_decode( file_get_contents( $path ), true );
                if ( is_array( $raw ) ) {
                    foreach ( $raw as $row ) {
                        if ( isset( $row['abbr'], $row['fips'] ) ) {
                            $map[ strtoupper( $row['abbr'] ) ] = (string) $row['fips'];
                        }
                    }
                }
            }
        }

        $key = strtoupper( (string) $abbr );
        return isset( $map[ $key ] ) ? $map[ $key ] : null;

    }

    public function get_cities() {
        $city_data = file_get_contents( VOS_TM_PATH . 'includes/assets/citydata.json' );

        // Decode before responding. Returning the raw string would make the
        // REST layer JSON-encode it a second time, so the client receives a
        // string rather than a FeatureCollection — which breaks the turf
        // consumers in SaveButton/BranchProcessor.
        return rest_ensure_response( json_decode( $city_data ) );
    }

    public function save_branch_cities( $request ) {

        $payload = $request->get_json_params();

        if ( ! isset( $payload['branch_cities'] ) ) {
            return new WP_Error( 'vos_tm_missing_data', 'branch_cities is required.', array( 'status' => 400 ) );
        }

        update_option( '_vos_tm_branch_cities', $payload['branch_cities'] );

        return rest_ensure_response( array( 'success' => true ) );

    }

    public function get_branch_cities( $request ) {

        $payload  = $request->get_params();
        $site_url = isset( $payload['site_url'] ) ? $payload['site_url'] : '';

        if ( $site_url === '' ) {
            return new WP_Error( 'vos_tm_missing_site_url', 'site_url is required.', array( 'status' => 400 ) );
        }

        $all_branch_cities = json_decode( get_option( '_vos_tm_branch_cities' ), true );
        if ( ! is_array( $all_branch_cities ) ) {
            return rest_ensure_response( array() );
        }

        $branch_id = $this->get_branch_id( $site_url );

        if ( $branch_id === null ) {
            return rest_ensure_response( array() );
        }

        $branch_cities_key = array_search( $branch_id, array_column( $all_branch_cities, 'branch' ) );

        if ( $branch_cities_key === false || ! isset( $all_branch_cities[ $branch_cities_key ]['cities'] ) ) {
            return rest_ensure_response( array() );
        }

        return rest_ensure_response( $all_branch_cities[ $branch_cities_key ]['cities'] );

    }

    /**
     * Resolves a branch post ID from its website URL (the _vos_branch_url
     * meta on the vos_branch CPT). Returns null when no branch matches.
     */
    public function get_branch_id( $site_url ) {

        $posts = get_posts( array(
            'post_type'   => 'vos_branch',
            'post_status' => 'publish',
            'numberposts' => 1,
            'meta_key'    => '_vos_branch_url',
            'meta_value'  => $site_url,
            'fields'      => 'ids',
        ) );

        return $posts ? (string) $posts[0] : null;

    }

    public function save_map_settings( $request ) {

        $payload = $request->get_json_params();

        if ( ! isset( $payload['id'], $payload['data'] ) ) {
            return new WP_Error( 'vos_tm_missing_data', 'Both id and data are required.', array( 'status' => 400 ) );
        }

        $key  = $payload['id'];
        $data = $payload['data'];

        // Allowlist the option keys this route may write. Without it, any user
        // with edit_vos_territory (the Map Manager role) could overwrite ANY
        // WordPress option — e.g. default_role or users_can_register — which is
        // a privilege-escalation hole. Restrict to the plugin's map-state keys.
        $allowed_keys = array(
            '_vos_tm_active_regions',
            '_vos_tm_active_subregions',
            '_vos_tm_branch_cities',
            '_vos_tm_playground_subregions',
        );

        if ( ! in_array( $key, $allowed_keys, true ) ) {
            return new WP_Error( 'vos_tm_bad_key', 'Unrecognized option key.', array( 'status' => 403 ) );
        }

        // Zip code enrichment on subregion save was removed —
        // that feature will be rebuilt from scratch in 3.0.

        update_option( $key, $data );

        return rest_ensure_response( array( 'success' => true, 'key' => $key ) );

    }

    public function rest_get_state( $fips ) {

        $state = $fips['id'];
        $path  = VOS_TM_PATH . 'includes/assets/states/' . $state . '.geojson';

        if ( ! file_exists( $path ) ) {
            return new WP_Error( 'vos_tm_no_state', 'State GeoJSON not found.', array( 'status' => 404 ) );
        }

        $state_json = json_decode( file_get_contents( $path ) );

        return rest_ensure_response( $state_json );

    }

    public function register() {

        $this->register_settings();
        $this->add_settings_sections();

    }

}
