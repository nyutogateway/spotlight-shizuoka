<?php
/**
 * 記事ページ。
 *
 * 本文は表示側で組む。JS で描くとクローラに拾われないため。
 * 本文そのものは管理画面の本文エディタが持ち、ブロックが必要なクラスごと
 * 保存する（inc/blocks.php 参照）。
 *
 * @package spotlight-shizuoka
 */

get_header();

while ( have_posts() ) :
	the_post();

	$spot_person   = (string) get_field( 'person' );
	$spot_company  = (string) get_field( 'company' );
	$spot_position = (string) get_field( 'position' );
	$spot_profile  = (string) get_field( 'profile' );
	$spot_site     = (string) get_field( 'site' );
	$spot_name_en  = (string) get_field( 'name_en' );
	$spot_portrait = spot_portrait_id( get_the_ID() );
	?>

<article class="p-article l-container" id="js-article">

  <!-- 頭は「写真＝左 / 人物情報＝右」の2段組 -->
  <header class="p-article__head">
    <figure class="p-article__portrait">
      <?php
      echo wp_get_attachment_image(
        $spot_portrait,
        'large',
        false,
        array( 'fetchpriority' => 'high', 'decoding' => 'async' )
      );
      ?>
    </figure>

    <div class="p-article__intro">
      <h1 class="p-article__title"><?php the_title(); ?></h1>
      <?php if ( $spot_name_en ) : ?>
        <p class="p-article__name-en"><?php echo esc_html( $spot_name_en ); ?></p>
      <?php endif; ?>
      <p class="p-article__name"><?php echo esc_html( $spot_person ); ?></p>
      <p class="p-article__company">
        <?php echo esc_html( $spot_position ? $spot_company . '　｜　' . $spot_position : $spot_company ); ?>
      </p>
      <?php if ( $spot_profile ) : ?>
        <p class="p-article__profile"><?php echo esc_html( $spot_profile ); ?></p>
      <?php endif; ?>
      <?php if ( $spot_site ) : ?>
        <p class="p-article__site">
          <a href="<?php echo esc_url( $spot_site ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $spot_site ); ?></a>
        </p>
      <?php endif; ?>
    </div>
  </header>

  <div class="p-article__content">
    <?php
    the_content();
    get_template_part( 'parts/closing' );
    ?>
  </div>

  <p class="p-article__back">
    <a href="<?php echo esc_url( home_url( '/#' . get_post_field( 'post_name' ) ) ); ?>">一覧へ戻る</a>
  </p>

</article>

	<?php
endwhile;

get_footer();
