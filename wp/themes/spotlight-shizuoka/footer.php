<?php
/**
 * フッター。並びは「ロゴ → 案内 → 罫 → 協力 → 著作表示」。
 *
 * @package spotlight-shizuoka
 */
$spot_sbs = function_exists( 'get_field' ) ? (string) get_field( 'sbs_url', 'option' ) : '';
?>
</main>

<footer class="l-footer">
  <div class="l-container l-footer__inner">
    <p class="l-footer__logo">
      <img src="<?php echo esc_url( get_theme_file_uri( 'assets/img/logo.png' ) ); ?>"
           alt="<?php bloginfo( 'name' ); ?>" width="1034" height="569" />
    </p>

    <nav class="l-footer__nav" aria-label="フッター">
      <?php
      wp_nav_menu(
        array(
          'theme_location' => 'footer',
          'container'      => false,
          'items_wrap'     => '<ul>%3$s</ul>',
          'depth'          => 1,
          // メニュー未設定でも空にならないよう、固定ページから作る
          'fallback_cb'    => 'spot_footer_fallback_menu',
        )
      );
      ?>
    </nav>

    <?php if ( $spot_sbs ) : ?>
      <!-- 協力。ロゴは地色が焼き込まれた素材なので白の版に載せる -->
      <div class="l-footer__station">
        <p class="l-footer__station-label">協力</p>
        <a href="<?php echo esc_url( $spot_sbs ); ?>" target="_blank" rel="noopener noreferrer"><img
          src="<?php echo esc_url( get_theme_file_uri( 'assets/img/sbs_logo.png' ) ); ?>"
          alt="SBSラジオ" width="144" height="96" loading="lazy" decoding="async" /></a>
      </div>
    <?php endif; ?>

    <p class="l-footer__copy">
      Copyright &copy; <?php echo esc_html( wp_date( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?>. All Rights Reserved.
    </p>
  </div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
