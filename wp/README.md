# WordPress テーマ

設計の考え方は [../docs/wordpress.md](../docs/wordpress.md) を参照。
ここは導入の手順だけ。

> **未検証**：WP 環境がないため、構文検査（`php -l` / `node --check` / JSON）
> しか通していない。実際の挙動は導入して確かめること。

---

## 1. 置き場所

```
wp-content/themes/spotlight-shizuoka/
```

このリポジトリの `wp/themes/spotlight-shizuoka/` をそのまま入れる。
そのうえで**静的サイトの資産をテーマの中へコピー**する。

```sh
cp -R assets wp/themes/spotlight-shizuoka/assets
```

`assets/css/style.css` と `assets/js/main.js` は**書き換えずに使う**。
テーマが出すマークアップを静的サイトに合わせてあるので、
クラス名や DOM の形を変えると Hero の演出も VOICE の送りも止まる。

---

## 2. 必要なプラグイン

| プラグイン | 用途 | 必須 |
|---|---|---|
| Advanced Custom Fields **PRO** | プロフィール・サイト設定 | ● |
| 並び順（Intuitive Custom Post Order 等） | 1〜25 の順番 | ● |
| Contact Form 7 など | 問い合わせフォーム | 送信先が決まり次第 |

ACF は **PRO**。リピーター（コンセプト文・グループの色）とオプション
ページを使っている。

フィールドは PHP（`inc/acf-fields.php`）で定義しているので、
**管理画面で作る作業も、書き出し / 読み込みも要らない**。

---

## 3. 手順

1. テーマを有効化する
2. プラグインを入れて有効化する
3. **固定ページを3つ**作る
   | タイトル | スラッグ |
   |---|---|
   | TOP | 任意 |
   | CONTACT | `contact` |
   | プライバシーポリシー | `privacy` |
4. 設定 → 表示設定 → ホームページの表示を「固定ページ」にして TOP を選ぶ
5. 設定 → パーマリンク設定を開き直す（`/story/{slug}/` を効かせるため）
6. サイト設定（左メニュー）でコンセプト文・グループの色・OGP 画像を入れる
7. 既存の記事を取り込む（次章）

---

## 4. 既存記事の取り込み

`data/articles/*.json` の 20 件を story 投稿へ移す。
本文は種別付きなのでブロックへ機械変換できる。手で貼り直す必要はない。

```sh
# まず何が起きるか見る（書き込まない）
wp eval-file wp/tools/import-stories.php -- --dry

# 実行
wp eval-file wp/tools/import-stories.php
```

やること：

- スラッグで既存を探して**更新**する（2回目以降も重複を作らない）
- 写真をメディアへ取り込み、URL を添付 ID に差し替える
  （現在は `spotlight-miyazaki.com` を直リンクしている）
- 同じ URL の画像は使い回す
- 連続した写真は「写真の帯」、1枚だけなら単独写真に振り分ける
- 末尾の「地の文＋写真」は締めのメッセージ（ACF）へ移し、本文から外す
- 並び順（`menu_order`）をファイル名順に 1 から振る

取り込んだあと、**並び順プラグインで 1〜25 を並べ直す**。
グループも通し番号も大きいカードも、そこから自動で決まる。

---

## 5. ファイルの見取り図

```
functions.php          読み込み・VOICE のデータ出力・本文の包み
inc/
  helpers.php          並び順 → グループ / 通し番号 / 大きいカード
  post-types.php       story の登録・管理画面の列
  acf-fields.php       ACF のフィールド定義（PHP で持つ）
  blocks.php           ブロック登録・コアブロックへのクラス付与
  meta.php             canonical / OGP / タイトル
header.php footer.php
front-page.php         TOP。Hero ＋ VOICE の器
single-story.php       記事
page.php               CONTACT / ポリシー
parts/
  hero.php             Hero のマークアップ（静的サイトから移設）
  closing.php          締めのメッセージ（2カラム）
blocks/
  qa/                  質問・回答
  photo-band/          写真の帯
```

---

## 6. 本文の書き方

使えるブロックは5つに絞ってある（それ以外は CSS が当たらず崩れるため）。

| 内容 | ブロック |
|---|---|
| 章見出し | 見出し（H2） |
| 地の文 | 段落 |
| 質問・回答 | **質問・回答**（ツールバーで Q / A を切り替え） |
| 単独の写真 | 画像（本文に回り込む。出てくる順に右・左と交互） |
| 連続した写真 | **写真の帯**（2枚以上で流れる。1枚なら単独写真になる） |

末尾の応援メッセージは本文ではなく、投稿画面下の
**「締めのメッセージ」**（見出し・本文・写真）に入れる。

---

## 7. 静的サイトとの違い

WP へ移すことで解ける制限：

| 静的サイト | WP |
|---|---|
| 記事ごとの OGP が出せない（クローラが JS を実行しないため全記事が共通カード） | slug ごとに `<head>` へ静的出力 |
| `entry.html?slug=xxx` | `/story/{slug}/` |
| `entry.html` が `noindex` | 記事ごとに `index` |
| 更新に `tools/gen-data.mjs` の実行が必要 | 管理画面で完結 |

そのまま残るもの（DOM に対して動くだけなので手を入れていない）：

- Hero の演出一式
- VOICE のカルーセル
- パララックス・フェードイン・ハンバーガー

---

## 8. 未着手

- **CONTACT のフォーム** — 送信先が未定。`page.php` の本文にフォーム
  プラグインのショートコードを置く想定
- **`noindex`** — 公開方針が決まり次第、`inc/meta.php` で出し分ける
- **記事の本文** — 中身は宮崎のまま。静岡の原稿に差し替える
