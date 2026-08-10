<?php
/**
 * head のメタ。
 *
 * 静的サイトでは記事ごとの OGP が出せなかった（SNS のクローラは JS を
 * 実行しないので、全記事が同じカードになっていた）。
 * WP では slug ごとに静的へ出せるので、その制限がここで解ける。
 *
 * @package spotlight-shizuoka
 */

defined( 'ABSPATH' ) || exit;

add_action( 'wp_head', 'spot_head_meta', 2 );

function spot_head_meta() {
	$url   = spot_current_url();
	$title = wp_get_document_title();
	$desc  = spot_description();
	$image = spot_ogp_image();
	$type  = is_singular( 'story' ) ? 'article' : 'website';

	printf( '<link rel="canonical" href="%s" />' . "\n", esc_url( $url ) );
	printf( '<meta name="description" content="%s" />' . "\n", esc_attr( $desc ) );

	printf( '<meta property="og:type" content="%s" />' . "\n", esc_attr( $type ) );
	printf( '<meta property="og:site_name" content="%s" />' . "\n", esc_attr( get_bloginfo( 'name' ) ) );
	printf( '<meta property="og:title" content="%s" />' . "\n", esc_attr( $title ) );
	printf( '<meta property="og:description" content="%s" />' . "\n", esc_attr( $desc ) );
	printf( '<meta property="og:url" content="%s" />' . "\n", esc_url( $url ) );
	printf( '<meta property="og:locale" content="ja_JP" />' . "\n" );

	if ( $image ) {
		printf( '<meta property="og:image" content="%s" />' . "\n", esc_url( $image['url'] ) );
		if ( $image['width'] ) {
			printf( '<meta property="og:image:width" content="%d" />' . "\n", (int) $image['width'] );
			printf( '<meta property="og:image:height" content="%d" />' . "\n", (int) $image['height'] );
		}
	}

	printf( '<meta name="twitter:card" content="summary_large_image" />' . "\n" );
	printf( '<meta name="theme-color" content="%s" />' . "\n", is_singular( 'story' ) ? '#EDEDED' : '#0B1B2E' );
}

/** いま表示している URL。 */
function spot_current_url() {
	if ( is_singular() ) {
		return get_permalink();
	}
	if ( is_front_page() ) {
		return home_url( '/' );
	}

	return home_url( add_query_arg( array() ) );
}

/** 説明文。記事は略歴、それ以外は抜粋かサイトのリード文。 */
function spot_description() {
	if ( is_singular( 'story' ) ) {
		$profile = (string) get_field( 'profile', get_the_ID() );
		if ( $profile ) {
			return wp_trim_words( $profile, 60, '…' );
		}
		return wp_trim_words( wp_strip_all_tags( get_the_content() ), 60, '…' );
	}

	if ( is_singular() && has_excerpt() ) {
		return wp_strip_all_tags( get_the_excerpt() );
	}

	$catch = function_exists( 'get_field' ) ? (string) get_field( 'catch', 'option' ) : '';

	return $catch ? $catch : (string) get_bloginfo( 'description' );
}

/**
 * OGP 画像。記事は顔写真、それ以外は設定の既定画像。
 *
 * @return array{url:string,width:int,height:int}|null
 */
function spot_ogp_image() {
	$id = 0;

	if ( is_singular( 'story' ) ) {
		$id = spot_portrait_id( get_the_ID() );
	}

	if ( ! $id && function_exists( 'get_field' ) ) {
		$fallback = get_field( 'ogp_image', 'option' );
		if ( is_array( $fallback ) && isset( $fallback['ID'] ) ) {
			$id = (int) $fallback['ID'];
		}
	}

	if ( ! $id ) {
		return null;
	}

	$src = wp_get_attachment_image_src( $id, 'full' );

	return $src ? array(
		'url'    => $src[0],
		'width'  => (int) $src[1],
		'height' => (int) $src[2],
	) : null;
}

/* 記事タイトルは「所属 氏名 ｜ サイト名」。静的サイトと揃える */
add_filter( 'document_title_parts', 'spot_title_parts' );

function spot_title_parts( $parts ) {
	if ( is_singular( 'story' ) ) {
		$company = (string) get_field( 'company', get_the_ID() );
		$person  = (string) get_field( 'person', get_the_ID() );

		if ( $company || $person ) {
			$parts['title'] = trim( $company . ' ' . $person );
		}
	}

	return $parts;
}

add_filter( 'document_title_separator', static function () {
	return '｜';
} );
