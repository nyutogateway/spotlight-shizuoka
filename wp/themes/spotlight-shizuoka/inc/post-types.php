<?php
/**
 * 投稿タイプ story。
 *
 * 一覧は TOP（固定ページ）が持つのでアーカイブは作らない。
 * page-attributes を有効にしているのは、並び順プラグインが menu_order を
 * 使うため。順番はここでしか管理しない（グループも通し番号もここから計算）。
 *
 * @package spotlight-shizuoka
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'spot_register_story' );

function spot_register_story() {
	register_post_type(
		'story',
		array(
			'label'         => 'ストーリー',
			'labels'        => array(
				'name'          => 'ストーリー',
				'singular_name' => 'ストーリー',
				'add_new_item'  => 'ストーリーを追加',
				'edit_item'     => 'ストーリーを編集',
				'all_items'     => 'ストーリー一覧',
			),
			'public'        => true,
			'has_archive'   => false,
			'menu_position' => 5,
			'menu_icon'     => 'dashicons-microphone',
			'rewrite'       => array( 'slug' => 'story', 'with_front' => false ),
			'supports'      => array( 'title', 'editor', 'thumbnail', 'page-attributes', 'revisions' ),
			'show_in_rest'  => true,   // ブロックエディタに必要
		)
	);
}

/**
 * 管理画面の一覧も並び順で出す。
 *
 * 並び順プラグインを入れれば普通は不要だが、入れる前でも順番が見えるように
 * しておく。プラグイン側が orderby を指定してきたらそちらを優先する。
 */
add_action( 'pre_get_posts', 'spot_admin_order_stories' );

function spot_admin_order_stories( $query ) {
	if ( ! is_admin() || ! $query->is_main_query() ) {
		return;
	}
	if ( 'story' !== $query->get( 'post_type' ) ) {
		return;
	}
	if ( $query->get( 'orderby' ) ) {
		return;
	}

	$query->set( 'orderby', 'menu_order' );
	$query->set( 'order', 'ASC' );
}

/**
 * 一覧に「並び順」と「グループ」の列を足す。
 *
 * 5件ごとに組が変わり、組の先頭が大きいカードになる。
 * その対応が編集画面から見えないと、並べ替えの結果が予測できない。
 */
add_filter( 'manage_story_posts_columns', 'spot_story_columns' );

function spot_story_columns( $columns ) {
	$head = array_slice( $columns, 0, 2, true );          // チェックボックスとタイトル
	$rest = array_slice( $columns, 2, null, true );

	return $head + array(
		'spot_order' => '並び順',
		'spot_group' => 'グループ',
	) + $rest;
}

add_action( 'manage_story_posts_custom_column', 'spot_story_column_body', 10, 2 );

function spot_story_column_body( $column, $post_id ) {
	$pos = spot_position( get_post_field( 'menu_order', $post_id ) );

	if ( 'spot_order' === $column ) {
		echo esc_html( $pos['no'] );
	}

	if ( 'spot_group' === $column ) {
		printf(
			'GROUP %d ／ %d番目%s',
			(int) $pos['group'],
			(int) $pos['vol'],
			$pos['lead'] ? '<br><small>大きいカード</small>' : ''
		);
	}
}
