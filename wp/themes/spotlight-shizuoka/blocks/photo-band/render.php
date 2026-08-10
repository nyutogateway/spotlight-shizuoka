<?php
/**
 * spotlight/photo-band の出力。
 *
 * 静的サイトの main.js buildMarquee() と同じ構成にする。
 * 同じ並びを2周ぶん敷いて -50% 送ることで途切れずに繋がる仕掛けなので、
 * 2周目は必ず出すこと。2周目は複製なので読み上げからは外す。
 *
 * 1枚の幅と流す速さは main.js が実測して CSS 変数で渡す（--marquee-item /
 * --marquee-duration）。ここでは器だけ用意する。
 *
 * @package spotlight-shizuoka
 *
 * @var array $attributes ブロックの属性。
 */

defined( 'ABSPATH' ) || exit;

$ids = isset( $attributes['ids'] ) ? array_filter( array_map( 'intval', (array) $attributes['ids'] ) ) : array();

if ( ! $ids ) {
	return;
}

// 1枚しかないなら帯にせず、本文に回り込む単独写真として置く
if ( 1 === count( $ids ) ) {
	printf(
		'<figure class="p-article__figure">%s</figure>',
		wp_get_attachment_image( $ids[0], 'large', false, array( 'loading' => 'lazy' ) )
	);
	return;
}
?>
<div class="c-marquee" role="group" aria-label="<?php echo esc_attr( sprintf( '写真 %d枚', count( $ids ) ) ); ?>">
	<div class="c-marquee__track">
		<?php for ( $loop = 0; $loop < 2; $loop++ ) : ?>
			<?php foreach ( $ids as $id ) : ?>
				<div class="c-marquee__item"<?php echo 1 === $loop ? ' aria-hidden="true"' : ''; ?>>
					<?php
					echo wp_get_attachment_image(
						$id,
						'large',
						false,
						array(
							'loading' => 'lazy',
							// 2周目は同じ写真の複製なので代替テキストを空にする
							'alt'     => 1 === $loop ? '' : trim( (string) get_post_meta( $id, '_wp_attachment_image_alt', true ) ),
						)
					);
					?>
				</div>
			<?php endforeach; ?>
		<?php endfor; ?>
	</div>
</div>
