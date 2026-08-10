<?php
/**
 * ヘッダー。ハンバーガーとドロワーは main.js が l-header__end へ差し込む。
 *
 * @package spotlight-shizuoka
 */
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="profile" href="https://gmpg.org/xfn/11" />
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<a class="c-skip-link" href="#main">本文へスキップ</a>

<header class="l-header" id="js-header">
  <div class="l-header__inner">
    <p class="l-header__logo">
      <a href="<?php echo esc_url( home_url( '/' ) ); ?>"><img
        src="<?php echo esc_url( get_theme_file_uri( 'assets/img/logo.png' ) ); ?>"
        alt="<?php bloginfo( 'name' ); ?>" width="1034" height="569" /></a>
    </p>

    <!-- ハンバーガーは main.js がここに差し込む -->
    <div class="l-header__end"></div>
  </div>
</header>

<main class="l-main" id="main">
