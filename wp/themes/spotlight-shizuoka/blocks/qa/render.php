<?php
/**
 * spotlight/qa の出力。
 *
 * 静的サイトの main.js buildBody() が組んでいたものと同じクラス構成にする。
 * クラスが変わると assets/css/style.css のバッジ・字下げが効かなくなる。
 *
 * @package spotlight-shizuoka
 *
 * @var array $attributes ブロックの属性。
 */

defined( 'ABSPATH' ) || exit;

$kind = isset( $attributes['kind'] ) && 'a' === $attributes['kind'] ? 'a' : 'q';
$text = isset( $attributes['text'] ) ? $attributes['text'] : '';

if ( '' === trim( wp_strip_all_tags( $text ) ) ) {
	return;
}
?>
<div class="p-article__qa p-article__qa--<?php echo esc_attr( $kind ); ?>">
	<span class="p-article__badge"><?php echo esc_html( strtoupper( $kind ) ); ?></span>
	<p class="p-article__qa-text"><?php echo wp_kses_post( $text ); ?></p>
</div>
