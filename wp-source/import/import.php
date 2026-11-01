<?php
/**
 * Imports Northline demo content from /content (run with `wp eval-file`).
 * Keyed by slug: re-running updates existing posts instead of duplicating.
 */

require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

const NL_DIR = '/content';

function nl_json( $file ) {
	return json_decode( file_get_contents( NL_DIR . "/$file" ), true, 512, JSON_THROW_ON_ERROR );
}

/** Attachment for a media file, imported once (tracked by _nl_source). */
function nl_media( $file, $parent = 0 ) {
	$found = get_posts( [ 'post_type' => 'attachment', 'post_status' => 'inherit', 'numberposts' => 1,
		'meta_key' => '_nl_source', 'meta_value' => $file, 'fields' => 'ids' ] );
	if ( $found ) {
		return $found[0];
	}
	$tmp = wp_tempnam( $file );
	copy( NL_DIR . "/media/$file", $tmp );
	$id = media_handle_sideload( [ 'name' => $file, 'tmp_name' => $tmp ], $parent );
	if ( is_wp_error( $id ) ) {
		WP_CLI::error( "$file: " . $id->get_error_message() );
	}
	update_post_meta( $id, '_nl_source', $file );
	return $id;
}

/** Create or update a post by type + slug. */
function nl_upsert( $type, $slug, $title, $content, $extra = [] ) {
	$existing = get_page_by_path( $slug, OBJECT, $type );
	$data = array_merge( [
		'post_type'    => $type,
		'post_name'    => $slug,
		'post_title'   => $title,
		'post_content' => $content,
		'post_status'  => 'publish',
	], $extra );
	if ( $existing ) {
		$data['ID'] = $existing->ID;
	}
	$id = wp_insert_post( wp_slash( $data ), true );
	if ( is_wp_error( $id ) ) {
		WP_CLI::error( "$type/$slug: " . $id->get_error_message() );
	}
	return $id;
}

function nl_meta( $id, $fields ) {
	foreach ( $fields as $name => $value ) {
		update_post_meta( $id, $name, $value );
		update_post_meta( $id, "_$name", "field_nl_$name" );
	}
}

function nl_seo( $id, $title, $desc ) {
	update_post_meta( $id, '_yoast_wpseo_title', $title . ' | Northline Industrial Supply' );
	update_post_meta( $id, '_yoast_wpseo_metadesc', $desc );
}

function nl_gallery( $files ) {
	$html = '';
	foreach ( $files as $file ) {
		$id   = nl_media( $file );
		$html .= '<figure class="wp-block-image size-large">' . wp_get_attachment_image( $id, 'large' ) . '</figure>';
	}
	return $html;
}

// Defaults from a fresh install.
foreach ( [ [ 'post', 'hello-world' ], [ 'page', 'sample-page' ] ] as [ $type, $slug ] ) {
	if ( $p = get_page_by_path( $slug, OBJECT, $type ) ) {
		wp_delete_post( $p->ID, true );
	}
}

// Products.
$catalog = nl_json( 'products.json' );
foreach ( $catalog['categories'] as $c ) {
	$term = term_exists( $c['slug'], 'product_category' );
	if ( ! $term ) {
		wp_insert_term( $c['name'], 'product_category', [ 'slug' => $c['slug'], 'description' => $c['description'] ] );
	}
}
foreach ( $catalog['products'] as $p ) {
	$id = nl_upsert( 'product', $p['slug'], $p['title'], $p['body'], [ 'post_excerpt' => $p['excerpt'] ] );
	wp_set_object_terms( $id, $p['category'], 'product_category' );
	set_post_thumbnail( $id, nl_media( "product-{$p['slug']}.jpg", $id ) );
	nl_meta( $id, [ 'sku' => $p['sku'], 'specs' => $p['specs'], 'datasheet' => nl_media( "datasheet-{$p['slug']}.pdf", $id ) ] );
	nl_seo( $id, $p['title'], $p['excerpt'] );
}

// Inventory.
foreach ( nl_json( 'inventory.json' ) as $i ) {
	$id = nl_upsert( 'inventory', $i['slug'], $i['title'], $i['body'] );
	set_post_thumbnail( $id, nl_media( "inventory-{$i['slug']}.jpg", $id ) );
	nl_meta( $id, [ 'price' => $i['price'], 'status' => $i['status'], 'condition' => $i['condition'] ] );
	nl_seo( $id, $i['title'], wp_strip_all_tags( $i['body'] ) );
}

