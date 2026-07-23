# SPOTLIGHT SHIZUOKA

企画名は **SPOTLIGHT SHIZUOKA**。ロゴ・タイトル・コピーライトはこの名前で通す。

**ただし現在載っている記事20本は [spotlight-miyazaki.com](https://spotlight-miyazaki.com/) から取得したサンプル。**
同シリーズ（スポットライトMIYAZAKI）の実データを流し込んでいる。
社名・人物・本文・写真・リード文はすべて差し替え前提で見ること。

表示内容はHTMLに直書きせず、**すべて `data/` 配下のJSONから `main.js` が生成する。**

---

## 1. ディレクトリ構成

```
spotlight-shizuoka/
├── index.html                  # INDEX。カードは空。main.js が描画する
├── entry.html                  # 記事ページ。?slug=xxx で1件を描画する
├── about.html                  # 企画概要（仮）
├── contact.html                # 問い合わせ窓口（仮）
├── privacy.html                # プライバシーポリシー（雛形）
├── README.md
├── data/
│   ├── entries.json            # 一覧用の元データ（20件・本文なし）
│   ├── entries.js              # ↑から生成。ブラウザはこちらを読む
│   └── articles/{slug}.json    # 記事1本ぶんの全文（20件）
│       └── {slug}.js           # ↑から生成
├── tools/
│   └── gen-data.mjs            # json → js の生成スクリプト
└── assets/
    ├── css/style.css           # FLOCSS 1ファイル
    ├── js/main.js              # 依存なし。JSON → DOM
    └── img/
        ├── logo.png            # ★要差し替え（後述）
        ├── AdobeStock_310895879_Preview.jpeg  # ★透かし入りプレビュー。イントロの地
        └── entries/01.svg … 30.svg   # 旧仮画像。現在は未使用
```

一覧と記事でデータを分けているのは、本文込みだと330KBになりINDEXの初期表示に載せられないため。
一覧側は本文と経歴を持たず、記事ページが該当する1本だけを読み込む。

### JSONとJSの二本立てについて

**編集するのは `.json`、ブラウザが読むのは `.js`。**
`file://`（HTMLをダブルクリックで開いた状態）ではブラウザが `fetch` を拒否するため、
JSONを直接取りにいくと一覧も記事も真っ白になる。
そのため実行時は `<script>` で読める `.js`（`window.FL_ENTRIES` / `window.FL_ARTICLE[slug]` への代入）を使っている。

```bash
# JSON を書き換えたら必ず流し直す
node tools/gen-data.mjs
```

---

## 2. データ

### 2-1. `data/entries.json`（一覧）

```json
{
  "source": "https://spotlight-miyazaki.com/",
  "site": { "name": "SPOTLIGHT SHIZUOKA", "kicker": "…", "lead": "…", "total": 20 },
  "groups": [
    {
      "id": "group-01",
      "index": "GROUP 1",
      "color": "#0A4E86",
      "entries": [
        {
          "no": "01", "vol": 1, "slug": "tegevajaro", "lead": true,
          "title": "宮崎からJ1へ。 地域と共に「育てる」 サッカークラブの挑戦",
          "company": "テゲバジャーロ宮崎",
          "person": "宮本 功",
          "position": "代表取締役社長",
          "name_en": "Isao Miyamoto",
          "site": "https://www.tegevajaro.com/",
          "image": "https://spotlight-miyazaki.com/wp-content/uploads/….jpg",
          "logo":  "https://spotlight-miyazaki.com/wp-content/uploads/….png",
          "image_alt": "宮本 功"
        }
      ]
    }
  ]
}
```

- `no`（通し番号 01–30）と `vol`（グループ内連番 1–5）はデータには持っているが、カードには出していない
- 掲載順は元サイトの並び順そのまま。`lead: true` が `.c-card--lead`（**各グループ1件のみ**）
- `position` が空の場合、カードのチップは出力されない（個人での掲載＝和菓子作家・救命救急医の2件）
- `title` は記事の見出し。カード下部の `.c-card__excerpt` に出る

### 2-2. `data/articles/{slug}.json`（記事）

`entries.json` の項目に加えて `profile`（経歴）と `body` を持つ。

```json
"body": [
  { "type": "h", "text": "強豪「宇都宮ブレックス」影の立役者" },
  { "type": "p", "text": "プロバスケットボールチーム、宇都宮ブレックス。…" },
  { "type": "img", "src": "https://…/5U4A0383_credit.jpg", "alt": "スタジアム風景" }
]
```

`h` → `<h2>`、`p` → `<p>`、`img` → `<figure>`（`alt` があれば `<figcaption>` も出す）。
本文中の装飾（`<span style="font-weight:400">` 等）は取り込み時に落としてある。

### 2-3. グループ

元サイトの `GROUP 1〜4` をそのまま引き継いでいる（**4グループ × 5件 = 20件**）。
グループ見出しは出さず、`--group-color`（ブルー4段階）と余白・罫だけが区切りになる。

### 2-4. カードの写真とロゴ

一覧のカードは `logo`（企業ロゴ）と `image`（人物写真）の2枚を持つ。
**既定ではロゴだけが見えていて、カードにホバーすると写真へ入れ替わる**（CSSのみ。元サイトの `hover-change` と同じ挙動）。
ホバーできない環境（タッチ）は `@media (hover: none)` で最初から写真を出す。

---

## 3. デザイン仕様

**レイアウトと組みの参照: [loogg.jp](https://loogg.jp/)。**
極太のグロテスク欧文を大きく置き、写真は大きく、罫と装飾は最小限にする、という誌面の作り。
**ただし色は参照サイトの黒＋イエローではなく、ロゴから採ったブルーを主役にしている。**

### 3-1. カラー

ロゴの3色（ブルー濃・ブルー淡・ライム）が基準。色を増やさないこと。

| 用途 | 値 | 備考 |
| --- | --- | --- |
| 地 | `#E9EDF0` | 全ページの背景。青みを含んだグレー |
| インク | `#0E1B2E` | 文字。純黒は使わない |
| ネイビー | `#0B1B2E` | ヘッダー・フッター・ドロワーの地。**ロゴが濃色地前提のため** |
| ブルー濃 | `#0090E8` | ロゴ由来。**主役の差し色**（カードのホバー下線・記事のリンク） |
| ブルー淡 | `#3DB0EA` | ロゴ由来。濃地の上で使う（ドロワー・フッター） |
| ブルー深 | `#0A4E86` | イントロの帯 |
| ライム | `#E3E648` | ロゴ由来。**イントロのスポット演出とキッカーだけ** |
| グレー | `#6B7885` | 補助文字（会社名・キャプション） |
| 罫 | `#D3DAE0` / `#BDC6CE` | 区切り線 |

- **ライムを面で使わないこと。** 面積が増えるとポップ側に転ぶ
- グループ色（`--group-color`）はブルーの6段階だが、**画像読み込み前の下地にしか使っていない**

### 3-2. タイポグラフィ

| 役割 | フォント |
| --- | --- |
| 欧文・数字（表示用） | Inter 700/800 — 参照サイトの DIN 2014 相当 |
| 和文 | Noto Sans JP 400/500/700（Hiragino Kaku Gothic 相当） |

- **明朝は使わない。** 以前の Zen Old Mincho / Bodoni Moda は参照デザインに合わないため外した
- ジャンプ率は本文14pxに対してイントロの見出し最大58px、`Index` 最大124px。**大きい欧文を小さくしないこと**

### 3-3. レイアウト

**イントロ**（`.p-intro` / ページの先頭）

企画名どおり「光を当てる」ことを見せる、ページ内で唯一の濃い帯。

- 地は静岡の写真（富士山と茶畑／`AdobeStock_310895879_Preview.jpeg`）。ロゴの山と同じモチーフが入る位置（`center 40%`）で止めている
- その上にネイビー→ブルーのグラデーションを 0.80〜0.93 で重ねて白文字を読ませる
- 天井から降りるスポットライト（`.p-intro::before` のラジアルグラデ／ライム）
- **下の境目は斜め**（`.p-intro::after`）。地の色の板を1.8度傾けて重ね、縁にライムの光を1本通している
  - 板が下から食い込むぶん、帯の `padding-bottom` を厚めに取る（150px / 900px以下104px）。**この2つは必ずセットで調整すること**（薄くすると本文が板に隠れる）
- 左に大きな一言、右にリード文の2分割（900px以下で縦積み）

**INDEX**（`.p-groups`）

- 左26%に貼り付く巨大見出し `Index`、右に記事フィードの2分割。1100px以下で1カラムに落ちる
  - 見出しは左カラム幅に収まる上限（`clamp(52px, 8.4vw, 124px)`）。これ以上大きくすると字が欠ける
- **フィードは2列。** 1列にすると件数ぶん縦に伸びすぎるため
  - 各グループの先頭1社（`.c-card--lead`）だけ2列ぶんを使い、画像＝左の横組み
  - 残り4社は画像＝上の縦組み（16:9）で2列×2段
  - 760px以下で1列、600px以下は画像＝左の詰まった並びに切り替える（縦の総量が倍近く変わる）
- カードの情報の並びは参照サイトに合わせた3段
  1. 会社名 ／ 役職（細字・グレー）＋ 氏名（太字・黒）を1行に
  2. 記事タイトル＝カードの主役（太字・最大19px、leadは27px）
  3. ホバーでタイトルにイエローの下線
- グループ間は `--group-gap`（64px / 900px以下 48px）＋ 上端の罫で束を分ける
- `aspect-ratio` を使う `.c-card__media` には `width: 100%` を必ず併記する。伸長した高さ×比率で列からはみ出すため

**ヘッダー**（高さ88px / 900px以下は68px）

- `1fr auto 1fr` の3分割グリッド。ロゴを2列目に置いて中央固定にしている（左右の要素幅に影響されない）
- **ヘッダーとフッターは黒地。** `logo.png` が濃色地前提の抜き（イエロー＋ブルー）で、
  グレーの地に置くと沈んで読めないため。**地をグレーに戻さないこと**
- 右にハンバーガー（56×56 / 線38×3px）。地がネイビーなので線は白

**記事ページ**

構成は KUMAMOTO未来リーダーズ の記事ページを参考にしている（構成だけで、色や書体は本テンプレートのまま）。

1. **人物ヘッダー** — 写真＝左（3:4）／右にタイトル・欧文氏名・和文氏名・会社名｜役職・プロフィール・公式サイト
   - 欧文氏名（`name_en`）は元サイトが持っているものをそのまま使っている
2. `MY STORY` のラベル＋中央寄せの章見出し（本文の `h` ブロックごとに出る）
3. 本文。**Q&A形式**。Qは青いバッジ＋太字、Aはグレーのバッジ＋細字（データの `q` / `a` ブロック）
   - 地の文の段落（`p`）と写真（`img`）も混在できる
4. 中央の「一覧へ戻る」ボタン（角丸）

本文は840pxに絞る。通し番号（`01 / 30`）は出さない。

**下層ページ**（`.p-page` / about・contact・privacy）

- 左に貼り付く巨大な欧文タイトル＋リード、右に本文（720px）の2分割。900px以下で縦積み
- 内容が未確定であることは `.p-page__notice`（ブルーの縦罫つき）で明示する

### 3-4. インタラクション

- **スクロールでカードが奥へ畳まれる**（`initFold`）
  - ヘッダー下32pxを基準線とし、カードの上辺が越えたぶんだけ **上辺を蝶番に `rotateX` で奥へ倒す**（最大80度）
  - **透明度は触らない。** 薄くして消すのではなく、角度がついて畳まれ、見かけの高さが潰れていく動き
  - 畳み切るのは自分の高さぶん。下端が基準線に達したところで最大になる
  - 消失点は `.p-group__list` の `perspective: 1100px` で共有しているので、同じ行のカードは揃って倒れる
  - `transform` は inline で書くため、**`.c-card__link` にCSSで `transform` を当てないこと**
  - 画面から遠いカードは IntersectionObserver で計算対象から外し、離れたら inline を消す
- カードホバーで企業ロゴから人物写真へ入れ替わる（タッチ環境では最初から写真）
- 人物写真は `object-position: top` で切り取る（顔が切れないように）
- カードホバー: 写真がわずかに寄り、タイトルにブルーの下線が引かれる
- ヘッダー: 40px スクロールで地色に戻る（`.is-scrolled`）
- ハンバーガー: 3本線が × に変形（`.is-active`）。ドロワーは**全画面のネイビー**
  - 開いている間は `body` に `.is-drawer-open` を付けて背面をスクロールさせない
  - 開いたら先頭リンクへフォーカス、`Esc` かリンククリックで閉じてボタンへ戻す
  - 閉じている間は `inert` + `aria-hidden` でタブ移動もAT読み上げも止める
- リード・カード・記事本文: フェードイン（`.js-reveal` → `.is-visible`）
- `prefers-reduced-motion: reduce` で全モーション無効

---

## 4. CSS 設計（FLOCSS）

`style.css` 1ファイル内をレイヤー順のコメントで区切っている。分割ビルドに移す場合はコメント単位で切り出す。

```
Foundation  variable / reset / base
Layout      l-container, l-header, l-footer
Object
  Component c-skip-link, c-error, c-card, c-hamburger, c-drawer
  Project   p-intro, p-groups / p-group, p-article
  Utility   u-visually-hidden
```

- 状態クラスは `is-` 接頭辞（`is-scrolled` / `is-visible`）
- JS フックは `js-` 接頭辞（`js-header` / `js-groups` / `js-article` / `js-reveal`）。**スタイルの当て先にしない**
- Component は色を持たず、`--group-color` / `--group-tint` を Project 側から受け取る

---

## 5. JS（`assets/js/main.js`）

| 関数 | 役割 |
| --- | --- |
| `initHeader` | スクロールで `.is-scrolled` を付与 |
| `initMenu` | ハンバーガーとドロワーを生成してヘッダー／body に差し込む。記事一覧は `FL_ENTRIES` から |
| `initIndexPage` | `#js-groups` があれば `window.FL_ENTRIES` からカードを生成 |
| `initArticlePage` | `#js-article` があれば `data/articles/{slug}.js` を読み込んで本文を生成 |
| `initReveal` | 生成後の要素に `.js-reveal` を付けて IntersectionObserver で点灯 |
| `initFold` | スクロール量に応じてカードを奥へ畳む（INDEXのみ） |

- `slug` は `/^[a-z0-9_-]+$/` を通ったものだけ使う（パスを組み立てるため）
- 生成はすべて `createElement` + `textContent`。`innerHTML` に文字列を流し込まない
- 取得に失敗した場合は `.c-error` を出す。`<noscript>` も置いてある
- データは script タグで読むので **`file://`（ダブルクリックで開く）でも動く**

---

## 6. 未対応・要確認

### 要対応

- [ ] **`assets/img/logo.png` は左右が見切れたラスタ画像。** SVG（またはAI）の支給が必要
- [ ] **記事20本とリード文が `スポットライトMIYAZAKI` 由来のサンプル。** 静岡の取材データに差し替えること（リード文も宮崎のまま）
- [ ] **写真・ロゴが spotlight-miyazaki.com への直リンク。** 公開前に自社ドメインへ移すこと
- [ ] favicon（`assets/img/favicon.svg`）未作成
- [ ] OGP画像未作成。`entry.html` の OGP は静的なまま（記事ごとの出し分けをしていない）
- [ ] `<link rel="canonical">` と OGP の URL が `https://example.com/` のまま
- [ ] **`about.html` / `contact.html` / `privacy.html` は仮の内容。** 事業者名・住所・電話・メール・制作クレジットがすべて `◯◯` のまま
- [ ] **プライバシーポリシーは雛形。** 法務の確認を受けていない。公開前に必ず精査すること
- [ ] **イントロの写真が Adobe Stock の透かし入りプレビュー。** ライセンス版（素材ID 310895879）への差し替えが必要
- [ ] `assets/img/entries/*.svg`（旧仮画像30点）が未使用のまま残っている
- [ ] ドロワーの `ABOUT` / `CONTACT` / `PRIVACY` はリンク先が未作成

### 要確認

- **記事一覧・本文をJSで描画しているためJS無効環境とクローラで不利。** SEOを取るならビルド時にHTMLへ焼き込む方式へ移す
- **グループ分けが掲載順の機械的な5件区切り。** テーマで束ね直すか、色帯だけの現状でよいか
- Google Fonts を CDN 読み込み中。表示速度を詰めるならセルフホストへ

---

## 7. 動作確認

`index.html` をダブルクリックで開いても動く。サーバー経由で見る場合は下記。

```bash
cd spotlight-shizuoka
python3 -m http.server 8000
# http://localhost:8000              … INDEX
# http://localhost:8000/entry.html?slug=mitsumasa_fujimoto  … 記事
```

対応: Chrome / Safari / Firefox / Edge の各最新版。
`backdrop-filter` 非対応環境ではヘッダーが不透明ネイビーのまま（デグレードのみ、破綻しない）。
