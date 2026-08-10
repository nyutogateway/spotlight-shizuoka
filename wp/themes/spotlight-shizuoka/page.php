<?php
/**
 * 固定ページ（CONTACT / プライバシーポリシーなど）。
 * TOP だけは front-page.php が受け持つ。
 *
 * @package spotlight-shizuoka
 */

get_header();

while ( have_posts() ) :
	the_post();
	?>
<div class="p-page l-container">
  <header class="p-page__head">
    <h1 class="p-page__title"><?php the_title(); ?></h1>
  </header>

  <div class="p-page__body">
    <?php the_content(); ?>
  </div>

  <p class="p-page__back">
    <a href="<?php echo esc_url( home_url( '/' ) ); ?>">TOP へ戻る</a>
  </p>
</div>
	<?php
endwhile;

get_footer();