// Projects.
foreach ( nl_json( 'projects.json' ) as $p ) {
	$body = $p['body'];
	if ( $p['gallery'] ) {
		$files = array_map( fn( $n ) => "project-{$p['slug']}-$n.jpg", range( 1, $p['gallery'] ) );
		$body .= '<figure class="wp-block-gallery has-nested-images columns-3">' . nl_gallery( $files ) . '</figure>';
	}
	$id = nl_upsert( 'project', $p['slug'], $p['title'], $body );
	set_post_thumbnail( $id, nl_media( "project-{$p['slug']}.jpg", $id ) );
	nl_meta( $id, [ 'client_type' => $p['client_type'], 'location' => $p['location'], 'year' => $p['year'] ] );
	nl_seo( $id, $p['title'], wp_strip_all_tags( $p['body'] ) );
}

// Blog.
$blog = nl_json( 'posts.json' );
foreach ( $blog['categories'] as $c ) {
	if ( ! term_exists( $c['slug'], 'category' ) ) {
		wp_insert_term( $c['name'], 'category', [ 'slug' => $c['slug'] ] );
	}
}
foreach ( $blog['posts'] as $p ) {
	$id = nl_upsert( 'post', $p['slug'], $p['title'], $p['body'], [ 'post_date' => $p['date'] . ' 09:00:00' ] );
	wp_set_object_terms( $id, $p['category'], 'category' );
	set_post_thumbnail( $id, nl_media( "post-{$p['slug']}.jpg", $id ) );
	nl_seo( $id, $p['title'], wp_trim_words( wp_strip_all_tags( $p['body'] ), 25 ) );
}
if ( $uncat = get_term_by( 'slug', 'uncategorized', 'category' ) ) {
	if ( (int) get_option( 'default_category' ) === (int) $uncat->term_id ) {
		update_option( 'default_category', get_term_by( 'slug', 'company-news', 'category' )->term_id );
	}
	wp_delete_term( $uncat->term_id, 'category' );
}

// Quote form (Contact Form 7).
$form = get_page_by_path( 'request-a-quote-form', OBJECT, 'wpcf7_contact_form' );
if ( ! $form ) {
	$cf = WPCF7_ContactForm::get_template( [ 'title' => 'Request a quote' ] );
	$cf->set_properties( [ 'form' => "<label>Name [text* your-name]</label>\n<label>Company [text company]</label>\n<label>Email [email* your-email]</label>\n<label>Message [textarea* your-message]</label>\n[submit \"Send request\"]" ] );
	$cf->save();
	wp_update_post( [ 'ID' => $cf->id(), 'post_name' => 'request-a-quote-form' ] );
	$form = get_post( $cf->id() );
}
$shortcode = sprintf( '[contact-form-7 id="%d" title="Request a quote"]', $form->ID );

// Pages.
foreach ( nl_json( 'pages.json' ) as $p ) {
	$body = str_replace( '{{CF7}}', $shortcode, $p['body'] );
	if ( str_contains( $body, '{{GALLERY:about}}' ) ) {
		$body = str_replace( '{{GALLERY:about}}', nl_gallery( [ 'about-workshop-1.jpg', 'about-workshop-2.jpg', 'about-workshop-3.jpg' ] ), $body );
	}
	$id = nl_upsert( 'page', $p['slug'], $p['title'], $body );
	nl_seo( $id, $p['title'], wp_trim_words( wp_strip_all_tags( $body ), 25 ) ?: $p['title'] );
	if ( ! empty( $p['front'] ) ) {
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $id );
	}
	if ( ! empty( $p['posts_page'] ) ) {
		update_option( 'page_for_posts', $id );
	}
	if ( $p['slug'] === 'privacy-policy' ) {
		update_option( 'wp_page_for_privacy_policy', $id );
	}
}

// Retired pages stay published on WordPress; the migration turns them into redirects.
foreach ( nl_json( 'retired.json' ) as $p ) {
	$id = nl_upsert( 'page', $p['slug'], $p['title'], $p['body'] );
	nl_seo( $id, $p['title'], wp_strip_all_tags( $p['body'] ) );
}

WP_CLI::success( 'Northline content imported.' );
