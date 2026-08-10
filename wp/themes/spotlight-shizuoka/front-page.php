<?php
/**
 * TOP（固定ページ）。
 *
 * Hero のあとに VOICE の器だけ置く。中身は main.js が
 * window.FL_ENTRIES（functions.php で出力）から組み立てる。
 * 静的サイトと同じ入れ物・同じデータ形なので、JS には手を入れていない。
 *
 * @package spotlight-shizuoka
 */

get_header();

get_template_part( 'parts/hero' );
?>

<!-- VOICE。5件ずつのグループは main.js が組み立てる -->
<div class="p-voices" id="js-voices">
  <h2 class="u-visually-hidden">VOICE ｜ <?php echo esc_html( count( spot_all_stories() ) ); ?>人のリーダー</h2>
  <noscript>
    <ul class="l-container">
      <?php foreach ( spot_all_stories() as $spot_post ) : ?>
        <li>
          <a href="<?php echo esc_url( get_permalink( $spot_post ) ); ?>">
            <?php echo esc_html( get_field( 'person', $spot_post->ID ) ); ?>
            （<?php echo esc_html( get_field( 'company', $spot_post->ID ) ); ?>）
          </a>
        </li>
      <?php endforeach; ?>
    </ul>
  </noscript>
</div>

<?php
get_footer();
