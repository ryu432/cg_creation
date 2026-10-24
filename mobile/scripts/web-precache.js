// Web 版を書き出したあとに実行する（node scripts/web-precache.js dist）。
// - 書き出したファイルの一覧を precache.json に書く（サービスワーカーが最初に全部保存して、開いたことのない画面もオフラインで開けるように）
// - sw.js の __BUILD_ID__ を今回の中身から作った値に置き換える（sw.js が変わると、ブラウザが新しい版を入れ直す）
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2] ?? 'dist');
const skip = new Set(['index.html', 'sw.js', 'precache.json', 'metadata.json']);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(dist)
  .map((file) => path.relative(dist, file).split(path.sep).join('/'))
  .filter((file) => !skip.has(file))
  .sort();

const hash = crypto.createHash('sha256');
for (const file of files) hash.update(file).update(fs.readFileSync(path.join(dist, file)));
hash.update(fs.readFileSync(path.join(dist, 'index.html')));
const buildId = hash.digest('hex').slice(0, 12);

fs.writeFileSync(path.join(dist, 'precache.json'), JSON.stringify(files.map((file) => '/' + file)));
const swPath = path.join(dist, 'sw.js');
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replaceAll('__BUILD_ID__', buildId));
console.log(`precache: ${files.length} files, build ${buildId}`);
