#!/usr/bin/env node

import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Ensure directories exist
const distRendererDir = join(rootDir, 'dist', 'renderer');
const distStylesDir = join(rootDir, 'dist', 'renderer', 'styles');

mkdirSync(distStylesDir, { recursive: true });

// Copy files
const files = [
  { src: 'src/renderer/index.html', dest: 'dist/renderer/index.html' },
  { src: 'src/renderer/styles/main.css', dest: 'dist/renderer/styles/main.css' },
];

for (const { src, dest } of files) {
  const srcPath = join(rootDir, src);
  const destPath = join(rootDir, dest);

  if (!existsSync(srcPath)) {
    console.error(`Error: Source file ${src} not found.`);
    process.exit(1);
  }

  copyFileSync(srcPath, destPath);
  console.log(`Copied ${src} -> ${dest}`);
}

console.log('Assets copied successfully.');
