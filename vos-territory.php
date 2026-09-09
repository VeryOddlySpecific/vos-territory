<?php
/**
 * Plugin Name: VOS Territory Map
 * Description: Mapping plugin to display and manage branch territory coverage.
 * Version: 2.8.1
 * Author: Alexander Steadman (VOS)
 * License: GPL2
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
    die;
}

// Define plugin constants
define( 'VOS_TM_PATH', plugin_dir_path( __FILE__ ) );
define( 'VOS_TM_URL', plugin_dir_url( __FILE__ ) );
define( 'VOS_TM_VERSION', '2.8.1' );

// Include plugin files
require_once VOS_TM_PATH . 'includes/class-vos-territory.php';

$plugin = new VOS_Territory();
$plugin->run();
