<?php
/**
 * Plugin Name: Northline content types
 * Description: Products, projects and inventory for the Northline demo site.
 */

add_action( 'init', function () {
	$types = [
		'product'   => [ 'Products', 'Product', 'products' ],
		'project'   => [ 'Projects', 'Project', 'projects' ],
		'inventory' => [ 'Inventory', 'Inventory unit', 'inventory' ],
	];
	foreach ( $types as $type => [ $plural, $singular, $slug ] ) {
		register_post_type( $type, [
			'labels'       => [ 'name' => $plural, 'singular_name' => $singular ],
			'public'       => true,
			'show_in_rest' => true,
			'has_archive'  => $slug,
			'rewrite'      => [ 'slug' => $slug, 'with_front' => false ],
			'supports'     => [ 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields' ],
			'menu_icon'    => 'dashicons-hammer',
		] );
	}

	register_taxonomy( 'product_category', [ 'product' ], [
		'labels'            => [ 'name' => 'Product categories', 'singular_name' => 'Product category' ],
		'public'            => true,
		'hierarchical'      => true,
		'show_in_rest'      => true,
		'show_admin_column' => true,
		'rewrite'           => [ 'slug' => 'product-category', 'with_front' => false ],
	] );
} );

// Field groups live in code so the site can be rebuilt from scratch.
add_action( 'acf/include_fields', function () {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}
	$group = function ( $key, $title, $type, $fields ) {
		acf_add_local_field_group( [
			'key'          => "group_nl_$key",
			'title'        => $title,
			'fields'       => $fields,
			'location'     => [ [ [ 'param' => 'post_type', 'operator' => '==', 'value' => $type ] ] ],
			'show_in_rest' => 1,
		] );
	};
	$field = function ( $name, $label, $type, $extra = [] ) {
		return array_merge( [ 'key' => "field_nl_$name", 'name' => $name, 'label' => $label, 'type' => $type ], $extra );
	};

	$group( 'product', 'Product details', 'product', [
		$field( 'sku', 'SKU', 'text' ),
		$field( 'specs', 'Specifications (one "Key: Value" per line)', 'textarea' ),
		$field( 'datasheet', 'Datasheet (PDF)', 'file', [ 'return_format' => 'id', 'mime_types' => 'pdf' ] ),
	] );
	$group( 'inventory', 'Inventory details', 'inventory', [
		$field( 'price', 'Price (USD)', 'number' ),
		$field( 'status', 'Status', 'select', [ 'choices' => [ 'available' => 'Available', 'reserved' => 'Reserved', 'sold' => 'Sold' ] ] ),
		$field( 'condition', 'Condition', 'text' ),
	] );
	$group( 'project', 'Project details', 'project', [
		$field( 'client_type', 'Client type', 'text' ),
		$field( 'location', 'Location', 'text' ),
		$field( 'year', 'Year', 'number' ),
	] );
} );
