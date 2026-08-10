<?php
/**
 * ブロックの登録と、本文（the_content）の整形。
 *
 * 本文と写真は管理画面の本文エディタで持つ方針。ただし表示側は
 * assets/css/style.css がクラスで組んでいるので、素の段落と画像のままでは
 * 同じ見た目にならない。そこで:
 *
 *   ・Q&A と写真の帯   → 専用ブロックを登録して、必要なクラスごと保存する
 *   ・見出し / 段落 / 単独写真 → コアブロックのまま出し、ここでクラスを足す
 *
 * @package spotlight-shizuoka
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'spot_register_blocks' );

function spot_register_blocks() {
	foreach ( array( 'qa', 'photo-band' ) as $name ) {
		register_block_type( get_theme_file_path( "blocks/$name" ) );
	}
}

/* ----------------------------------------------------------------------
   コアブロックにクラスを足す。
   render_block で1ブロックずつ触る。the_content の文字列置換だと
   本文以外（抜粋やウィジェット）にも掛かるので使わない。
   ---------------------------------------------------------------------- */
add_filter( 'render_block', 'spot_class_core_blocks', 10, 2 );

function spot_class_core_blocks( $html, $block ) {
	if ( ! is_singular( 'story' ) || '' === trim( $html ) ) {
		return $html;
	}

	$name = isset( $block['blockName'] ) ? $block['blockName'] : '';

	// 章見出し。前の章と切り離す罫は CSS が持つ
	if ( 'core/heading' === $name ) {
		return spot_add_class( $html, 'h2', 'p-article__heading' );
	}

	// 地の文
	if ( 'core/paragraph' === $name ) {
		return spot_add_class( $html, 'p', 'p-article__p' );
	}

	/* 単独の写真は本文に回り込ませる。出てくる順に右・左と振り分けるので、
	   ここで通し番号を数える。CSS の nth-of-type では数えられない
	   （帯を挟むと本文のかたまりが分かれて数え直しになるため） */
	if ( 'core/image' === $name ) {
		static $figure_index = 0;

		$class = 'p-article__figure' . ( $figure_index % 2 ? ' p-article__figure--left' : '' );
		$figure_index++;

		return spot_add_class( $html, 'figure', $class );
	}

	return $html;
}

/**
 * 最初に現れる指定タグへクラスを足す。
 *
 * @param string $html  ブロックの出力。
 * @param string $tag   対象のタグ名。
 * @param string $class 足すクラス。
 * @return string
 */
function spot_add_class( $html, $tag, $class ) {
	// WP 6.2 以降の HTML API。属性の壊れた置換にならない
	if ( class_exists( 'WP_HTML_Tag_Processor' ) ) {
		$doc = new WP_HTML_Tag_Processor( $html );
		if ( $doc->next_tag( array( 'tag_name' => $tag ) ) ) {
			foreach ( explode( ' ', $class ) as $one ) {
				$doc->add_class( $one );
			}
		}
		return $doc->get_updated_html();
	}

	return $html;
}

/* ----------------------------------------------------------------------
   使えるブロックを絞る。
   本文に置けるものを限定しておかないと、CSS の当たらない組み方が
   混ざって表示が崩れる
   ---------------------------------------------------------------------- */
add_filter( 'allowed_block_types_all', 'spot_allowed_blocks', 10, 2 );

function spot_allowed_blocks( $allowed, $context ) {
	if ( ! isset( $context->post ) || 'story' !== $context->post->post_type ) {
		return $allowed;
	}

	return array(
		'core/heading',
		'core/paragraph',
		'core/image',
		'spotlight/qa',
		'spotlight/photo-band',
	);
}

/* 編集画面にも表示側と近い当たりを付ける（バッジの形など） */
add_action( 'enqueue_block_editor_assets', 'spot_editor_style' );

function spot_editor_style() {
	wp_enqueue_style(
		'spot-editor',
		get_theme_file_uri( 'assets/editor.css' ),
		array(),
		spot_asset_version( 'assets/editor.css' )
	);
}
