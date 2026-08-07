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

  /* 公開先。canonical / og:url を記事ごとに組み立てるのに使う。
     各 HTML の <head> に書いてある値と揃えること */
  var SITE_ORIGIN = 'https://spotlight-shizuoka.com/';

  /* 縦積みに切り替える境目。CSS の @media と揃えること */
  var NARROW_MAX = 900;
  var MQ_WIDE = '(min-width: ' + (NARROW_MAX + 1) + 'px)';
  var MQ_NARROW = '(max-width: ' + NARROW_MAX + 'px)';

  function isNarrow() {
    return window.innerWidth <= NARROW_MAX;
  }

  /* ------------------------------------------------------------------
     小さなDOMヘルパ
     ------------------------------------------------------------------ */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null && text !== '') node.textContent = text;
    return node;
  }

  /* 画像は既定で遅延読み込み。開いてすぐ見えるものだけ eager にする */
  function imgEl(src, alt, eager) {
    var img = el('img');
    img.src = src;
    img.alt = alt || '';
    img.decoding = 'async';
    if (eager) img.fetchPriority = 'high';
    else img.loading = 'lazy';
    return img;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /* :root に置いた CSS 変数を読む（JS 側の値と二重管理しないため） */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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
    // 見せるのは人。大きい枠はカラー、レールは白黒でホバーで色が戻る（CSS 側）
    var item = el('li', 'c-card' + (isLead ? ' c-card--lead' : ''));
    item.id = entry.slug;

    var link = el('a', 'c-card__link');
    link.href = 'entry.html?slug=' + encodeURIComponent(entry.slug);

    var figure = el('figure', 'c-card__img');

    var photo = el('span', 'c-card__photo');
    photo.appendChild(imgEl(entry.image, entry.image_alt));
    figure.appendChild(photo);

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
    // 役職は出さない（記事側で読ませる）。一覧では所属だけ添える
    info.appendChild(el('p', 'c-card__job', entry.company));

    link.appendChild(figure);
    link.appendChild(info);
    item.appendChild(link);
    return item;
  }

  // VOICE で見せるグループ数。実データが足りないぶんは空き枠で埋める
  var VOICE_GROUP_TOTAL = 6;

  /* グループの外枠と見出し。実データのグループも空き枠も同じ形にする。
     奇数グループは大きいカードが左、偶数は右（p-voice--flip）で、
     並びが単調にならないようにする */
  function buildVoiceShell(index, modifier) {
    var section = el('section', 'p-voice' +
      (modifier ? ' ' + modifier : '') +
      (index % 2 === 1 ? ' p-voice--flip' : ''));

    var inner = el('div', 'p-voice__inner l-container');
    section.appendChild(inner);

    var head = el('header', 'p-voice__head');
    var label = el('p', 'p-voice__group');
    label.appendChild(el('span', 'p-voice__group-label', 'GROUP'));
    label.appendChild(el('span', 'p-voice__group-num', String(index + 1)));
    head.appendChild(label);
    head.appendChild(el('h2', 'p-voice__title', 'VOICE'));
    inner.appendChild(head);

    return { section: section, inner: inner, head: head };
  }

  /* 空き枠のグループ。データが揃うまで COMING SOON として先に置く。
     見出しは実グループと同じ構成にし、本体だけプレースホルダーにする */
  function buildComingGroup(index) {
    var shell = buildVoiceShell(index, 'p-voice--coming');
    shell.section.id = 'group-' + (index + 1 < 10 ? '0' : '') + (index + 1);

    var body = el('div', 'p-voice__body');
    var placeholder = el('div', 'p-voice__coming');
    placeholder.appendChild(el('p', 'p-voice__coming-label', 'COMING SOON'));
    placeholder.appendChild(el('p', 'p-voice__coming-sub', '近日公開'));
    body.appendChild(placeholder);
    shell.inner.appendChild(body);

    return shell.section;
  }

  var VOICE_AUTO_MS = 2600;    // 自動送りの間隔
  var VOICE_SWAP_MS = 220;     // 入れ替えの前に一度沈めておく時間（CSS の is-swapping と揃える）

  /* 5人を順に大きい枠へ送るカルーセル。大きいカードも入れ替えの対象にする */
  function initVoiceCarousel(section, members, parts) {
    var offset = 0;

    function paint() {
      clear(parts.lead);
      parts.lead.appendChild(buildCard(members[offset], true));

      var list = el('ul', 'p-voice__cards');
      for (var i = 1; i < members.length; i++) {
        list.appendChild(buildCard(members[(offset + i) % members.length], false));
      }
      clear(parts.rail);
      parts.rail.appendChild(list);
    }

    function rotate(direction) {
      offset = (offset + direction + members.length) % members.length;
      // 入れ替えは一度沈めてから
      parts.body.classList.add('is-swapping');
      window.setTimeout(function () {
        paint();
        parts.body.classList.remove('is-swapping');
      }, VOICE_SWAP_MS);
    }

    paint();

    /* 自動遷移。カードにカーソルを載せても止めない（送りは一定で回し続ける）。
       キーボードで中を辿っている間だけは、足元のカードが入れ替わらないよう待つ */
    var timer = null;
    var focusHeld = false;

    function play() {
      if (prefersReducedMotion || timer) return;
      timer = window.setInterval(function () {
        if (!focusHeld) rotate(1);
      }, VOICE_AUTO_MS);
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

    /* ボタンは「並びをどちらへずらすか」で持つ。
       ・左＝1つ左へずれる＝次の人が大きい枠へ入る（自動送りと同じ向き）
       ・右＝1つ右へずれる＝前の人が戻ってくる
       大きい枠が左でも右でも（p-voice--flip）、カードが動く向きは
       押したボタンと必ず一致する */
    parts.left.addEventListener('click', function () { manual(1); });
    parts.right.addEventListener('click', function () { manual(-1); });

    section.addEventListener('focusin', function () { focusHeld = true; });
    section.addEventListener('focusout', function () { focusHeld = false; });

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
  }

  function renderVoices(container, data) {
    var frag = document.createDocumentFragment();

    data.groups.forEach(function (group, index) {
      var shell = buildVoiceShell(index);
      shell.section.id = group.id;
      // 写真のパララックスはこの枠から配る（下の initParallaxScopes 参照）
      shell.section.setAttribute('data-parallax-scope', '');

      /* 送りは「人の前後」ではなく「カードをどちらへ動かすか」で持つ。
         大きい枠が左右どちらのグループでも、押した向きと動く向きが揃う */
      var nav = el('div', 'p-voice__nav');
      var left = el('button', 'p-voice__arrow p-voice__arrow--left');
      var right = el('button', 'p-voice__arrow p-voice__arrow--right');
      [left, right].forEach(function (button, i) {
        button.type = 'button';
        button.appendChild(el('span', 'u-visually-hidden',
          i ? 'カードを右へ送る' : 'カードを左へ送る'));
      });
      nav.appendChild(left);
      nav.appendChild(right);
      shell.head.appendChild(nav);

      var body = el('div', 'p-voice__body');
      var lead = el('div', 'p-voice__lead');
      var rail = el('div', 'p-voice__rail');
      body.appendChild(lead);
      body.appendChild(rail);
      shell.inner.appendChild(body);

      initVoiceCarousel(shell.section, group.entries.slice(), {
        body: body, lead: lead, rail: rail, left: left, right: right
      });

      frag.appendChild(shell.section);
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
    imageScaleStart: 1.24,   // CSS の --opening-image-scale と揃える
    imageScaleMid: 1.12,
    imageScaleEnd: 1,
    windowMidWidth: 0.54,    // 画面幅に対する中盤の切り抜き幅
    windowMidHeight: 0.66,   // 画面高に対する中盤の切り抜き高
    windowMidBleed: 0.4,     // 見切れ量を中盤でどこまで戻すか（0=そのまま 1=画面内）
    overlayOpacity: 0.64,    // CSS の --opening-overlay-opacity と揃える
    parallax: 10,            // Phase1 で風景がずれる量(px)
    logoLift: 24,            // ロゴが退くときに動く量(px)
    headerLogoAt: 0.46       // ここを超えたらヘッダーのロゴを出す（タイムライン進捗の割合）
  };

  /* コンセプトが出そろってから Hero を抜けるまでの間。
     ここが短いと、出そろった位置＝ほぼ終点になってしまい、
     ひと押しで通り過ぎる（読む前に飛び出す）。
     snap の止め位置も終点に近づきすぎて、2つの止め位置が食い合う */
  var HERO_READ_HOLD = .60;

  /* Hero の締め（放送のお知らせ→覆い→コンセプト文）の timeline 上の
     位置と量。PC と狭い画面で数値だけが違うので表にしてある。
     ・at*      : timeline 上の位置
     ・type     : コンセプト文を打ち終わるまでの長さ

     以前は終盤に風景ごと持ち上げて下から地色を覗かせていたが、
     止まる位置がちょうど持ち上げきったところで、風景の下に地色の帯が
     残って隙間に見えてしまうのでやめた。Hero を抜けると sticky が
     外れて風景ごと上へ流れるので、送り出しはそれで足りる */
  var HERO_FINALE = {
    wide: {
      atOnair: .74, atOverlay: .88, atConcept: .92, atLines: .96, type: 2.40
    },
    narrow: {
      atOnair: .58, atOverlay: .70, atConcept: .74, atLines: .78, type: 2.00
    }
  };

  /* コンセプト文を1文字ずつに割る。スクロールに合わせて打っていくため。
     ・外側の枠は最初から出しておき、中の字だけを出す。枠の位置が動かないので
       打つあいだ行が伸び縮みせず、中央寄せの組みが揺れない
     ・打っている位置の縦棒（カーソル）は外側の枠に出す。中の字と一緒に
       透明にならないよう、透過を掛けるのは中の字だけにしてある
     ・読み上げには元の文をそのまま渡し、割った字は読ませない */
  function splitIntoChars(lines) {
    var chars = [];
    var glyphs = [];

    Array.prototype.forEach.call(lines, function (line) {
      var text = line.textContent.trim();
      line.setAttribute('aria-label', text);
      clear(line);

      text.split('').forEach(function (ch) {
        var box = el('span', 'opening-hero__concept-char');
        box.setAttribute('aria-hidden', 'true');
        var glyph = el('span', null, ch);
        box.appendChild(glyph);
        line.appendChild(box);
        chars.push(box);
        glyphs.push(glyph);
      });
    });

    return { chars: chars, glyphs: glyphs };
  }

  /* 打てた割合から「何文字目まで出すか」を決めて塗り分ける。
     毎フレーム全部を触らないよう、前回との差だけを書き換える */
  function paintTyped(chars, typed) {
    var count = Math.round(typed.at * chars.length);
    if (count === typed.painted) return;

    var from = Math.min(count, typed.painted || 0);
    var to = Math.max(count, typed.painted || 0);
    for (var i = from; i < to; i++) {
      chars[i].classList.toggle('is-typed', i < count);
    }

    // 打っている位置の縦棒。打ち終わりと頭出しでは消す
    if (chars[typed.caret]) chars[typed.caret].classList.remove('is-typing');
    typed.caret = (count > 0 && count < chars.length) ? count - 1 : -1;
    if (chars[typed.caret]) chars[typed.caret].classList.add('is-typing');

    typed.painted = count;
  }

  /* 切り抜きが最後に寄っていく形。紙面から切り抜いた穴（CSS の
     .opening-window の clip-path）と同じ点数のまま矩形へ寄せて、
     全画面の風景につなぐ */
  var HERO_CLIP_FULL ='polygon(0.00% 0.00%,2.46% 0.00%,4.94% 0.00%,7.34% 0.00%,9.85% 0.00%,12.68% 0.00%,15.37% 0.00%,17.81% 0.00%,19.87% 0.00%,22.51% 0.00%,24.97% 0.00%,27.33% 0.00%,29.83% 0.00%,32.18% 0.00%,34.50% 0.00%,37.00% 0.00%,39.78% 0.00%,42.02% 0.00%,44.55% 0.00%,47.24% 0.00%,49.86% 0.00%,52.61% 0.00%,55.50% 0.00%,58.08% 0.00%,60.89% 0.00%,63.62% 0.00%,66.14% 0.00%,68.28% 0.00%,70.64% 0.00%,73.30% 0.00%,76.18% 0.00%,79.08% 0.00%,82.02% 0.00%,83.93% 0.00%,86.20% 0.00%,88.47% 0.00%,90.75% 0.00%,93.03% 0.00%,95.30% 0.00%,96.99% 0.00%,99.22% 0.00%,100.00% 1.53%,100.00% 3.79%,100.00% 6.05%,100.00% 8.33%,100.00% 10.60%,100.00% 12.35%,100.00% 14.73%,100.00% 17.10%,100.00% 19.45%,100.00% 20.62%,100.00% 23.33%,100.00% 26.25%,100.00% 29.10%,100.00% 31.75%,100.00% 34.30%,100.00% 36.40%,100.00% 39.20%,100.00% 42.07%,100.00% 44.92%,100.00% 47.48%,100.00% 49.97%,100.00% 52.40%,100.00% 54.87%,100.00% 57.43%,100.00% 58.57%,100.00% 60.02%,100.00% 62.63%,100.00% 65.41%,100.00% 67.89%,100.00% 70.23%,100.00% 72.56%,100.00% 74.26%,100.00% 76.58%,100.00% 78.93%,100.00% 81.36%,100.00% 83.92%,100.00% 86.57%,100.00% 88.60%,100.00% 90.69%,100.00% 92.98%,100.00% 95.01%,100.00% 97.46%,99.95% 100.00%,97.08% 100.00%,94.45% 100.00%,92.06% 100.00%,89.54% 100.00%,86.61% 100.00%,83.78% 100.00%,81.11% 100.00%,78.50% 100.00%,76.09% 100.00%,73.52% 100.00%,71.20% 100.00%,68.89% 100.00%,66.64% 100.00%,63.96% 100.00%,62.25% 100.00%,59.71% 100.00%,56.80% 100.00%,54.06% 100.00%,51.70% 100.00%,48.83% 100.00%,45.99% 100.00%,43.34% 100.00%,40.65% 100.00%,37.69% 100.00%,35.23% 100.00%,32.68% 100.00%,30.06% 100.00%,27.58% 100.00%,24.79% 100.00%,21.97% 100.00%,19.88% 100.00%,17.59% 100.00%,14.94% 100.00%,12.27% 100.00%,9.33% 100.00%,6.59% 100.00%,3.72% 100.00%,0.77% 100.00%,0.00% 98.04%,0.00% 95.84%,0.00% 93.57%,0.00% 91.32%,0.00% 89.16%,0.00% 86.86%,0.00% 84.58%,0.00% 82.34%,0.00% 79.92%,0.00% 77.76%,0.00% 75.10%,0.00% 73.31%,0.00% 70.54%,0.00% 67.58%,0.00% 64.79%,0.00% 61.92%,0.00% 58.97%,0.00% 56.03%,0.00% 53.36%,0.00% 51.19%,0.00% 48.81%,0.00% 46.12%,0.00% 43.22%,0.00% 40.31%,0.00% 37.63%,0.00% 35.45%,0.00% 33.35%,0.00% 30.56%,0.00% 27.96%,0.00% 25.13%,0.00% 22.19%,0.00% 19.28%,0.00% 16.32%,0.00% 13.38%,0.00% 10.45%,0.00% 7.71%,0.00% 4.86%,0.00% 2.28%)';

  /* CSS 変数で指定した余白(vw / svh)を px にして、
     中盤でどこまで詰めるかを返す */
  function bleed(base, name) {
    var value = parseFloat(cssVar(name)) || 0;   // 例: "-5vw" → -5
    var px = base * value / 100;
    return px * (1 - HERO_SETTINGS.windowMidBleed);
  }

  /* 全画面の風景になったあとの締め。PC と狭い画面で共通の組み立て。
     放送のお知らせを引き、覆いをかけてコンセプト文を打っていく。
     風景は最後まで画面いっぱいのまま置き、送り出しは Hero を抜けた
     ところで sticky が外れるのに任せる（下に地色の帯を作らない）。
     timeline に足すだけで ScrollTrigger は増やさない。
     戻り値は snap の止め位置（進捗の割合） */
  function addHeroFinale(tl, parts, at) {
    var chars = parts.conceptChars;
    var typed = { at: 0 };      // 打てた割合。timeline はこれ1つだけを送る

    tl
      /* ここから先はコンセプト文を読ませる段。ヘッダーが地を取り戻すと
         札の上を帯が横切ってしまうので、放送のお知らせは引く */
      .to(parts.onair, { opacity: 0, ease: 'none', duration: .12 }, at.atOnair)

      /* 風景の上に覆いをかけてから、文字を打ちはじめる */
      .to(parts.overlay, {
        opacity: HERO_SETTINGS.overlayOpacity, ease: 'none', duration: .16
      }, at.atOverlay)
      .set(parts.concept, { opacity: 1 }, at.atConcept)

      /* タイプライター。1つの数値を 0→1 へ送り、そこから「何文字目まで
         打てたか」を出してクラスで切り替える。
         stagger 付きの tween を 73個の字に掛けると、再生前の状態が
         巻き戻しで正しく戻らず、頭出しから全文が出てしまう。
         数値1本なら行きも戻りも同じ式で決まる */
      .to(typed, {
        at: 1,
        duration: at.type,
        ease: 'none',
        onUpdate: function () { paintTyped(chars, typed); }
      }, at.atLines);

    /* 打ち終わった位置。ここが snap の止め位置になる。
       文字数はデータ側で変わりうるので、実際の長さから取る */
    var settled = tl.duration();

    /* 読む時間。ここを過ぎると Hero を抜けて、風景ごと上へ流れる */
    tl.to({}, { duration: HERO_READ_HOLD });

    return settled / tl.duration();
  }

  function initOpeningHero(hero) {
    var sticky = hero.querySelector('.opening-hero__sticky');
    var backdrop = hero.querySelector('.opening-hero__backdrop');
    var logo = hero.querySelector('.opening-hero__logo');
    var frame = hero.querySelector('.opening-window');
    var image = hero.querySelector('.opening-window__image');
    var scroll = hero.querySelector('.opening-hero__scroll');
    var overlay = hero.querySelector('.opening-hero__overlay');
    var concept = hero.querySelector('.opening-hero__concept');
    var onair = hero.querySelector('.opening-hero__onair');
    var conceptLines = hero.querySelectorAll('.opening-hero__concept-line');

    function stay(reason) {
      if (reason) console.warn('opening hero: ' + reason);
      hero.classList.add('is-static');
    }

    if (!sticky || !backdrop || !logo || !frame || !image || !overlay || !concept) {
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
    var activeTL = null;
    var header = document.getElementById('js-header');

    /* ヘッダーのロゴの出し分け。頭（進捗が浅い）のうちは大きな Hero ロゴが
       主役なので隠し、reveal が進んだコンセプト段やコンテンツ側では出す。
       Hero を通り過ぎていれば（スクロール位置で判定）常に出す＝リロードで
       途中に居ても scrub の追従を待たずに正しく表示される。

       頭に戻っているあいだは進捗を見ずに必ず隠す。scrub は追従が遅れるので、
       スクロール位置が頭でも progress はしばらく高いままになり、
       それを見て判定するとヘッダーが出たまま残ってしまう */
    function updateHeaderLogo() {
      if (!header) return;
      var heroScroll = hero.offsetHeight - window.innerHeight;
      var y = window.scrollY;
      var atHead = y < heroScroll * 0.2;
      var pastHero = y > heroScroll * 0.6;
      var p = activeTL ? activeTL.progress() : 0;
      header.classList.toggle('is-logo-hidden',
        atHead || (!pastHero && p < HERO_SETTINGS.headerLogoAt));
    }

    /* スクロールに滑らかに追従（scrub）して“流れる”ように再生する。
       止め位置（0 / コンセプト出そろい / 送り出し）へ snap で吸着させ、
       中途半端な位置で止まらない・大きくは飛び越えないようにする */
    function timeline() {
      return gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.8,                 // 追従の平滑化。大きいほど“ぬめっと”流れる
          invalidateOnRefresh: true,
          onUpdate: updateHeaderLogo,
          snap: {
            snapTo: function (value) {
              var pts = [0, conceptStop, 1];
              var best = pts[0], bd = Infinity;
              for (var i = 0; i < pts.length; i++) {
                var d = Math.abs(pts[i] - value);
                if (d < bd) { bd = d; best = pts[i]; }
              }
              return best;
            },
            duration: { min: 0.25, max: 0.7 },
            ease: 'power1.inOut',
            delay: 0.05
          }
        }
      });
    }

    // 頭出しの状態：Hero の大きなロゴが主役なので、ヘッダー側は隠しておく
    if (header) header.classList.add('is-logo-hidden');
    // Hero を通り過ぎたら確実にロゴを出す（scrub の追従待ちに依存しない）
    window.addEventListener('scroll', updateHeaderLogo, { passive: true });


    /* 読み込み直後の登場。スクロール演出とぶつからないよう、
       timeline が触らない子要素だけを動かす。

       ロゴは画面の左の外から、3回跳ねながら定位置まで入ってくる。
       跳び上がるときは縦に伸び、着地の瞬間に潰れる（squash & stretch）。
       transform-origin を下端に置いているので、足で着地して弾んで見える。
       跳ぶ幅・高さ・潰れ方は進むほど小さくして、勢いが減っていくようにする。
       スクロール側の timeline は h1 の y / opacity を触るので、
       ここは img の xPercent / yPercent / scale だけに閉じてぶつからないようにする */
    var logoImage = hero.querySelector('.opening-hero__logo img');
    if (logoImage) {
      /* to    : そのホップの着地点（定位置＝0 までの xPercent）
         up    : 跳び上がる高さ
         rise  : 上がる時間 / fall : 落ちる時間
         sx,sy : 着地で潰れる量 */
      var HOPS = [
        { to: -74, up: 34, rise: .30, fall: .26, sx: 1.14, sy: .81 },
        { to: -27, up: 22, rise: .24, fall: .20, sx: 1.09, sy: .88 },
        { to:   0, up: 11, rise: .18, fall: .15, sx: 1.05, sy: .94 }
      ];

      gsap.set(logoImage, {
        transformOrigin: '50% 100%',
        xPercent: -155,          // 画面の外
        yPercent: 0
      });

      var intro = gsap.timeline({ delay: .12 });

      HOPS.forEach(function (hop, i) {
        var at = intro.duration();          // このホップの開始位置
        var last = i === HOPS.length - 1;
        var land = at + hop.rise + hop.fall;

        intro
          // 横移動は一定の速さで。上下の弧と重ねて放物線に見せる
          .to(logoImage, {
            xPercent: hop.to, duration: hop.rise + hop.fall, ease: 'none'
          }, at)
          .to(logoImage, {
            yPercent: -hop.up, scaleX: .95, scaleY: 1.09,
            duration: hop.rise, ease: 'power2.out'
          }, at)
          .to(logoImage, {
            yPercent: 0, scaleX: 1, scaleY: 1,
            duration: hop.fall, ease: 'power2.in'
          }, at + hop.rise)
          // 着地の潰れ
          .to(logoImage, {
            scaleX: hop.sx, scaleY: hop.sy, duration: .09, ease: 'power2.out'
          }, land)
          // 戻り。最後だけ余韻を残す
          .to(logoImage, {
            scaleX: 1, scaleY: 1,
            duration: last ? .5 : .16,
            ease: last ? 'elastic.out(1, .45)' : 'power2.out'
          }, land + .09);
      });
    }
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

    /* 締めの共通部分に渡す顔ぶれ */
    /* コンセプト文を1文字ずつに割る。演出が動くと決まったここで初めて割り、
       演出しない環境（上で return 済み）では元の文のまま残す */
    var split = splitIntoChars(conceptLines);

    var finaleParts = {
      overlay: overlay, concept: concept, onair: onair,
      conceptChars: split.chars, conceptGlyphs: split.glyphs
    };

    var media = gsap.matchMedia();

    /* PC。中央から左に大きなロゴ、右下に切り抜き。
       切り抜きが全画面まで広がり、そのまま風景の中に入る */
    media.add(MQ_WIDE, function () {
      /* CSS の translate(-50%,-50%) は、GSAP が触る時点で px に解決済み。
         そこへ yPercent を足すと中央寄せが二重に掛かって半分ぶん上へずれる。
         x/y を 0 に戻したうえで割合だけを持たせ、GSAP に一本化する */
      gsap.set(logo, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
      gsap.set(concept, { xPercent: -50, yPercent: -50, x: 0, y: 0 });

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
        /* 穴が広がりきるのに合わせて、切り抜きの中に色が戻る */
        .to(sticky, { '--opening-window-gray': 0, ease: 'none', duration: .28 }, .50);

      /* 全画面になってから一拍おいて、Phase 5-6（コンセプト文と送り出し）へ */
      conceptStop = addHeroFinale(tl, finaleParts, HERO_FINALE.wide);
      activeTL = tl;
    });

    /* 画面が狭いときは短く。ロゴの下の切り抜きが全画面まで伸びるだけにする */
    media.add(MQ_NARROW, function () {
      gsap.set(concept, { xPercent: -50, yPercent: -50, x: 0, y: 0 });

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
        /* 穴が広がりきるのに合わせて、切り抜きの中に色が戻る */
        .to(sticky, { '--opening-window-gray': 0, ease: 'none', duration: .32 }, .28);

      /* 全画面になってから一拍おいて、コンセプト文と送り出しへ */
      conceptStop = addHeroFinale(tlNarrow, finaleParts, HERO_FINALE.narrow);
      activeTL = tlNarrow;
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
    parallaxRangeNarrow: 2.5 // 900px 以下で動く幅(%)
  };

  function scrollMotionReady() {
    return !prefersReducedMotion &&
      typeof gsap !== 'undefined' &&
      typeof ScrollTrigger !== 'undefined';
  }

  /* 「枠」に ScrollTrigger を1つだけ置き、進捗を CSS 変数として配る。
     枠の中の要素は変数を継承するので、あとから差し込まれたものも追従する。
     （カードは自動送りで作り直されるので、要素1つずつに持たせると
     描き直しのたびに ScrollTrigger が増えてしまう）

     options: attr / property / scrub / value(progress) / skipHidden */
  function initScrubVar(root, options) {
    var nodes = (root || document).querySelectorAll('[' + options.attr + ']');
    if (!nodes.length || !scrollMotionReady()) return;

    var doneAttr = options.attr + '-ready';

    Array.prototype.forEach.call(nodes, function (node) {
      // 二重生成しない。非表示の枠は測れないので飛ばす
      if (node.hasAttribute(doneAttr)) return;
      if (options.skipHidden && !node.offsetParent && node.offsetHeight === 0) return;
      node.setAttribute(doneAttr, '');

      ScrollTrigger.create({
        trigger: node,
        start: 'top bottom',
        end: 'bottom top',
        scrub: options.scrub,
        onUpdate: function (self) {
          node.style.setProperty(options.property, options.value(self.progress));
        }
      });
    });
  }

  /* 画像のパララックス */
  function initParallaxScopes(root) {
    initScrubVar(root, {
      attr: 'data-parallax-scope',
      property: '--parallax-shift',
      scrub: true,
      skipHidden: true,
      value: function (progress) {
        var range = isNarrow()
          ? BODY_MOTION.parallaxRangeNarrow
          : BODY_MOTION.parallaxRange;
        return (BODY_MOTION.parallaxBase + (progress - 0.5) * range).toFixed(2) + '%';
      }
    });
  }


  /* ------------------------------------------------------------------
     3. 記事: 本文生成
     ------------------------------------------------------------------ */
  /* 単独の写真。本文に回り込ませるので、出てくる順に右・左と振り分ける
     （CSS の nth-of-type だと、帯を挟んで本文のかたまりが分かれた時に
     数え直しになってしまうため、ここで決める） */
  function buildFigure(block, index) {
    var figure = el('figure', 'p-article__figure' +
      (index % 2 ? ' p-article__figure--left' : ''));
    figure.appendChild(imgEl(block.src, block.alt));
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
        // 2周目は同じ写真の複製なので、読み上げからは外す
        if (loop === 1) item.setAttribute('aria-hidden', 'true');
        item.appendChild(imgEl(block.src, loop === 0 ? block.alt : ''));
        track.appendChild(item);
      });
    }
    marquee.appendChild(track);

    // 1画面に何枚見せるかから、1枚の幅を出す
    function layout() {
      var perView = window.innerWidth <= 600 ? 2 : (isNarrow() ? 3 : 5);
      var width = (marquee.clientWidth - MARQUEE_GAP * (perView - 1)) / perView;
      marquee.style.setProperty('--marquee-item', width.toFixed(2) + 'px');
      marquee.style.setProperty('--marquee-duration', (list.length * MARQUEE_SEC_PER_ITEM).toFixed(1) + 's');
    }

    window.addEventListener('resize', layout, { passive: true });
    window.requestAnimationFrame(layout);
    return marquee;
  }

  /* 記事の締め。記事が「地の文 → 単独の写真」で終わるとき、その2つを
     横並びの列として組む。
     回り込み（float）にすると、締めの写真は本文よりずっと背が高いので
     本文が尽きたあと横が丸ごと空いてしまう。列なら高さが合わなくても
     並びとして成立する。
     返すのは締めのかたまりが始まる位置。組めないときは -1 */
  function closingStart(blocks) {
    var last = blocks.length - 1;
    if (last < 1 || blocks[last].type !== 'img') return -1;
    // 写真が続くなら帯になるので対象外
    if (blocks[last - 1].type === 'img') return -1;
    var i = last - 1;
    while (i >= 0 && blocks[i].type === 'p') i -= 1;
    // 直前に地の文が1つもなければ並べる相手がいない
    return i === last - 1 ? -1 : i + 1;
  }

  /* 本文。
     単独の写真は本文に回り込ませたいので、読み幅のかたまり
     （.p-article__text）の中に入れる。float はそのかたまりの中だけで効く。
     連続した写真の帯（c-marquee）は記事幅いっぱいに出したいので、
     かたまりを一度閉じてから外に置き、続きは新しいかたまりで組む */
  function buildBody(blocks) {
    var frag = document.createDocumentFragment();
    var run = null;
    var images = [];
    var figures = 0;      // 単独写真の通し番号。左右の振り分けに使う

    var closeAt = closingStart(blocks);
    var closing = null;   // 締めの2列。始まったらここに入れる
    var closingText = null;

    function textRun() {
      if (!run) {
        run = el('div', 'p-article__text');
        frag.appendChild(run);
      }
      return run;
    }

    // 連続した写真をためて、途切れたところで吐き出す
    function flushImages() {
      if (!images.length) return;
      if (images.length > 1) {
        frag.appendChild(buildMarquee(images));
        run = null;                       // 帯の後ろは新しいかたまりから
      } else if (closing) {
        closing.appendChild(buildFigure(images[0], 0));
      } else {
        textRun().appendChild(buildFigure(images[0], figures));
        figures += 1;
      }
      images = [];
    }

    blocks.forEach(function (block, index) {
      if (closeAt >= 0 && index === closeAt) {
        closing = el('div', 'p-article__closing');
        closingText = el('div', 'p-article__closing-text');
        closing.appendChild(closingText);
        textRun().appendChild(closing);
      }

      if (block.type === 'img') {
        images.push(block);
        return;
      }
      flushImages();
      // 章の頭。中央寄せの見出しで区切る
      if (block.type === 'h') {
        textRun().appendChild(el('h2', 'p-article__heading', block.text));
        return;
      }
      // 質問・回答（データが Q&A を持つ場合）
      if (block.type === 'q' || block.type === 'a') {
        var row = el('div', 'p-article__qa p-article__qa--' + block.type);
        row.appendChild(el('span', 'p-article__badge', block.type.toUpperCase()));
        row.appendChild(el('p', 'p-article__qa-text', block.text));
        textRun().appendChild(row);
        return;
      }
      (closingText || textRun()).appendChild(el('p', 'p-article__p', block.text));
    });

    flushImages();
    return frag;
  }

  /* 記事ごとのメタ。head に置いた共通の値を、描いた記事のもので上書きする。
     SNS のカードはクロール時に JS を動かさないので共通のままだが、
     JS を実行する側（検索エンジンや一部のツール）には正しい値が渡る */
  function updateArticleMeta(article) {
    var url = SITE_ORIGIN + 'entry.html?slug=' + encodeURIComponent(article.slug);
    var title = article.company + ' ' + article.person + ' ｜ SPOTLIGHT SHIZUOKA';
    var desc = article.profile || article.title || '';

    document.title = title;

    function meta(selector, value) {
      var node = document.head.querySelector(selector);
      if (node && value) node.setAttribute('content', value);
    }
    meta('meta[name="description"]', desc);
    meta('meta[property="og:title"]', title);
    meta('meta[property="og:description"]', desc);
    meta('meta[property="og:url"]', url);

    var canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);
  }

  function renderArticle(container, article) {
    updateArticleMeta(article);

    // 頭は「写真＝左／人物情報＝右」の2段組
    var head = el('header', 'p-article__head');

    // 開いてすぐ見える1枚なので、遅延させず優先して読む
    var portrait = el('figure', 'p-article__portrait');
    portrait.appendChild(imgEl(article.image, article.image_alt, true));

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
      initReveal('.p-article__head, .p-article__heading, .p-article__p, .p-article__qa, .c-marquee, .p-article__back');
    }).catch(function () {
      fail(container, '記事「' + slug + '」を読み込めませんでした。');
    });
  }

  function init() {
    initHeader();
    initMenu();

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
      '.p-page__head', '.p-page__notice', '.p-page__section', '.p-page__back',
      '.c-form__row', '.c-form__consent', '.c-form__submit',
      '[data-reveal]'
    ].join(', '));

    // 静的に置いてある枠のぶん（VOICE 内は描画後に initIndexPage が呼ぶ）
    initParallaxScopes(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
