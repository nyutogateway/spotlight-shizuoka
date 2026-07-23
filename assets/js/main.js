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
    ['INDEX', 'index.html'],
    ['CONTACT', 'contact.html'],
    ['PRIVACY', 'privacy.html']
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

      /* 見出し脇の短い説明。PC では左の列に置いて sticky にする */
      var members = group.entries.slice();
      var note = el('div', 'p-voice__note');
      var first = members[0];
      var last = members[members.length - 1];
      if (first && last && first.no && last.no) {
        note.appendChild(el('p', 'p-voice__range', first.no + ' — ' + last.no));
      }
      note.appendChild(el('p', 'p-voice__text',
        '静岡で挑戦を続ける人と企業の声を、5人ずつ紹介します。'));
      head.appendChild(note);

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
        rail.scrollLeft = 0;
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

    container.appendChild(frag);
  }

  /* ------------------------------------------------------------------
     2-2. FEATURED INTERVIEW。掲載者の顔を自動で入れ替える
     （Hero から外した人物情報。VOICE の手前に置く）
     ------------------------------------------------------------------ */
  function initFeatured() {
    var stage = document.getElementById('js-top-stage');
    if (!stage || !window.FL_ENTRIES || !window.FL_ENTRIES.groups) return;

    var members = [];
    window.FL_ENTRIES.groups.forEach(function (group) {
      group.entries.forEach(function (entry) {
        if (entry.image) members.push(entry);
      });
    });
    // 出す中身がないときは枠ごと出さない
    if (!members.length) return;

    var section = document.getElementById('js-featured');
    if (section) section.classList.add('is-ready');

    var link = stage.querySelector('.p-featured__stage');
    var frames = stage.querySelectorAll('.p-featured__frame');
    var caption = stage.querySelector('.p-featured__caption');
    var index = 0;
    var front = 0;

    function paint(first) {
      var entry = members[index];
      var back = frames[1 - front];
      var img = el('img');
      img.src = entry.image;
      img.alt = entry.image_alt || '';
      img.decoding = 'async';
      if (first) img.fetchPriority = 'high';
      clear(back);
      back.appendChild(img);

      // 読み込めてから入れ替える。
      // 読み込みが遅れて順番が前後しても、表になるのは常に1枚だけにする
      function show() {
        Array.prototype.forEach.call(frames, function (frame) {
          frame.classList.toggle('is-front', frame === back);
        });
        front = 1 - front;
      }
      if (img.complete) show();
      else img.addEventListener('load', show, { once: true });

      link.href = 'entry.html?slug=' + encodeURIComponent(entry.slug);
      // 中身が写真だけなので、リンクの行き先は読み上げ用に言葉で持たせる
      link.setAttribute('aria-label', entry.person + '（' + entry.company + '）のインタビューを読む');
      clear(caption);
      caption.appendChild(el('span', 'p-featured__caption-name', entry.person));
      caption.appendChild(el('span', 'p-featured__caption-company',
        entry.position ? entry.company + '／' + entry.position : entry.company));
    }

    paint(true);

    var timer = null;
    var hovering = false;

    function play() {
      if (prefersReducedMotion || timer) return;
      timer = window.setInterval(function () {
        if (hovering) return;
        index = (index + 1) % members.length;
        paint(false);
      }, 4200);
    }

    function pause() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
    }

    ['mouseenter', 'focusin'].forEach(function (type) {
      stage.addEventListener(type, function () { hovering = true; });
    });
    ['mouseleave', 'focusout'].forEach(function (type) {
      stage.addEventListener(type, function () { hovering = false; });
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) play(); else pause();
        });
      }, { threshold: 0.2 }).observe(stage);
    } else {
      play();
    }
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
    headerLogoAt: 0.40       // ヘッダーのロゴが出てくる位置（Heroスクロールに対する割合）
  };

  /* 切り抜きの形。紙面から切り抜いた穴のつもりで、少しだけ辺を崩す。
     最後は同じ点数のまま矩形へ寄せて、全画面の風景につなぐ。
     CSS の .opening-window の clip-path と開始値を揃えること */
  var HERO_CLIP_CUT = 'polygon(39.57% 8.48%, 39.54% 26.08%, 20.67% 41.25%, 19.01% 51.35%, 14.02% 58.05%, 9.37% 71.66%, 0.17% 79.35%, 0.00% 92.46%, 18.91% 95.23%, 34.81% 93.99%, 44.64% 100.00%, 42.89% 92.83%, 49.08% 83.20%, 52.49% 69.47%, 61.95% 62.96%, 63.06% 60.14%, 61.31% 59.93%, 61.24% 62.73%, 60.70% 58.34%, 64.45% 51.72%, 72.18% 47.57%, 80.76% 51.19%, 85.48% 56.83%, 84.48% 59.74%, 77.87% 59.73%, 78.47% 70.15%, 76.19% 78.61%, 77.63% 85.04%, 75.44% 90.92%, 81.71% 99.38%, 87.97% 92.47%, 90.34% 93.97%, 90.96% 85.91%, 93.98% 83.52%, 100.00% 67.47%, 96.86% 63.71%, 97.09% 57.00%, 95.24% 55.98%, 97.81% 47.92%, 92.84% 47.04%, 89.67% 38.94%, 92.23% 29.97%, 91.21% 23.40%, 71.91% 27.32%, 65.99% 18.93%, 63.07% 22.28%, 61.81% 31.47%, 63.04% 42.19%, 60.56% 45.34%, 57.48% 44.44%, 54.97% 42.31%, 52.57% 31.17%, 48.18% 32.37%, 45.97% 29.81%, 47.12% 12.27%, 44.15% 0.00%)';
  var HERO_CLIP_FULL = 'polygon(0.00% 0.00%, 13.93% 0.00%, 33.09% 0.00%, 41.19% 0.00%, 47.80% 0.00%, 59.18% 0.00%, 68.66% 0.00%, 79.03% 0.00%, 94.16% 0.00%, 100.00% 6.77%, 100.00% 15.89%, 100.00% 21.73%, 100.00% 30.78%, 100.00% 41.98%, 100.00% 51.07%, 100.00% 53.46%, 100.00% 54.86%, 100.00% 57.07%, 100.00% 60.57%, 100.00% 66.59%, 100.00% 73.53%, 100.00% 80.90%, 100.00% 86.72%, 100.00% 89.15%, 100.00% 94.38%, 97.36% 100.00%, 90.43% 100.00%, 85.21% 100.00%, 80.25% 100.00%, 71.92% 100.00%, 64.54% 100.00%, 62.32% 100.00%, 55.92% 100.00%, 52.87% 100.00%, 39.31% 100.00%, 35.44% 100.00%, 30.12% 100.00%, 28.45% 100.00%, 21.76% 100.00%, 17.76% 100.00%, 10.88% 100.00%, 3.50% 100.00%, 0.00% 98.24%, 0.00% 82.65%, 0.00% 74.52%, 0.00% 71.01%, 0.00% 63.67%, 0.00% 55.13%, 0.00% 51.96%, 0.00% 49.42%, 0.00% 46.82%, 0.00% 37.80%, 0.00% 34.20%, 0.00% 31.52%, 0.00% 17.61%, 0.00% 7.63%)';

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

    function timeline() {
      return gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom bottom',
          scrub: HERO_SETTINGS.scrub,
          invalidateOnRefresh: true
        }
      });
    }

    initHeaderLogoHandoff(hero);

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

        /* Phase 5 — 風景の上でコンセプト文を読ませる */
        .to(overlay, { opacity: HERO_SETTINGS.overlayOpacity, ease: 'none', duration: .13 }, .72)
        .fromTo(concept,
          { opacity: 0, y: 36 },
          { opacity: 1, y: 0, ease: 'none', duration: .16 }, .76)

        /* 読む時間 */
        .to({}, { duration: .08 });

      /* Phase 6 — 次の誌面へ送り出す */
      addHeroExitTransition(tl, [frame, overlay, concept], HERO_SETTINGS.exitLift, 1.0);
      // 持ち上げたときに覗くのは、次のセクションと同じ本文の地色
      tl.to(sticky, {
        backgroundColor: pageBackground(),
        ease: 'none',
        duration: .10
      }, 1.0);
    });

    /* 画面が狭いときは短く。ロゴの下の切り抜きが全画面まで伸びるだけにする */
    media.add('(max-width: 900px)', function () {
      gsap.set(concept, { xPercent: -50, yPercent: -50 });

      var tlNarrow = timeline();

      tlNarrow
        .to(image, { scale: HERO_SETTINGS.imageScaleMid, ease: 'none', duration: .30 }, 0)
        .to(logo, { opacity: 0, y: -16, ease: 'none', duration: .18 }, .16)
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
        .to(overlay, { opacity: HERO_SETTINGS.overlayOpacity, ease: 'none', duration: .14 }, .62)
        .fromTo(concept,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, ease: 'none', duration: .18 }, .66)
        .to({}, { duration: .10 });

      addHeroExitTransition(tlNarrow, [frame, overlay, concept], HERO_SETTINGS.exitLiftMobile);
      tlNarrow.to(sticky, {
        backgroundColor: pageBackground(),
        ease: 'none',
        duration: .10
      }, '<');
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
      initReveal('.p-article__heading, .p-article__p, .p-article__figure, .c-marquee');
    }).catch(function () {
      fail(container, '記事「' + slug + '」を読み込めませんでした。');
    });
  }

  function init() {
    initHeader();
    initMenu();
    initFeatured();

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

    initReveal('.p-featured__inner, .p-station__inner, [data-reveal]');

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
