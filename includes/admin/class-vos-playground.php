<?php

/**
 * Registers the vos_playground Custom Post Type and its associated meta fields.
 *
 * Playgrounds are an independent territory category that overlaps the standard
 * branches — a county can belong to a branch AND a playground at the same time.
 * Their county assignments live in the separate _vos_tm_playground_subregions
 * option (parallel to _vos_tm_active_subregions for branches) so the two layers
 * never collide. The map flips between the two via the "view mode" toggle.
 *
 * Each playground post stores:
 *   _vos_playground_number      – legacy reference number (not used as the map key)
 *   _vos_playground_color       – hex color string, e.g. "#2f4f4f"
 *   _vos_playground_coordinates – JSON-encoded [lng, lat] array
 *   _vos_playground_url         – website URL
 *
 * Validation for these fields lives in VOS_Meta_Fields, shared with VOS_Branch.
 *
 * This intentionally mirrors VOS_Branch; the shared color/quick-edit machinery
 * is duplicated rather than abstracted so the working branch code stays
 * untouched. A future pass can extract a common base (see README).
 */
class VOS_Playground {

    public function register_cpt() {

        $labels = array(
            'name'               => 'Playgrounds',
            'singular_name'      => 'Playground',
            'add_new'            => 'Add New',
            'add_new_item'       => 'Add New Playground',
            'edit_item'          => 'Edit Playground',
            'new_item'           => 'New Playground',
            'view_item'          => 'View Playground',
            'search_items'       => 'Search Playgrounds',
            'not_found'          => 'No playgrounds found',
            'not_found_in_trash' => 'No playgrounds found in Trash',
            'menu_name'          => 'Playgrounds',
        );

        $args = array(
            'labels'          => $labels,
            'public'          => false,
            'show_ui'         => true,
            // Nest under the Territory Map top-level menu, next to Branches.
            'show_in_menu'    => 'vos-territory',
            'show_in_rest'    => true,   // required for the block editor
            'supports'        => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
            // Custom capability pair so admins and the Map Manager role can
            // CRUD playgrounds via the matching *_vos_playgrounds caps without
            // needing generic 'edit_posts'.
            'capability_type' => array( 'vos_playground', 'vos_playgrounds' ),
            'map_meta_cap'    => true,
            'has_archive'     => false,
            'rewrite'         => false,
            'query_var'       => false,
        );

        register_post_type( 'vos_playground', $args );

    }

    public function register_meta() {

        VOS_Meta_Fields::register( 'vos_playground', '_vos_playground_', 'edit_vos_playgrounds' );

    }

    /**
     * Enqueues the playground editor sidebar script only on vos_playground edit screens.
     */
    public function enqueue_editor_assets() {

        $screen = get_current_screen();
        if ( ! $screen || $screen->post_type !== 'vos_playground' ) return;

        wp_enqueue_script(
            'vos-playground-editor',
            VOS_TM_URL . 'build/playground-editor.js',
            array( 'wp-plugins', 'wp-editor', 'wp-components', 'wp-data', 'wp-core-data', 'wp-element' ),
            null,
            true
        );

    }

    /**
     * Returns all published playgrounds keyed by post ID (as string).
     * Mirrors VOS_Branch::get_branches_for_js() so the front-end can treat
     * the two entity maps identically.
     *
     * @return array  e.g. [ '42' => [ 'id' => 42, 'label' => '...', 'color' => '#...' ], ... ]
     */
    public static function get_playgrounds_for_js() {

        $posts = get_posts( array(
            'post_type'   => 'vos_playground',
            'numberposts' => -1,
            'post_status' => 'publish',
            'orderby'     => 'menu_order',
            'order'       => 'ASC',
        ) );

        $playgrounds = array();

        foreach ( $posts as $post ) {
            // Re-sanitized on read as well as on write; see get_branches_for_js().
            $coordinates = VOS_Meta_Fields::sanitize_coordinates( get_post_meta( $post->ID, '_vos_playground_coordinates', true ) );

            $playgrounds[ (string) $post->ID ] = array(
                'id'          => $post->ID,
                'label'       => $post->post_title,
                'color'       => VOS_Meta_Fields::sanitize_color( get_post_meta( $post->ID, '_vos_playground_color', true ) ),
                'coordinates' => $coordinates ? json_decode( $coordinates ) : null,
                'url'         => VOS_Meta_Fields::sanitize_url( get_post_meta( $post->ID, '_vos_playground_url', true ) ),
            );
        }

        return $playgrounds;

    }

