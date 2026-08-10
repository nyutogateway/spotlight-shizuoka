<?php
/**
 * 静的サイトの JSON を story 投稿へ取り込む WP-CLI コマンド。
 *
 *   wp eval-file wp/tools/import-stories.php            … 取り込み
 *   wp eval-file wp/tools/import-stories.php -- --dry    … 何が起きるかだけ見る
 *
 * data/articles/{slug}.json の body は種別付きなので、ブロックの HTML へ
 * 機械変換できる。手で貼り直す必要はない。
 * 写真は URL のままではメディアに入らないので取り込んでから ID を差し替える。
 *
 * 2回目以降はスラッグで見つけて更新する（重複を作らない）。
 *
 * @package spotlight-shizuoka
 */

defined( 'ABSPATH' ) || exit;

$spot_dry  = in_array( '--dry', (array) ( $args ?? array() ), true );
$spot_root = dirname( __DIR__, 2 );            // リポジトリの根
$spot_dir  = $spot_root . '/data/articles';

if ( ! is_dir( $spot_dir ) ) {
	WP_CLI::error( "見つかりません: $spot_dir" );
}

/**
 * 画像 URL をメディアへ取り込む。同じ URL は使い回す。
 *
 * @param string $url    画像の URL。
 * @param int    $parent 紐付ける投稿ID。
 * @param string $alt    代替テキスト。
 * @return int 添付ID。失敗時 0。
 */
function spot_import_image( $url, $parent, $alt = '' ) {
	static $seen = array();

	if ( ! $url ) {
		return 0;
	}
	if ( isset( $seen[ $url ] ) ) {
		return $seen[ $url ];
	}

	// 取り込み済みなら再利用する
	$found = get_posts(
		array(
			'post_type'      => 'attachment',
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'meta_key'       => '_spot_source_url',
			'meta_value'     => $url,
		)
	);

	if ( $found ) {
		$seen[ $url ] = (int) $found[0];
		return $seen[ $url ];
	}

	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	$id = media_sideload_image( $url, $parent, $alt, 'id' );

	if ( is_wp_error( $id ) ) {
		WP_CLI::warning( "画像を取り込めません: $url（{$id->get_error_message()}）" );
		return 0;
	}

	update_post_meta( $id, '_spot_source_url', $url );
	if ( $alt ) {
		update_post_meta( $id, '_wp_attachment_image_alt', $alt );
	}

	$seen[ $url ] = (int) $id;
	return $seen[ $url ];
}

/**
 * body（種別付きの配列）をブロックの HTML にする。
 *
 * 連続した写真はまとめて「写真の帯」にする。1枚だけなら単独写真。
 * 静的サイトの main.js buildBody() と同じ振り分け。
 *
 * @param array $body   ブロックの配列。
 * @param int   $parent 画像を紐付ける投稿ID。
 * @param bool  $dry    取り込まずに数えるだけか。
 * @return string
 */
function spot_body_to_blocks( $body, $parent, $dry ) {
	$out    = array();
	$images = array();

	$flush = static function () use ( &$out, &$images, $parent, $dry ) {
		if ( ! $images ) {
			return;
		}

		$ids = array();
		foreach ( $images as $img ) {
			$ids[] = $dry ? 0 : spot_import_image( $img['src'], $parent, $img['alt'] ?? '' );
		}
		$ids = array_filter( $ids );

		if ( count( $images ) > 1 ) {
			// 2枚以上は流れる帯
			$out[] = '<!-- wp:spotlight/photo-band ' . wp_json_encode( array( 'ids' => array_values( $ids ) ) ) . ' /-->';
		} elseif ( $ids ) {
			$id  = (int) reset( $ids );
			$out[] = sprintf(
				'<!-- wp:image {"id":%1$d,"sizeSlug":"large"} --><figure class="wp-block-image size-large">%2$s</figure><!-- /wp:image -->',
				$id,
				wp_get_attachment_image( $id, 'large' )
			);
		}

		$images = array();
	};

	foreach ( $body as $block ) {
		$type = $block['type'] ?? '';
		$text = trim( (string) ( $block['text'] ?? '' ) );

		if ( 'img' === $type ) {
			$images[] = $block;
			continue;
		}

		$flush();

		if ( 'h' === $type ) {
			$out[] = '<!-- wp:heading {"level":2} --><h2>' . esc_html( $text ) . '</h2><!-- /wp:heading -->';
			continue;
		}

		if ( 'q' === $type || 'a' === $type ) {
			$out[] = '<!-- wp:spotlight/qa ' . wp_json_encode( array( 'kind' => $type, 'text' => $text ) ) . ' /-->';
			continue;
		}

		$out[] = '<!-- wp:paragraph --><p>' . esc_html( $text ) . '</p><!-- /wp:paragraph -->';
	}

	$flush();

	return implode( "\n\n", $out );
}

