import { mkdtemp, readFile, mkdir, rename, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const extension = path.join(root, 'extension');
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version)) throw new Error('Invalid manifest version');

// Explicit runtime files keep source, tests, credentials and OS metadata out of the ZIP.
const files = [
  'manifest.json', 'background.js', 'popup.html', 'popup.js',
  'icons/icon-16.png', 'icons/icon-32.png', 'icons/icon-48.png', 'icons/icon-128.png',
];
const dist = path.join(root, 'dist');
await mkdir(dist, { recursive: true });
const temporary = await mkdtemp(path.join(dist, '.package-'));
const archive = path.join(temporary, 'extension.zip');
const output = path.join(dist, `chrome-auto-group-${manifest.version}.zip`);
try {
  // A fresh archive avoids retaining obsolete files from a previous release.
  execFileSync('zip', ['-X', '-MM', '-q', archive, ...files], { cwd: extension, stdio: 'inherit' });
  await rename(archive, output);
  console.log(path.relative(root, output));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
