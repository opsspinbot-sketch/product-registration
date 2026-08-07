import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const itemsToCopy = [
  'index.html',
  'admin.html',
  'profile.html',
  'add-product.html',
  'step2-product.html',
  'step3-details.html',
  'success.html',
  'registration-details.html',
  'css',
  'js',
  'images',
  'assets'
];

for (const item of itemsToCopy) {
  const src = path.join(root, item);
  const dest = path.join(publicDir, item);

  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true, force: true });
    console.log(`Copied ${item} -> public/${item}`);
  }
}

console.log('Build complete: static assets synced to public/');