/* ----------------------------------------------------------------------
   取り込み本体
   ---------------------------------------------------------------------- */
$spot_files = glob( $spot_dir . '/*.json' );
sort( $spot_files );

WP_CLI::log( sprintf( '%d件を%s', count( $spot_files ), $spot_dry ? '確認します（書き込みません）' : '取り込みます' ) );

$spot_order = 0;

foreach ( $spot_files as $spot_file ) {
	$spot_data = json_decode( (string) file_get_contents( $spot_file ), true );

	if ( ! is_array( $spot_data ) || empty( $spot_data['slug'] ) ) {
		WP_CLI::warning( '読めません: ' . basename( $spot_file ) );
		continue;
	}

	$spot_order++;
	$spot_slug = sanitize_title( $spot_data['slug'] );
	$spot_pos  = spot_position( $spot_order );

	$spot_existing = get_posts(
		array(
			'post_type'      => 'story',
			'name'           => $spot_slug,
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'fields'         => 'ids',
		)
	);

	WP_CLI::log(
		sprintf(
			'  %s %s（GROUP %d / %d番目%s）%s',
			$spot_pos['no'],
			$spot_slug,
			$spot_pos['group'],
			$spot_pos['vol'],
			$spot_pos['lead'] ? '・大きいカード' : '',
			$spot_existing ? ' … 更新' : ' … 新規'
		)
	);

	if ( $spot_dry ) {
		continue;
	}

	$spot_id = wp_insert_post(
		array(
			'ID'           => $spot_existing ? (int) $spot_existing[0] : 0,
			'post_type'    => 'story',
			'post_status'  => 'publish',
			'post_title'   => (string) ( $spot_data['title'] ?? $spot_slug ),
			'post_name'    => $spot_slug,
			'menu_order'   => $spot_order,
			'post_content' => '',   // 画像の取り込みに ID が要るので後で入れる
		),
		true
	);

	if ( is_wp_error( $spot_id ) ) {
		WP_CLI::warning( "作成できません: $spot_slug（{$spot_id->get_error_message()}）" );
		continue;
	}

	// 顔写真
	$spot_portrait = spot_import_image(
		(string) ( $spot_data['image'] ?? '' ),
		$spot_id,
		(string) ( $spot_data['image_alt'] ?? '' )
	);

	if ( $spot_portrait ) {
		set_post_thumbnail( $spot_id, $spot_portrait );
		update_field( 'portrait', $spot_portrait, $spot_id );
	}

	foreach ( array( 'person', 'company', 'position', 'site', 'profile', 'name_en' ) as $spot_key ) {
		update_field( $spot_key, (string) ( $spot_data[ $spot_key ] ?? '' ), $spot_id );
	}

	/* 締めのメッセージ。静的サイトでは「地の文が続いたあと単独の写真で
	   終わる」形を検出して2カラムにしていた。取り込みでも同じ判定をして
	   ACF へ移し、本文からは外す */
	$spot_body = (array) ( $spot_data['body'] ?? array() );
	$spot_last = end( $spot_body );

	if ( is_array( $spot_last ) && 'img' === ( $spot_last['type'] ?? '' ) ) {
		$spot_tail = array();

		array_pop( $spot_body );
		while ( $spot_body && 'p' === ( end( $spot_body )['type'] ?? '' ) ) {
			array_unshift( $spot_tail, array_pop( $spot_body ) );
		}

		if ( $spot_tail ) {
			$spot_heading = ( $spot_body && 'h' === ( end( $spot_body )['type'] ?? '' ) )
				? array_pop( $spot_body )
				: null;

			update_field( 'closing_title', $spot_heading ? $spot_heading['text'] : '＜応援メッセージ＞', $spot_id );
			update_field(
				'closing_text',
				implode( "\n\n", array_map( static fn( $b ) => (string) ( $b['text'] ?? '' ), $spot_tail ) ),
				$spot_id
			);

			$spot_close_img = spot_import_image( (string) $spot_last['src'], $spot_id );
			if ( $spot_close_img ) {
				update_field( 'closing_image', $spot_close_img, $spot_id );
			}
		} else {
			// 地の文が続いていなければ締めにせず、本文へ戻す
			$spot_body[] = $spot_last;
		}
	}

	wp_update_post(
		array(
			'ID'           => $spot_id,
			'post_content' => spot_body_to_blocks( $spot_body, $spot_id, false ),
		)
	);
}

WP_CLI::success( $spot_dry ? '確認だけ終わりました' : '取り込みました' );
