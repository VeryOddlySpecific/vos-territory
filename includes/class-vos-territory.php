<?php

class VOS_Territory {

    private $admin;
    private $public;
    private $branch;
    private $playground;

    public function __construct() {

        $this->load_deps();
        $this->set_controls();

    }

    private function load_deps() {

        require_once VOS_TM_PATH . 'includes/admin/class-vos-meta-fields.php';
        require_once VOS_TM_PATH . 'includes/admin/class-vos-branch.php';
        require_once VOS_TM_PATH . 'includes/admin/class-vos-playground.php';
        require_once VOS_TM_PATH . 'includes/admin/class-vos-admin.php';
        require_once VOS_TM_PATH . 'includes/public/class-vos-public.php';

    }

    private function set_controls() {

        $this->branch     = new VOS_Branch();
        $this->playground = new VOS_Playground();
        $this->admin      = new VOS_Admin();
        $this->public     = new VOS_Public();

    }

    public function run() {

        $this->branch->run();
        $this->playground->run();
        $this->admin->run();
        $this->public->run();

        add_action( 'admin_init', array( 'VOS_Meta_Fields', 'maybe_repair_stored_values' ) );

    }
}
