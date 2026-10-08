<?php

/**
 * Shared meta registration and sanitizing for the vos_branch and
 * vos_playground CPTs.
 *
 * Both post types store the same four fields under their own prefix:
 *   *_number      – legacy reference number (non-negative integer)
 *   *_color       – hex color, stored as lowercase #rrggbb
 *   *_url         – absolute http(s) URL
 *   *_coordinates – JSON-encoded [lng, lat] array
 *
 * These values end up in admin markup (Print Map) and in public links
 * (Branch Finder), and the roles that can write them are lower-privileged
 * than the admins who view them. So every field gets a sanitize_callback,
 * which runs on every write through the meta API (REST, block editor,
 * update_post_meta), and the string fields get a REST schema so the block
 * editor gets a 400 for a bad value instead of a silent save.
 */
class VOS_Meta_Fields {

    /**
     * Bump when a sanitizer changes so repair_stored_values() runs again.
     */
    const REPAIR_VERSION = '1';

    const REPAIR_OPTION = '_vos_tm_meta_repair_version';

    /**
     * Post type => meta key prefix.
     */
    const POST_TYPES = array(
        'vos_branch'     => '_vos_branch_',
        'vos_playground' => '_vos_playground_',
    );

    /**
     * Registers the four fields for one post type.
     *
     * @param string $post_type  e.g. 'vos_branch'
     * @param string $prefix     e.g. '_vos_branch_'
     * @param string $cap        primitive edit cap for the post type
     */
    public static function register( $post_type, $prefix, $cap ) {

        foreach ( self::fields() as $field => $args ) {
            register_post_meta( $post_type, $prefix . $field, array_merge( $args, array(
                'single'        => true,
                // Required so the block editor's data store can write meta via the REST API.
                'auth_callback' => function() use ( $cap ) {
                    return current_user_can( $cap );
                },
            ) ) );
        }

    }

    /**
     * Field suffix => register_post_meta() args.
     *
     * The REST patterns allow an empty string because the block editor
     * sends the whole meta object on save, including fields that were
     * never set.
     */
    private static function fields() {

        return array(
            'number' => array(
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
                'show_in_rest'      => true,
            ),
            'color' => array(
                'type'              => 'string',
                'sanitize_callback' => array( __CLASS__, 'sanitize_color' ),
                'show_in_rest'      => array(
                    'schema' => array(
                        'type'    => 'string',
                        'pattern' => '^(#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6})?$',
                    ),
                ),
            ),
            'url' => array(
                'type'              => 'string',
                'sanitize_callback' => array( __CLASS__, 'sanitize_url' ),
                'show_in_rest'      => array(
                    'schema' => array(
                        'type'    => 'string',
                        'pattern' => '^((?i)https?://\S+)?$',
                    ),
                ),
            ),
            'coordinates' => array(
                'type'              => 'string',
                'sanitize_callback' => array( __CLASS__, 'sanitize_coordinates' ),
                'show_in_rest'      => true,
            ),
        );

    }

    /**
     * Returns a lowercase #rrggbb color, or '' for anything else.
     * Short #rgb input is expanded so every consumer can rely on one format.
     */
    public static function sanitize_color( $value ) {

        if ( ! is_scalar( $value ) ) return '';

        $color = sanitize_hex_color( trim( (string) $value ) );
        if ( ! $color ) return '';

        if ( strlen( $color ) === 4 ) {
            $color = '#' . $color[1] . $color[1] . $color[2] . $color[2] . $color[3] . $color[3];
        }

        return strtolower( $color );

    }

    /**
     * Returns an absolute http(s) URL, or '' for anything else. Drops
     * javascript:, data:, relative and protocol-relative URLs.
     */
    public static function sanitize_url( $value ) {

        if ( ! is_scalar( $value ) ) return '';

        // Wrapped rather than passed to register_post_meta() directly: meta
        // sanitize callbacks receive the meta key as their second argument,
        // which esc_url_raw() would read as its protocol list.
        $url = esc_url_raw( trim( (string) $value ), array( 'http', 'https' ) );

        return preg_match( '#^https?://#i', $url ) ? $url : '';

    }

    /**
     * Returns a JSON-encoded [lng, lat] pair of in-range numbers, or ''.
     * Accepts the JSON string or an already-decoded array.
     */
    public static function sanitize_coordinates( $value ) {

        if ( is_string( $value ) ) {
            $value = json_decode( $value, true );
        }

        // A plain two-item list only; {"a":1,"b":2} is not a coordinate pair.
        if ( ! is_array( $value ) || array_keys( $value ) !== array( 0, 1 ) ) return '';

        list( $lng, $lat ) = $value;

        if ( ! is_numeric( $lng ) || ! is_numeric( $lat ) ) return '';

        $lng = (float) $lng;
        $lat = (float) $lat;

        // Also rejects INF, which is_numeric() lets through for e.g. "1e999".
        if ( abs( $lng ) > 180 || abs( $lat ) > 90 ) return '';

        return wp_json_encode( array( $lng, $lat ) );

    }

    /**
     * One-time pass that re-sanitizes values saved before the callbacks
     * existed. A sanitize_callback only runs on new writes, so a payload
     * stored earlier would otherwise still reach the Print window and the
     * Branch Finder. It also keeps the block editor from failing on save:
     * the editor sends existing values back, and the REST schema would
     * reject an old bad value.
     *
     * Runs once per REPAIR_VERSION, on the first admin page load after an
     * update.
     */
    public static function maybe_repair_stored_values() {

        if ( get_option( self::REPAIR_OPTION ) === self::REPAIR_VERSION ) return;

        foreach ( self::POST_TYPES as $post_type => $prefix ) {

            $ids = get_posts( array(
                'post_type'   => $post_type,
                'post_status' => array( 'publish', 'future', 'draft', 'pending', 'private', 'trash' ),
                'numberposts' => -1,
                'fields'      => 'ids',
            ) );

            foreach ( $ids as $id ) {
                foreach ( self::fields() as $field => $args ) {

                    $key = $prefix . $field;
                    if ( ! metadata_exists( 'post', $id, $key ) ) continue;

                    $old = get_post_meta( $id, $key, true );
                    $new = call_user_func( $args['sanitize_callback'], $old );

                    if ( (string) $new === (string) $old ) continue;

                    if ( $new === '' ) {
                        delete_post_meta( $id, $key );
                    } else {
                        update_post_meta( $id, $key, $new );
                    }

                }
            }

        }

        update_option( self::REPAIR_OPTION, self::REPAIR_VERSION, false );

    }

}
