<?php
/**
 * 記事の締め。応援メッセージと写真を横並びの2カラムで置く。
 *
 * 回り込み（float）にすると、写真のほうが本文よりずっと背が高いため
 * 本文が尽きたあと横が丸ごと空いてしまう。列として組めば高さが違っても
 * 並びとして成立する。
 *
 * @package spotlight-shizuoka
 */

defined( 'ABSPATH' ) || exit;

$spot_title = (string) get_field( 'closing_title' );
$spot_text  = (string) get_field( 'closing_text' );
$spot_image = get_field( 'closing_image' );

if ( ! $spot_text && ! $spot_image ) {
	return;
}
?>
<div class="p-article__text">
	<?php if ( $spot_title ) : ?>
		<h2 class="p-article__heading"><?php echo esc_html( $spot_title ); ?></h2>
	<?php endif; ?>

	<div class="p-article__closing">
		<div class="p-article__closing-text">
			<?php
			foreach ( preg_split( '/\R{2,}/', trim( $spot_text ) ) as $spot_para ) {
				if ( '' === trim( $spot_para ) ) {
					continue;
				}
				printf( '<p class="p-article__p">%s</p>', nl2br( esc_html( trim( $spot_para ) ) ) );
			}
			?>
		</div>

		<?php if ( is_array( $spot_image ) && isset( $spot_image['ID'] ) ) : ?>
			<figure class="p-article__figure">
				<?php echo wp_get_attachment_image( (int) $spot_image['ID'], 'large', false, array( 'loading' => 'lazy' ) ); ?>
			</figure>
		<?php endif; ?>
	</div>
</div>
