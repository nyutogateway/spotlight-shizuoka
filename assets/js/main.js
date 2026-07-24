/**
 * SPOTLIGHT SHIZUOKA — main.js
 *
 * 依存なし。<script defer> で読み込む前提。
 * 表示内容はすべて data/ から流し込む。
 * file:// でも開けるよう、fetch ではなく script タグでデータを読む
 * （data/*.js は data/*.json から node tools/gen-data.mjs で生成）。
 *
 *  1. ヘッダー（スクロール状態 / ハンバーガーメニュー）
 *  2. FEATURED/VOICE: window.FL_ENTRIES → 顔の入れ替えと .c-card を生成
 *  2-3. TOP の Hero: GSAP + ScrollTrigger（読めなければ静的表示に戻す）
 *  3. 記事: window.FL_ARTICLE[slug] → 記事本文を生成
 *  4. フェードイン（js-reveal → is-visible）
 */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SLUG_RE = /^[a-z0-9_-]+$/i;

  /* ------------------------------------------------------------------
     小さなDOMヘルパ
     ------------------------------------------------------------------ */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null && text !== '') node.textContent = text;
    return node;
  }

  // file:// では fetch が使えないため、データは script タグで読み込む
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error(src)); };
      document.head.appendChild(script);
    });
  }

  function fail(container, message) {
    container.appendChild(el('p', 'c-error', message));
  }

  /* ------------------------------------------------------------------
     1. ヘッダー: 一定量スクロールしたら半透明化
     ------------------------------------------------------------------ */
  function initHeader() {
    var header = document.getElementById('js-header');
    if (!header) return;

    var THRESHOLD = 40;
    var ticking = false;

    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > THRESHOLD);
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  /* ------------------------------------------------------------------
     1-2. ハンバーガーメニュー
     ------------------------------------------------------------------ */
  var SITE_LINKS = [
    ['TOP', 'index.html'],
    ['CONTACT', 'contact.html'],
    ['POLICY', 'privacy.html']
  ];

  function buildHamburger() {
    var button = el('button', 'c-hamburger');
    button.type = 'button';
    button.setAttribute('aria-controls', 'js-drawer');
    button.setAttribute('aria-expanded', 'false');
    button.appendChild(el('span', 'u-visually-hidden', 'メニューを開く'));
    ['top', 'middle', 'bottom'].forEach(function (place) {
      var line = el('span', 'c-hamburger__line c-hamburger__line--' + place);
      line.setAttribute('aria-hidden', 'true');
      button.appendChild(line);
    });
    return button;
  }

  function buildDrawer() {
    var drawer = el('nav', 'c-drawer');
    drawer.id = 'js-drawer';
    drawer.setAttribute('aria-label', 'メニュー');

    var inner = el('div', 'c-drawer__inner');

    var siteSection = el('section', 'c-drawer__section');
    siteSection.appendChild(el('p', 'c-drawer__label', 'MENU'));
    var menu = el('ul', 'c-drawer__menu');
    SITE_LINKS.forEach(function (pair) {
      var item = el('li');
      var link = el('a', null, pair[0]);
      link.href = pair[1];
      item.appendChild(link);
      menu.appendChild(item);
    });
    siteSection.appendChild(menu);
    inner.appendChild(siteSection);

    // 記事一覧。entries.js が読めていないページでは出さない
    if (window.FL_ENTRIES && window.FL_ENTRIES.groups) {
      var articleSection = el('section', 'c-drawer__section');
      articleSection.appendChild(el('p', 'c-drawer__label', 'ARTICLES'));
      var list = el('ul', 'c-drawer__list');

      window.FL_ENTRIES.groups.forEach(function (group) {
        group.entries.forEach(function (entry) {
          var item = el('li');
          var link = el('a', 'c-drawer__link');
          link.href = 'entry.html?slug=' + encodeURIComponent(entry.slug);
          link.appendChild(el('span', 'c-drawer__company', entry.company));
          link.appendChild(el('span', 'c-drawer__person', entry.person));
          item.appendChild(link);
          list.appendChild(item);
        });
      });

      articleSection.appendChild(list);
      inner.appendChild(articleSection);
    }

    drawer.appendChild(inner);
    return drawer;
  }

  function initMenu() {
    var inner = document.querySelector('.l-header__inner');
    if (!inner) return;

    var button = buildHamburger();
    var drawer = buildDrawer();
    // 右端の枠があればそこへ、なければヘッダー直下に置く
    (inner.querySelector('.l-header__end') || inner).appendChild(button);
    document.body.appendChild(drawer);

    var isOpen = false;

    function setOpen(open) {
      isOpen = open;
      button.classList.toggle('is-active', open);
      button.setAttribute('aria-expanded', String(open));
      button.querySelector('.u-visually-hidden').textContent = open ? 'メニューを閉じる' : 'メニューを開く';
      drawer.classList.toggle('is-open', open);
      document.body.classList.toggle('is-drawer-open', open);

      if (open) {
        drawer.removeAttribute('inert');
        drawer.removeAttribute('aria-hidden');
        // visibility が hidden のままだとフォーカスが入らないので描画を1フレーム待つ
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            var first = drawer.querySelector('a');
            if (first && isOpen) first.focus();
          });
        });
      } else {
        // 閉じた中にフォーカスを残さない
        if (drawer.contains(document.activeElement)) button.focus();
        drawer.setAttribute('inert', '');
        drawer.setAttribute('aria-hidden', 'true');
      }
    }

    setOpen(false);

    button.addEventListener('click', function () {
      setOpen(!isOpen);
    });

    drawer.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen) setOpen(false);
    });
  }

  /* ------------------------------------------------------------------
     2. INDEX: カード生成
     ------------------------------------------------------------------ */
  function buildCard(entry, isLead) {
    // 大きい枠は顔、レールは企業ロゴ。どちらもホバーで入れ替わる
    var item = el('li', 'c-card' + (isLead ? ' c-card--lead' : ''));
    item.id = entry.slug;

    var link = el('a', 'c-card__link');
    link.href = 'entry.html?slug=' + encodeURIComponent(entry.slug);

    var figure = el('figure', 'c-card__img');

    var photo = el('span', 'c-card__photo');
    var img = el('img');
    img.src = entry.image;
    img.alt = entry.image_alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    photo.appendChild(img);
    figure.appendChild(photo);

    if (entry.logo) {
      var logo = el('span', 'c-card__logo');
      logo.setAttribute('aria-hidden', 'true');
      var logoImg = el('img');
      logoImg.src = entry.logo;
      logoImg.alt = '';
      logoImg.loading = 'lazy';
      logo.appendChild(logoImg);
      figure.appendChild(logo);
    }

    figure.appendChild(el('span', 'c-card__more', 'READ MORE →'));

    var info = el('div', 'c-card__info');
    if (entry.name_en) {
      // 欧文は姓名で改行する
      var parts = entry.name_en.split(' ');
      var en = el('p', 'c-card__en', parts[0]);
      if (parts.length > 1) {
        en.appendChild(document.createElement('br'));
        en.appendChild(document.createTextNode(parts.slice(1).join(' ')));
      }
      info.appendChild(en);
    }
    info.appendChild(el('p', 'c-card__jp', entry.person));
    info.appendChild(el('p', 'c-card__job',
      entry.position ? entry.company + '／' + entry.position : entry.company));

    link.appendChild(figure);
    link.appendChild(info);
    item.appendChild(link);
    return item;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // VOICE で見せるグループ数。実データが足りないぶんは空き枠で埋める
  var VOICE_GROUP_TOTAL = 6;

  /* 空き枠のグループ。データが揃うまで COMING SOON として先に置く。
     見出しは実グループと同じ構成にし、本体だけプレースホルダーにする */
  function buildComingGroup(index) {
    var section = el('section', 'p-voice p-voice--coming' +
      (index % 2 === 1 ? ' p-voice--flip' : ''));
    section.id = 'group-' + (index + 1 < 10 ? '0' : '') + (index + 1);

    var inner = el('div', 'p-voice__inner l-container');

    var head = el('header', 'p-voice__head');
    var label = el('p', 'p-voice__group');
    label.appendChild(el('span', 'p-voice__group-label', 'GROUP'));
    label.appendChild(el('span', 'p-voice__group-num', String(index + 1)));
    head.appendChild(label);
    head.appendChild(el('h2', 'p-voice__title', 'VOICE'));

    var body = el('div', 'p-voice__body');
    var placeholder = el('div', 'p-voice__coming');
    placeholder.appendChild(el('p', 'p-voice__coming-label', 'COMING SOON'));
    placeholder.appendChild(el('p', 'p-voice__coming-sub', '近日公開'));
    body.appendChild(placeholder);

    inner.appendChild(head);
    inner.appendChild(body);
    section.appendChild(inner);
    return section;
  }

  function renderVoices(container, data) {
    var frag = document.createDocumentFragment();

    data.groups.forEach(function (group, index) {
      // 奇数グループは大きいカードが左、偶数は右。並びに変化をつける
      var flipped = index % 2 === 1;
      var section = el('section', 'p-voice' + (flipped ? ' p-voice--flip' : ''));
      section.id = group.id;
      // 写真のパララックスはこの枠から配る（下の initParallaxScopes 参照）
      section.setAttribute('data-parallax-scope', '');

      var inner = el('div', 'p-voice__inner l-container');

      var head = el('header', 'p-voice__head');
      var label = el('p', 'p-voice__group');
      label.appendChild(el('span', 'p-voice__group-label', 'GROUP'));
      label.appendChild(el('span', 'p-voice__group-num', String(index + 1)));
      head.appendChild(label);
      head.appendChild(el('h2', 'p-voice__title', 'VOICE'));

      var members = group.entries.slice();

      var nav = el('div', 'p-voice__nav');
      var prev = el('button', 'p-voice__arrow p-voice__arrow--prev');
      var next = el('button', 'p-voice__arrow p-voice__arrow--next');
      [prev, next].forEach(function (button, i) {
        button.type = 'button';
        button.appendChild(el('span', 'u-visually-hidden', i ? '次の人へ' : '前の人へ'));
      });
      nav.appendChild(prev);
      nav.appendChild(next);
      head.appendChild(nav);

      var body = el('div', 'p-voice__body');
      var leadWrap = el('div', 'p-voice__lead');
      var rail = el('div', 'p-voice__rail');
      body.appendChild(leadWrap);
      body.appendChild(rail);

      /* 5人を順に大きい枠へ送る。大きいカードも入れ替えの対象にする */
      var offset = 0;

      function paint() {
        clear(leadWrap);
        leadWrap.appendChild(buildCard(members[offset], true));

        var list = el('ul', 'p-voice__cards');
        for (var i = 1; i < members.length; i++) {
          list.appendChild(buildCard(members[(offset + i) % members.length], false));
        }
        clear(rail);
        rail.appendChild(list);
      }

      function rotate(direction) {
        offset = (offset + direction + members.length) % members.length;
        // 入れ替えは一度沈めてから
        body.classList.add('is-swapping');
        window.setTimeout(function () {
          paint();
          body.classList.remove('is-swapping');
        }, 220);
      }

      paint();

      /* 自動遷移 */
      var AUTO_MS = 4200;
      var timer = null;
      var hovering = false;

      function play() {
        if (prefersReducedMotion || timer) return;
        timer = window.setInterval(function () {
          if (!hovering) rotate(1);
        }, AUTO_MS);
      }

      function pause() {
        if (!timer) return;
        window.clearInterval(timer);
        timer = null;
      }

      function manual(direction) {
        rotate(direction);
        pause();
        play();
      }

      prev.addEventListener('click', function () { manual(-1); });
      next.addEventListener('click', function () { manual(1); });

      // グループは画面いっぱいなので、止めるのは
      // 「カードか矢印の上にいるとき」だけに絞る
      section.addEventListener('mouseover', function (event) {
        if (event.target.closest('.c-card, .p-voice__nav')) hovering = true;
      });
      section.addEventListener('mouseout', function (event) {
        if (event.target.closest('.c-card, .p-voice__nav')) hovering = false;
      });
      section.addEventListener('focusin', function () { hovering = true; });
      section.addEventListener('focusout', function () { hovering = false; });

      // 画面外では動かさない
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) play();
            else pause();
          });
        }, { threshold: 0.25 }).observe(section);
      } else {
        play();
      }

      inner.appendChild(head);
      inner.appendChild(body);
      section.appendChild(inner);
      frag.appendChild(section);
    });

    // 実データのぶんの後ろに、目標数まで空き枠を足す
    for (var g = data.groups.length; g < VOICE_GROUP_TOTAL; g++) {
      frag.appendChild(buildComingGroup(g));
    }

    container.appendChild(frag);
  }

  /* ------------------------------------------------------------------
     2-3. TOP の Hero
     切り抜きから覗く静岡の風景が、スクロールで全画面の風景になり、
     最後にコンセプト文が出る。GSAP + ScrollTrigger を使う。

     ・演出できない環境（JSなし / GSAPなし / モーション低減）では
       .is-static を付けて CSS 側の縦積みに戻す。
     ・将来 WordPress へ移すときはこの関数ごと差し替えられるようにしてある。
     ------------------------------------------------------------------ */
  var HERO_SETTINGS = {
    scrub: 0.9,
    imageScaleStart: 1.24,   // CSS の --opening-image-scale と揃える
    imageScaleMid: 1.12,
    imageScaleEnd: 1,
    windowMidWidth: 0.54,    // 画面幅に対する中盤の切り抜き幅
    windowMidHeight: 0.66,   // 画面高に対する中盤の切り抜き高
    windowMidBleed: 0.4,     // 見切れ量を中盤でどこまで戻すか（0=そのまま 1=画面内）
    overlayOpacity: 0.64,    // CSS の --opening-overlay-opacity と揃える
    parallax: 10,            // Phase1 で風景がずれる量(px)
    logoLift: 24,            // ロゴが退くときに動く量(px)
    exitLift: 44,            // 終盤に風景ごと持ち上げる量(px)
    exitLiftMobile: 30,
    headerLogoAt: 0.40,      // ヘッダーのロゴが出てくる位置（Heroスクロールに対する割合）
    conceptStagger: 0.055,   // コンセプト1行ずつの間隔
    conceptStaggerNarrow: 0.045,
    conceptSnapFrom: 0.60    // ここから先で止めたら、コンセプトが出そろう位置まで送る
  };

  /* 切り抜きの形。紙面から切り抜いた穴のつもりで、少しだけ辺を崩す。
     最後は同じ点数のまま矩形へ寄せて、全画面の風景につなぐ。
     CSS の .opening-window の clip-path と開始値を揃えること */
  var HERO_CLIP_CUT = 'polygon(39.96% 8.12%,39.73% 11.12%,40.33% 14.08%,40.22% 17.01%,38.80% 19.72%,39.89% 23.00%,39.24% 26.23%,36.88% 28.06%,34.63% 29.18%,32.81% 31.84%,30.45% 33.69%,27.87% 34.99%,25.87% 37.29%,23.78% 39.24%,21.74% 41.21%,19.69% 43.48%,20.46% 46.78%,18.84% 48.99%,18.27% 52.02%,16.94% 55.03%,14.94% 57.52%,13.47% 60.54%,13.29% 64.07%,11.37% 66.57%,10.11% 69.75%,8.67% 72.76%,6.64% 75.08%,4.29% 76.20%,1.76% 77.59%,0.42% 80.55%,0.08% 84.05%,0.00% 87.59%,0.46% 91.15%,1.93% 92.97%,4.69% 92.75%,7.45% 93.02%,10.19% 93.48%,12.92% 94.07%,15.66% 94.44%,17.52% 95.34%,20.25% 95.41%,22.93% 94.55%,25.67% 94.25%,28.42% 94.39%,31.16% 94.93%,33.91% 95.30%,35.88% 96.10%,38.42% 97.54%,41.00% 98.84%,43.62% 100.00%,44.44% 98.83%,42.87% 95.91%,43.37% 92.38%,44.48% 89.08%,46.35% 86.45%,48.51% 84.20%,49.62% 81.89%,50.95% 78.74%,50.82% 75.24%,51.69% 71.87%,53.70% 69.47%,56.03% 67.53%,58.48% 65.83%,60.84% 63.96%,62.76% 61.50%,61.36% 61.50%,60.93% 59.79%,62.53% 57.04%,63.93% 53.94%,66.00% 51.74%,68.58% 50.52%,71.23% 49.47%,72.90% 48.25%,75.56% 49.25%,78.19% 50.37%,80.61% 52.09%,82.64% 54.47%,84.53% 57.10%,84.62% 59.58%,82.13% 60.16%,79.47% 59.32%,77.89% 61.23%,77.40% 64.18%,77.54% 67.34%,78.06% 70.81%,76.46% 73.59%,77.07% 76.44%,76.53% 79.48%,77.11% 83.00%,76.95% 86.46%,75.50% 89.37%,76.68% 92.34%,78.16% 94.88%,79.34% 97.80%,81.76% 99.25%,84.06% 97.61%,86.30% 96.01%,88.13% 93.31%,89.60% 94.80%,89.82% 91.71%,90.51% 88.23%,92.01% 85.23%,94.09% 83.24%,95.11% 79.89%,96.25% 76.61%,98.05% 73.92%,99.72% 71.10%,100.00% 67.49%,98.30% 65.01%,96.46% 62.50%,97.10% 59.37%,95.82% 56.62%,95.72% 53.22%,96.99% 50.02%,95.71% 47.81%,93.08% 46.86%,91.78% 43.90%,90.13% 41.09%,89.69% 37.52%,91.07% 34.47%,92.07% 31.11%,91.89% 27.51%,90.83% 24.36%,88.32% 23.37%,85.58% 23.74%,83.04% 24.79%,80.52% 25.58%,77.82% 26.33%,75.08% 26.84%,72.35% 26.60%,70.74% 24.11%,68.17% 23.55%,66.63% 20.69%,64.44% 20.83%,63.24% 23.99%,63.21% 27.60%,62.47% 30.93%,62.22% 34.42%,62.62% 38.00%,62.65% 41.60%,61.41% 44.61%,58.80% 45.05%,56.29% 43.59%,54.80% 40.65%,53.92% 37.23%,53.14% 33.76%,51.74% 30.80%,49.23% 31.70%,46.83% 30.82%,46.12% 27.49%,45.75% 24.33%,46.27% 20.91%,46.10% 17.33%,46.82% 13.85%,46.72% 10.24%,46.20% 6.69%,45.54% 3.17%,44.45% 0.00%,43.32% 3.29%,41.85% 6.07%)';
  var HERO_CLIP_FULL = 'polygon(0.00% 0.00%,2.46% 0.00%,4.94% 0.00%,7.34% 0.00%,9.85% 0.00%,12.68% 0.00%,15.37% 0.00%,17.81% 0.00%,19.87% 0.00%,22.51% 0.00%,24.97% 0.00%,27.33% 0.00%,29.83% 0.00%,32.18% 0.00%,34.50% 0.00%,37.00% 0.00%,39.78% 0.00%,42.02% 0.00%,44.55% 0.00%,47.24% 0.00%,49.86% 0.00%,52.61% 0.00%,55.50% 0.00%,58.08% 0.00%,60.89% 0.00%,63.62% 0.00%,66.14% 0.00%,68.28% 0.00%,70.64% 0.00%,73.30% 0.00%,76.18% 0.00%,79.08% 0.00%,82.02% 0.00%,83.93% 0.00%,86.20% 0.00%,88.47% 0.00%,90.75% 0.00%,93.03% 0.00%,95.30% 0.00%,96.99% 0.00%,99.22% 0.00%,100.00% 1.53%,100.00% 3.79%,100.00% 6.05%,100.00% 8.33%,100.00% 10.60%,100.00% 12.35%,100.00% 14.73%,100.00% 17.10%,100.00% 19.45%,100.00% 20.62%,100.00% 23.33%,100.00% 26.25%,100.00% 29.10%,100.00% 31.75%,100.00% 34.30%,100.00% 36.40%,100.00% 39.20%,100.00% 42.07%,100.00% 44.92%,100.00% 47.48%,100.00% 49.97%,100.00% 52.40%,100.00% 54.87%,100.00% 57.43%,100.00% 58.57%,100.00% 60.02%,100.00% 62.63%,100.00% 65.41%,100.00% 67.89%,100.00% 70.23%,100.00% 72.56%,100.00% 74.26%,100.00% 76.58%,100.00% 78.93%,100.00% 81.36%,100.00% 83.92%,100.00% 86.57%,100.00% 88.60%,100.00% 90.69%,100.00% 92.98%,100.00% 95.01%,100.00% 97.46%,99.95% 100.00%,97.08% 100.00%,94.45% 100.00%,92.06% 100.00%,89.54% 100.00%,86.61% 100.00%,83.78% 100.00%,81.11% 100.00%,78.50% 100.00%,76.09% 100.00%,73.52% 100.00%,71.20% 100.00%,68.89% 100.00%,66.64% 100.00%,63.96% 100.00%,62.25% 100.00%,59.71% 100.00%,56.80% 100.00%,54.06% 100.00%,51.70% 100.00%,48.83% 100.00%,45.99% 100.00%,43.34% 100.00%,40.65% 100.00%,37.69% 100.00%,35.23% 100.00%,32.68% 100.00%,30.06% 100.00%,27.58% 100.00%,24.79% 100.00%,21.97% 100.00%,19.88% 100.00%,17.59% 100.00%,14.94% 100.00%,12.27% 100.00%,9.33% 100.00%,6.59% 100.00%,3.72% 100.00%,0.77% 100.00%,0.00% 98.04%,0.00% 95.84%,0.00% 93.57%,0.00% 91.32%,0.00% 89.16%,0.00% 86.86%,0.00% 84.58%,0.00% 82.34%,0.00% 79.92%,0.00% 77.76%,0.00% 75.10%,0.00% 73.31%,0.00% 70.54%,0.00% 67.58%,0.00% 64.79%,0.00% 61.92%,0.00% 58.97%,0.00% 56.03%,0.00% 53.36%,0.00% 51.19%,0.00% 48.81%,0.00% 46.12%,0.00% 43.22%,0.00% 40.31%,0.00% 37.63%,0.00% 35.45%,0.00% 33.35%,0.00% 30.56%,0.00% 27.96%,0.00% 25.13%,0.00% 22.19%,0.00% 19.28%,0.00% 16.32%,0.00% 13.38%,0.00% 10.45%,0.00% 7.71%,0.00% 4.86%,0.00% 2.28%)';

  /* CSS 変数で指定した余白(vw / svh)を px にして、
     中盤でどこまで詰めるかを返す */
  function bleed(base, name) {
    var raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    var value = parseFloat(raw) || 0;          // 例: "-5vw" → -5
    var px = base * value / 100;
    return px * (1 - HERO_SETTINGS.windowMidBleed);
  }

  /* 本文の地色。Hero の締めで下から覗かせる色に使う */
  function pageBackground() {
    var value = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-bg').trim();
    return value || '#E9EDF0';
  }

  /* ヘッダーのロゴの受け渡し。
     Hero の頭では大きなロゴだけを見せたいので、ヘッダー側は隠しておき、
     Hero を離れはじめたところで出す。二重に見せない。
     GSAP が無いときはこの関数自体を呼ばないので、ヘッダーは通常表示のまま */
  function initHeaderLogoHandoff(hero) {
    var header = document.getElementById('js-header');
    if (!header) return;

    var threshold = 1;

    // 測るのはリサイズのときだけ。スクロール中はクラスを切り替えるだけにする
    function measure() {
      var travel = hero.offsetHeight - window.innerHeight;
      threshold = Math.max(travel * HERO_SETTINGS.headerLogoAt, 1);
    }

    function update() {
      header.classList.toggle('is-logo-hidden', window.scrollY < threshold);
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', function () {
      measure();
      update();
    }, { passive: true });

    measure();
    update();
  }

  /* Hero の締め。風景とコンセプト文をまとめて少し持ち上げ、
     下から本文の地色（＝次のセクションと同じ色）を覗かせて送り出す。
     sticky の解除自体は CSS 任せなので、スクロール位置は飛ばない。
     Hero の timeline に足すだけで、ScrollTrigger は増やさない */
  function addHeroExitTransition(timeline, targets, lift, position) {
    timeline.to(targets, {
      y: -lift,
      ease: 'none',
      duration: .10
    }, position);
  }

  function initOpeningHero(hero) {
    var sticky = hero.querySelector('.opening-hero__sticky');
    var logo = hero.querySelector('.opening-hero__logo');
    var frame = hero.querySelector('.opening-window');
    var image = hero.querySelector('.opening-window__image');
    var scroll = hero.querySelector('.opening-hero__scroll');
    var overlay = hero.querySelector('.opening-hero__overlay');
    var concept = hero.querySelector('.opening-hero__concept');
    var conceptLines = hero.querySelectorAll('.opening-hero__concept-line');

    function stay(reason) {
      if (reason) console.warn('opening hero: ' + reason);
      hero.classList.add('is-static');
    }

    if (!sticky || !logo || !frame || !image || !overlay || !concept) {
      stay('必要な要素が足りません');
      return;
    }

    if (prefersReducedMotion) {
      stay();
      return;
    }

    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' ||
        typeof gsap.matchMedia !== 'function') {
      stay('GSAP または ScrollTrigger を読み込めませんでした');
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    // iOS でアドレスバーが伸縮するたびに測り直さない
    ScrollTrigger.config({ ignoreMobileResize: true });

    // 画面サイズは毎回測り直す（invalidateOnRefresh とセット）
    function stageWidth() { return sticky.clientWidth; }
    function stageHeight() { return sticky.clientHeight; }

    /* 風景とコンセプト文が出そろう位置。各ブランチが実際の値を入れる。
       ここは見せ場なので、途中の半端な状態で止めない */
    var conceptStop = 1;

    // 直近のスクロール方向（1=下 / -1=上）。snap の送り先を決めるのに使う
    var heroDir = 1;

    function timeline() {
      return gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom bottom',
          scrub: HERO_SETTINGS.scrub,
          invalidateOnRefresh: true,
          onUpdate: function (self) { heroDir = self.direction; },
          /* スクロールの「速さ」に依存させず、1本の滑らかなアニメとして再生する。
             止め位置は 3つだけ：頭出し(0) / コンセプトが出そろう(conceptStop) / 送り出し(1)。
             少しでもスクロールしたら、その方向の次の止め位置まで一定の尺で再生し切る。
             duration を固定気味にすることで、速く振っても遅く振っても同じ速度で動く */
          snap: {
            snapTo: function (value) {
              var pts = [0, conceptStop, 1];
              if (heroDir >= 0) {
                for (var i = 0; i < pts.length; i++) {
                  if (pts[i] > value + .004) return pts[i];
                }
                return pts[pts.length - 1];
              }
              for (var j = pts.length - 1; j >= 0; j--) {
                if (pts[j] < value - .004) return pts[j];
              }
              return pts[0];
            },
            duration: { min: 1.5, max: 2.4 },  // 一定尺＝一定速度に近づける
            delay: .02,                        // スクロール直後に再生を始める
            ease: 'power1.inOut',
            inertia: false
          }
        }
      });
    }

    initHeaderLogoHandoff(hero);

    /* 読み込み直後の登場。スクロール演出とぶつからないよう、
       timeline が触らない子要素だけを動かす */
    gsap.from(hero.querySelector('.opening-hero__logo img'), {
      opacity: 0,
      y: 20,
      duration: 1.1,
      ease: 'power2.out',
      delay: .1
    });
    gsap.from(hero.querySelector('.opening-window__visual'), {
      opacity: 0,
      duration: 1.2,
      ease: 'power2.out',
      delay: .35
    });
    if (scroll) {
      gsap.from(scroll.children, {
        opacity: 0,
        duration: .7,
        stagger: .08,
        ease: 'power2.out',
        delay: .85
      });
    }

    var media = gsap.matchMedia();

    /* PC。中央から左に大きなロゴ、右下に切り抜き。
       切り抜きが全画面まで広がり、そのまま風景の中に入る */
    media.add('(min-width: 901px)', function () {
      gsap.set(logo, { yPercent: -50 });
      gsap.set(concept, { xPercent: -50, yPercent: -50 });

      var tl = timeline();

      tl
        /* Phase 1 — まだ動かさない。切り抜きの中の風景がわずかにずれるだけ */
        .to(image, { y: -HERO_SETTINGS.parallax, ease: 'none', duration: .18 }, 0)

        /* Phase 2 — 視点が切り抜きの奥へ近づく。
           見切れていた分が少しだけ画面内へ戻り、穴が広がりはじめる */
        .to(image, { scale: HERO_SETTINGS.imageScaleMid, ease: 'none', duration: .22 }, .18)
        .to(frame, {
          width: function () { return stageWidth() * HERO_SETTINGS.windowMidWidth; },
          height: function () { return stageHeight() * HERO_SETTINGS.windowMidHeight; },
          right: function () { return bleed(stageWidth(), '--opening-window-bleed-x'); },
          bottom: function () { return bleed(stageHeight(), '--opening-window-bleed-y'); },
          ease: 'none',
          duration: .22
        }, .18)

        /* Phase 3 — ロゴが静かに退き、主役が風景へ移る */
        .to(logo, {
          opacity: 0,
          y: -HERO_SETTINGS.logoLift,
          ease: 'none',
          duration: .16
        }, .24)
        .to(sticky, { '--opening-light': 0, ease: 'none', duration: .16 }, .24)
        .to(scroll, { opacity: 0, ease: 'none', duration: .10 }, .34)

        /* Phase 4 — 切り抜きの境界がほどけ、同じ写真がそのまま全画面になる */
        .to(frame, {
          width: stageWidth,
          height: stageHeight,
          right: 0,
          bottom: 0,
          clipPath: HERO_CLIP_FULL,
          ease: 'none',
          duration: .28
        }, .50)
        .to(image, { scale: HERO_SETTINGS.imageScaleEnd, y: 0, ease: 'none', duration: .28 }, .50)

        /* 全画面になってから一拍おく。ここで風景だけを見せる */

        /* Phase 5 — 風景の上でコンセプト文を1行ずつ読ませる */
        .to(overlay, { opacity: HERO_SETTINGS.overlayOpacity, ease: 'none', duration: .13 }, .90)
        .set(concept, { opacity: 1 }, .92)
        .fromTo(conceptLines,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            stagger: HERO_SETTINGS.conceptStagger,
            ease: 'none',
            duration: .10
          }, .94)

        /* 読む時間 */
        .to({}, { duration: .08 });

      /* Phase 6 — 次の誌面へ送り出す */
      addHeroExitTransition(tl, [frame, overlay, concept], HERO_SETTINGS.exitLift, 1.34);
      // 持ち上げたときに覗くのは、次のセクションと同じ本文の地色
      tl.to(sticky, {
        backgroundColor: pageBackground(),
        ease: 'none',
        duration: .10
      }, 1.34);

      // コンセプトが出そろってから送り出しが始まるまでの真ん中
      conceptStop = 1.30 / tl.duration();
    });

    /* 画面が狭いときは短く。ロゴの下の切り抜きが全画面まで伸びるだけにする */
    media.add('(max-width: 900px)', function () {
      gsap.set(concept, { xPercent: -50, yPercent: -50 });

      var tlNarrow = timeline();

      tlNarrow
        .to(image, { scale: HERO_SETTINGS.imageScaleMid, ease: 'none', duration: .30 }, 0)
        .to(logo, { opacity: 0, y: -16, ease: 'none', duration: .18 }, .16)
        .to(sticky, { '--opening-light': 0, ease: 'none', duration: .18 }, .16)
        .to(scroll, { opacity: 0, ease: 'none', duration: .10 }, .20)
        .to(frame, {
          width: stageWidth,
          height: stageHeight,
          right: 0,
          bottom: 0,
          clipPath: HERO_CLIP_FULL,
          ease: 'none',
          duration: .32
        }, .28)
        .to(image, { scale: HERO_SETTINGS.imageScaleEnd, ease: 'none', duration: .32 }, .28)
        /* 全画面になってから一拍おく */
        .to(overlay, { opacity: HERO_SETTINGS.overlayOpacity, ease: 'none', duration: .14 }, .72)
        .set(concept, { opacity: 1 }, .74)
        .fromTo(conceptLines,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            stagger: HERO_SETTINGS.conceptStaggerNarrow,
            ease: 'none',
            duration: .08
          }, .76)
        .to({}, { duration: .08 });

      addHeroExitTransition(tlNarrow, [frame, overlay, concept], HERO_SETTINGS.exitLiftMobile, 1.20);
      tlNarrow.to(sticky, {
        backgroundColor: pageBackground(),
        ease: 'none',
        duration: .10
      }, 1.20);

      conceptStop = 1.16 / tlNarrow.duration();
    });

    // 画像やフォントが揃ってから測り直す
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  /* ------------------------------------------------------------------
     2-4. 本文側の控えめなスクロール演出
     Hero より明らかに弱い動きにする。GSAP が無い / モーション低減の
     ときは何もしない（CSS の既定値のままで内容は読める）。
     ------------------------------------------------------------------ */
  var BODY_MOTION = {
    parallaxBase: -3,        // 画像の基準位置(%)。CSS の --parallax-shift 既定値と揃える
    parallaxRange: 6,        // PC で動く幅(%)。人物写真の頭を切らない範囲に留める
    parallaxRangeNarrow: 2.5,// 900px 以下で動く幅(%)
    typeShift: 80,           // 背景英字が流れる量(px)
    typeShiftNarrow: 36,
    scrub: 0.9
  };

  function scrollMotionReady() {
    return !prefersReducedMotion &&
      typeof gsap !== 'undefined' &&
      typeof ScrollTrigger !== 'undefined';
  }

  function isNarrow() {
    return window.innerWidth <= 900;
  }

  /* 画像のパララックス。
     カードは自動送りで作り直されるので、画像1枚ずつに ScrollTrigger を
     持たせるとリピント（4.2秒ごと）のたびに増えてしまう。
     そこで「枠」側に1つだけ置き、CSS変数を配る形にしている。
     新しく差し込まれた画像も変数を継承するので追従する */
  function initParallaxScopes(root) {
    var scopes = (root || document).querySelectorAll('[data-parallax-scope]');
    if (!scopes.length || !scrollMotionReady()) return;

    Array.prototype.forEach.call(scopes, function (scope) {
      // 二重生成しない。非表示の枠は測れないので飛ばす
      if (scope.hasAttribute('data-parallax-ready')) return;
      if (!scope.offsetParent && scope.offsetHeight === 0) return;
      scope.setAttribute('data-parallax-ready', '');

      ScrollTrigger.create({
        trigger: scope,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        onUpdate: function (self) {
          var range = isNarrow()
            ? BODY_MOTION.parallaxRangeNarrow
            : BODY_MOTION.parallaxRange;
          var value = BODY_MOTION.parallaxBase + (self.progress - 0.5) * range;
          scope.style.setProperty('--parallax-shift', value.toFixed(2) + '%');
        }
      });
    });
  }

  /* 背景の大きな英字。スクロールに合わせて横へゆっくり送るだけ */
  function initTypeBands(root) {
    var bands = (root || document).querySelectorAll('[data-typeband]');
    if (!bands.length || !scrollMotionReady()) return;

    Array.prototype.forEach.call(bands, function (band) {
      if (band.hasAttribute('data-typeband-ready')) return;
      band.setAttribute('data-typeband-ready', '');

      ScrollTrigger.create({
        trigger: band,
        start: 'top bottom',
        end: 'bottom top',
        scrub: BODY_MOTION.scrub,
        onUpdate: function (self) {
          var shift = isNarrow()
            ? BODY_MOTION.typeShiftNarrow
            : BODY_MOTION.typeShift;
          band.style.setProperty('--typeband-shift', (-shift * self.progress).toFixed(1) + 'px');
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     3. 記事: 本文生成
     ------------------------------------------------------------------ */
  function buildFigure(block) {
    var figure = el('figure', 'p-article__figure');
    var img = el('img');
    img.src = block.src;
    img.alt = block.alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    figure.appendChild(img);
    if (block.alt) figure.appendChild(el('figcaption', 'p-article__caption', block.alt));
    return figure;
  }

  /* 連続した写真は、途切れずに流れ続ける帯にまとめる */
  var MARQUEE_GAP = 0;       // 写真同士の間隔(px)。隙間なしで詰める
  var MARQUEE_SEC_PER_ITEM = 3.4;

  function buildMarquee(list) {
    var marquee = el('div', 'c-marquee');
    marquee.setAttribute('role', 'group');
    marquee.setAttribute('aria-label', '写真 ' + list.length + '枚');

    var track = el('div', 'c-marquee__track');
    // 同じ並びを2周ぶん敷き、-50% 送って繋ぐ
    for (var loop = 0; loop < 2; loop++) {
      list.forEach(function (block) {
        var item = el('div', 'c-marquee__item');
        if (loop === 1) item.setAttribute('aria-hidden', 'true');
        var img = el('img');
        img.src = block.src;
        img.alt = loop === 0 ? (block.alt || '') : '';
        img.loading = 'lazy';
        img.decoding = 'async';
        item.appendChild(img);
        track.appendChild(item);
      });
    }
    marquee.appendChild(track);

    // 1画面に何枚見せるかから、1枚の幅を出す
    function layout() {
      var perView = window.innerWidth <= 600 ? 2 : (window.innerWidth <= 900 ? 3 : 5);
      var width = (marquee.clientWidth - MARQUEE_GAP * (perView - 1)) / perView;
      marquee.style.setProperty('--marquee-item', width.toFixed(2) + 'px');
      marquee.style.setProperty('--marquee-duration', (list.length * MARQUEE_SEC_PER_ITEM).toFixed(1) + 's');
    }

    window.addEventListener('resize', layout, { passive: true });
    window.requestAnimationFrame(layout);
    return marquee;
  }

  function buildBody(blocks) {
    var frag = document.createDocumentFragment();
    var images = [];

    // 連続した写真をためて、途切れたところで吐き出す
    function flushImages() {
      if (!images.length) return;
      frag.appendChild(images.length > 1 ? buildMarquee(images) : buildFigure(images[0]));
      images = [];
    }

    blocks.forEach(function (block) {
      if (block.type === 'img') {
        images.push(block);
        return;
      }
      flushImages();
      // 章の頭。ラベル → 中央寄せの見出し
      if (block.type === 'h') {
        frag.appendChild(el('p', 'p-article__label', 'MY STORY'));
        frag.appendChild(el('h2', 'p-article__heading', block.text));
        return;
      }
      // 質問・回答（データが Q&A を持つ場合）
      if (block.type === 'q' || block.type === 'a') {
        var row = el('div', 'p-article__qa p-article__qa--' + block.type);
        row.appendChild(el('span', 'p-article__badge', block.type.toUpperCase()));
        row.appendChild(el('p', 'p-article__qa-text', block.text));
        frag.appendChild(row);
        return;
      }
      frag.appendChild(el('p', 'p-article__p', block.text));
    });

    flushImages();
    return frag;
  }

  function renderArticle(container, article) {
    document.title = article.company + ' ' + article.person + ' ｜ SPOTLIGHT SHIZUOKA';

    // 頭は「写真＝左／人物情報＝右」の2段組
    var head = el('header', 'p-article__head');

    var portrait = el('figure', 'p-article__portrait');
    var portraitImg = el('img');
    portraitImg.src = article.image;
    portraitImg.alt = article.image_alt || '';
    portraitImg.decoding = 'async';
    portraitImg.fetchPriority = 'high';
    portrait.appendChild(portraitImg);

    var intro = el('div', 'p-article__intro');
    intro.appendChild(el('h1', 'p-article__title', article.title));
    if (article.name_en) intro.appendChild(el('p', 'p-article__name-en', article.name_en));
    intro.appendChild(el('p', 'p-article__name', article.person));
    intro.appendChild(el('p', 'p-article__company',
      article.position ? article.company + '　｜　' + article.position : article.company));
    if (article.profile) intro.appendChild(el('p', 'p-article__profile', article.profile));
    if (article.site) {
      var site = el('p', 'p-article__site');
      var link = el('a', null, article.site);
      link.href = article.site;
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      site.appendChild(link);
      intro.appendChild(site);
    }

    head.appendChild(portrait);
    head.appendChild(intro);
    container.appendChild(head);

    var content = el('div', 'p-article__content');
    content.appendChild(buildBody(article.body || []));
    container.appendChild(content);

    var back = el('p', 'p-article__back');
    var backLink = el('a', null, '一覧へ戻る');
    backLink.href = 'index.html#' + article.slug;
    back.appendChild(backLink);
    container.appendChild(back);
  }

  /* ------------------------------------------------------------------
     4. フェードイン（下から少し上げながら表示）
     ・隠すのは JS が付ける .js-reveal なので、JS が動かない環境では
       最初から見えている
     ・同じタイミングで入ってきたものだけ少しずつ遅らせる
     ・一度出したら二度と隠さない（unobserve する）
     ------------------------------------------------------------------ */
  var REVEAL_STAGGER = 0.07;   // カードが続けて出るときの間隔(秒)

  function initReveal(selector) {
    var targets = document.querySelectorAll(selector);
    if (!targets.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      return; // クラスを付けない = CSS 側の初期状態も適用されない
    }

    // すでに登録済みのものは二度観測しない
    var pending = [];
    Array.prototype.forEach.call(targets, function (node) {
      if (node.classList.contains('js-reveal')) return;
      node.classList.add('js-reveal');
      pending.push(node);
    });

    if (!pending.length) return;

    var observer = new IntersectionObserver(function (entries, obs) {
      var order = 0;

      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (order) {
          entry.target.style.setProperty('--reveal-delay', (order * REVEAL_STAGGER).toFixed(2) + 's');
        }
        order += 1;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, {
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.08
    });

    pending.forEach(function (node) {
      observer.observe(node);
    });
  }

  /* ------------------------------------------------------------------
     init
     ------------------------------------------------------------------ */
  function initIndexPage(container) {
    // data/entries.js は index.html が先に読み込んでいる（保険として動的読み込みも試す）
    var ready = window.FL_ENTRIES ? Promise.resolve() : loadScript('data/entries.js');

    ready.then(function () {
      if (!window.FL_ENTRIES) throw new Error('FL_ENTRIES undefined');
      renderVoices(container, window.FL_ENTRIES);
      initReveal('.c-card, .p-voice__head, [data-reveal]');
      // VOICE は描画後にできるので、ここでスクロール演出を足す
      initParallaxScopes(container);
      initTypeBands(container);
      // 記事から戻ってきたときは該当カードまで送る（描画後にハッシュを解決し直す）
      var hash = window.location.hash.slice(1);
      if (hash && SLUG_RE.test(hash)) {
        var target = document.getElementById(hash);
        if (target) target.scrollIntoView({ block: 'center' });
      }
    }).catch(function () {
      fail(container, '記事一覧を読み込めませんでした。data/entries.js を確認してください。');
    });
  }

  function initArticlePage(container) {
    var slug = new URLSearchParams(window.location.search).get('slug');
    if (!slug || !SLUG_RE.test(slug)) {
      fail(container, '記事が指定されていません。INDEX から選び直してください。');
      return;
    }

    loadScript('data/articles/' + slug + '.js').then(function () {
      var article = window.FL_ARTICLE && window.FL_ARTICLE[slug];
      if (!article) throw new Error('not found');
      renderArticle(container, article);
      initReveal('.p-article__head, .p-article__label, .p-article__heading, .p-article__p, .p-article__qa, .p-article__figure, .c-marquee, .p-article__back');
    }).catch(function () {
      fail(container, '記事「' + slug + '」を読み込めませんでした。');
    });
  }

  function init() {
    initHeader();
    initMenu();

    /* 放送局の波形は SMIL(<animate>)で動かしている（Safari/iOS 対応のため）。
       SMIL は CSS の prefers-reduced-motion では止まらないので、ここで止める */
    if (prefersReducedMotion) {
      document.querySelectorAll('.p-station__wave').forEach(function (svg) {
        if (typeof svg.pauseAnimations === 'function') svg.pauseAnimations();
      });
    }

    var hero = document.querySelector('[data-opening-hero]');
    if (hero) {
      // Hero がこけてもページ全体は止めない
      try {
        initOpeningHero(hero);
      } catch (error) {
        hero.classList.add('is-static');
        console.warn('opening hero:', error);
      }
    }

    var voices = document.getElementById('js-voices');
    if (voices) initIndexPage(voices);

    var article = document.getElementById('js-article');
    if (article) initArticlePage(article);

    initReveal([
      '.p-station__title', '.p-station__sub',           // ABOUT
      '.p-station__freq', '.p-station__text', '.p-station__link',
      '.p-page__head', '.p-page__notice', '.p-page__section', '.p-page__back',
      '.c-form__row', '.c-form__consent', '.c-form__submit',
      '[data-reveal]'
    ].join(', '));

    // 静的に置いてある枠のぶん（VOICE 内は描画後に initIndexPage が呼ぶ）
    initParallaxScopes(document);
    initTypeBands(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
