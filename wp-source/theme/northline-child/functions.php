<?php
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style( 'northline', get_stylesheet_uri(), [], wp_get_theme()->get( 'Version' ) );
} );

add_action( 'wp_footer', function () {
	echo '<p class="nl-demo-note" style="text-align:center">Demo project — fictional company.</p>';
} );
