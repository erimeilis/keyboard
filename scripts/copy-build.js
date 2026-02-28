import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const buildDir = resolve(root, 'build');
const bundleDir = resolve(root, 'src-tauri/target/release/bundle');

// Clean previous build
if (existsSync(buildDir)) {
  rmSync(buildDir, { recursive: true });
}
mkdirSync(buildDir, { recursive: true });

// Copy .app bundle
const appSrc = resolve(bundleDir, 'macos');
if (existsSync(appSrc)) {
  cpSync(appSrc, buildDir, { recursive: true });
  console.log('Copied .app bundle to build/');
}

// Copy .dmg
const dmgDir = resolve(bundleDir, 'dmg');
if (existsSync(dmgDir)) {
  cpSync(dmgDir, buildDir, { recursive: true });
  console.log('Copied .dmg to build/');
}

console.log('Build artifacts available in build/');
