<?php
/**
 * ACF のフィールド定義。
 *
 * 管理画面で作らず PHP で持つ。理由は3つ:
 *   ・git で差分が追える
 *   ・別環境へ持っていくのに書き出し / 読み込みが要らない
 *   ・「共通なところをまとめる」方針が、コードとして1箇所に残る
 *
 * 持たせないもの（重複を避けるため）:
 *   タイトル      → 投稿タイトル
 *   スラッグ      → 投稿スラッグ
 *   代替テキスト  → 画像の alt
 *   通し番号/グループ/組内の位置/大きいカードか → 並び順から計算（helpers.php）
 *
 * @package spotlight-shizuoka
 */

defined( 'ABSPATH' ) || exit;

add_action( 'acf/init', 'spot_register_acf' );

function spot_register_acf() {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}

	/* ------------------------------------------------------------------
	   1. 記事の顔まわり。一覧カードと記事ヘッダーの両方がこれを見る
	   ------------------------------------------------------------------ */
	acf_add_local_field_group(
		array(
			'key'      => 'group_story_profile',
			'title'    => 'プロフィール',
			'location' => array(
				array(
					array( 'param' => 'post_type', 'operator' => '==', 'value' => 'story' ),
				),
			),
			'position' => 'normal',
			'fields'   => array(
				array(
					'key'          => 'field_person',
					'name'         => 'person',
					'label'        => '氏名',
					'type'         => 'text',
					'required'     => 1,
					'placeholder'  => '宮本 功',
				),
				array(
					'key'           => 'field_name_en',
					'name'          => 'name_en',
					'label'         => '氏名（欧文）',
					'type'          => 'text',
					'instructions'  => 'カードで姓と名を改行するので、半角スペースで区切ること（例: Isao Miyamoto）',
					'placeholder'   => 'Isao Miyamoto',
				),
				array(
					'key'      => 'field_company',
					'name'     => 'company',
					'label'    => '所属',
					'type'     => 'text',
					'required' => 1,
				),
				array(
					'key'          => 'field_position',
					'name'         => 'position',
					'label'        => '役職',
					'type'         => 'text',
					'instructions' => 'TOP の一覧には出さず、記事ページだけで使う',
				),
				array(
					'key'   => 'field_profile',
					'name'  => 'profile',
					'label' => '略歴',
					'type'  => 'textarea',
					'rows'  => 4,
				),
				array(
					'key'   => 'field_site',
					'name'  => 'site',
					'label' => '公式サイト',
					'type'  => 'url',
				),
				array(
					'key'           => 'field_portrait',
					'name'          => 'portrait',
					'label'         => '顔写真',
					'type'          => 'image',
					'return_format' => 'array',
					'instructions'  => '一覧カードと記事ヘッダーで共用。空ならアイキャッチを使う',
				),
			),
		)
	);

	/* ------------------------------------------------------------------
	   2. 記事の締め。本文の最後に置く「応援メッセージ」
	      本文の並びから推測せず、明示的に持たせる
	   ------------------------------------------------------------------ */
	acf_add_local_field_group(
		array(
			'key'      => 'group_story_closing',
			'title'    => '締めのメッセージ',
			'location' => array(
				array(
					array( 'param' => 'post_type', 'operator' => '==', 'value' => 'story' ),
				),
			),
			'position' => 'normal',
			'fields'   => array(
				array(
					'key'          => 'field_closing_title',
					'name'         => 'closing_title',
					'label'        => '見出し',
					'type'         => 'text',
					'default_value' => '＜応援メッセージ＞',
				),
				array(
					'key'   => 'field_closing_text',
					'name'  => 'closing_text',
					'label' => '本文',
					'type'  => 'textarea',
					'rows'  => 5,
				),
				array(
					'key'           => 'field_closing_image',
					'name'          => 'closing_image',
					'label'         => '写真',
					'type'          => 'image',
					'return_format' => 'array',
					'instructions'  => '本文と横並びの2カラムで出る',
				),
			),
		)
	);

	/* ------------------------------------------------------------------
	   3. サイト共通の設定。オプションページに1つだけ置く
	   ------------------------------------------------------------------ */
	if ( function_exists( 'acf_add_options_page' ) ) {
		acf_add_options_page(
			array(
				'page_title' => 'サイト設定',
				'menu_title' => 'サイト設定',
				'menu_slug'  => 'spot-settings',
				'capability' => 'manage_options',
				'icon_url'   => 'dashicons-admin-settings',
				'position'   => 6,
			)
		);
	}

	acf_add_local_field_group(
		array(
			'key'      => 'group_site_settings',
			'title'    => 'サイト設定',
			'location' => array(
				array(
					array( 'param' => 'options_page', 'operator' => '==', 'value' => 'spot-settings' ),
				),
			),
			'fields'   => array(
				array(
					'key'   => 'field_catch',
					'name'  => 'catch',
					'label' => 'サイトのリード文',
					'type'  => 'textarea',
					'rows'  => 3,
				),
				array(
					'key'          => 'field_concept_lines',
					'name'         => 'concept_lines',
					'label'        => 'Hero のコンセプト文',
					'type'         => 'repeater',
					'instructions' => '1行につき1件。スクロールに合わせて1文字ずつ打つので、改行位置がそのまま見え方になる',
					'button_label' => '行を追加',
					'layout'       => 'table',
					'sub_fields'   => array(
						array(
							'key'   => 'field_concept_line',
							'name'  => 'line',
							'label' => '行',
							'type'  => 'text',
						),
					),
				),
				array(
					'key'          => 'field_group_colors',
					'name'         => 'group_colors',
					'label'        => 'グループの色',
					'type'         => 'repeater',
					'instructions' => '上から GROUP 1、2… の順。5組ぶん',
					'max'          => 8,
					'layout'       => 'table',
					'sub_fields'   => array(
						array(
							'key'   => 'field_group_color',
							'name'  => 'color',
							'label' => '色',
							'type'  => 'color_picker',
						),
					),
				),
				array(
					'key'           => 'field_sbs_url',
					'name'          => 'sbs_url',
					'label'         => '協力（SBSラジオ）のリンク先',
					'type'          => 'url',
					'default_value' => 'https://www.at-s.com/sbsradio/',
				),
				array(
					'key'           => 'field_ogp_image',
					'name'          => 'ogp_image',
					'label'         => 'OGP 画像',
					'type'          => 'image',
					'return_format' => 'array',
					'instructions'  => '1200×630。個別に指定がないページで使う',
				),
			),
		)
	);
}
