#!/usr/bin/env node
/**
 * Build script to minify JS/CSS and assemble dist folder
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = join(__dirname, 'dist');

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function buildJS(entry, outFile) {
  await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    outfile: outFile,
    format: 'iife',
    target: 'es2020',
    legalComments: 'none',
  });
}

async function minifyCSS(inputFile, outputFile) {
  const cssContent = readFileSync(inputFile, 'utf-8');
  await build({
    stdin: {
      contents: cssContent,
      loader: 'css',
      resolveDir: __dirname,
    },
    bundle: false,
    minify: true,
    outfile: outputFile,
    write: true,
  });
}

async function copyFile(file) {
  const content = readFileSync(file, 'utf-8');
  writeFileSync(join(distDir, file), content);
}

async function runBuild() {
  try {
    console.log('Starting build...');
    ensureDir(distDir);

    await buildJS('content.js', join(distDir, 'content.js'));
    await buildJS('options.js', join(distDir, 'options.js'));
    await buildJS('popup.js', join(distDir, 'popup.js'));
    await buildJS('background.js', join(distDir, 'background.js'));

    await minifyCSS('content.css', join(distDir, 'content.css'));
    await minifyCSS('options.css', join(distDir, 'options.css'));
    await minifyCSS('popup.css', join(distDir, 'popup.css'));

    await copyFile('manifest.json');
    await copyFile('options.html');
    await copyFile('popup.html');

    const iconsDir = join(distDir, 'icons');
    ensureDir(iconsDir);
    cpSync('icons', iconsDir, { recursive: true });

    console.log('✓ Build complete! Output in dist/');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

runBuild();
