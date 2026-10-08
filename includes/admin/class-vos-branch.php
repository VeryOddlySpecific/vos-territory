<?php

/**
 * Registers the vos_branch Custom Post Type and its associated meta fields.
 *
 * Each branch post stores:
 *   _vos_branch_number      – legacy reference number (not used as the map key)
 *   _vos_branch_color       – hex color string, e.g. "#2f4f4f"
 *   _vos_branch_coordinates – JSON-encoded [lng, lat] array
 *   _vos_branch_url         – branch website URL
 *
 * Validation for these fields lives in VOS_Meta_Fields.
 *
 * Style objects (style / activeStyle) are computed client-side from the color.
 * The post ID is used as the branch key throughout the map app.
 */
class VOS_Branch {

    public function register_cpt() {

        $labels = array(
            'name'               => 'Branches',
            'singular_name'      => 'Branch',
            'add_new'            => 'Add New',
            'add_new_item'       => 'Add New Branch',
            'edit_item'          => 'Edit Branch',
            'new_item'           => 'New Branch',
            'view_item'          => 'View Branch',
            'search_items'       => 'Search Branches',
            'not_found'          => 'No branches found',
            'not_found_in_trash' => 'No branches found in Trash',
            'menu_name'          => 'Branches',
        );

        $args = array(
            'labels'          => $labels,
            'public'          => false,
            'show_ui'         => true,
            // Nest under the Territory Map top-level menu instead of getting
            // its own sidebar item.
            'show_in_menu'    => 'vos-territory',
            'show_in_rest'    => true,   // required for the block editor
            'supports'        => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
            // Custom capability pair so admins and the Map Manager role
            // can CRUD branches via the matching *_vos_branches caps
            // without needing generic 'edit_posts' (which would expose the
            // full Posts admin).
            'capability_type' => array( 'vos_branch', 'vos_branches' ),
            'map_meta_cap'    => true,
            'has_archive'     => false,
            'rewrite'         => false,
            'query_var'       => false,
        );

        register_post_type( 'vos_branch', $args );

    }

    public function register_meta() {

        // edit_vos_branches is the CPT's primitive "edit" cap — granted
        // to administrators and the Map Manager role.
        VOS_Meta_Fields::register( 'vos_branch', '_vos_branch_', 'edit_vos_branches' );

    }

    /**
     * Enqueues the branch editor sidebar script only on vos_branch edit screens.
     */
    public function enqueue_editor_assets() {

        $screen = get_current_screen();
        if ( ! $screen || $screen->post_type !== 'vos_branch' ) return;

        wp_enqueue_script(
            'vos-branch-editor',
            VOS_TM_URL . 'build/branch-editor.js',
            array( 'wp-plugins', 'wp-editor', 'wp-components', 'wp-data', 'wp-core-data', 'wp-element' ),
            null,
            true
        );

    }

    /**
     * Returns all published branches keyed by post ID (as string).
     * Used by the admin display class to pass branch data to the JS map app
     * via wp_localize_script.
     *
     * @return array  e.g. [ '42' => [ 'id' => 42, 'label' => '...', 'color' => '#...' ], ... ]
     */
    public static function get_branches_for_js() {

        $posts = get_posts( array(
            'post_type'   => 'vos_branch',
            'numberposts' => -1,
            'post_status' => 'publish',
            'orderby'     => 'menu_order',
            'order'       => 'ASC',
        ) );

        $branches = array();

        foreach ( $posts as $post ) {
            // Re-sanitized on read as well as on write, so a value that got
            // into the database some other way (direct SQL, a migration)
            // still can't reach the Print window or the Branch Finder.
            $coordinates = VOS_Meta_Fields::sanitize_coordinates( get_post_meta( $post->ID, '_vos_branch_coordinates', true ) );

            $branches[ (string) $post->ID ] = array(
                'id'          => $post->ID,
                'label'       => $post->post_title,
                'color'       => VOS_Meta_Fields::sanitize_color( get_post_meta( $post->ID, '_vos_branch_color', true ) ),
                'coordinates' => $coordinates ? json_decode( $coordinates ) : null,
                'url'         => VOS_Meta_Fields::sanitize_url( get_post_meta( $post->ID, '_vos_branch_url', true ) ),
            );
        }

        return $branches;

    }