    /**
     * Adds a "Color" column to the Playgrounds list table, rendering a swatch
     * plus the hex code.
     */
    public function list_columns( $cols ) {

        $new = array();
        foreach ( $cols as $key => $label ) {
            $new[ $key ] = $label;
            if ( $key === 'title' ) {
                $new['vos_playground_color'] = 'Color';
            }
        }
        return $new;

    }

    public function list_column_content( $column, $post_id ) {

        if ( $column !== 'vos_playground_color' ) return;

        $color = get_post_meta( $post_id, '_vos_playground_color', true );
        if ( ! $color ) {
            echo '—';
            return;
        }

        printf(
            '<span class="vos-playground-color-swatch" data-color="%1$s" style="display:inline-block;width:18px;height:18px;border:1px solid #ccc;border-radius:3px;vertical-align:middle;background:%1$s;"></span> <code style="font-size:11px;">%1$s</code>',
            esc_attr( $color )
        );

    }

    /**
     * Renders the color input inside the Quick Edit row.
     */
    public function quick_edit_box( $column, $post_type ) {

        if ( $post_type !== 'vos_playground' || $column !== 'vos_playground_color' ) return;

        wp_nonce_field( 'vos_playground_quick_edit', 'vos_playground_quick_edit_nonce' );
        ?>
        <fieldset class="inline-edit-col-right">
            <div class="inline-edit-col">
                <label>
                    <span class="title">Color</span>
                    <span class="input-text-wrap">
                        <input
                            type="color"
                            name="_vos_playground_color"
                            value="#000000"
                            class="vos-playground-color-input"
                            style="width:60px;height:28px;padding:0;vertical-align:middle;"
                        >
                    </span>
                </label>
            </div>
        </fieldset>
        <?php

    }

    /**
     * Saves the color from a Quick Edit submission. Guarded by the Quick Edit
     * nonce so this handler is a no-op on full-editor saves (where the
     * block-editor REST flow already handles meta updates).
     */
    public function save_quick_edit( $post_id ) {

        if ( ! isset( $_POST['vos_playground_quick_edit_nonce'] ) )                                       return;
        if ( ! wp_verify_nonce( $_POST['vos_playground_quick_edit_nonce'], 'vos_playground_quick_edit' ) ) return;
        if ( ! current_user_can( 'edit_post', $post_id ) )                                                return;
        if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) )                         return;

        if ( isset( $_POST['_vos_playground_color'] ) ) {
            $raw = sanitize_text_field( wp_unslash( $_POST['_vos_playground_color'] ) );
            if ( preg_match( '/^#[0-9a-f]{6}$/i', $raw ) ) {
                update_post_meta( $post_id, '_vos_playground_color', $raw );
            }
        }

    }

    /**
     * Seeds the Quick Edit color input from the swatch's data-color attribute
     * when the row expands (WP doesn't auto-populate custom meta fields).
     */
    public function quick_edit_script() {

        $screen = get_current_screen();
        if ( ! $screen || $screen->post_type !== 'vos_playground' ) return;
        ?>
        <script>
        ( function () {
            var $ = window.jQuery;
            if ( ! $ || ! window.inlineEditPost ) return;

            var originalEdit = inlineEditPost.edit;
            inlineEditPost.edit = function ( id ) {
                originalEdit.apply( this, arguments );

                var postId = ( typeof id === 'object' ) ? this.getId( id ) : id;
                if ( ! postId ) return;

                var color = $( '#post-' + postId ).find( '.vos-playground-color-swatch' ).data( 'color' );
                if ( color ) {
                    $( '#edit-' + postId ).find( 'input.vos-playground-color-input' ).val( color );
                }
            };
        } )();
        </script>
        <?php

    }

    public function run() {
        add_action( 'init',                        array( $this, 'register_cpt' ) );
        add_action( 'init',                        array( $this, 'register_meta' ) );
        add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_editor_assets' ) );

        add_filter( 'manage_vos_playground_posts_columns',       array( $this, 'list_columns' ) );
        add_action( 'manage_vos_playground_posts_custom_column', array( $this, 'list_column_content' ), 10, 2 );
        add_action( 'quick_edit_custom_box',                     array( $this, 'quick_edit_box' ), 10, 2 );
        add_action( 'save_post_vos_playground',                  array( $this, 'save_quick_edit' ) );
        add_action( 'admin_footer-edit.php',                     array( $this, 'quick_edit_script' ) );
    }

}
