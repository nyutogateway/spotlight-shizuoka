<?php
/**
 * SPOTLIGHT SHIZUOKA テーマ。
 *
 * 静的サイトの assets/css/style.css と assets/js/main.js を
 * そのまま使う前提で組んである。クラス名と DOM の形を変えると
 * Hero の演出も VOICE の送りも止まるので、出力するマークアップは
 * 静的サイト側に合わせること。
 *
 * @package spotlight-shizuoka
 */

defined( 'ABSPATH' ) || exit;

require_once get_theme_file_path( 'inc/helpers.php' );
require_once get_theme_file_path( 'inc/post-types.php' );
require_once get_theme_file_path( 'inc/acf-fields.php' );
require_once get_theme_file_path( 'inc/blocks.php' );
require_once get_theme_file_path( 'inc/meta.php' );

/* ----------------------------------------------------------------------
   テーマの土台
   ---------------------------------------------------------------------- */
add_action( 'after_setup_theme', 'spot_setup' );

function spot_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'style', 'script', 'gallery', 'caption' ) );
	add_theme_support( 'responsive-embeds' );

	register_nav_menus( array( 'footer' => 'フッター' ) );
}

/**
 * ファイルの更新時刻を版として使う。
 * 触ったぶんだけキャッシュが切れるので、手で番号を上げなくてよい。
 *
 * @param string $rel テーマからの相対パス。
 * @return string
 */
function spot_asset_version( $rel ) {
	$path = get_theme_file_path( $rel );

	return file_exists( $path ) ? (string) filemtime( $path ) : '0';
}

/* ----------------------------------------------------------------------
   読み込み
   ---------------------------------------------------------------------- */
add_action( 'wp_enqueue_scripts', 'spot_assets' );

function spot_assets() {
	// 既定のブロック CSS は当たりが被るので外す
	wp_dequeue_style( 'wp-block-library' );
	wp_dequeue_style( 'global-styles' );

	wp_enqueue_style(
		'spot',
		get_theme_file_uri( 'assets/css/style.css' ),
		array(),
		spot_asset_version( 'assets/css/style.css' )
	);

	wp_enqueue_style(
		'spot-fonts',
		'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&family=Shippori+Mincho+B1:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500&display=swap',
		array(),
		null
	);

	/* Hero の演出。TOP でしか使わないので他のページでは積まない。
	   defer で読むのは静的サイトと同じ */
	if ( is_front_page() ) {
		wp_enqueue_script( 'gsap', 'https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js', array(), null, true );
		wp_enqueue_script( 'gsap-scrolltrigger', 'https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js', array( 'gsap' ), null, true );
	}

	wp_enqueue_script(
		'spot',
		get_theme_file_uri( 'assets/js/main.js' ),
		is_front_page() ? array( 'gsap-scrolltrigger' ) : array(),
		spot_asset_version( 'assets/js/main.js' ),
		true
	);

	/* TOP の VOICE は main.js が window.FL_ENTRIES から組み立てる。
	   静的サイトと同じ形で渡せば JS を書き換えずに済む */
	if ( is_front_page() ) {
		wp_add_inline_script( 'spot', 'window.FL_ENTRIES = ' . wp_json_encode( spot_entries_payload() ) . ';', 'before' );
	}
}

/**
 * main.js が読む一覧データ。data/entries.json と同じ形。
 *
 * @return array
 */
function spot_entries_payload() {
	$groups = array();

	foreach ( spot_story_groups() as $group ) {
		// 記事が1件も入っていない組は渡さない。main.js が残りを
		// COMING SOON の枠で埋める
		if ( ! $group['entries'] ) {
			continue;
		}

		$groups[] = array(
			'id'      => sprintf( 'group-%02d', $group['index'] ),
			'index'   => 'GROUP ' . $group['index'],
			'color'   => $group['color'],
			'entries' => array_map( 'spot_story_entry', $group['entries'] ),
		);
	}

	return array(
		'site'   => array(
			'name'  => get_bloginfo( 'name' ),
			'lead'  => (string) get_field( 'catch', 'option' ),
			'total' => count( spot_all_stories() ),
		),
		'groups' => $groups,
	);
}

/* ----------------------------------------------------------------------
   JS が使える環境にだけ演出用の配置を当てる（静的サイトと同じ仕掛け）
   ---------------------------------------------------------------------- */
add_action( 'wp_head', 'spot_has_js_flag', 1 );

function spot_has_js_flag() {
	echo "<script>document.documentElement.classList.add('has-js');</script>\n";
}

/* ----------------------------------------------------------------------
   記事の本文は表示側（PHP）で組む。
   JS で描くとクローラに拾われず、WP へ移した意味が薄れる
   ---------------------------------------------------------------------- */
add_filter( 'the_content', 'spot_wrap_article_content', 20 );

function spot_wrap_article_content( $content ) {
	if ( ! is_singular( 'story' ) || ! in_the_loop() || ! is_main_query() ) {
		return $content;
	}

	/* 本文のかたまり。単独写真の回り込みはこの中だけで効かせる。
	   写真の帯だけは記事幅いっぱいに出したいので、かたまりの外へ出す */
	$parts = preg_split( '/(<div class="c-marquee".*?<\/div>\s*<\/div>)/s', $content, -1, PREG_SPLIT_DELIM_CAPTURE );
	$out   = '';

	foreach ( $parts as $part ) {
		if ( '' === trim( $part ) ) {
			continue;
		}

		$out .= ( false !== strpos( $part, 'c-marquee' ) )
			? $part
			: '<div class="p-article__text">' . $part . '</div>';
	}

	return $out;
}