    /**
     * Adds a "Color" column to the Branches list table, rendering a swatch
     * plus the hex code. The swatch's data-color attribute is what the
     * Quick Edit JS reads to pre-populate the color input.
     */
    public function list_columns( $cols ) {

        $new = array();
        foreach ( $cols as $key => $label ) {
            $new[ $key ] = $label;
            if ( $key === 'title' ) {
                $new['vos_branch_color'] = 'Color';
            }
        }
        return $new;

    }

    public function list_column_content( $column, $post_id ) {

        if ( $column !== 'vos_branch_color' ) return;

        $color = get_post_meta( $post_id, '_vos_branch_color', true );
        if ( ! $color ) {
            echo '—';
            return;
        }

        printf(
            '<span class="vos-branch-color-swatch" data-color="%1$s" style="display:inline-block;width:18px;height:18px;border:1px solid #ccc;border-radius:3px;vertical-align:middle;background:%1$s;"></span> <code style="font-size:11px;">%1$s</code>',
            esc_attr( $color )
        );

    }

    /**
     * Renders the color input inside the Quick Edit row. WP only calls this
     * for columns registered via list_columns(), so checking the column name
     * keeps us from double-rendering in unrelated Quick Edit columns.
     */
    public function quick_edit_box( $column, $post_type ) {

        if ( $post_type !== 'vos_branch' || $column !== 'vos_branch_color' ) return;

        wp_nonce_field( 'vos_branch_quick_edit', 'vos_branch_quick_edit_nonce' );
        ?>
        <fieldset class="inline-edit-col-right">
            <div class="inline-edit-col">
                <label>
                    <span class="title">Color</span>
                    <span class="input-text-wrap">
                        <input
                            type="color"
                            name="_vos_branch_color"
                            value="#000000"
                            class="vos-branch-color-input"
                            style="width:60px;height:28px;padding:0;vertical-align:middle;"
                        >
                    </span>
                </label>
            </div>
        </fieldset>
        <?php

    }

    /**
     * Saves the color from a Quick Edit submission. Guarded by the Quick
     * Edit nonce so this handler is a no-op on full-editor saves (where
     * the block-editor REST flow already handles meta updates).
     */
    public function save_quick_edit( $post_id ) {

        if ( ! isset( $_POST['vos_branch_quick_edit_nonce'] ) )                              return;
        if ( ! wp_verify_nonce( $_POST['vos_branch_quick_edit_nonce'], 'vos_branch_quick_edit' ) ) return;
        if ( ! current_user_can( 'edit_post', $post_id ) )                                   return;
        if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) )            return;

        if ( isset( $_POST['_vos_branch_color'] ) ) {
            $raw = sanitize_text_field( wp_unslash( $_POST['_vos_branch_color'] ) );
            if ( preg_match( '/^#[0-9a-f]{6}$/i', $raw ) ) {
                update_post_meta( $post_id, '_vos_branch_color', $raw );
            }
        }

    }

    /**
     * WP's Quick Edit doesn't auto-populate custom meta fields — we have to
     * seed the input ourselves when the row expands. We read the existing
     * value from the swatch's data-color attribute in the list row.
     */
    public function quick_edit_script() {

        $screen = get_current_screen();
        if ( ! $screen || $screen->post_type !== 'vos_branch' ) return;
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

                var color = $( '#post-' + postId ).find( '.vos-branch-color-swatch' ).data( 'color' );
                if ( color ) {
                    $( '#edit-' + postId ).find( 'input.vos-branch-color-input' ).val( color );
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

        add_filter( 'manage_vos_branch_posts_columns',       array( $this, 'list_columns' ) );
        add_action( 'manage_vos_branch_posts_custom_column', array( $this, 'list_column_content' ), 10, 2 );
        add_action( 'quick_edit_custom_box',                 array( $this, 'quick_edit_box' ), 10, 2 );
        add_action( 'save_post_vos_branch',                  array( $this, 'save_quick_edit' ) );
        add_action( 'admin_footer-edit.php',                 array( $this, 'quick_edit_script' ) );
    }

}
