/**
 * data/*.json（編集する側）から data/*.js（ブラウザが読む側）を生成する。
 *
 *   node tools/gen-data.mjs
 *
 * file:// で開いたときブラウザは fetch を拒否するため、
 * 実行時は JSON ではなく script タグで読める .js を使っている。
 * JSON を書き換えたら必ずこれを流し直すこと。
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const banner = '/* 自動生成ファイル。編集しないこと（元: %s / 生成: node tools/gen-data.mjs） */\n';

function read(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

/* 一覧 */
const entries = read('data/entries.json');
writeFileSync(
  join(root, 'data/entries.js'),
  banner.replace('%s', 'data/entries.json') +
  'window.FL_ENTRIES = ' + JSON.stringify(entries) + ';\n',
);

/* 記事（1本ずつ。記事ページは該当する1ファイルだけ読み込む） */
const dir = join(root, 'data/articles');
mkdirSync(dir, { recursive: true });

const slugs = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
for (const slug of slugs) {
  const article = read(join('data/articles', slug + '.json'));
  writeFileSync(
    join(dir, slug + '.js'),
    banner.replace('%s', 'data/articles/' + slug + '.json') +
    'window.FL_ARTICLE = window.FL_ARTICLE || {};\n' +
    'window.FL_ARTICLE[' + JSON.stringify(slug) + '] = ' + JSON.stringify(article) + ';\n',
  );
}

console.log('generated: data/entries.js and ' + slugs.length + ' article files');
