#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const iconPng = join(rootDir, 'build', 'icon.png');
const iconIcns = join(rootDir, 'build', 'icon.icns');

// Check if source icon exists
if (!existsSync(iconPng)) {
  console.error('Error: Source icon build/icon.png not found.');
  process.exit(1);
}

// On non-macOS, just verify icons exist (they should be committed)
if (platform() !== 'darwin') {
  if (existsSync(iconIcns)) {
    console.log('Skipping icon generation on non-macOS (icons already exist).');
    process.exit(0);
  } else {
    console.warn('Warning: icon.icns not found. macOS-specific icons cannot be generated on this platform.');
    console.warn('Please generate icons on macOS or commit them to the repository.');
    process.exit(0); // Don't fail the build
  }
}

// On macOS, run the shell script
console.log('Generating icons on macOS...');
try {
  execSync('bash scripts/generate-icons.sh', {
    cwd: rootDir,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Failed to generate icons:', error.message);
  process.exit(1);
}
