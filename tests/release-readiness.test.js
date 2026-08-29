'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('release runtime uses a supported pinned Electron line', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.devDependencies.electron, '43.4.1');
});

test('Windows x64 package excludes foreign ONNX Runtime binaries', () => {
  const pkg = JSON.parse(read('package.json'));
  const excluded = '!node_modules/onnxruntime-node/bin/**/*';
  const included = 'node_modules/onnxruntime-node/bin/napi-v6/win32/x64/**/*';

  assert.deepEqual(pkg.build.asarUnpack, [
    'scripts/**/*',
    'assets/**/*',
    included
  ]);
  assert.ok(pkg.build.files.indexOf(excluded) >= 0, 'foreign ONNX binaries must be excluded');
  assert.ok(
    pkg.build.files.indexOf(included) > pkg.build.files.indexOf(excluded),
    'the Windows x64 runtime must be re-included after the broad exclusion'
  );
  assert.ok(!pkg.build.files.includes('docs/**/*'), 'repository documentation must not inflate the executable');
  assert.ok(pkg.build.files.includes('!scripts/**/__pycache__/**'));
  assert.ok(pkg.build.files.includes('!scripts/**/*.pyc'));
});

test('public documentation describes the portable release rather than developer setup', () => {
  const readme = read('README.md');
  const englishReadme = read('README.en.md');
  const japaneseReadme = read('README.ja.md');
  const knownIssues = read('docs/KNOWN_ISSUES.md');

  assert.match(readme, /## 下载/);
  assert.match(readme, /不需要另外安装 Node\.js、Python/);
  assert.match(readme, /70%–150%/);
  assert.doesNotMatch(readme, /在 70%–130% 间切换/);
  assert.match(englishReadme, /## Download/);
  assert.match(englishReadme, /README\.ja\.md/);
  assert.match(japaneseReadme, /## ダウンロード/);
  assert.match(japaneseReadme, /README\.en\.md/);
  assert.match(knownIssues, /Windows 10 或 Windows 11 的 64 位版本/);
});

test('all localized landing pages keep valid repository-local links and screenshots', () => {
  for (const relativePath of ['README.md', 'README.en.md', 'README.ja.md', 'docs/ARCHITECTURE.md']) {
    const markdown = read(relativePath);
    const sourceDir = path.dirname(path.join(root, relativePath));
    const references = [
      ...markdown.matchAll(/\]\(([^)#]+)(?:#[^)]+)?\)/g),
      ...markdown.matchAll(/(?:src|href)="([^"#]+)(?:#[^"]+)?"/g)
    ].map((match) => match[1]);

    for (const reference of references) {
      if (/^(?:https?:|mailto:|\.\.\/\.\.\/)/i.test(reference)) continue;
      assert.ok(
        fs.existsSync(path.resolve(sourceDir, reference)),
        `${relativePath} contains a missing local reference: ${reference}`
      );
    }
  }
});

test('public repository ignores development-only capture directories', () => {
  const ignored = new Set(
    read('.gitignore')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );

  for (const pattern of ['artifacts/', 'backups/', 'qa/', 'work/', 'tmp-*.png', '__pycache__/', '*.py[cod]']) {
    assert.ok(ignored.has(pattern), `missing .gitignore entry: ${pattern}`);
  }
});

test('README screenshot set is present in the repository', () => {
  for (const name of [
    'trance-poster.png',
    'dubstep-poster.png',
    'electro-house-capsule.png',
    'neurofunk-capsule.png'
  ]) {
    assert.ok(fs.existsSync(path.join(root, 'docs', 'screenshots', name)), `missing screenshot: ${name}`);
  }
});

test('GitHub CI reproduces the Windows release checks', () => {
  assert.ok(fs.existsSync(path.join(root, '.github', 'workflows', 'windows-release-check.yml')));
  const workflow = read('.github/workflows/windows-release-check.yml');

  for (const command of ['npm ci', 'npm test', 'npm audit --audit-level=high', 'npm run dist']) {
    assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.ok(fs.existsSync(path.join(root, 'SECURITY.md')));
});
