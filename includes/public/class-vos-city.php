<?php

class VOS_City {

    public $city_name;
    public $city_state;
    public $city_pop;
    public $city_coords;

    public function __construct( $city_data ) {

        $this->city_name   = $city_data['properties']['city'];
        $this->city_state  = $city_data['properties']['state'];
        $this->city_pop    = $city_data['properties']['pop'];
        $this->city_coords = $city_data['geometry']['coordinates'];

    }

    public function create_post() {

        $post_id = wp_insert_post( array(
            'post_title'  => $this->city_name,
            'post_type'   => 'city',
            'post_status' => 'publish',
        ) );

        return $post_id;

    }

    public function set_post_meta( $post_id ) {

        update_post_meta( $post_id, 'city_state',  $this->city_state );
        update_post_meta( $post_id, 'city_pop',    $this->city_pop );
        update_post_meta( $post_id, 'city_coords', $this->city_coords );

    }

    public function run() {
        $post_id = $this->create_post();

        if ( $post_id ) {
            $this->set_post_meta( $post_id );
        }
    }
}
