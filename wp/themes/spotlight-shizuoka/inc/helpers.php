<?php
/**
 * 共通の小さな関数。
 *
 * ここの要は「並び順から組み立てを導く」こと。
 * 通し番号・グループ・組の中の位置・大きいカードかどうかは、すべて
 * 並び順プラグイン（menu_order）1つから計算する。ACF の項目にはしない。
 * 並べ替えるだけで全部が追従するので、入れ替えのたびに番号を振り直す
 * 作業が発生しない。
 *
 * @package spotlight-shizuoka
 */

defined( 'ABSPATH' ) || exit;

/** 1グループに入れる件数。5件で1組、先頭が大きいカード */
const SPOT_GROUP_SIZE = 5;

/**
 * 並び順（1始まり）から、その記事の位置づけを返す。
 *
 * @param int $order menu_order。1〜25 を想定。
 * @return array{order:int,group:int,vol:int,lead:bool,no:string}
 */
function spot_position( $order ) {
	$order = max( 1, (int) $order );

	$group = (int) ceil( $order / SPOT_GROUP_SIZE );
	$vol   = ( ( $order - 1 ) % SPOT_GROUP_SIZE ) + 1;

	return array(
		'order' => $order,
		'group' => $group,
		'vol'   => $vol,
		'lead'  => 1 === $vol,           // 組の先頭＝大きいカード
		'no'    => sprintf( '%02d', $order ),
	);
}

/**
 * 記事1件を、静的サイトの entries.json と同じ形の配列にして返す。
 *
 * TOP の VOICE は assets/js/main.js がこの形を読んで組み立てる。
 * JS を書き換えずに済ませたいので、キー名と型は JSON 版に合わせてある。
 *
 * @param WP_Post $post story 投稿。
 * @return array
 */
function spot_story_entry( $post ) {
	$pos = spot_position( $post->menu_order );

	$portrait = spot_portrait_id( $post->ID );
	$image    = $portrait ? wp_get_attachment_image_url( $portrait, 'large' ) : '';
	$alt      = $portrait ? get_post_meta( $portrait, '_wp_attachment_image_alt', true ) : '';

	return array(
		'no'        => $pos['no'],
		'vol'       => $pos['vol'],
		'slug'      => $post->post_name,
		'lead'      => $pos['lead'],
		'title'     => get_the_title( $post ),
		'company'   => (string) get_field( 'company', $post->ID ),
		'person'    => (string) get_field( 'person', $post->ID ),
		'position'  => (string) get_field( 'position', $post->ID ),
		'site'      => (string) get_field( 'site', $post->ID ),
		'image'     => $image,
		'image_alt' => $alt ? $alt : (string) get_field( 'person', $post->ID ),
		'name_en'   => (string) get_field( 'name_en', $post->ID ),
	);
}

/**
 * 顔写真の添付ID。ACF の portrait があればそれ、無ければアイキャッチ。
 *
 * 「アイキャッチ＝一覧に出る顔写真」で運用できるなら ACF 側は空でよい。
 *
 * @param int $post_id 投稿ID。
 * @return int 添付ID。無ければ 0。
 */
function spot_portrait_id( $post_id ) {
	$field = function_exists( 'get_field' ) ? get_field( 'portrait', $post_id ) : null;

	if ( is_array( $field ) && isset( $field['ID'] ) ) {
		return (int) $field['ID'];
	}
	if ( is_numeric( $field ) ) {
		return (int) $field;
	}

	return (int) get_post_thumbnail_id( $post_id );
}

/**
 * 公開中の story を並び順で全部取る。
 *
 * @return WP_Post[]
 */
function spot_all_stories() {
	return get_posts(
		array(
			'post_type'      => 'story',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'orderby'        => array( 'menu_order' => 'ASC', 'date' => 'ASC' ),
		)
	);
}

/**
 * 記事を5件ずつのグループに分けて返す。
 *
 * 実データが足りないぶんは空の組で埋める。TOP はその枠を
 * COMING SOON として出す（静的サイトと同じ考え方）。
 *
 * @param int $total_groups 見せたい組数。
 * @return array<int, array{index:int,color:string,entries:WP_Post[]}>
 */
function spot_story_groups( $total_groups = 5 ) {
	$groups = array();

	foreach ( spot_all_stories() as $post ) {
		$pos = spot_position( $post->menu_order );
		$groups[ $pos['group'] ][] = $post;
	}

	$colors = spot_group_colors();
	$out    = array();

	for ( $i = 1; $i <= max( $total_groups, count( $groups ) ); $i++ ) {
		$out[] = array(
			'index'   => $i,
			'color'   => isset( $colors[ $i - 1 ] ) ? $colors[ $i - 1 ] : '',
			'entries' => isset( $groups[ $i ] ) ? $groups[ $i ] : array(),
		);
	}

	return $out;
}

/**
 * グループの色。設定ページのリピーターから取る。
 *
 * @return string[]
 */
function spot_group_colors() {
	$rows = function_exists( 'get_field' ) ? get_field( 'group_colors', 'option' ) : null;

	if ( ! is_array( $rows ) ) {
		// 設定前でも見た目が崩れないよう、静的サイトの値を控えに置く
		return array( '#0A4E86', '#0090E8', '#3DB0EA', '#5CBEEE', '#8AD2F3' );
	}

	return array_map(
		static function ( $row ) {
			return isset( $row['color'] ) ? (string) $row['color'] : '';
		},
		$rows
	);
}

/**
 * フッターの案内。メニューが未設定のときの控え。
 *
 * 固定ページを作ってメニューに入れるまでのあいだも、
 * TOP / CONTACT / POLICY へ辿れるようにしておく。
 */
function spot_footer_fallback_menu() {
	$links = array( array( 'TOP', home_url( '/' ) ) );

	foreach ( array( 'contact' => 'CONTACT', 'privacy' => 'POLICY' ) as $slug => $label ) {
		$page = get_page_by_path( $slug );
		if ( $page ) {
			$links[] = array( $label, get_permalink( $page ) );
		}
	}

	echo '<ul>';
	foreach ( $links as $link ) {
		printf( '<li><a href="%s">%s</a></li>', esc_url( $link[1] ), esc_html( $link[0] ) );
	}
	echo '</ul>';
}
